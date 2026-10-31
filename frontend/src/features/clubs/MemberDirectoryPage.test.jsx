import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import membershipsReducer from './membershipsSlice'
import MemberDirectoryPage from './MemberDirectoryPage'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

function renderWithProviders(ui, { initialState } = {}) {
  const store = configureStore({
    reducer: {
      memberships: membershipsReducer,
      auth: (state = { user: null }) => state,
    },
    preloadedState: initialState,
  })
  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/clubs/club-1/members']}>
          <Routes>
            <Route path="/clubs/:clubId/members" element={ui} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('MemberDirectoryPage', () => {
  it('allows normal students to view member directory in read-only mode without management controls', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/pending')) return Promise.resolve({ data: [] })
      return Promise.resolve({
        data: [
          { id: 'm1', userId: 'other-user', userName: 'Alice', clubName: 'Tech Club', position: 'PRESIDENT', status: 'APPROVED' },
          { id: 'm2', userId: 'student-1', userName: 'Normal Student', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
        ],
      })
    })

    renderWithProviders(<MemberDirectoryPage />, {
      initialState: {
        auth: { user: { id: 'student-1', name: 'Normal Student', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByText(/member directory/i)).toBeInTheDocument()
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(await screen.findByText('Normal Student')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /invite members/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getAllByText('Read-only').length).toBeGreaterThan(0)
    expect(axios.get).not.toHaveBeenCalledWith('/clubs/club-1/members/pending')
  })

  it('allows access for club president and displays member directory', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/pending')) return Promise.resolve({ data: [] })
      return Promise.resolve({
        data: [
          { id: 'm1', userId: 'pres-1', userName: 'President Bob', clubName: 'Tech Club', position: 'PRESIDENT', status: 'APPROVED' },
          { id: 'm2', userId: 'student-1', userName: 'Charlie', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
        ],
      })
    })

    renderWithProviders(<MemberDirectoryPage />, {
      initialState: {
        auth: { user: { id: 'pres-1', name: 'President Bob', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByText(/member directory/i)).toBeInTheDocument()
    expect(await screen.findByText('President Bob')).toBeInTheDocument()
    expect(await screen.findByText('Charlie')).toBeInTheDocument()
  })

  it('allows access for Faculty Advisor in observer mode and does not call members/pending', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/clubs') {
        return Promise.resolve({ data: [{ id: 'club-1', name: 'Tech Club' }] })
      }
      return Promise.resolve({
        data: [
          { id: 'm1', userId: 'pres-1', userName: 'President Bob', clubName: 'Tech Club', position: 'PRESIDENT', status: 'APPROVED' },
          { id: 'm2', userId: 'student-1', userName: 'Charlie', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
        ],
      })
    })

    renderWithProviders(<MemberDirectoryPage />, {
      initialState: {
        auth: { user: { id: 'advisor-1', name: 'Advisor Smith', role: 'FACULTY_ADVISOR' } },
      },
    })

    expect(await screen.findByText(/member directory/i)).toBeInTheDocument()
    expect(await screen.findByText('President Bob')).toBeInTheDocument()
    expect(await screen.findByText('Charlie')).toBeInTheDocument()
    // Verify observer read-only indicator is present and pending endpoint is never hit
    expect(screen.getAllByText('Read-only').length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /invite members/i })).not.toBeInTheDocument()
    expect(axios.get).not.toHaveBeenCalledWith('/clubs/club-1/members/pending')
  })

  it('allows Super Admin to remove the President', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const axios = (await import('../../api/axios')).default
    axios.delete.mockResolvedValue({})
    axios.get.mockImplementation((url) => {
      if (url === '/clubs') {
        return Promise.resolve({ data: [{ id: 'club-1', name: 'Tech Club' }] })
      }
      if (url.includes('/pending')) return Promise.resolve({ data: [] })
      return Promise.resolve({
        data: [
          { id: 'm1', userId: 'pres-1', userName: 'President Bob', clubName: 'Tech Club', position: 'PRESIDENT', status: 'APPROVED' },
          { id: 'm2', userId: 'student-1', userName: 'Charlie', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
        ],
      })
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithProviders(<MemberDirectoryPage />, {
      initialState: {
        auth: { user: { id: 'admin-1', name: 'Super Admin', role: 'SUPER_ADMIN' } },
      },
    })

    expect(await screen.findByText(/member directory/i)).toBeInTheDocument()
    expect(await screen.findByText('President Bob')).toBeInTheDocument()

    const removePresBtn = screen.getByTitle('Remove President')
    expect(removePresBtn).toBeInTheDocument()

    fireEvent.click(removePresBtn)

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Remove President President Bob from the club? This will vacate the presidency.')
    )
    expect(axios.delete).toHaveBeenCalledWith('/memberships/m1')
    confirmSpy.mockRestore()
  })

  it('enforces single president policy by disallowing President role in batch change modal', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/clubs') {
        return Promise.resolve({ data: [{ id: 'club-1', name: 'Tech Club' }] })
      }
      if (url.includes('/pending')) return Promise.resolve({ data: [] })
      return Promise.resolve({
        data: [
          { id: 'm1', userId: 'pres-1', userName: 'President Bob', clubName: 'Tech Club', position: 'PRESIDENT', status: 'APPROVED' },
          { id: 'm2', userId: 'student-1', userName: 'Charlie', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
          { id: 'm3', userId: 'student-2', userName: 'David', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
        ],
      })
    })

    renderWithProviders(<MemberDirectoryPage />, {
      initialState: {
        auth: { user: { id: 'admin-1', name: 'Super Admin', role: 'SUPER_ADMIN' } },
      },
    })

    expect(await screen.findByText(/member directory/i)).toBeInTheDocument()

    // Select all members to trigger batch bar
    const selectAllCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(selectAllCheckbox)

    // Click "Change Role" in batch toolbar
    const changePositionBatchBtn = await screen.findByRole('button', { name: /change role/i })
    fireEvent.click(changePositionBatchBtn)

    // Modal opens - verify the Single President Policy explanation appears
    expect(await screen.findByText(/A club can only have one President. The President role cannot be assigned in bulk./i)).toBeInTheDocument()

    // PRESIDENT option should NOT exist in the batch select dropdown inside the modal
    const dialog = screen.getByRole('dialog')
    const selectDropdown = dialog.querySelector('select')
    const options = Array.from(selectDropdown.querySelectorAll('option')).map((o) => o.value)
    expect(options).not.toContain('PRESIDENT')
  })

  it('hides Export Data button for normal student', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/clubs') {
        return Promise.resolve({ data: [{ id: 'club-1', name: 'Tech Club' }] })
      }
      return Promise.resolve({
        data: [
          { id: 'm1', userId: 'pres-1', userName: 'President Bob', clubName: 'Tech Club', position: 'PRESIDENT', status: 'APPROVED' },
          { id: 'm2', userId: 'student-1', userName: 'Charlie', clubName: 'Tech Club', position: 'MEMBER', status: 'APPROVED' },
        ],
      })
    })

    renderWithProviders(<MemberDirectoryPage />, {
      initialState: {
        auth: { user: { id: 'student-1', name: 'Charlie', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByText(/member directory/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export data/i })).not.toBeInTheDocument()
  })
})

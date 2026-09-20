import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import UserManagementPage from './UserManagementPage'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))

const ME = { id: 'u-admin', name: 'Admin', role: 'SUPER_ADMIN' }

const USERS = [
  { id: 'u-admin', name: 'Admin', email: 'admin@example.com', role: 'SUPER_ADMIN', active: true, emailVerified: true, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u-sam', name: 'Sam Student', email: 'sam@example.com', role: 'STUDENT', active: true, emailVerified: true, createdAt: '2026-02-01T00:00:00Z' },
  { id: 'u-gone', name: 'Gone User', email: 'gone@example.com', role: 'STUDENT', active: false, emailVerified: false, createdAt: '2026-03-01T00:00:00Z' },
]

function renderPage() {
  const store = configureStore({ reducer: { auth: (state = { user: ME }) => state } })
  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter>
          <UserManagementPage />
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

let api
beforeEach(async () => {
  api = (await import('../../api/axios')).default
  vi.clearAllMocks()
  api.get.mockResolvedValue({ data: USERS, headers: { 'x-total-count': '3' } })
})

describe('UserManagementPage', () => {
  it('lists users with their role and deactivated status', async () => {
    renderPage()

    expect(await screen.findByText('Sam Student')).toBeInTheDocument()
    expect(screen.getByText('Gone User')).toBeInTheDocument()
    expect(screen.getByText('Deactivated')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { page: 0, size: 20 } })
  })

  it('does not let the admin deactivate their own account', async () => {
    renderPage()
    await screen.findByText('Sam Student')

    expect(screen.getByRole('button', { name: 'Deactivate Admin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Deactivate Sam Student' })).toBeEnabled()
  })

  it('asks for confirmation before deactivating a user', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    api.post.mockResolvedValue({ data: {} })
    renderPage()
    await screen.findByText('Sam Student')

    await user.click(screen.getByRole('button', { name: 'Deactivate Sam Student' }))
    expect(api.post).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Deactivate Sam Student' }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/users/u-sam/deactivate'))
    confirm.mockRestore()
  })

  it('reactivates a deactivated user', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: {} })
    renderPage()
    await screen.findByText('Gone User')

    await user.click(screen.getByRole('button', { name: 'Reactivate Gone User' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/admin/users/u-gone/activate'))
  })

  it('creates a user with the chosen role', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValue({ data: {} })
    renderPage()
    await screen.findByText('Sam Student')

    await user.click(screen.getByRole('button', { name: /new user/i }))
    await user.type(screen.getByLabelText('Name'), 'Dr. Advisor')
    await user.type(screen.getByLabelText('Email'), 'advisor@example.com')
    await user.type(screen.getByLabelText('Temporary password'), 'password123')
    await user.selectOptions(screen.getByLabelText('Role'), 'FACULTY_ADVISOR')
    await user.click(screen.getByRole('button', { name: 'Create user' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/users', {
        name: 'Dr. Advisor',
        email: 'advisor@example.com',
        password: 'password123',
        role: 'FACULTY_ADVISOR',
      }),
    )
  })

  it('changes a user role from the edit dialog', async () => {
    const user = userEvent.setup()
    api.put.mockResolvedValue({ data: {} })
    renderPage()
    await screen.findByText('Sam Student')

    await user.click(screen.getByRole('button', { name: 'Edit Sam Student' }))
    await user.selectOptions(screen.getByLabelText('Role'), 'FACULTY_ADVISOR')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/admin/users/u-sam', {
        name: 'Sam Student',
        email: 'sam@example.com',
        role: 'FACULTY_ADVISOR',
      }),
    )
  })

  it('locks the role selector when editing yourself', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('Sam Student')

    await user.click(screen.getByRole('button', { name: 'Edit Admin' }))

    expect(screen.getByLabelText('Role')).toBeDisabled()
  })

  it('shows the server error when loading fails', async () => {
    api.get.mockRejectedValue({ response: { data: { message: 'Forbidden' } } })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  })
})

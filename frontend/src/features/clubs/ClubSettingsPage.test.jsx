import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import ClubSettingsPage from './ClubSettingsPage'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}))

function renderWithProviders(ui, { initialState } = {}) {
  const store = configureStore({
    reducer: {
      auth: (state = { user: null }) => state,
    },
    preloadedState: initialState,
  })
  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/clubs/c1/settings']}>
          <Routes>
            <Route path="/clubs/:clubId/settings" element={ui} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('ClubSettingsPage', () => {
  it('renders Club Settings page with parameters form and platform live preview for officers', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/memberships/me')) {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Photography Club', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1/members')) {
        return Promise.resolve({
          data: [{ id: 'm1', userId: 'dave-1', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1')) {
        return Promise.resolve({
          data: {
            id: 'c1',
            name: 'Photography Club',
            category: 'Arts & Culture',
            description: 'Capturing campus moments through lens and creativity since 2018.',
            logoB64: null,
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<ClubSettingsPage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'Dave', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: /club settings/i })).toBeInTheDocument()
    expect(await screen.findByText(/club profile parameters/i)).toBeInTheDocument()
    expect(await screen.findByText(/platform live preview/i)).toBeInTheDocument()
    expect(await screen.findByText(/save profile configuration/i)).toBeInTheDocument()
  })

  it('renders Send Announcement section when Announcements & Alerts tab is clicked by an officer', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/memberships/me')) {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Photography Club', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1/members')) {
        return Promise.resolve({
          data: [{ id: 'm1', userId: 'dave-1', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/announcements')) {
        return Promise.resolve({
          data: [
            {
              id: 'a1',
              authorName: 'Sarah Jenkins',
              content: 'Welcome everyone to the new semester!',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }
      if (url.includes('/clubs/c1')) {
        return Promise.resolve({
          data: {
            id: 'c1',
            name: 'Photography Club',
            category: 'Arts & Culture',
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    const { userEvent } = await import('@testing-library/user-event')
    const userEv = userEvent.setup()

    renderWithProviders(<ClubSettingsPage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'Dave', role: 'STUDENT' } },
      },
    })

    const announcementsTab = await screen.findByRole('button', { name: /announcements & alerts/i })
    await userEv.click(announcementsTab)

    expect(await screen.findByRole('heading', { level: 2, name: /send club announcement/i })).toBeInTheDocument()
    expect(await screen.findByPlaceholderText(/type your announcement message here/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /broadcast announcement/i })).toBeInTheDocument()
    expect(await screen.findByText(/welcome everyone to the new semester!/i)).toBeInTheDocument()
  })

  it('restricts access for normal students without a leadership role', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/memberships/me')) {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Photography Club', position: 'MEMBER', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1/members')) {
        return Promise.resolve({
          data: [{ id: 'm1', userId: 'dave-1', position: 'MEMBER', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1')) {
        return Promise.resolve({
          data: {
            id: 'c1',
            name: 'Photography Club',
            category: 'Arts & Culture',
            description: 'Capturing campus moments through lens and creativity since 2018.',
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<ClubSettingsPage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'Dave', role: 'STUDENT' } },
      },
    })

    // Header displays restricted access notice
    expect(await screen.findByRole('heading', { level: 1, name: /club leadership only/i })).toBeInTheDocument()
    expect(screen.getByText(/the club settings section is reserved for club leadership positions/i)).toBeInTheDocument()

    // Form and parameters should not be accessible
    expect(screen.queryByText(/club profile parameters/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save profile configuration/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /announcements & alerts/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /roles & permissions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /privacy & access/i })).not.toBeInTheDocument()
  })

  it('keeps Announcements & Alerts, Roles & Permissions, and Privacy & Access accessible for club officers (VP, Secretary, Treasurer)', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/memberships/me')) {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Photography Club', position: 'VP', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1/members')) {
        return Promise.resolve({
          data: [
            { id: 'm1', userId: 'officer-1', position: 'VP', status: 'APPROVED' },
            { id: 'm2', userId: 'pres-1', position: 'PRESIDENT', status: 'APPROVED' },
          ],
        })
      }
      if (url.includes('/clubs/c1')) {
        return Promise.resolve({
          data: {
            id: 'c1',
            name: 'Photography Club',
            category: 'Arts & Culture',
            description: 'Capturing campus moments through lens and creativity since 2018.',
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<ClubSettingsPage />, {
      initialState: {
        auth: { user: { id: 'officer-1', name: 'Officer Olivia', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: /club settings/i })).toBeInTheDocument()

    // All 4 tabs MUST be present and accessible for officer roles
    expect(await screen.findByRole('button', { name: /^profile$/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /announcements & alerts/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /roles & permissions/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /privacy & access/i })).toBeInTheDocument()

    // Profile input is editable for officers
    const clubNameInput = screen.getByDisplayValue('Photography Club')
    expect(clubNameInput).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /save profile configuration/i })).toBeInTheDocument()
  })

  it('allows President to configure and toggle member budget visibility under Privacy & Access settings', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/memberships/me')) {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Photography Club', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1/members')) {
        return Promise.resolve({
          data: [{ id: 'm1', userId: 'dave-1', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/clubs/c1')) {
        return Promise.resolve({
          data: {
            id: 'c1',
            name: 'Photography Club',
            category: 'Arts & Culture',
            showBudgetToMembers: false,
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    const { userEvent } = await import('@testing-library/user-event')
    const userEv = userEvent.setup()

    renderWithProviders(<ClubSettingsPage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'Dave President', role: 'STUDENT' } },
      },
    })

    const privacyTab = await screen.findByRole('button', { name: /privacy & access/i })
    await userEv.click(privacyTab)

    expect(await screen.findByText(/club budget & financial ledger visibility/i)).toBeInTheDocument()
    expect(screen.getByText(/hidden from members/i)).toBeInTheDocument()
    expect(screen.getByText(/visible to club members/i)).toBeInTheDocument()

    const visibleOption = screen.getByLabelText(/visible to club members/i)
    await userEv.click(visibleOption)

    const saveButton = screen.getByRole('button', { name: /save privacy & access settings/i })
    await userEv.click(saveButton)

    expect(axios.put).toHaveBeenCalledWith(
      '/clubs/c1',
      expect.objectContaining({ showBudgetToMembers: true }),
    )
  })

  it('removes Roles & Permissions and Privacy & Access tabs for Super Admin in Club Settings', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url.includes('/clubs/c1')) {
        return Promise.resolve({
          data: {
            id: 'c1',
            name: 'Photography Club',
            category: 'Arts & Culture',
            description: 'Capturing campus moments through lens and creativity since 2018.',
          },
        })
      }
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Photography Club' }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<ClubSettingsPage />, {
      initialState: {
        auth: { user: { id: 'admin-1', name: 'Super Admin', role: 'SUPER_ADMIN' } },
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: /club settings/i })).toBeInTheDocument()

    // Profile and Announcements & Alerts tabs must be visible
    expect(await screen.findByRole('button', { name: /^profile$/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /announcements & alerts/i })).toBeInTheDocument()

    // Roles & Permissions and Privacy & Access must be removed for Super Admin
    expect(screen.queryByRole('button', { name: /roles & permissions/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /privacy & access/i })).not.toBeInTheDocument()
  })
})

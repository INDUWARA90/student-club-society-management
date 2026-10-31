import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import ClubDetailPage from './ClubDetailPage'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

function renderDetailPage(clubId, user) {
  const store = configureStore({
    reducer: {
      auth: () => ({ user }),
      clubs: () => ({ items: [], status: 'succeeded' }),
    },
  })

  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/clubs/${clubId}`]}>
          <Routes>
            <Route path="/clubs/:clubId" element={<ClubDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('ClubDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleClub = {
    id: 'club-fa-1',
    name: 'Robotics & AI Society',
    description: 'Autonomous exploration and machine learning.',
    category: 'TECH',
    status: 'APPROVED',
    joinPolicy: 'OPEN',
    membershipFee: 0,
    memberCount: 25,
  }

  it('renders successfully for Faculty Advisor with Faculty Oversight badge and does not call members/pending', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-fa-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-fa-1/members') return Promise.resolve({ data: [] })
      if (url === '/clubs/club-fa-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-fa-1') return Promise.resolve({ data: null })
      return Promise.resolve({ data: [] })
    })

    const advisorUser = {
      id: 'adv-99',
      name: 'Dr. Faculty Advisor',
      email: 'advisor@university.edu',
      role: 'FACULTY_ADVISOR',
    }

    renderDetailPage('club-fa-1', advisorUser)

    // Assert club header and Faculty Oversight badge (renders Shield without ReferenceError)
    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()
    expect(screen.getByText('Faculty Oversight')).toBeInTheDocument()

    // Assert Faculty Advisor can watch members via Members tab
    expect(screen.getByRole('tab', { name: /^members/i })).toBeInTheDocument()

    // Assert members/pending was NEVER called for faculty advisor (preventing 403 Forbidden)
    expect(api.get).not.toHaveBeenCalledWith('/clubs/club-fa-1/members/pending')
  })

  it('renders successfully for Super Admin with System Administrator badge and can create events', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-sa-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-sa-1/members') return Promise.resolve({ data: [] })
      if (url === '/clubs/club-sa-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-sa-1') return Promise.resolve({ data: null })
      if (url === '/clubs/club-sa-1/members/pending') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    const adminUser = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    renderDetailPage('club-sa-1', adminUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()
    // Verify System Administrator badge is displayed
    expect(screen.getByText('System Administrator')).toBeInTheDocument()

    // Verify Super Admin can watch members via Members tab
    expect(screen.getByRole('tab', { name: /^members/i })).toBeInTheDocument()

    // Verify Super Admin cannot join or see Join Club button
    expect(screen.queryByRole('button', { name: /join club/i })).not.toBeInTheDocument()

    // Verify Super Admin has budget tab and fetches expense ledger
    expect(await screen.findByRole('tab', { name: /^budget/i })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/expenses/ledger'))
  })

  it('allows Super Admin to see remove button for President and call delete membership', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const api = (await import('../../api/axios')).default
    const presidentMember = {
      id: 'mem-pres-1',
      userId: 'user-pres',
      userName: 'Alice President',
      userEmail: 'alice@example.com',
      position: 'PRESIDENT',
      status: 'APPROVED',
      joinedAt: '2026-01-01T00:00:00Z',
    }

    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-sa-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-sa-1/members') return Promise.resolve({ data: [presidentMember] })
      if (url === '/clubs/club-sa-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-sa-1') return Promise.resolve({ data: null })
      if (url === '/clubs/club-sa-1/members/pending') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    api.delete.mockResolvedValue({})

    const adminUser = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderDetailPage('club-sa-1', adminUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()

    // Switch to Members tab
    const membersTab = screen.getByRole('tab', { name: /^members/i })
    fireEvent.click(membersTab)

    // President should be listed
    expect(await screen.findByText('Alice President')).toBeInTheDocument()

    // Super Admin should see the remove button for President
    const removeBtn = screen.getByRole('button', { name: 'Remove Alice President' })
    expect(removeBtn).toBeInTheDocument()
    expect(removeBtn).toHaveAttribute('title', 'Remove President from club')

    // Click remove button
    fireEvent.click(removeBtn)

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Remove President Alice President from the club? This will vacate the presidency.')
    )
    expect(api.delete).toHaveBeenCalledWith('/memberships/mem-pres-1')
    confirmSpy.mockRestore()
  })

  it('prompts confirmation when transferring President role to enforce single president policy', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const api = (await import('../../api/axios')).default
    const presidentMember = {
      id: 'mem-pres-1',
      userId: 'user-pres',
      userName: 'Alice President',
      userEmail: 'alice@example.com',
      position: 'PRESIDENT',
      status: 'APPROVED',
      joinedAt: '2026-01-01T00:00:00Z',
    }
    const regularMember = {
      id: 'mem-user-2',
      userId: 'user-2',
      userName: 'Bob Member',
      userEmail: 'bob@example.com',
      position: 'MEMBER',
      status: 'APPROVED',
      joinedAt: '2026-01-02T00:00:00Z',
    }

    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-sa-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-sa-1/members') return Promise.resolve({ data: [presidentMember, regularMember] })
      if (url === '/clubs/club-sa-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-sa-1') return Promise.resolve({ data: null })
      if (url === '/clubs/club-sa-1/members/pending') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    api.put.mockResolvedValue({ data: { ...regularMember, position: 'PRESIDENT' } })

    const adminUser = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderDetailPage('club-sa-1', adminUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()

    // Switch to Members tab
    const membersTab = screen.getByRole('tab', { name: /^members/i })
    fireEvent.click(membersTab)

    expect(await screen.findByText('Bob Member')).toBeInTheDocument()

    // Find the position select dropdown for Bob Member
    const selects = screen.getAllByRole('combobox')
    const bobSelect = selects[1] // second member

    fireEvent.change(bobSelect, { target: { value: 'PRESIDENT' } })

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('A club can only have one President. Setting Bob Member as President will demote Alice President to Member. Proceed with transfer?')
    )
    expect(api.put).toHaveBeenCalledWith('/memberships/mem-user-2/position', { position: 'PRESIDENT' })
    confirmSpy.mockRestore()
  })

  it('does not display Archive Society feature in admin options', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const api = (await import('../../api/axios')).default
    const presidentMember = {
      id: 'mem-pres-1',
      userId: 'user-pres-1',
      userName: 'Alice President',
      userEmail: 'alice@example.com',
      position: 'PRESIDENT',
      status: 'APPROVED',
      joinedAt: '2026-01-01T00:00:00Z',
    }

    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-pres-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-pres-1/members') return Promise.resolve({ data: [presidentMember] })
      if (url === '/clubs/club-pres-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-pres-1') return Promise.resolve({ data: null })
      if (url === '/clubs/club-pres-1/members/pending') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    const presUser = {
      id: 'user-pres-1',
      name: 'Alice President',
      email: 'alice@example.com',
      role: 'STUDENT',
    }

    renderDetailPage('club-pres-1', presUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()

    // Open Admin Menu dropdown
    const adminMenuBtn = screen.getByRole('button', { name: /manage/i })
    fireEvent.click(adminMenuBtn)

    // Archive Society should not exist in the admin menu
    expect(screen.queryByText(/archive society/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/reactivate society/i)).not.toBeInTheDocument()
  })

  it('synchronizes the Budget tab with the full Budget & Finance dashboard and dashboard link', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const api = (await import('../../api/axios')).default
    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-sa-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-sa-1/members') return Promise.resolve({ data: [] })
      if (url === '/clubs/club-sa-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-sa-1') return Promise.resolve({ data: null })
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 8000,
            totalExpenses: 4200,
            balance: 3800,
            expenses: [
              {
                id: 'e1',
                description: '3D Printer Filament',
                amount: 350,
                type: 'EXPENSE',
                category: 'Equipment',
                expenseDate: '2026-10-15',
                loggedByName: 'Alice President',
              },
            ],
            eventBudgets: [],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    const adminUser = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    renderDetailPage('club-sa-1', adminUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()

    // Click Budget tab
    const budgetTab = screen.getByRole('tab', { name: /^budget/i })
    fireEvent.click(budgetTab)

    // Verify it renders the synchronized Budget & Finance dashboard
    expect(await screen.findByText(/total allocated budget/i)).toBeInTheDocument()
    expect(await screen.findByText(/expense history & incomes/i)).toBeInTheDocument()
    expect(await screen.findByText(/3d printer filament/i)).toBeInTheDocument()

    // Verify link to open the full dashboard is present
    const openFullLink = screen.getByRole('link', { name: /open full dashboard/i })
    expect(openFullLink).toBeInTheDocument()
    expect(openFullLink).toHaveAttribute('href', '/clubs/club-sa-1/budget')
  })

  it('does not display Budget tab for normal students without a club position', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-s-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-s-1/members') return Promise.resolve({ data: [] })
      if (url === '/clubs/club-s-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-s-1') return Promise.resolve({ data: null })
      if (url === '/memberships/me') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    const studentUser = {
      id: 'student-1',
      name: 'Normal Student',
      email: 'student@university.edu',
      role: 'STUDENT',
    }

    renderDetailPage('club-s-1', studentUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /^budget/i })).not.toBeInTheDocument()
  })

  it('displays Budget tab for normal student members when showBudgetToMembers is enabled', async () => {
    const api = (await import('../../api/axios')).default
    const publicClub = { ...sampleClub, id: 'club-public-1', showBudgetToMembers: true }
    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-public-1') return Promise.resolve({ data: publicClub })
      if (url === '/clubs/club-public-1/members') {
        return Promise.resolve({
          data: [{ id: 'm-std-1', userId: 'student-1', user: { id: 'student-1', name: 'Normal Student' }, position: 'MEMBER', status: 'APPROVED' }],
        })
      }
      if (url === '/clubs/club-public-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-public-1') return Promise.resolve({ data: null })
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'club-public-1', position: 'MEMBER', status: 'APPROVED' }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    const studentUser = {
      id: 'student-1',
      name: 'Normal Student',
      email: 'student@university.edu',
      role: 'STUDENT',
    }

    renderDetailPage('club-public-1', studentUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: /^budget/i })).toBeInTheDocument()
  })

  it('does not render Create Event button for Super Admin in club details', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockImplementation((url) => {
      if (url === '/clubs/club-sa-1') return Promise.resolve({ data: sampleClub })
      if (url === '/clubs/club-sa-1/members') return Promise.resolve({ data: [] })
      if (url === '/clubs/club-sa-1/announcements') return Promise.resolve({ data: [] })
      if (url === '/events') return Promise.resolve({ data: [] })
      if (url === '/analytics/clubs/club-sa-1') return Promise.resolve({ data: null })
      if (url === '/clubs/club-sa-1/members/pending') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    const adminUser = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    renderDetailPage('club-sa-1', adminUser)

    expect(await screen.findByRole('heading', { name: 'Robotics & AI Society' })).toBeInTheDocument()
    // Super Admin should NOT see Create event button
    expect(screen.queryByRole('button', { name: /create event/i })).not.toBeInTheDocument()
  })
})

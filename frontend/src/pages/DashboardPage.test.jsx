import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../components/ToastProvider'
import DashboardPage from './DashboardPage'

vi.mock('../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

function renderDashboard(user) {
  const store = configureStore({
    reducer: {
      auth: () => ({ user }),
      theme: () => ({ mode: 'light' }),
    },
  })

  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders tailored Faculty Advisor portal, profile card, and pending events approval panel', async () => {
    const api = (await import('../api/axios')).default
    api.get.mockImplementation((url) => {
      if (url === '/memberships/me') return Promise.resolve({ data: [] })
      if (url === '/events') {
        return Promise.resolve({
          data: [
            {
              id: 'e1',
              title: 'Annual Tech Fest',
              eventDate: '2026-12-01T10:00:00Z',
              endDate: '2026-12-01T18:00:00Z',
              cancelled: false,
              venueName: 'Auditorium A',
            },
          ],
        })
      }
      if (url === '/rsvps/me') return Promise.resolve({ data: [] })
      if (url === '/notifications/me') return Promise.resolve({ data: [] })
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Creative Arts Society', category: 'Arts & Culture' }],
        })
      }
      if (url === '/events/pending') {
        return Promise.resolve({
          data: [
            {
              id: 'pe1',
              title: 'National Art Exhibition',
              clubName: 'Creative Arts Society',
              eventDate: '2026-11-20T09:00:00Z',
              fee: 25.0,
              venueName: 'Main Gallery',
              description: 'Exhibition of student artwork across faculties.',
            },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })

    const user = {
      id: 'adv-123',
      name: 'Dr. John Faculty',
      email: 'john.advisor@university.edu',
      role: 'FACULTY_ADVISOR',
    }

    renderDashboard(user)

    // Check Faculty Advisor portal hero banner
    expect(await screen.findByText('Faculty Advisor Portal')).toBeInTheDocument()
    expect(screen.getByText(/welcome back, dr. john faculty! 🎓/i)).toBeInTheDocument()

    // Check Stat Cards for Faculty Advisor
    expect(screen.getByText('Clubs Under Oversight')).toBeInTheDocument()
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument()
    expect(screen.getByText('Scheduled Events')).toBeInTheDocument()
    expect(screen.getAllByText('University Analytics').length).toBeGreaterThanOrEqual(1)

    // Check Events Awaiting Your Approval section
    expect(screen.getByText('Events Awaiting Your Approval')).toBeInTheDocument()
    expect(screen.getByText('National Art Exhibition')).toBeInTheDocument()
    expect(screen.getAllByText('Creative Arts Society').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/fee: \$25\.00/i)).toBeInTheDocument()

    // Check Faculty Advisor profile card in the right column
    expect(screen.getByText('john.advisor@university.edu')).toBeInTheDocument()
    expect(screen.getByText('Active Staff')).toBeInTheDocument()
    expect(screen.getByText('Academic Affairs & Student Clubs')).toBeInTheDocument()
    expect(screen.getByText('Advisor Quick Actions')).toBeInTheDocument()
    expect(screen.getByText('Review Pending Events')).toBeInTheDocument()
  })

  it('allows Faculty Advisor to approve pending events directly from dashboard', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../api/axios')).default

    api.get.mockImplementation((url) => {
      if (url === '/events/pending') {
        return Promise.resolve({
          data: [
            {
              id: 'pe-99',
              title: 'Robotics Workshop',
              clubName: 'Tech Society',
              eventDate: '2026-11-25T14:00:00Z',
              fee: 10.0,
            },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValue({ data: { success: true } })

    const user = {
      id: 'adv-123',
      name: 'Dr. Jane Advisor',
      email: 'jane.advisor@university.edu',
      role: 'FACULTY_ADVISOR',
    }

    renderDashboard(user)

    expect(await screen.findByText('Robotics Workshop')).toBeInTheDocument()

    const approveBtn = screen.getByRole('button', { name: /approve/i })
    await userEventSetup.click(approveBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/pe-99/approve', undefined)
    })
  })

  it('renders executive Super Admin Command Center, event management with CRUD actions, and deletes an event', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../api/axios')).default

    api.get.mockImplementation((url) => {
      if (url === '/events') {
        return Promise.resolve({
          data: [
            {
              id: 'evt-sa-1',
              title: 'Global AI Summit',
              clubName: 'Tech Society',
              eventDate: '2026-11-28T09:00:00Z',
              fee: 0,
              venueName: 'Auditorium 1',
            },
          ],
        })
      }
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'club-1', name: 'Tech Society', category: 'Tech', status: 'APPROVED', memberCount: 42 }],
        })
      }
      if (url === '/audit-logs') {
        return Promise.resolve({
          data: [{ id: 'log-1', actorName: 'Admin', action: 'CREATE_CLUB', createdAt: '2026-10-30T10:00:00Z' }],
        })
      }
      return Promise.resolve({ data: [] })
    })
    api.delete.mockResolvedValue({ data: { success: true } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const adminUser = {
      id: 'admin-01',
      name: 'Super Admin User',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    renderDashboard(adminUser)

    // Check Super Admin Command Center Banner & KPIs
    expect(await screen.findByText('Super Admin Command Center')).toBeInTheDocument()
    expect(screen.getByText(/welcome back, super admin user! ⚡/i)).toBeInTheDocument()
    expect(screen.getByText('Total Societies')).toBeInTheDocument()
    expect(screen.getByText('Campus Events')).toBeInTheDocument()
    expect(screen.getByText('Audit Activity')).toBeInTheDocument()

    // Check Events Management Section with CRUD buttons
    expect(screen.getByText('Campus Events Management')).toBeInTheDocument()
    expect(screen.getByText('Global AI Summit')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^manage$/i }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByRole('button', { name: /^edit$/i }).length).toBeGreaterThanOrEqual(1)

    const deleteBtns = screen.getAllByRole('button', { name: /^delete$/i })
    expect(deleteBtns.length).toBeGreaterThanOrEqual(1)

    // Super Admin should NOT see Create Event or New Event button
    expect(screen.queryByRole('button', { name: /^create event$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^new event$/i })).not.toBeInTheDocument()

    // Click delete event
    await userEventSetup.click(deleteBtns[0])
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/events/evt-sa-1')
    })
  })

  it('renders Advisor Escalations section and allows Faculty Advisor to submit a request to Super Admin', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../api/axios')).default

    api.get.mockImplementation((url) => {
      if (url === '/advisor-requests') {
        return Promise.resolve({
          data: [
            {
              id: 'req-1',
              advisorName: 'Dr. John Faculty',
              clubName: 'Creative Arts Society',
              requestType: 'CLUB_DELETION',
              priority: 'URGENT',
              subject: 'Club misconduct report',
              message: 'Repeated unauthorized events and policy violations.',
              status: 'PENDING',
              createdAt: '2026-10-30T10:00:00Z',
            },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValue({
      data: {
        id: 'req-2',
        advisorName: 'Dr. John Faculty',
        requestType: 'DISCIPLINARY_ACTION',
        priority: 'NORMAL',
        subject: 'General consultation',
        message: 'Looking into board dispute.',
        status: 'PENDING',
        createdAt: '2026-10-30T11:00:00Z',
      },
    })

    const advisorUser = {
      id: 'adv-123',
      name: 'Dr. John Faculty',
      email: 'john.advisor@university.edu',
      role: 'FACULTY_ADVISOR',
    }

    renderDashboard(advisorUser)

    expect(await screen.findByText('Advisor Escalations & Admin Requests')).toBeInTheDocument()
    expect(screen.getByText('Club misconduct report')).toBeInTheDocument()
    expect(screen.getByText(/repeated unauthorized events/i)).toBeInTheDocument()

    // Click "New Request to Admin"
    const newReqBtn = screen.getByRole('button', { name: /new request to admin/i })
    await userEventSetup.click(newReqBtn)

    expect(await screen.findByRole('heading', { name: /submit request to super admin/i })).toBeInTheDocument()

    // Fill form and submit
    const subjectInput = screen.getByPlaceholderText(/recommend club deletion/i)
    const messageInput = screen.getByPlaceholderText(/explain the circumstances/i)

    await userEventSetup.type(subjectInput, 'Disciplinary review needed')
    await userEventSetup.type(messageInput, 'Student executives failing to submit financial statements.')

    const submitBtn = screen.getByRole('button', { name: /send to super admin/i })
    await userEventSetup.click(submitBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/advisor-requests', expect.objectContaining({
        subject: 'Disciplinary review needed',
        message: 'Student executives failing to submit financial statements.',
      }))
    })
  })

  it('allows Super Admin to view advisor escalations and resolve a request', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../api/axios')).default

    api.get.mockImplementation((url) => {
      if (url === '/advisor-requests') {
        return Promise.resolve({
          data: [
            {
              id: 'req-99',
              advisorName: 'Dr. Jane Advisor',
              advisorEmail: 'jane.advisor@university.edu',
              clubName: 'Misbehaving Club',
              clubId: 'c-99',
              requestType: 'CLUB_DELETION',
              priority: 'URGENT',
              subject: 'Recommend dissolution of Misbehaving Club',
              message: 'Severe violation of university safety policies.',
              status: 'PENDING',
              createdAt: '2026-10-30T10:00:00Z',
            },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })
    api.put.mockResolvedValue({
      data: {
        id: 'req-99',
        status: 'RESOLVED',
        adminResponse: 'Reviewed with Dean. Club decommissioned.',
        resolvedByName: 'Super Admin',
      },
    })

    const adminUser = {
      id: 'admin-01',
      name: 'Super Admin',
      email: 'admin@university.edu',
      role: 'SUPER_ADMIN',
    }

    renderDashboard(adminUser)

    expect(await screen.findByText('Advisor Escalations & Disciplinary Reports')).toBeInTheDocument()
    expect(screen.getByText('Recommend dissolution of Misbehaving Club')).toBeInTheDocument()
    expect(screen.getByText('Dr. Jane Advisor')).toBeInTheDocument()

    // Click "Review & Respond"
    const reviewBtn = screen.getByRole('button', { name: /review & respond/i })
    await userEventSetup.click(reviewBtn)

    expect(await screen.findByRole('heading', { name: /review & respond to advisor request/i })).toBeInTheDocument()

    // Type response notes and submit
    const responseInput = screen.getByPlaceholderText(/discussed with student affairs/i)
    await userEventSetup.type(responseInput, 'Approved dissolution. Administrative notice sent.')

    const saveBtn = screen.getByRole('button', { name: /save & send response/i })
    await userEventSetup.click(saveBtn)

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/advisor-requests/req-99/resolve', {
        status: 'RESOLVED',
        adminResponse: 'Approved dissolution. Administrative notice sent.',
      })
    })
  })
})

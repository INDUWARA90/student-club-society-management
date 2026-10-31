import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axios'
import PendingEventsPage from './PendingEventsPage'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

let mockUser = { role: 'FACULTY_ADVISOR' }
vi.mock('react-redux', () => ({
  useSelector: (selector) => selector({ auth: { user: mockUser } }),
}))

const mockShowToast = vi.fn()
vi.mock('../../components/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

const mockEvents = [
  {
    id: 'evt-1',
    clubId: 'club-1',
    clubName: 'Tech Innovators',
    title: 'AI Workshop 2026',
    description: 'Hands-on AI and machine learning workshop.',
    eventDate: '2026-11-10T10:00:00Z',
    endDate: '2026-11-10T13:00:00Z',
    location: 'Auditorium A',
    venueName: 'Main Auditorium',
    capacity: 100,
    fee: 0,
    budget: 500,
    requiresFaApproval: true,
    approvalStatus: 'PENDING',
    cancelled: false,
  },
  {
    id: 'evt-2',
    clubId: 'club-2',
    clubName: 'Creative Arts Society',
    title: 'Spring Art Exhibition',
    description: 'Showcasing student artwork.',
    eventDate: '2026-11-15T14:00:00Z',
    requiresFaApproval: true,
    approvalStatus: 'APPROVED',
    cancelled: false,
  },
  {
    id: 'evt-3',
    clubId: 'club-1',
    clubName: 'Tech Innovators',
    title: 'Hackathon Night',
    description: 'Overnight coding marathon.',
    eventDate: '2026-11-20T18:00:00Z',
    requiresFaApproval: true,
    approvalStatus: 'REJECTED',
    rejectionReason: 'Overnight stay requires special campus security authorization.',
    cancelled: false,
  },
]

describe('PendingEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { role: 'FACULTY_ADVISOR' }
    api.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'club-1', status: 'APPROVED', position: 'PRESIDENT' }],
        })
      }
      return Promise.resolve({ data: mockEvents })
    })
    api.post.mockResolvedValue({ data: { success: true } })
  })

  it('renders advisor oversight heading, counts, and initial pending events', async () => {
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Event Approvals & Decision History')).toBeInTheDocument()
    })

    // Verify stat card labels exist
    expect(screen.getByText('Needs Review')).toBeInTheDocument()
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Not Approved')).toBeInTheDocument()
    expect(screen.getAllByText(/All Decisions/i).length).toBeGreaterThanOrEqual(1)

    // Default tab is PENDING -> AI Workshop is visible, Spring Art Exhibition is not
    expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    expect(screen.getByText('Pending Sign-off')).toBeInTheDocument()
    expect(screen.queryByText('Spring Art Exhibition')).not.toBeInTheDocument()
  })

  it('switches to Approved tab and shows approved events', async () => {
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Approved by Me/i }))

    expect(screen.getByText('Spring Art Exhibition')).toBeInTheDocument()
    expect(screen.getByText('Approved by Advisor')).toBeInTheDocument()
    expect(screen.queryByText('AI Workshop 2026')).not.toBeInTheDocument()
  })

  it('switches to Not Approved / Rejected tab and displays rejection reason feedback', async () => {
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Not Approved \/ Rejected/i }))

    expect(screen.getByText('Hackathon Night')).toBeInTheDocument()
    expect(screen.getAllByText(/Not Approved \/ Rejected/i).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText('Overnight stay requires special campus security authorization.')
    ).toBeInTheDocument()
  })

  it('approves a pending event', async () => {
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    })

    const approveBtn = screen.getByRole('button', { name: /Approve & Publish/i })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/evt-1/approve')
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Event approved successfully'))
    })
  })

  it('opens reject modal and confirms rejection with feedback', async () => {
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    })

    const rejectBtn = screen.getByRole('button', { name: /Reject Event/i })
    fireEvent.click(rejectBtn)

    expect(screen.getByText('Reject Event Proposal')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText(/Explain why this proposal is rejected/i)
    fireEvent.change(textarea, { target: { value: 'Venue capacity issue. Please relocate.' } })

    const confirmBtn = screen.getByRole('button', { name: /Confirm Rejection/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/evt-1/reject', {
        reason: 'Venue capacity issue. Please relocate.',
      })
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Event rejected and feedback sent'))
    })
  })

  it('renders student leadership view without approve/reject action buttons', async () => {
    mockUser = { role: 'STUDENT' }
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Club Event Proposals & Approval Status')).toBeInTheDocument()
    })

    expect(screen.getByText('Club Leadership View')).toBeInTheDocument()
    // Approve & Publish button should NOT be rendered for a student
    expect(screen.queryByRole('button', { name: /Approve & Publish/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Reject Event/i })).not.toBeInTheDocument()
    // Status text should be shown instead
    expect(
      screen.getByText(/awaiting Faculty Advisor review and sign-off/i)
    ).toBeInTheDocument()
  })

  it('handles 403 error cleanly with descriptive access alert and retry', async () => {
    api.get.mockRejectedValue({ response: { status: 403 } })

    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Access restricted. You need Faculty Advisor, Super Admin, or Club Officer permissions/i)
      ).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument()
  })

  it('allows club officer to resubmit a rejected event to advisor', async () => {
    mockUser = { role: 'STUDENT' }
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Not Approved \/ Rejected/i }))

    expect(screen.getByText('Hackathon Night')).toBeInTheDocument()
    expect(screen.getByText('Overnight stay requires special campus security authorization.')).toBeInTheDocument()

    const resendBtn = screen.getByRole('button', { name: /Resend to Advisor/i })
    expect(resendBtn).toBeInTheDocument()
    fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/events/evt-3/resubmit')
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('resubmitted'))
    })
  })

  it('does not show fix and resubmit buttons to faculty advisor on rejected events', async () => {
    mockUser = { role: 'FACULTY_ADVISOR' }
    render(
      <BrowserRouter>
        <PendingEventsPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('AI Workshop 2026')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Not Approved \/ Rejected/i }))

    expect(screen.getByText('Hackathon Night')).toBeInTheDocument()
    expect(screen.getByText('Overnight stay requires special campus security authorization.')).toBeInTheDocument()

    // Faculty Advisor must NOT see Fix & Resubmit or Resend buttons
    expect(screen.queryByRole('button', { name: /Fix & Resubmit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resend to Advisor/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Awaiting revision and resubmission from the Club President/i)).toBeInTheDocument()
  })
})

import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import EventDetailPage from './EventDetailPage'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../api/websocket', () => ({
  subscribeToTopic: vi.fn(() => () => {}),
}))

function renderEventDetailPage(eventId, user) {
  const store = configureStore({
    reducer: {
      auth: () => ({ user }),
    },
  })

  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/events/${eventId}`]}>
          <Routes>
            <Route path="/events/:eventId" element={<EventDetailPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('EventDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleEvent = {
    id: 'event-101',
    clubId: 'club-1',
    clubName: 'Tech Innovators',
    clubCategory: 'TECH',
    title: 'ICTSCE 2026',
    description: 'International Conference on Technical Student Club Engagements.',
    eventDate: '2026-11-01T10:00:00Z',
    endDate: '2026-11-01T13:00:00Z',
    location: 'Main Auditorium',
    venueName: 'Grand Hall',
    venueBuilding: 'Innovation Complex',
    capacity: 100,
    fee: 0,
    cancelled: false,
    approvalStatus: 'APPROVED',
  }

  it('renders modern hero banner, event title, date ribbon badge, and logistics sidebar', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/events/event-101') return Promise.resolve({ data: sampleEvent })
      if (url.includes('/rsvps')) {
        return Promise.resolve({
          data: [{ id: 'r1', userId: 'u1', userName: 'Alice Walker', status: 'CONFIRMED' }],
        })
      }
      if (url.includes('/waitlist')) return Promise.resolve({ data: [] })
      if (url.includes('/attendance')) return Promise.resolve({ data: [] })
      if (url.includes('/feedback/average')) return Promise.resolve({ data: { averageRating: 4.8 } })
      if (url.includes('/feedback')) return Promise.resolve({ data: [] })
      if (url.includes('/comments')) return Promise.resolve({ data: [] })
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ userId: 'student-1', position: 'MEMBER' }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderEventDetailPage('event-101', { id: 'student-1', name: 'Student Sam', role: 'STUDENT' })

    // Hero title & club
    expect(await screen.findByRole('heading', { level: 1, name: 'ICTSCE 2026' })).toBeInTheDocument()
    expect(screen.getAllByText('Tech Innovators').length).toBeGreaterThan(0)
    expect(screen.getByText(/About this Event/i)).toBeInTheDocument()
    expect(screen.getByText('International Conference on Technical Student Club Engagements.')).toBeInTheDocument()

    // Logistics & venue
    expect(screen.getAllByText(/Grand Hall/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Free Admission/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /RSVP for Event/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add to calendar/i })).toBeInTheDocument()

    // Attendee section
    expect(screen.getByText(/Alice Walker/i)).toBeInTheDocument()
    expect(screen.getByText(/Going \(1 \/ 100\)/i)).toBeInTheDocument()
  })

  it('renders Organizer Management Tools when user is a club officer or president', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/events/event-101') return Promise.resolve({ data: sampleEvent })
      if (url.includes('/rsvps')) return Promise.resolve({ data: [] })
      if (url.includes('/waitlist')) return Promise.resolve({ data: [] })
      if (url.includes('/attendance')) return Promise.resolve({ data: [] })
      if (url.includes('/feedback')) return Promise.resolve({ data: [] })
      if (url.includes('/comments')) return Promise.resolve({ data: [] })
      if (url.includes('/members')) {
        return Promise.resolve({
          data: [{ userId: 'pres-1', position: 'PRESIDENT' }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderEventDetailPage('event-101', { id: 'pres-1', name: 'President Dave', role: 'STUDENT' })

    expect(await screen.findByText(/Organizer Management Tools/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edit event/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Show check-in QR code/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send certificates/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cancel event/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete event/i })).toBeInTheDocument()
  })

  it('renders Faculty Advisor sign-off banner when event is pending review', async () => {
    const pendingEvent = { ...sampleEvent, approvalStatus: 'PENDING' }
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/events/event-101') return Promise.resolve({ data: pendingEvent })
      if (url.includes('/rsvps')) return Promise.resolve({ data: [] })
      if (url.includes('/waitlist')) return Promise.resolve({ data: [] })
      if (url.includes('/attendance')) return Promise.resolve({ data: [] })
      if (url.includes('/feedback')) return Promise.resolve({ data: [] })
      if (url.includes('/comments')) return Promise.resolve({ data: [] })
      if (url.includes('/members')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    renderEventDetailPage('event-101', { id: 'advisor-1', name: 'Prof. Evans', role: 'FACULTY_ADVISOR' })

    expect(await screen.findByText(/Pending Faculty Advisor Sign-Off/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Approve Event/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reject Event/i })).toBeInTheDocument()
  })

  it('renders Faculty Advisor Oversight view-only banner on approved events and hides RSVP button', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/events/event-101') return Promise.resolve({ data: sampleEvent })
      if (url.includes('/rsvps')) return Promise.resolve({ data: [] })
      if (url.includes('/waitlist')) return Promise.resolve({ data: [] })
      if (url.includes('/attendance')) return Promise.resolve({ data: [] })
      if (url.includes('/feedback')) return Promise.resolve({ data: [] })
      if (url.includes('/comments')) return Promise.resolve({ data: [] })
      if (url.includes('/members')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    renderEventDetailPage('event-101', { id: 'advisor-1', name: 'Prof. Evans', role: 'FACULTY_ADVISOR' })

    expect(await screen.findByText(/Faculty Advisor Oversight/i)).toBeInTheDocument()
    expect(screen.getByText(/Faculty Advisors cannot join or RSVP to student events/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rsvp for event/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rsvp now/i })).not.toBeInTheDocument()
  })

  it('does not show fix and resubmit buttons to faculty advisor on rejected events', async () => {
    const rejectedEvent = {
      ...sampleEvent,
      approvalStatus: 'REJECTED',
      rejectionReason: 'Requires updated safety briefing.',
    }
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/events/event-101') return Promise.resolve({ data: rejectedEvent })
      return Promise.resolve({ data: [] })
    })

    renderEventDetailPage('event-101', { id: 'advisor-1', name: 'Prof. Evans', role: 'FACULTY_ADVISOR' })

    expect(await screen.findByText(/Event Proposal Rejected by Faculty Advisor/i)).toBeInTheDocument()
    expect(screen.getByText('Requires updated safety briefing.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Fix Issues & Resubmit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Resend Proposal to Advisor/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Awaiting revision and resubmission from the Club President/i)).toBeInTheDocument()
  })
})

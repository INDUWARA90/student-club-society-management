import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import EventCard from './EventCard'

describe('EventCard', () => {
  const sampleEvent = {
    id: 'evt-1',
    title: 'Hackathon Launch Night',
    eventDate: '2026-10-24T18:00:00Z',
    endDate: '2026-10-24T22:00:00Z',
    location: 'Main Engineering Hall 4B',
    clubName: 'Robotics & AI Society',
    clubCategory: 'TECH',
    cancelled: false,
    approvalStatus: 'APPROVED',
  }

  it('renders event title, location, floating date badge matching mockup', () => {
    render(
      <MemoryRouter>
        <EventCard event={sampleEvent} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Hackathon Launch Night')).toBeInTheDocument()
    expect(screen.getByText('Main Engineering Hall 4B')).toBeInTheDocument()
    expect(screen.getByText('OCT')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rsvp now/i })).toBeInTheDocument()
  })

  it('calls onRsvpToggle when RSVP Now button is clicked', async () => {
    const user = userEvent.setup()
    const handleToggle = vi.fn()

    render(
      <MemoryRouter>
        <EventCard event={sampleEvent} onRsvpToggle={handleToggle} />
      </MemoryRouter>,
    )

    const rsvpBtn = screen.getByRole('button', { name: /rsvp now/i })
    await user.click(rsvpBtn)

    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('displays RSVP Confirmed state when user has already RSVPed', () => {
    render(
      <MemoryRouter>
        <EventCard event={sampleEvent} isGoing={true} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /rsvp confirmed/i })).toBeInTheDocument()
  })

  it('displays Approve and Reject buttons when viewer is Faculty Advisor and event is pending', async () => {
    const user = userEvent.setup()
    const handleReview = vi.fn()
    const pendingEvent = {
      ...sampleEvent,
      approvalStatus: 'PENDING',
    }

    render(
      <MemoryRouter>
        <EventCard
          event={pendingEvent}
          isFacultyAdvisor={true}
          onAdvisorReview={handleReview}
        />
      </MemoryRouter>,
    )

    const approveBtn = screen.getByRole('button', { name: /approve/i })
    const rejectBtn = screen.getByRole('button', { name: /reject/i })

    expect(approveBtn).toBeInTheDocument()
    expect(rejectBtn).toBeInTheDocument()

    await user.click(approveBtn)
    expect(handleReview).toHaveBeenCalledWith(expect.anything(), 'evt-1', true)
  })

  it('displays View Event button in read-only mode for Faculty Advisor on approved events, without RSVP option', () => {
    render(
      <MemoryRouter>
        <EventCard
          event={sampleEvent}
          isFacultyAdvisor={true}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /view event/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rsvp now/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /rsvp confirmed/i })).not.toBeInTheDocument()
  })
})

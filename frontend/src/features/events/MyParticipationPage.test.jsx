import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyParticipationPage from './MyParticipationPage'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn() },
}))

let api
beforeEach(async () => {
  api = (await import('../../api/axios')).default
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <MyParticipationPage />
    </MemoryRouter>,
  )
}

describe('MyParticipationPage', () => {
  it('shows the empty state when the student has not attended anything', async () => {
    api.get.mockResolvedValue({ data: [] })
    renderPage()

    expect(await screen.findByText(/no participation yet/i)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/attendance/me')
  })

  it('lists attended events with a per-club summary', async () => {
    api.get.mockResolvedValue({
      data: [
        { eventId: 'e1', eventTitle: 'Play Night', eventDate: '2026-05-02T18:00:00Z', clubId: 'c2', clubName: 'Drama Club', method: 'QR', markedAt: '2026-05-02T18:05:00Z' },
        { eventId: 'e2', eventTitle: 'Blitz Cup', eventDate: '2026-04-01T18:00:00Z', clubId: 'c1', clubName: 'Chess Club', method: 'MANUAL', markedAt: '2026-04-01T18:30:00Z' },
        { eventId: 'e3', eventTitle: 'Opening Night', eventDate: '2026-03-01T18:00:00Z', clubId: 'c1', clubName: 'Chess Club', method: 'QR', markedAt: '2026-03-01T18:02:00Z' },
      ],
    })
    renderPage()

    expect(await screen.findByText('3 events attended')).toBeInTheDocument()
    expect(screen.getByText('Chess Club: 2')).toBeInTheDocument()
    expect(screen.getByText('Drama Club: 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Play Night' })).toHaveAttribute('href', '/events/e1')
    expect(screen.getByText(/Marked by an officer/)).toBeInTheDocument()
  })

  it('shows an alert when the history cannot be loaded', async () => {
    api.get.mockRejectedValue({ response: { data: { message: 'Nope' } } })
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Nope')
  })
})

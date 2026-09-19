import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axios'
import EventCheckInPage from './EventCheckInPage'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/checkin/:eventId" element={<EventCheckInPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EventCheckInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { id: 'e1', title: 'Hack Night' } })
  })

  it('sends the token from the scanned link and confirms the check-in', async () => {
    api.post.mockResolvedValue({ data: {} })

    renderAt('/checkin/e1?t=tok123')

    expect(await screen.findByText(/you are checked in/i)).toBeInTheDocument()
    expect(screen.getByText('Hack Night')).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/events/e1/attendance/qr-check-in', null, { params: { token: 'tok123' } })
  })

  it('shows the server message when the code has expired', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'This QR code is invalid or has expired' } } })

    renderAt('/checkin/e1?t=old')

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(screen.queryByText(/you are checked in/i)).not.toBeInTheDocument()
  })

  it('still attempts the check-in without a token (the server refuses it)', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'This QR code is invalid or has expired' } } })

    renderAt('/checkin/e1')

    expect(await screen.findByText(/invalid or has expired/i)).toBeInTheDocument()
    expect(api.post).toHaveBeenCalledWith('/events/e1/attendance/qr-check-in', null, { params: { token: null } })
  })
})

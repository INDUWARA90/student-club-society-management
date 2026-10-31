import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import venuesReducer from '../venues/venuesSlice'
import CreateEventModal from './CreateEventModal'
import eventsReducer from './eventsSlice'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn().mockImplementation(() => Promise.resolve({ data: [] })),
    post: vi.fn().mockImplementation(() => Promise.resolve({ data: {} })),
    put: vi.fn().mockImplementation(() => Promise.resolve({ data: {} })),
    delete: vi.fn().mockImplementation(() => Promise.resolve({ data: {} })),
  },
}))

function renderModal(props = {}, initialState = {}) {
  const store = configureStore({
    reducer: {
      auth: (state = { user: { id: 'u1', role: 'STUDENT' } }) => state,
      venues: venuesReducer,
      events: eventsReducer,
    },
    preloadedState: {
      venues: {
        items: [
          { id: 'v1', name: 'Grand Auditorium', building: 'Hall A', capacity: 300 },
        ],
        status: 'succeeded',
        error: null,
      },
      ...initialState,
    },
  })

  return render(
    <Provider store={store}>
      <ToastProvider>
        <CreateEventModal clubId="club-1" onClose={vi.fn()} onCreated={vi.fn()} {...props} />
      </ToastProvider>
    </Provider>,
  )
}

describe('CreateEventModal', () => {
  it('renders modern event creation form with proper descriptive labels and meaningful sections', () => {
    renderModal()

    // Title & Header
    expect(screen.getByRole('heading', { level: 2, name: /create new event/i })).toBeInTheDocument()

    // Proper labels
    expect(screen.getByLabelText(/event title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/event description & agenda/i)).toBeInTheDocument()
    expect(screen.getByText(/event schedule & timing/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText(/event date/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/starts at \(time\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ends at \(time\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/location \/ room \/ meeting link/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/campus venue reservation/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/attendee limit/i)).toBeInTheDocument()

    // Removed per user request: Registration Fee and Allocated Event Budget
    expect(screen.queryByLabelText(/registration fee/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/allocated event budget/i)).not.toBeInTheDocument()

    // Removed preset buttons and quick duration buttons
    expect(screen.queryByRole('button', { name: /\+2 hours/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tomorrow 10 am/i })).not.toBeInTheDocument()

    // Action buttons
    expect(screen.getByRole('button', { name: /publish event proposal/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('allows selecting date and times and displays live formatted schedule summary', () => {
    renderModal()

    const dateInput = screen.getByLabelText(/event date/i, { selector: 'input' })
    const startTimeSelect = screen.getByLabelText(/starts at \(time\)/i)
    const endTimeSelect = screen.getByLabelText(/ends at \(time\)/i)

    fireEvent.change(dateInput, { target: { value: '2026-11-15' } })
    fireEvent.change(startTimeSelect, { target: { value: '14:00' } })
    fireEvent.change(endTimeSelect, { target: { value: '16:00' } })

    // Verify live formatted schedule summary is displayed
    expect(screen.getByText(/2:00 PM – 4:00 PM/i)).toBeInTheDocument()
    expect(screen.getByText(/\(2 hours\)/i)).toBeInTheDocument()
  })

  it('warns when end time is earlier than start time', () => {
    renderModal()

    const startTimeSelect = screen.getByLabelText(/starts at \(time\)/i)
    const endTimeSelect = screen.getByLabelText(/ends at \(time\)/i)

    fireEvent.change(startTimeSelect, { target: { value: '16:00' } })
    fireEvent.change(endTimeSelect, { target: { value: '14:00' } })

    expect(screen.getByText(/end time must be after the start time/i)).toBeInTheDocument()
  })

  it('checks venue availability when requested', async () => {
    const axios = (await import('../../api/axios')).default
    const startIso = new Date('2026-11-15T14:00:00').toISOString()
    const endIso = new Date('2026-11-15T16:00:00').toISOString()
    axios.get.mockImplementation((url) => {
      if (url.includes('/venues/v1/next-available-slot')) {
        return Promise.resolve({
          data: {
            found: true,
            start: startIso,
            end: endIso,
          },
        })
      }
      if (url === '/venues') {
        return Promise.resolve({
          data: [{ id: 'v1', name: 'Grand Auditorium', building: 'Hall A', capacity: 300 }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderModal()

    // Pick start and end dates/times
    const dateInput = screen.getByLabelText(/event date/i, { selector: 'input' })
    const startTimeSelect = screen.getByLabelText(/starts at \(time\)/i)
    const endTimeSelect = screen.getByLabelText(/ends at \(time\)/i)

    fireEvent.change(dateInput, { target: { value: '2026-11-15' } })
    fireEvent.change(startTimeSelect, { target: { value: '14:00' } })
    fireEvent.change(endTimeSelect, { target: { value: '16:00' } })

    // Select venue
    const venueSelect = screen.getByLabelText(/campus venue reservation/i)
    fireEvent.change(venueSelect, { target: { value: 'v1' } })

    // Click check availability button
    const checkBtn = await screen.findByRole('button', { name: /check venue availability/i })
    fireEvent.click(checkBtn)

    await waitFor(() => {
      expect(screen.getByText(/venue is completely free for your selected schedule/i)).toBeInTheDocument()
    })
  })

  it('submits event with default fee 0 and budget null when fields are removed', async () => {
    const axios = (await import('../../api/axios')).default
    let postedData = null
    axios.post.mockImplementation((url, data) => {
      if (url.includes('/events')) {
        postedData = data
        return Promise.resolve({
          data: { id: 'evt-100', title: data.title, approvalStatus: 'PENDING' },
        })
      }
      return Promise.resolve({ data: {} })
    })

    renderModal({ clubId: 'club-1' })

    fireEvent.change(screen.getByLabelText(/event title/i), {
      target: { value: 'Annual Robotics Summit' },
    })

    const dateInput = screen.getByLabelText(/event date/i, { selector: 'input' })
    fireEvent.change(dateInput, { target: { value: '2026-11-20' } })

    const publishBtn = screen.getByRole('button', { name: /publish event proposal/i })
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(postedData).not.toBeNull()
      expect(postedData.fee).toBe(0)
      expect(postedData.budget).toBeNull()
      expect(postedData.title).toBe('Annual Robotics Summit')
    })
  })
})

import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import NotificationsPage from './NotificationsPage'
import notificationsReducer from './notificationsSlice'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function renderNotificationsPage(preloadedState) {
  const store = configureStore({
    reducer: {
      notifications: notificationsReducer,
      auth: (state = { user: { id: 'u1', name: 'Alice' } }) => state,
    },
    preloadedState,
  })

  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/notifications']}>
          <Routes>
            <Route path="/notifications" element={<NotificationsPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const sampleNotifications = [
    {
      id: 'notif-1',
      message: 'New announcement in Creative Arts Society: Welcome to Creative Arts Society! General meeting this Friday at 5 PM in Room 204.',
      read: false,
      createdAt: '2026-10-26T00:53:00Z',
    },
    {
      id: 'notif-2',
      message: 'Your club Tech Innovators was approved.',
      read: true,
      createdAt: '2026-09-17T00:05:00Z',
    },
  ]

  it('renders modern notification cards with parsed badges, categories, and relative time', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleNotifications })

    renderNotificationsPage({
      notifications: {
        items: sampleNotifications,
        status: 'succeeded',
        error: null,
      },
    })

    // Assert header and unread count badge
    expect(await screen.findByRole('heading', { level: 1, name: /notifications/i })).toBeInTheDocument()
    expect(screen.getByText(/1 unread/i)).toBeInTheDocument()

    // Assert announcement card
    expect(screen.getByText('Announcement from Creative Arts Society')).toBeInTheDocument()
    expect(screen.getByText(/General meeting this Friday at 5 PM in Room 204/i)).toBeInTheDocument()
    expect(screen.getByText('Announcement')).toBeInTheDocument()

    // Assert club approved card
    expect(screen.getByText('Club Approved & Live')).toBeInTheDocument()
    expect(screen.getByText('Club Approved')).toBeInTheDocument()

    // Assert filter counts
    expect(screen.getByRole('button', { name: /all \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unread \(1\)/i })).toBeInTheDocument()
  })

  it('filters notifications by unread tab', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleNotifications })

    renderNotificationsPage({
      notifications: {
        items: sampleNotifications,
        status: 'succeeded',
        error: null,
      },
    })

    expect(await screen.findByText('Announcement from Creative Arts Society')).toBeInTheDocument()
    expect(screen.getByText('Club Approved & Live')).toBeInTheDocument()

    // Click Unread filter
    fireEvent.click(screen.getByRole('button', { name: /unread \(1\)/i }))

    // Only unread card should remain visible
    expect(screen.getByText('Announcement from Creative Arts Society')).toBeInTheDocument()
    expect(screen.queryByText('Club Approved & Live')).not.toBeInTheDocument()
  })

  it('filters notifications by search query', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleNotifications })

    renderNotificationsPage({
      notifications: {
        items: sampleNotifications,
        status: 'succeeded',
        error: null,
      },
    })

    const searchInput = await screen.findByPlaceholderText(/search notifications/i)
    fireEvent.change(searchInput, { target: { value: 'Tech Innovators' } })

    expect(screen.queryByText('Announcement from Creative Arts Society')).not.toBeInTheDocument()
    expect(screen.getByText('Club Approved & Live')).toBeInTheDocument()
  })

  it('allows marking all notifications as read', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleNotifications })
    api.post.mockResolvedValue({})

    renderNotificationsPage({
      notifications: {
        items: sampleNotifications,
        status: 'succeeded',
        error: null,
      },
    })

    const markAllBtn = await screen.findByRole('button', { name: /mark all as read/i })
    fireEvent.click(markAllBtn)

    expect(api.post).toHaveBeenCalledWith('/notifications/read-all')
  })

  it('allows marking a single notification as read', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleNotifications })
    api.post.mockResolvedValue({})

    renderNotificationsPage({
      notifications: {
        items: sampleNotifications,
        status: 'succeeded',
        error: null,
      },
    })

    const markSingleBtn = await screen.findByRole('button', { name: /mark notification as read/i })
    fireEvent.click(markSingleBtn)

    expect(api.post).toHaveBeenCalledWith('/notifications/notif-1/read')
  })
})

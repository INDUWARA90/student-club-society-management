import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import clubsReducer from './clubsSlice'
import CreateClubModal from './CreateClubModal'

vi.mock('../../api/axios', () => ({
  default: { post: vi.fn() },
}))

function renderWithProviders(ui, { initialState } = {}) {
  const store = configureStore({
    reducer: {
      clubs: clubsReducer,
      auth: (state = { user: { role: 'SUPER_ADMIN' } }) => state,
    },
    preloadedState: initialState,
  })
  return render(
    <Provider store={store}>
      <ToastProvider>{ui}</ToastProvider>
    </Provider>,
  )
}

describe('CreateClubModal', () => {
  it('shows a validation error when required fields are missing', async () => {
    const onClose = vi.fn()
    renderWithProviders(<CreateClubModal onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /create club/i }))

    expect(await screen.findByText(/name and category are required/i)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('submits the form and closes on success', async () => {
    const axios = (await import('../../api/axios')).default
    axios.post.mockResolvedValueOnce({
      data: { id: 'c1', name: 'Chess Club', category: 'Games', status: 'APPROVED' },
    })
    const onClose = vi.fn()
    const onCreated = vi.fn()
    renderWithProviders(<CreateClubModal onClose={onClose} onCreated={onCreated} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^name$/i), 'Chess Club')
    await user.type(screen.getByLabelText(/category/i), 'Games')
    await user.click(screen.getByRole('button', { name: /create club/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
    expect(axios.post).toHaveBeenCalledWith('/clubs', expect.objectContaining({ name: 'Chess Club', category: 'Games' }))
  })

  it('closes the modal on cancel', async () => {
    const onClose = vi.fn()
    renderWithProviders(<CreateClubModal onClose={onClose} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onClose).toHaveBeenCalled()
  })

  it('does not display membership fee or certificate threshold fields', async () => {
    const axios = (await import('../../api/axios')).default
    axios.post.mockResolvedValueOnce({
      data: { id: 'c2', name: 'Robotics', category: 'Tech', status: 'APPROVED' },
    })
    renderWithProviders(<CreateClubModal onClose={vi.fn()} onCreated={vi.fn()} />)
    const user = userEvent.setup()

    expect(screen.queryByLabelText(/membership fee/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/events for certificate/i)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/^name$/i), 'Robotics')
    await user.type(screen.getByLabelText(/category/i), 'Tech')
    await user.click(screen.getByRole('button', { name: /create club/i }))

    await waitFor(() =>
      expect(axios.post).toHaveBeenLastCalledWith(
        '/clubs',
        expect.objectContaining({ name: 'Robotics', membershipFee: 0 }),
      ),
    )
  })

  it('does not render when a normal student attempts to open create mode', () => {
    renderWithProviders(<CreateClubModal onClose={vi.fn()} />, {
      initialState: { auth: { user: { role: 'STUDENT' } } },
    })

    expect(screen.queryByRole('heading', { name: /create a club/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

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

function renderWithProviders(ui) {
  const store = configureStore({ reducer: { clubs: clubsReducer } })
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

  it('sends the membership fee and certificate threshold with the club', async () => {
    const axios = (await import('../../api/axios')).default
    axios.post.mockResolvedValueOnce({
      data: { id: 'c2', name: 'Robotics', category: 'Tech', status: 'PENDING' },
    })
    renderWithProviders(<CreateClubModal onClose={vi.fn()} onCreated={vi.fn()} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/^name$/i), 'Robotics')
    await user.type(screen.getByLabelText(/category/i), 'Tech')
    await user.clear(screen.getByLabelText(/membership fee/i))
    await user.type(screen.getByLabelText(/membership fee/i), '50')
    await user.clear(screen.getByLabelText(/events for certificate/i))
    await user.type(screen.getByLabelText(/events for certificate/i), '5')
    await user.click(screen.getByRole('button', { name: /create club/i }))

    await waitFor(() =>
      expect(axios.post).toHaveBeenLastCalledWith(
        '/clubs',
        expect.objectContaining({ name: 'Robotics', membershipFee: 50, certificateThreshold: 5 }),
      ),
    )
  })

  it('pre-fills the fee and threshold when editing an existing club', () => {
    renderWithProviders(
      <CreateClubModal
        club={{ id: 'c1', name: 'Chess', category: 'Games', joinPolicy: 'OPEN', membershipFee: 120, certificateThreshold: 4 }}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByLabelText(/membership fee/i)).toHaveValue(120)
    expect(screen.getByLabelText(/events for certificate/i)).toHaveValue(4)
  })
})

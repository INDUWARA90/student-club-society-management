import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import ContactAdvisorModal from './ContactAdvisorModal'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

function renderModal(props) {
  return render(
    <ToastProvider>
      <ContactAdvisorModal {...props} />
    </ToastProvider>,
  )
}

describe('ContactAdvisorModal', () => {
  const mockAdvisors = [
    { id: 'adv-1', name: 'Dr. Jane Smith', email: 'jsmith@uni.edu' },
    { id: 'adv-2', name: 'Prof. Alan Turing', email: 'aturing@uni.edu' },
  ]

  const mockClubs = [
    { id: 'club-1', name: 'Robotics Society' },
    { id: 'club-2', name: 'Debate Club' },
  ]

  beforeEach(async () => {
    vi.clearAllMocks()
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: mockAdvisors })
  })

  it('renders nothing when isOpen is false', () => {
    renderModal({ isOpen: false, onClose: vi.fn() })
    expect(screen.queryByText(/Contact Faculty Advisor/i)).not.toBeInTheDocument()
  })

  it('loads advisors and renders form when isOpen is true', async () => {
    renderModal({ isOpen: true, onClose: vi.fn(), clubs: mockClubs })

    expect(await screen.findByText('Contact Faculty Advisor')).toBeInTheDocument()
    expect(await screen.findByText(/Dr. Jane Smith/i)).toBeInTheDocument()
    expect(await screen.findByText(/Prof. Alan Turing/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Subject/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument()
  })

  it('submits contact form and calls onClose on success', async () => {
    const api = (await import('../../api/axios')).default
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: 'Your inquiry has been sent to Dr. Jane Smith.',
        advisorsNotified: ['Dr. Jane Smith'],
      },
    })

    const onClose = vi.fn()
    renderModal({ isOpen: true, onClose, clubs: mockClubs })
    const user = userEvent.setup()

    // Wait for advisors to load
    await screen.findByText(/Dr. Jane Smith/i)

    // Select advisor
    await user.selectOptions(screen.getByLabelText(/Target Faculty Advisor/i), 'adv-1')

    // Fill subject and message
    await user.type(screen.getByLabelText(/Subject/i), 'Guidance on workshop budget')
    await user.type(
      screen.getByLabelText(/Message/i),
      'Could you please review our proposed workshop budget?',
    )

    // Submit
    await user.click(screen.getByRole('button', { name: /Send to Advisor/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/advisors/contact', {
        advisorId: 'adv-1',
        clubId: null,
        subject: 'Guidance on workshop budget',
        message: 'Could you please review our proposed workshop budget?',
      })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('displays error banner if API returns error response', async () => {
    const api = (await import('../../api/axios')).default
    api.post.mockRejectedValueOnce({
      response: {
        data: { message: 'Faculty advisor is currently unavailable' },
      },
    })

    const onClose = vi.fn()
    renderModal({ isOpen: true, onClose })
    const user = userEvent.setup()

    await screen.findByText(/Dr. Jane Smith/i)

    await user.type(screen.getByLabelText(/Subject/i), 'Urgent inquiry')
    await user.type(screen.getByLabelText(/Message/i), 'Need approval for our event')

    await user.click(screen.getByRole('button', { name: /Send to Advisor/i }))

    expect(
      await screen.findByText('Faculty advisor is currently unavailable'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

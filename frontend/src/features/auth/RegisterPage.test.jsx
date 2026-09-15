import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import authReducer from './authSlice'
import RegisterPage from './RegisterPage'

vi.mock('../../api/axios', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: {} })) },
}))

function renderWithProviders(ui) {
  const store = configureStore({ reducer: { auth: authReducer } })
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )
}

describe('RegisterPage', () => {
  it('shows an inline error for a short password after blur', async () => {
    renderWithProviders(<RegisterPage />)
    const user = userEvent.setup()

    const passwordInput = screen.getByLabelText(/password/i)
    await user.type(passwordInput, 'short')
    await user.tab()

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('shows inline errors for all empty fields on submit without calling the API', async () => {
    const axios = (await import('../../api/axios')).default
    renderWithProviders(<RegisterPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument()
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('submits valid input to the register API', async () => {
    const axios = (await import('../../api/axios')).default
    axios.post.mockResolvedValueOnce({
      data: { accessToken: 'tok', user: { id: '1', name: 'Ada', email: 'ada@example.com', role: 'STUDENT' } },
    })
    renderWithProviders(<RegisterPage />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText(/name/i), 'Ada')
    await user.type(screen.getByLabelText(/email/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(axios.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
    })
  })
})

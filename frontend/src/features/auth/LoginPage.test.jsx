import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import authReducer from './authSlice'
import LoginPage from './LoginPage'

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

describe('LoginPage', () => {
  it('shows an inline error when the email is invalid after blur', async () => {
    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()

    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'not-an-email')
    await user.tab()

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
  }, 15000)

  it('shows inline errors for empty fields on submit without calling the API', async () => {
    const axios = (await import('../../api/axios')).default
    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('does not show errors before the fields are touched', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.queryByText(/enter a valid email address/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/password is required/i)).not.toBeInTheDocument()
  })

  it('toggles password visibility between password and text when eye button is clicked', async () => {
    renderWithProviders(<LoginPage />)
    const user = userEvent.setup()

    const passwordInput = screen.getByLabelText(/password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleButton = screen.getByRole('button', { name: /^show$/i })
    await user.click(toggleButton)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: /^hide$/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^hide$/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})

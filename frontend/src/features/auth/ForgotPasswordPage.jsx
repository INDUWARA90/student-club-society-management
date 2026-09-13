import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import AuthCard from './AuthCard'
import { forgotPassword } from './authSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function ForgotPasswordPage() {
  const dispatch = useDispatch()
  const { status, error } = useSelector((state) => state.auth)

  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [sent, setSent] = useState(false)

  const emailError =
    touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address' : null
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!isValid) return

    const result = await dispatch(forgotPassword({ email }))
    if (forgotPassword.fulfilled.match(result)) {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <AuthCard title="Check your email">
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link to it.
        </p>
        <Link className="mt-6 inline-block text-sm text-brand-600 hover:underline" to="/login">
          Back to login
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Forgot password" subtitle="We'll email you a reset link">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {emailError && <p className="mt-1 text-xs text-danger">{emailError}</p>}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
        >
          {status === 'loading' ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="text-center text-sm text-ink-muted dark:text-ink-dark-muted">
          <Link className="text-brand-600 hover:underline" to="/login">
            Back to login
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}

export default ForgotPasswordPage

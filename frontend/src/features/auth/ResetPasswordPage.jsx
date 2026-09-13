import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthCard from './AuthCard'
import { resetPassword } from './authSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function ResetPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const { status, error } = useSelector((state) => state.auth)

  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)

  const passwordError =
    touched && password.length < 8 ? 'Password must be at least 8 characters' : null
  const isValid = password.length >= 8 && token.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched(true)
    if (!isValid) return

    const result = await dispatch(resetPassword({ token, newPassword: password }))
    if (resetPassword.fulfilled.match(result)) {
      navigate('/login')
    }
  }

  if (!token) {
    return (
      <AuthCard title="Invalid link">
        <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
          This password reset link is missing its token. Request a new one below.
        </p>
        <Link className="mt-6 inline-block text-sm text-brand-600 hover:underline" to="/forgot-password">
          Request a new link
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Reset password" subtitle="Choose a new password">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
          />
          {passwordError && <p className="mt-1 text-xs text-danger">{passwordError}</p>}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
        >
          {status === 'loading' ? 'Resetting…' : 'Reset password'}
        </button>
      </form>
    </AuthCard>
  )
}

export default ResetPasswordPage

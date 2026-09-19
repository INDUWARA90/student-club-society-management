import { Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from './AuthCard'
import { login } from './authSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { status, error } = useSelector((state) => state.auth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({})

  const emailError =
    touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address' : null
  const passwordError = touched.password && password.length === 0 ? 'Password is required' : null

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length > 0

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ email: true, password: true })
    if (!isValid) return

    const result = await dispatch(login({ email, password }))
    if (login.fulfilled.match(result)) {
      navigate('/')
    }
  }

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your club account">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
            <input
              id="email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
          </div>
          {emailError && <p className="mt-1 text-xs text-danger">{emailError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
            <input
              id="password"
              type="password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
          </div>
          {passwordError && <p className="mt-1 text-xs text-danger">{passwordError}</p>}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-card transition-fast hover:brightness-110 hover:shadow-card-hover disabled:opacity-60"
        >
          {status === 'loading' ? 'Logging in…' : 'Log in'}
        </button>

        <p className="text-center text-sm text-ink-muted dark:text-ink-dark-muted">
          <Link className="text-brand-600 hover:underline" to="/forgot-password">
            Forgot password?
          </Link>
        </p>
        <p className="text-center text-sm text-ink-muted dark:text-ink-dark-muted">
          No account?{' '}
          <Link className="text-brand-600 hover:underline" to="/register">
            Register
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}

export default LoginPage

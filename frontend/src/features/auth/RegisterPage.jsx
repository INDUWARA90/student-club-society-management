import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from './AuthCard'
import { register } from './authSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function RegisterPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { status, error } = useSelector((state) => state.auth)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({})

  const nameError = touched.name && name.trim().length === 0 ? 'Name is required' : null
  const emailError =
    touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address' : null
  const passwordError =
    touched.password && password.length < 8 ? 'Password must be at least 8 characters' : null

  const isValid = name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 8

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true })
    if (!isValid) return

    const result = await dispatch(register({ name, email, password }))
    if (register.fulfilled.match(result)) {
      navigate('/')
    }
  }

  return (
    <AuthCard title="Create your account" subtitle="Join clubs, RSVP to events, and more">
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          />
          {nameError && <p className="mt-1 text-xs text-danger">{nameError}</p>}
        </div>

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
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          />
          {emailError && <p className="mt-1 text-xs text-danger">{emailError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          />
          {passwordError && <p className="mt-1 text-xs text-danger">{passwordError}</p>}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
        >
          {status === 'loading' ? 'Creating account…' : 'Register'}
        </button>

        <p className="text-center text-sm text-ink-muted dark:text-ink-dark-muted">
          Already have an account?{' '}
          <Link className="text-brand-600 hover:underline" to="/login">
            Log in
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}

export default RegisterPage

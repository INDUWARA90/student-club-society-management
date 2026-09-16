import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { resendVerification } from '../features/auth/authSlice'
import { toggleTheme } from '../features/theme/themeSlice'
import { useToast } from './ToastProvider'
import NotificationBell from './NotificationBell'

function AppLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const themeMode = useSelector((state) => state.theme.mode)
  const user = useSelector((state) => state.auth.user)
  const [searchQuery, setSearchQuery] = useState('')
  const [resending, setResending] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState(false)

  async function handleResendVerification() {
    setResending(true)
    const result = await dispatch(resendVerification())
    setResending(false)
    if (resendVerification.fulfilled.match(result)) {
      showToast('Verification email sent')
    } else {
      showToast(result.payload, 'error')
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    if (!searchQuery.trim()) return
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <div className="min-h-svh bg-surface-muted dark:bg-surface-dark">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark-muted">
        <Link to="/" className="text-sm font-semibold text-ink dark:text-ink-dark">
          Club & Society
        </Link>
        <form onSubmit={handleSearch} className="order-3 w-full sm:order-none sm:w-64">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clubs, events…"
            aria-label="Search"
            className="w-full rounded-md border border-border bg-surface-muted px-3 py-1.5 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          />
        </form>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="rounded-full p-2 text-ink transition-fast hover:bg-surface-muted dark:text-ink-dark dark:hover:bg-surface-dark"
            aria-label="Toggle dark mode"
          >
            {themeMode === 'dark' ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
          <Link to="/profile" aria-label="Your profile">
            {user?.profileImageB64 ? (
              <img src={user.profileImageB64} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </header>
      {user && !user.emailVerified && !dismissedBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-warning/15 px-4 py-2 text-sm text-ink dark:text-ink-dark">
          <span>Please verify your email address to unlock all features.</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resending}
              className="font-medium text-brand-600 hover:underline disabled:opacity-60"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
            <button
              type="button"
              onClick={() => setDismissedBanner(true)}
              aria-label="Dismiss"
              className="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  )
}

export default AppLayout

import { Moon, Search, Sparkles, Sun, TriangleAlert, X } from 'lucide-react'
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
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-surface/85 px-4 py-3 backdrop-blur-md dark:border-border-dark/80 dark:bg-surface-dark-muted/85">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-ink dark:text-ink-dark">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-card">
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="hidden sm:inline">Club &amp; Society</span>
        </Link>
        <form onSubmit={handleSearch} className="relative order-3 w-full sm:order-none sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clubs, events…"
            aria-label="Search"
            className="w-full rounded-full border border-border bg-surface-muted py-1.5 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:bg-surface focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark dark:focus:bg-surface-dark-muted"
          />
        </form>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="rounded-full p-2 text-ink-muted transition-fast hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark dark:hover:text-ink-dark"
            aria-label="Toggle dark mode"
          >
            {themeMode === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <NotificationBell />
          <Link
            to="/profile"
            aria-label="Your profile"
            className="ml-1 rounded-full ring-1 ring-border transition-fast hover:ring-brand-400 dark:ring-border-dark"
          >
            {user?.profileImageB64 ? (
              <img src={user.profileImageB64} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </header>
      {user && !user.emailVerified && !dismissedBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-sm text-ink dark:text-ink-dark">
          <span className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
            Please verify your email address to unlock all features.
          </span>
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
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  )
}

export default AppLayout

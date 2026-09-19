import {
  Award,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  ScrollText,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
  TriangleAlert,
  User,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { logout, resendVerification } from '../features/auth/authSlice'
import { toggleTheme } from '../features/theme/themeSlice'
import { useToast } from './ToastProvider'
import NotificationBell from './NotificationBell'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/clubs', label: 'Clubs', icon: Users },
  { to: '/alumni', label: 'Alumni', icon: GraduationCap },
  { to: '/certificates', label: 'Certificates', icon: Award },
]

const ADMIN_LINKS = [
  { to: '/admin/pending-clubs', label: 'Pending clubs', icon: ClipboardCheck },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
  { to: '/admin/venues', label: 'Venues', icon: MapPin },
]

const ADVISOR_LINKS = [
  { to: '/advisor/pending-events', label: 'Pending events', icon: ClipboardCheck },
  { to: '/advisor/clubs', label: 'All clubs', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: TrendingUp },
]

const MOBILE_TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/events', label: 'Events', icon: CalendarDays },
  { to: '/calendar', label: 'Calendar', icon: CalendarRange },
  { to: '/clubs', label: 'Clubs', icon: Users },
  { to: '/profile', label: 'Profile', icon: User },
]

const ROLE_LABEL = {
  STUDENT: 'Student',
  FACULTY_ADVISOR: 'Faculty Advisor',
  SUPER_ADMIN: 'Super Admin',
}

const iconButton =
  'rounded-full p-2 text-ink-muted transition-fast hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark-muted dark:hover:text-ink-dark'

function SidebarLink({ to, label, icon: Icon }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-fast ${
          isActive
            ? 'bg-brand-50 text-brand-600 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r-full before:bg-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
            : 'text-ink-muted hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark dark:hover:text-ink-dark'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </NavLink>
  )
}

function SidebarSection({ title, links }) {
  return (
    <div className="mt-6">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted/80 dark:text-ink-dark-muted/80">
        {title}
      </p>
      <div className="mt-2 space-y-0.5">
        {links.map((link) => (
          <SidebarLink key={link.to + link.label} {...link} />
        ))}
      </div>
    </div>
  )
}

function Avatar({ user, className = 'h-8 w-8' }) {
  return user?.profileImageB64 ? (
    <img src={user.profileImageB64} alt={user.name} className={`${className} rounded-full object-cover`} />
  ) : (
    <div
      className={`${className} flex items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white`}
    >
      {user?.name?.[0]?.toUpperCase()}
    </div>
  )
}

function AppLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
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

  const roleLinks =
    user?.role === 'SUPER_ADMIN' ? ADMIN_LINKS : user?.role === 'FACULTY_ADVISOR' ? ADVISOR_LINKS : null
  const roleTitle = user?.role === 'SUPER_ADMIN' ? 'Administration' : 'Advisor tools'

  return (
    <div className="app-backdrop min-h-svh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface px-4 py-5 dark:border-border-dark dark:bg-surface-dark-muted lg:flex">
        <Link to="/" className="flex items-center gap-2.5 px-2 text-ink dark:text-ink-dark">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-card">
            <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold leading-tight">
            Club &amp; Society
            <span className="block text-[11px] font-normal text-ink-muted dark:text-ink-dark-muted">Management</span>
          </span>
        </Link>

        <nav aria-label="Main" className="mt-6 flex-1 overflow-y-auto">
          <div className="space-y-0.5">
            {NAV_LINKS.map((link) => (
              <SidebarLink key={link.to} {...link} />
            ))}
          </div>
          {roleLinks && <SidebarSection title={roleTitle} links={roleLinks} />}
        </nav>

        <div className="mt-4 border-t border-border pt-4 dark:border-border-dark">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-lg p-2 transition-fast hover:bg-surface-muted dark:hover:bg-surface-dark"
          >
            <Avatar user={user} className="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink dark:text-ink-dark">{user?.name}</span>
              <span className="block truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                {ROLE_LABEL[user?.role] || user?.role}
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => dispatch(logout())}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-fast hover:bg-danger/10 hover:text-danger dark:text-ink-dark-muted"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/80 bg-surface/85 px-4 py-3 backdrop-blur-md dark:border-border-dark/80 dark:bg-surface-dark-muted/85 md:px-8">
          <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-card">
              <Sparkles className="h-4 w-4" strokeWidth={2.25} />
            </span>
          </Link>
          <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search clubs, events…"
              aria-label="Search"
              className="w-full rounded-lg border border-border bg-surface-muted py-2 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:bg-surface focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark dark:focus:bg-surface-dark-muted dark:focus:ring-brand-500/20"
            />
          </form>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              className={iconButton}
              aria-label="Toggle dark mode"
            >
              {themeMode === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <Link to="/certificates" aria-label="My certificates" className={`${iconButton} lg:hidden`}>
              <Award className="h-[18px] w-[18px]" />
            </Link>
            <NotificationBell />
            <Link
              to="/profile"
              aria-label="Your profile"
              className="ml-1 hidden rounded-full ring-1 ring-border transition-fast hover:ring-brand-400 dark:ring-border-dark md:block lg:hidden"
            >
              <Avatar user={user} />
            </Link>
          </div>
        </header>

        {user && !user.emailVerified && !dismissedBanner && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/20 bg-warning/10 px-4 py-2 text-sm text-ink dark:text-ink-dark md:px-8">
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

        <main key={location.pathname} className="page-enter pb-20 lg:pb-0">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-border-dark dark:bg-surface-dark-muted/95 lg:hidden"
      >
        {MOBILE_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-fast ${
                isActive ? 'text-brand-600 dark:text-brand-300' : 'text-ink-muted dark:text-ink-dark-muted'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default AppLayout

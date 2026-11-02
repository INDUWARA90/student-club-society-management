import {
  Award,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Moon,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sun,
  TriangleAlert,
  UserCog,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { logout, refreshCurrentUser, resendVerification } from '../features/auth/authSlice'
import { toggleTheme } from '../features/theme/themeSlice'
import NotificationBell from './NotificationBell'
import ContactAdvisorModal from '../features/advisor/ContactAdvisorModal'
import { useToast } from './ToastProvider'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']

const ADMIN_LINKS = [
  { to: '/admin/users', label: 'Users', icon: UserCog },
  { to: '/admin/venues', label: 'Venues', icon: MapPin },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
]

const ADVISOR_LINKS = [
  { to: '/advisor/pending-events', label: 'Pending events', icon: ClipboardCheck },
  { to: '/analytics', label: 'University stats', icon: BarChart3 },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
]

const ROLE_LABEL = {
  STUDENT: 'Student',
  FACULTY_ADVISOR: 'Faculty Advisor',
  SUPER_ADMIN: 'Super Admin',
}

const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/clubs': 'Clubs',
  '/events': 'Events',
  '/calendar': 'Calendar',
  '/participation': 'Activity Log',
  '/certificates': 'Certificates',
  '/members': 'Members',
  '/budget': 'Budget & Finance',
  '/settings': 'Club Settings',
  '/analytics': 'University Analytics',
  '/profile': 'Profile Settings',
  '/search': 'Search',
  '/admin/users': 'Users',
  '/admin/pending-clubs': 'Pending Clubs',
  '/admin/venues': 'Venues',
  '/admin/audit-log': 'Audit Log',
  '/advisor/pending-events': 'Pending Events',
  '/advisor/clubs': 'Clubs',
}

function SidebarLink({ to, label, icon: Icon }) {
  const location = useLocation()
  const isBudgetActive =
    to.includes('/budget') &&
    (location.pathname.endsWith('/budget') || location.pathname.includes('/budget'))

  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
          isActive || isBudgetActive
            ? 'bg-[#eff0fe] text-[#6366f1] font-semibold dark:bg-[#6366f1] dark:text-white shadow-xs'
            : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span>{label}</span>
    </NavLink>
  )
}

function SidebarSection({ title, links }) {
  return (
    <div className="mt-5">
      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="mt-1.5 space-y-1">
        {links.map((link) => (
          <SidebarLink key={link.to + link.label} {...link} />
        ))}
      </div>
    </div>
  )
}

function Avatar({ user, className = 'h-8 w-8' }) {
  if (user?.profileImageB64) {
    return (
      <img
        src={user.profileImageB64}
        alt={user.name || 'User'}
        className={`${className} rounded-full object-cover shrink-0 ring-1 ring-slate-200 dark:ring-slate-700`}
      />
    )
  }

  return (
    <div
      className={`${className} flex items-center justify-center rounded-full bg-[#6366f1] text-xs font-semibold text-white shrink-0 shadow-xs`}
    >
      {user?.name?.[0]?.toUpperCase() || 'U'}
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [memberships, setMemberships] = useState([])
  const [showContactAdvisorModal, setShowContactAdvisorModal] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    dispatch(refreshCurrentUser())
    if (user?.id) {
      api
        .get('/memberships/me')
        .then((res) => setMemberships(Array.isArray(res.data) ? res.data : []))
        .catch(() => {})
    }
  }, [dispatch, user?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const managedClub = memberships.find(
    (m) => m.status === 'APPROVED' && OFFICER_POSITIONS.includes(m.position),
  )
  const isClubOfficerOrPresident = Boolean(managedClub)
  const canAccessBudget = isSuperAdmin || isFacultyAdvisor || isClubOfficerOrPresident
  const canAccessClubSettings = isSuperAdmin || isFacultyAdvisor || isClubOfficerOrPresident

  const managedPresidentClub = memberships.find(
    (m) => m.status === 'APPROVED' && m.position === 'PRESIDENT',
  )
  const isPresident = Boolean(managedPresidentClub)

  const managedLedgerClub = memberships.find(
    (m) => m.status === 'APPROVED' && ['PRESIDENT', 'TREASURER'].includes(m.position),
  )
  const isStudent = user?.role === 'STUDENT'

  const activeClubContextId = location.pathname.startsWith('/clubs/')
    ? location.pathname.split('/')[2]
    : typeof window !== 'undefined'
    ? sessionStorage.getItem('lastViewedClubId')
    : null
  const budgetNavPath = activeClubContextId ? `/clubs/${activeClubContextId}/budget` : '/budget'

  const mainNavLinks = isFacultyAdvisor
    ? [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/advisor/clubs', label: 'Clubs', icon: Shield },
        { to: '/events', label: 'Events Calendar', icon: CalendarDays },
        { to: budgetNavPath, label: 'Budget', icon: Wallet },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/clubs', label: 'Clubs', icon: Shield },
        { to: '/events', label: 'Events', icon: CalendarDays },
        ...(isStudent
          ? [
              { to: '/certificates', label: 'Certificates', icon: Award },
              { to: '/participation', label: 'Activity Log', icon: ClipboardCheck },
            ]
          : []),
        ...(canAccessBudget
          ? [
              {
                to: budgetNavPath,
                label: 'Budget',
                icon: Wallet,
              },
            ]
          : []),
        ...(canAccessClubSettings
          ? [
              { to: '/settings', label: 'Settings', icon: Settings },
            ]
          : []),
      ]

  const mobileTabs = isFacultyAdvisor
    ? [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/advisor/clubs', label: 'Clubs', icon: Shield },
        { to: '/advisor/pending-events', label: 'Approvals', icon: ClipboardCheck },
        { to: '/events', label: 'Events', icon: CalendarDays },
        { to: budgetNavPath, label: 'Budget', icon: Wallet },
      ]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/clubs', label: 'Clubs', icon: Shield },
        { to: '/events', label: 'Events', icon: CalendarDays },
        ...(isStudent
          ? [
              { to: '/certificates', label: 'Certificates', icon: Award },
              { to: '/participation', label: 'Activity Log', icon: ClipboardCheck },
            ]
          : []),
        ...(canAccessBudget
          ? [
              {
                to: budgetNavPath,
                label: 'Budget',
                icon: Wallet,
              },
            ]
          : []),
        ...(canAccessClubSettings
          ? [
              { to: '/settings', label: 'Settings', icon: Settings },
            ]
          : []),
      ]

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
    user?.role === 'SUPER_ADMIN'
      ? ADMIN_LINKS
      : user?.role === 'FACULTY_ADVISOR'
      ? ADVISOR_LINKS
      : isPresident
      ? [{ to: '/admin/users', label: 'User Directory', icon: UserCog }]
      : null
  const roleTitle =
    user?.role === 'SUPER_ADMIN'
      ? 'Admin Tools'
      : user?.role === 'FACULTY_ADVISOR'
      ? 'Advisor Tools'
      : isPresident
      ? 'President Tools'
      : null

  let currentTitle = ROUTE_TITLES[location.pathname]
  if (!currentTitle) {
    if (location.pathname.endsWith('/members')) currentTitle = 'Club Members'
    else if (location.pathname.endsWith('/budget')) currentTitle = 'Budget & Finance'
    else if (location.pathname.startsWith('/clubs/')) currentTitle = 'Club Details'
    else if (location.pathname.startsWith('/events/')) currentTitle = 'Event Details'
    else currentTitle = 'Dashboard'
  }

  const userName = user?.name || 'User'
  const userSubtitle =
    user?.role === 'STUDENT' ? 'Student' : (ROLE_LABEL[user?.role] || user?.role || 'Member')

  return (
    <div className="min-h-svh bg-[#f8fafc] text-slate-800 dark:bg-[#0d0f17] dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-[#6366f1] px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/80 bg-white px-4 py-5 dark:border-slate-800/80 dark:bg-[#12151e] lg:flex">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 px-2 text-slate-900 dark:text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6366f1] text-white font-bold text-sm shadow-sm tracking-tight shrink-0">
            C&amp;S
          </span>
          <div className="leading-tight">
            <span className="block text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">
              Club &amp; Society
            </span>
            <span className="block text-xs font-normal text-slate-400 dark:text-slate-500">
              Portal
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav aria-label="Main" className="mt-7 flex-1 overflow-y-auto space-y-1">
          {mainNavLinks.map((link) => (
            <SidebarLink key={link.to + link.label} {...link} />
          ))}

          {roleLinks && <SidebarSection title={roleTitle} links={roleLinks} />}
        </nav>

        {/* Contact Advisor Action Pill */}
        <div className="mt-3 px-1">
          <button
            type="button"
            onClick={() => setShowContactAdvisorModal(true)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-2.5 text-xs font-semibold text-indigo-700 transition-all hover:bg-indigo-100 hover:text-indigo-900 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 shadow-xs"
          >
            <GraduationCap className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
            <span>Contact Advisor</span>
          </button>
        </div>

        {/* User Footer Profile */}
        <div className="mt-4 border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <Link
            to="/profile"
            className="flex items-center gap-3 rounded-xl p-2 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60"
          >
            <Avatar user={user} className="h-10 w-10 ring-1 ring-slate-200 dark:ring-slate-700" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{userName}</p>
              <p className="truncate text-xs text-slate-400 dark:text-slate-500">{userSubtitle}</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Main Area */}
      <div className="lg:pl-64">
        {/* Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800/80 dark:bg-[#12151e]/90 md:px-8">
          {/* Breadcrumb Left */}
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Link
              to="/"
              className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 font-medium"
            >
              Home
            </Link>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {currentTitle}
            </span>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="relative w-48 sm:w-64 md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs, events, news..."
                aria-label="Search"
                className="w-full rounded-full border border-slate-200/90 bg-slate-50/80 py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#6366f1] focus:bg-white focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
              />
            </form>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={() => dispatch(toggleTheme())}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-all"
              aria-label="Toggle dark mode"
            >
              {themeMode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-full p-1 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="User menu"
              >
                <Avatar user={user} className="h-8 w-8 ring-1 ring-slate-200 dark:ring-slate-700" />
                <ChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-[#181b24]">
                  <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                    <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{userName}</p>
                    <p className="truncate text-[11px] text-slate-400">{user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false)
                        dispatch(logout())
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Verification Alert Banner */}
        {user && !user.emailVerified && !dismissedBanner && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200 md:px-8">
            <span className="flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              Please verify your email address to unlock all features.
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="font-medium text-[#6366f1] hover:underline disabled:opacity-60"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
              <button
                type="button"
                onClick={() => setDismissedBanner(true)}
                aria-label="Dismiss"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Outlet */}
        <main id="main-content" tabIndex={-1} key={location.pathname} className="pb-20 lg:pb-8 outline-none">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-[#12151e]/95 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))` }}
      >
        {mobileTabs.map(({ to, label, icon: Icon }) => {
          const isBudgetActive =
            to.includes('/budget') &&
            (location.pathname.endsWith('/budget') || location.pathname.includes('/budget'))
          return (
            <NavLink
              key={to + label}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all ${
                  isActive || isBudgetActive
                    ? 'text-[#6366f1] dark:text-[#818cf8]'
                    : 'text-slate-400 dark:text-slate-500'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          )
        })}
      </nav>

      {showContactAdvisorModal && (
        <ContactAdvisorModal
          isOpen={showContactAdvisorModal}
          onClose={() => setShowContactAdvisorModal(false)}
        />
      )}
    </div>
  )
}

export default AppLayout

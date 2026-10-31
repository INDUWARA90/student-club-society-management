import {
  AlertTriangle,
  Award,
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CheckCheck,
  CreditCard,
  ExternalLink,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import Skeleton from '../../components/ui/Skeleton'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationsSlice'

export function parseNotification(notification) {
  const msg = notification.message || ''
  const id = notification.id
  const read = Boolean(notification.read)
  const createdAt = notification.createdAt

  let category = 'GENERAL'
  let badge = 'Notice'
  let tone = 'slate'
  let destination = null
  let actionLabel = null
  let title = msg
  let body = null

  if (msg.includes('announcement in')) {
    category = 'ANNOUNCEMENT'
    badge = 'Announcement'
    tone = 'indigo'
    destination = '/clubs'
    actionLabel = 'View Society'
    const match = msg.match(/New announcement in ([^:]+):\s*(.*)/)
    if (match) {
      const clubName = match[1].trim()
      title = `Announcement from ${clubName}`
      body = match[2].trim()
    }
  } else if (msg.toLowerCase().includes('club') && (msg.toLowerCase().includes('approved') || msg.toLowerCase().includes('live'))) {
    category = 'CLUB'
    badge = 'Club Approved'
    tone = 'emerald'
    destination = '/clubs'
    actionLabel = 'Explore Club'
    title = 'Club Approved & Live'
    body = msg
  } else if (msg.toLowerCase().includes('membership') || msg.toLowerCase().includes('member of') || msg.toLowerCase().includes('application')) {
    category = 'MEMBERSHIP'
    badge = 'Membership'
    tone = 'sky'
    destination = '/clubs'
    actionLabel = 'My Memberships'
    title = 'Membership Update'
    body = msg
  } else if (msg.toLowerCase().includes('position in') || msg.toLowerCase().includes('president of') || msg.toLowerCase().includes('presidency')) {
    category = 'ROLE'
    badge = 'Position Update'
    tone = 'purple'
    destination = '/clubs'
    actionLabel = 'Society Matrix'
    title = 'Leadership Position Assigned'
    body = msg
  } else if (msg.toLowerCase().includes('event') && msg.toLowerCase().includes('rejected')) {
    category = 'EVENT'
    badge = 'Event Rejected'
    tone = 'rose'
    destination = '/advisor/pending-events'
    actionLabel = 'Fix & Resubmit'
    title = 'Event Proposal Rejected'
    body = msg
  } else if (msg.toLowerCase().includes('event') && (msg.toLowerCase().includes('needs your approval') || msg.toLowerCase().includes('resubmitted for your approval'))) {
    category = 'EVENT'
    badge = 'Review Needed'
    tone = 'amber'
    destination = '/advisor/pending-events'
    actionLabel = 'Review Proposal'
    title = 'Event Proposal Review'
    body = msg
  } else if (msg.toLowerCase().includes('rsvp') || msg.toLowerCase().includes('waitlist') || msg.toLowerCase().includes('spot opened up')) {
    category = 'EVENT'
    badge = 'Event RSVP'
    tone = 'amber'
    destination = '/events'
    actionLabel = 'View Events'
    title = 'Event Attendance'
    body = msg
  } else if (msg.toLowerCase().includes('certificate')) {
    category = 'CERTIFICATE'
    badge = 'Certificate'
    tone = 'purple'
    destination = '/certificates'
    actionLabel = 'View Certificates'
    title = 'Certificate Earned'
    body = msg
  } else if (msg.toLowerCase().includes('payment')) {
    category = 'PAYMENT'
    badge = 'Payment'
    tone = 'teal'
    destination = '/participation'
    actionLabel = 'View Activity'
    title = 'Payment & Transaction'
    body = msg
  } else if (msg.toLowerCase().includes('report') || msg.toLowerCase().includes('escalation')) {
    category = 'MODERATION'
    badge = 'Review'
    tone = 'rose'
    title = 'Moderation Alert'
    body = msg
  }

  return {
    id,
    category,
    badge,
    tone,
    title,
    body: body || msg,
    rawMessage: msg,
    read,
    createdAt,
    destination,
    actionLabel,
  }
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatRelativeTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 172800) return 'Yesterday'
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

function getToneStyles(tone) {
  switch (tone) {
    case 'indigo':
      return {
        iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/70',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80',
        dot: 'bg-indigo-500 ring-indigo-200 dark:ring-indigo-900',
      }
    case 'emerald':
      return {
        iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/70',
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80',
        dot: 'bg-emerald-500 ring-emerald-200 dark:ring-emerald-900',
      }
    case 'amber':
      return {
        iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/70',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/80',
        dot: 'bg-amber-500 ring-amber-200 dark:ring-amber-900',
      }
    case 'purple':
      return {
        iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200/70 dark:border-purple-800/70',
        badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/80',
        dot: 'bg-purple-500 ring-purple-200 dark:ring-purple-900',
      }
    case 'sky':
      return {
        iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 border border-sky-200/70 dark:border-sky-800/70',
        badge: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/80',
        dot: 'bg-sky-500 ring-sky-200 dark:ring-sky-900',
      }
    case 'teal':
      return {
        iconBg: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 border border-teal-200/70 dark:border-teal-800/70',
        badge: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80',
        dot: 'bg-teal-500 ring-teal-200 dark:ring-teal-900',
      }
    case 'rose':
      return {
        iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/70',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/80',
        dot: 'bg-rose-500 ring-rose-200 dark:ring-rose-900',
      }
    default:
      return {
        iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        dot: 'bg-slate-400 ring-slate-200 dark:ring-slate-800',
      }
  }
}

function getNotificationIcon(category) {
  switch (category) {
    case 'ANNOUNCEMENT':
      return Megaphone
    case 'CLUB':
      return ShieldCheck
    case 'EVENT':
      return CalendarDays
    case 'CERTIFICATE':
      return Sparkles
    case 'ROLE':
      return Award
    case 'MEMBERSHIP':
      return Users
    case 'PAYMENT':
      return CreditCard
    case 'MODERATION':
      return AlertTriangle
    default:
      return Bell
  }
}

function NotificationsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { items, status } = useSelector((state) => state.notifications)

  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    dispatch(fetchNotifications())
  }, [dispatch])

  const parsedItems = useMemo(() => {
    return (Array.isArray(items) ? items : []).map(parseNotification)
  }, [items])

  const unreadCount = useMemo(() => {
    return parsedItems.filter((n) => !n.read).length
  }, [parsedItems])

  const announcementCount = useMemo(() => {
    return parsedItems.filter((n) => n.category === 'ANNOUNCEMENT').length
  }, [parsedItems])

  const eventCount = useMemo(() => {
    return parsedItems.filter((n) => n.category === 'EVENT').length
  }, [parsedItems])

  const filteredItems = useMemo(() => {
    return parsedItems.filter((n) => {
      // Category / Read status filter
      if (filter === 'unread' && n.read) return false
      if (filter === 'announcements' && n.category !== 'ANNOUNCEMENT') return false
      if (filter === 'events' && n.category !== 'EVENT') return false

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = n.title.toLowerCase().includes(q)
        const matchBody = n.body.toLowerCase().includes(q)
        const matchBadge = n.badge.toLowerCase().includes(q)
        return matchTitle || matchBody || matchBadge
      }

      return true
    })
  }, [parsedItems, filter, searchQuery])

  async function handleMarkAllAsRead() {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    try {
      await dispatch(markAllNotificationsRead()).unwrap()
      showToast('All notifications marked as read', 'success')
    } catch {
      showToast('Failed to mark all as read', 'error')
    } finally {
      setMarkingAll(false)
    }
  }

  function handleNotificationClick(item) {
    if (!item.read) {
      dispatch(markNotificationRead(item.id))
    }
    if (item.destination) {
      navigate(item.destination)
    }
  }

  function handleMarkSingleRead(e, item) {
    e.stopPropagation()
    if (!item.read) {
      dispatch(markNotificationRead(item.id))
      showToast('Notification marked as read')
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8 space-y-6">
      {/* Top Breadcrumb */}
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]} />

      {/* Main Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Notifications
            </h1>
            {unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-[#6366f1] ring-1 ring-inset ring-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-400 dark:ring-indigo-800">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6366f1] animate-pulse" />
                {unreadCount} unread
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:ring-emerald-800">
                <Check className="h-3 w-3" />
                All caught up
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            Live updates on society announcements, RSVPs, leadership positions, and campus updates.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markingAll}
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <CheckCheck className="h-3.5 w-3.5 text-[#6366f1]" />
            <span>{markingAll ? 'Marking...' : 'Mark all as read'}</span>
          </button>
        )}
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              filter === 'all'
                ? 'bg-slate-900 text-white shadow-xs dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            All ({parsedItems.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-[#6366f1] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {unreadCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
            Unread ({unreadCount})
          </button>

          {announcementCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('announcements')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === 'announcements'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              Announcements ({announcementCount})
            </button>
          )}

          {eventCount > 0 && (
            <button
              type="button"
              onClick={() => setFilter('events')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === 'events'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              Events ({eventCount})
            </button>
          )}
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {status === 'loading' && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty States */}
      {status !== 'loading' && filteredItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-2xs dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 mb-3.5 shadow-2xs">
            {filter === 'unread' ? <CheckCheck className="h-7 w-7" /> : <BellOff className="h-7 w-7" />}
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {filter === 'unread'
              ? 'You are all caught up!'
              : searchQuery
              ? 'No matching notifications'
              : 'No notifications yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {filter === 'unread'
              ? 'There are no unread notifications waiting for your attention.'
              : searchQuery
              ? `No notifications found matching "${searchQuery}". Try a different keyword.`
              : 'When societies broadcast announcements, event RSVPs change, or certificates are issued, they will appear here.'}
          </p>
          {(filter !== 'all' || searchQuery) && (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  setFilter('all')
                  setSearchQuery('')
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notifications List */}
      {status !== 'loading' && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map((n) => {
            const Icon = getNotificationIcon(n.category)
            const toneStyles = getToneStyles(n.tone)

            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => handleNotificationClick(n)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleNotificationClick(n)
                  }
                }}
                className={`group relative flex items-start gap-4 rounded-2xl p-4.5 text-left transition-all cursor-pointer ${
                  !n.read
                    ? 'border-l-4 border-l-[#6366f1] border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                    : 'border border-slate-200/70 bg-slate-50/60 hover:bg-white dark:bg-slate-900/40 dark:hover:bg-slate-900 dark:border-slate-800/80'
                }`}
              >
                {/* Category Icon Container */}
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-2xs group-hover:scale-105 transition-transform ${toneStyles.iconBg}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Top line with Category badge and timestamp */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${toneStyles.badge}`}
                    >
                      {n.badge}
                    </span>

                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      • {formatRelativeTime(n.createdAt)}
                    </span>

                    <span
                      title={formatDate(n.createdAt)}
                      className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:inline"
                    >
                      ({formatDate(n.createdAt)})
                    </span>
                  </div>

                  {/* Primary Title */}
                  <h3
                    className={`mt-1.5 text-sm leading-snug ${
                      !n.read
                        ? 'font-bold text-slate-900 dark:text-white'
                        : 'font-semibold text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {n.title}
                  </h3>

                  {/* Subtitle / Message Body */}
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      !n.read
                        ? 'text-slate-600 dark:text-slate-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {n.body}
                  </p>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2 self-center shrink-0">
                  {n.destination && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!n.read) dispatch(markNotificationRead(n.id))
                        navigate(n.destination)
                      }}
                      className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-[#6366f1] hover:text-white hover:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-[#6366f1] dark:hover:text-white"
                    >
                      <span>{n.actionLabel || 'View'}</span>
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}

                  {!n.read ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Mark as read"
                        aria-label="Mark notification as read"
                        onClick={(e) => handleMarkSingleRead(e, n)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <span
                        className="h-2.5 w-2.5 rounded-full bg-[#6366f1] ring-4 ring-[#6366f1]/20"
                        title="Unread notification"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NotificationsPage

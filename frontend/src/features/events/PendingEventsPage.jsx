import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  Edit3,
  Filter,
  History,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import CreateEventModal from './CreateEventModal'

function PendingEventsPage() {
  const { showToast } = useToast()
  const reduxUser = useSelector((state) => state.auth?.user)
  const user = useMemo(() => {
    if (reduxUser) return reduxUser
    try {
      const stored = localStorage.getItem('user')
      if (stored) return JSON.parse(stored)
    } catch (e) {}
    return null
  }, [reduxUser])

  const isAdvisor = user?.role === 'FACULTY_ADVISOR'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const canApprove = isAdvisor || isSuperAdmin

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [searchQuery, setSearchQuery] = useState('')
  const [rejectingEvent, setRejectingEvent] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [resubmittingId, setResubmittingId] = useState(null)
  const [memberships, setMemberships] = useState([])

  useEffect(() => {
    load()
    api
      .get('/memberships/me')
      .then((res) => setMemberships(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMemberships([]))
  }, [])

  const canFixAndResubmit = (event) => {
    if (!event || !user) return false
    // Faculty Advisors can never fix or resubmit proposals — they are the review authority
    if (user.role === 'FACULTY_ADVISOR') return false
    // Only the Club President of that club can fix and resubmit
    return memberships.some(
      (m) =>
        m.clubId === event.clubId &&
        m.status === 'APPROVED' &&
        m.position === 'PRESIDENT',
    )
  }

  async function handleResubmit(eventId) {
    setResubmittingId(eventId)
    try {
      await api.post(`/events/${eventId}/resubmit`)
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, approvalStatus: 'PENDING', rejectionReason: null }
            : e,
        ),
      )
      showToast('Event proposal resubmitted to Faculty Advisor for approval 🎉')
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to resubmit event'
      showToast(msg, 'error')
    } finally {
      setResubmittingId(null)
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // First try advisor-history endpoint to get full history (pending, approved, rejected)
      const res = await api.get('/events/advisor-history')
      setEvents(Array.isArray(res.data) ? res.data : [])
    } catch (e) {
      // Fallback to /events/pending if advisor-history is unavailable and user has advisor/admin rights
      if (canApprove) {
        try {
          const pendingRes = await api.get('/events/pending')
          setEvents(Array.isArray(pendingRes.data) ? pendingRes.data : [])
          return
        } catch (err) {}
      }
      const message =
        e.response?.status === 403
          ? 'Access restricted. You need Faculty Advisor, Super Admin, or Club Officer permissions to view proposal approvals.'
          : e.response?.data?.message || 'Failed to load approvals history'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(iso) {
    if (!iso) return 'Date TBA'
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'full' })
  }

  function formatTime(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }

  // Counts
  const counts = useMemo(() => {
    const pending = events.filter((e) => e.approvalStatus === 'PENDING' && !e.cancelled).length
    const approved = events.filter((e) => e.approvalStatus === 'APPROVED').length
    const rejected = events.filter((e) => e.approvalStatus === 'REJECTED').length
    return {
      all: events.length,
      pending,
      approved,
      rejected,
    }
  }, [events])

  // Filtered list
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Status match
      if (statusFilter === 'PENDING' && (evt.approvalStatus !== 'PENDING' || evt.cancelled)) return false
      if (statusFilter === 'APPROVED' && evt.approvalStatus !== 'APPROVED') return false
      if (statusFilter === 'REJECTED' && evt.approvalStatus !== 'REJECTED') return false

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const titleMatch = evt.title?.toLowerCase().includes(q)
        const clubMatch = evt.clubName?.toLowerCase().includes(q)
        const locationMatch = (evt.venueName || evt.location)?.toLowerCase().includes(q)
        if (!titleMatch && !clubMatch && !locationMatch) return false
      }
      return true
    })
  }, [events, statusFilter, searchQuery])

  function findConflictForPendingEvent(evt) {
    if (evt.approvalStatus !== 'PENDING' || evt.cancelled) return null
    const start = new Date(evt.eventDate).getTime()
    const end = evt.endDate ? new Date(evt.endDate).getTime() : start + 2 * 3600 * 1000

    return events.find((other) => {
      if (other.id === evt.id || other.cancelled || other.approvalStatus !== 'APPROVED') return false
      const sameVenue = evt.venueId && other.venueId && evt.venueId === other.venueId
      const sameLocation =
        evt.location &&
        other.location &&
        evt.location.trim().toLowerCase() === other.location.trim().toLowerCase()

      if (!sameVenue && !sameLocation) return false

      const oStart = new Date(other.eventDate).getTime()
      const oEnd = other.endDate ? new Date(other.endDate).getTime() : oStart + 2 * 3600 * 1000

      return start < oEnd && end > oStart
    })
  }

  async function approveEvent(eventId) {
    setSubmittingAction(true)
    try {
      await api.post(`/events/${eventId}/approve`)
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, approvalStatus: 'APPROVED', rejectionReason: null } : e))
      )
      showToast('Event approved successfully! It is now live.')
    } catch (e) {
      const message = e.response?.data?.message || 'Failed to approve event'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSubmittingAction(false)
    }
  }

  async function confirmReject() {
    if (!rejectingEvent) return
    setSubmittingAction(true)
    try {
      await api.post(`/events/${rejectingEvent.id}/reject`, {
        reason: rejectReason.trim() || undefined,
      })
      setEvents((prev) =>
        prev.map((e) =>
          e.id === rejectingEvent.id
            ? { ...e, approvalStatus: 'REJECTED', rejectionReason: rejectReason.trim() || null }
            : e
        )
      )
      showToast('Event rejected and feedback sent to club leadership')
      setRejectingEvent(null)
      setRejectReason('')
    } catch (e) {
      const message = e.response?.data?.message || 'Failed to reject event'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSubmittingAction(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-0.5 text-xs font-semibold text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isAdvisor
                ? 'Faculty Advisor Oversight'
                : isSuperAdmin
                ? 'Super Admin Oversight'
                : 'Club Leadership View'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink dark:text-ink-dark sm:text-3xl">
            {canApprove ? 'Event Approvals & Decision History' : 'Club Event Proposals & Approval Status'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
            {canApprove
              ? 'Review event proposals awaiting your sign-off and track past approval or rejection decisions.'
              : 'Track faculty approval status and feedback for your club\'s submitted event proposals.'}
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={load} className="self-start md:self-auto">
          Refresh History
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            Try Again
          </Button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setStatusFilter('PENDING')}
          className={`text-left rounded-2xl border p-4 transition-all ${
            statusFilter === 'PENDING'
              ? 'border-amber-400 bg-amber-50/80 shadow-xs dark:border-amber-600 dark:bg-amber-950/30'
              : 'border-border bg-white hover:border-amber-200 dark:border-border-dark dark:bg-[#181b24]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Needs Review</span>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-ink dark:text-ink-dark">{counts.pending}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">Pending advisor sign-off</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('APPROVED')}
          className={`text-left rounded-2xl border p-4 transition-all ${
            statusFilter === 'APPROVED'
              ? 'border-emerald-400 bg-emerald-50/80 shadow-xs dark:border-emerald-600 dark:bg-emerald-950/30'
              : 'border-border bg-white hover:border-emerald-200 dark:border-border-dark dark:bg-[#181b24]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Approved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-ink dark:text-ink-dark">{counts.approved}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">Approved & published live</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('REJECTED')}
          className={`text-left rounded-2xl border p-4 transition-all ${
            statusFilter === 'REJECTED'
              ? 'border-rose-400 bg-rose-50/80 shadow-xs dark:border-rose-600 dark:bg-rose-950/30'
              : 'border-border bg-white hover:border-rose-200 dark:border-border-dark dark:bg-[#181b24]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Not Approved</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-ink dark:text-ink-dark">{counts.rejected}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">Rejected with feedback</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`text-left rounded-2xl border p-4 transition-all ${
            statusFilter === 'ALL'
              ? 'border-purple-400 bg-purple-50/80 shadow-xs dark:border-purple-600 dark:bg-purple-950/30'
              : 'border-border bg-white hover:border-purple-200 dark:border-border-dark dark:bg-[#181b24]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">All Decisions</span>
            <History className="h-4 w-4 text-purple-500" />
          </div>
          <p className="mt-2 text-2xl font-black text-ink dark:text-ink-dark">{counts.all}</p>
          <p className="mt-0.5 text-[11px] text-ink-muted dark:text-ink-dark-muted">Total tracked submissions</p>
        </button>
      </div>

      {/* Tabs and Search Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3 dark:border-border-dark">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-surface-secondary text-ink-muted hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:text-ink-dark-muted'
            }`}
          >
            <span>Pending Review</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                statusFilter === 'PENDING' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('APPROVED')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-surface-secondary text-ink-muted hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:text-ink-dark-muted'
            }`}
          >
            <span>Approved by Me</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                statusFilter === 'APPROVED' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
              }`}
            >
              {counts.approved}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('REJECTED')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-surface-secondary text-ink-muted hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:text-ink-dark-muted'
            }`}
          >
            <span>Not Approved / Rejected</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                statusFilter === 'REJECTED' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
              }`}
            >
              {counts.rejected}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-surface-secondary text-ink-muted hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:text-ink-dark-muted'
            }`}
          >
            <span>All Decisions</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                statusFilter === 'ALL' ? 'bg-purple-700 text-white' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300'
              }`}
            >
              {counts.all}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-muted dark:text-ink-dark-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or club..."
            className="w-full rounded-xl border border-border bg-white pl-9 pr-3 py-1.5 text-xs text-ink placeholder-ink-muted/70 focus:border-brand-500 focus:outline-none dark:border-border-dark dark:bg-[#181b24] dark:text-ink-dark"
          />
        </div>
      </div>

      {/* Main List */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          icon={statusFilter === 'PENDING' ? CheckCircle2 : History}
          title={
            statusFilter === 'PENDING'
              ? canApprove
                ? 'No events awaiting approval'
                : 'No pending event proposals'
              : statusFilter === 'APPROVED'
              ? 'No approved events yet'
              : statusFilter === 'REJECTED'
              ? 'No rejected events'
              : 'No event records found'
          }
          description={
            statusFilter === 'PENDING'
              ? canApprove
                ? 'All club event submissions have been reviewed and decided.'
                : 'Your club does not currently have any event proposals awaiting Faculty Advisor sign-off.'
              : 'Try changing your filter or search query.'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const isPending = event.approvalStatus === 'PENDING' && !event.cancelled
            const isApproved = event.approvalStatus === 'APPROVED'
            const isRejected = event.approvalStatus === 'REJECTED'
            const conflict = isPending ? findConflictForPendingEvent(event) : null

            return (
              <Card
                key={event.id}
                interactive={false}
                className={`overflow-hidden border p-0 transition-all ${
                  isPending
                    ? 'border-amber-200/90 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10'
                    : isApproved
                    ? 'border-emerald-200/80 bg-white dark:border-emerald-900/40 dark:bg-[#181b24]'
                    : 'border-rose-200/80 bg-white dark:border-rose-900/40 dark:bg-[#181b24]'
                }`}
              >
                <div className="flex flex-col md:flex-row">
                  {event.bannerB64 && (
                    <img
                      src={event.bannerB64}
                      alt={event.title}
                      className="h-44 w-full object-cover md:h-auto md:w-56 shrink-0"
                    />
                  )}

                  <div className="flex-1 p-5 md:p-6 flex flex-col justify-between">
                    <div>
                      {/* Status Badges & Club Meta */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/clubs/${event.clubId}`}
                          className="rounded-lg bg-surface-secondary px-2.5 py-1 text-xs font-bold text-ink hover:text-brand-500 dark:bg-surface-dark-secondary dark:text-ink-dark transition-colors"
                        >
                          {event.clubName || 'Student Club'}
                        </Link>

                        {isPending && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                            <Clock3 className="h-3 w-3" />
                            Pending Sign-off
                          </span>
                        )}

                        {isApproved && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Approved by Advisor
                          </span>
                        )}

                        {isRejected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-300">
                            <XCircle className="h-3 w-3" />
                            Rejected
                          </span>
                        )}
                      </div>

                      {/* Event Title */}
                      <div className="mt-2.5 flex items-start justify-between gap-4">
                        <Link
                          to={`/events/${event.id}`}
                          className="group text-lg font-bold text-ink hover:text-brand-500 dark:text-ink-dark transition-colors sm:text-xl"
                        >
                          <span>{event.title}</span>
                          <ArrowUpRight className="ml-1 inline h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </div>

                      {/* Description */}
                      {event.description && (
                        <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>
                      )}

                      {/* Scheduling Collision Warning for Advisor / Officer */}
                      {conflict && (
                        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50/90 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                          <div className="min-w-0 flex-1 leading-relaxed">
                            <span className="font-bold text-red-900 dark:text-red-200">
                              ⚠️ Scheduling Collision Detected:
                            </span>{' '}
                            {event.venueName || event.location} is already booked for approved event{' '}
                            <strong className="underline">{conflict.title}</strong> ({conflict.clubName}) at this time. Approving this proposal would result in a double-booked space.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata Grid */}
                    <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 text-xs text-ink-muted dark:border-border-dark dark:text-ink-dark-muted sm:grid-cols-2 md:grid-cols-3">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-brand-500" />
                        <span>
                          {formatDate(event.eventDate)} {formatTime(event.eventDate)}
                        </span>
                      </p>
                      {(event.location || event.venueName) && (
                        <p className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 shrink-0 text-brand-500" />
                          <span>{event.venueName || event.location}</span>
                        </p>
                      )}
                      {event.capacity && (
                        <p className="flex items-center gap-2">
                          <Users className="h-4 w-4 shrink-0 text-brand-500" />
                          <span>Capacity: {event.capacity} attendees</span>
                        </p>
                      )}
                      <p className="flex items-center gap-2">
                        <WalletCards className="h-4 w-4 shrink-0 text-brand-500" />
                        <span>Fee: {Number(event.fee) > 0 ? `$${Number(event.fee).toFixed(2)}` : 'Free'}</span>
                      </p>
                      {event.budget != null && (
                        <p className="flex items-center gap-2">
                          <WalletCards className="h-4 w-4 shrink-0 text-brand-500" />
                          <span>Budget: ${Number(event.budget).toFixed(2)}</span>
                        </p>
                      )}
                    </div>

                    {/* Rejection Feedback Callout (Visible if Rejected) */}
                    {isRejected && (
                      <div className="mt-4 rounded-xl border border-rose-200/90 bg-rose-50/70 p-3.5 dark:border-rose-900/50 dark:bg-rose-950/20">
                        <div className="flex items-start gap-2.5">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                              Advisor Feedback & Reason for Rejection:
                            </p>
                            <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                              {event.rejectionReason || 'No specific reason provided.'}
                            </p>
                          </div>
                        </div>

                        {/* Officer Actions to Fix and Resend to Advisor (Only President) */}
                        {canFixAndResubmit(event) ? (
                          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-rose-200/60 pt-3 dark:border-rose-900/40">
                            <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                              Revise event details or resubmit to the Faculty Advisor once addressed.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingEvent(event)}
                              >
                                <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                                Fix & Resubmit
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={resubmittingId === event.id}
                                onClick={() => handleResubmit(event.id)}
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${resubmittingId === event.id ? 'animate-spin' : ''}`} />
                                {resubmittingId === event.id ? 'Resending...' : 'Resend to Advisor'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 border-t border-rose-200/60 pt-2.5 dark:border-rose-900/40">
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium italic">
                              {isAdvisor
                                ? 'Awaiting revision and resubmission from the Club President.'
                                : 'Only the Club President can revise or resubmit this rejected proposal.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Approved Confirmation Note */}
                    {isApproved && (
                      <div className="mt-4 rounded-xl border border-emerald-200/90 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                            Sign-off completed. This event is published and open to campus members.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Pending Action Buttons or Officer Status */}
                    {isPending && (
                      <div className="mt-5 border-t border-border pt-4 dark:border-border-dark">
                        {canApprove ? (
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={submittingAction}
                              onClick={() => {
                                setRejectingEvent(event)
                                if (conflict) {
                                  setRejectReason(
                                    `Venue scheduling conflict: ${event.venueName || event.location} is already approved for "${conflict.title}" (${conflict.clubName}) at that time. Please reschedule to an open slot or select another venue.`
                                  )
                                } else {
                                  setRejectReason('')
                                }
                              }}
                            >
                              Reject Event
                            </Button>
                            <Button
                              variant="success"
                              size="sm"
                              disabled={submittingAction || !!conflict}
                              title={
                                conflict
                                  ? 'Cannot approve: Overlaps with an already-approved event at this venue'
                                  : 'Approve & publish event'
                              }
                              onClick={() => approveEvent(event.id)}
                            >
                              Approve & Publish
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-amber-50/70 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                            <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                              <Clock3 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span>Proposal submitted — awaiting Faculty Advisor review and sign-off.</span>
                            </div>
                            <Link
                              to={`/events/${event.id}`}
                              className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 hover:text-purple-800 dark:text-purple-300 self-start sm:self-auto"
                            >
                              <span>View Proposal</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Reject Event Modal */}
      {rejectingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl dark:border-border-dark dark:bg-[#181b24]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <XCircle className="h-5 w-5" />
                <h3 className="text-base font-bold text-ink dark:text-ink-dark">Reject Event Proposal</h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingEvent(null)}
                className="rounded-lg p-1 text-ink-muted hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">
              Rejecting <span className="font-semibold text-ink dark:text-ink-dark">{rejectingEvent.title}</span> ({rejectingEvent.clubName}). Please provide guidance for the club leadership.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-ink dark:text-ink-dark mb-1">
                Reason for Rejection / Changes Needed (Optional)
              </label>
              <textarea
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this proposal is rejected or what updates are required before resubmitting (e.g. adjust venue, refine budget, update safety plan)..."
                className="w-full rounded-xl border border-border bg-surface-secondary p-3 text-xs text-ink placeholder-ink-muted/70 focus:border-rose-500 focus:outline-none dark:border-border-dark dark:bg-[#101216] dark:text-ink-dark"
                maxLength={500}
              />
              <p className="mt-1 text-right text-[10px] text-ink-muted dark:text-ink-dark-muted">
                {rejectReason.length}/500 characters
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                disabled={submittingAction}
                onClick={() => setRejectingEvent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={submittingAction}
                onClick={confirmReject}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Fix & Resubmit Modal */}
      {editingEvent && (
        <CreateEventModal
          event={editingEvent}
          clubId={editingEvent.clubId}
          onClose={() => setEditingEvent(null)}
          onCreated={() => {
            setEditingEvent(null)
            load()
          }}
        />
      )}
    </div>
  )
}

export default PendingEventsPage

import {
  AlertCircle,
  Award,
  Ban,
  Calendar,
  CalendarPlus,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  MapPin,
  QrCode,
  RefreshCw,
  Star,
  Trash2,
  Users,
  X,
  Building2,
  Ticket,
  Sparkles,
  ArrowLeft,
  Share2,
  Shield,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { subscribeToTopic } from '../../api/websocket'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EventComments from './EventComments'
import CreateEventModal from './CreateEventModal'
import EventStatusBadge from './EventStatusBadge'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']

function getCategoryGradient(category = '') {
  const cat = (category || '').toLowerCase()
  if (cat.includes('tech') || cat.includes('code') || cat.includes('ai') || cat.includes('hack')) {
    return 'from-blue-600 via-indigo-600 to-cyan-500'
  }
  if (cat.includes('art') || cat.includes('cultur') || cat.includes('photo') || cat.includes('design')) {
    return 'from-purple-600 via-fuchsia-600 to-pink-500'
  }
  if (cat.includes('sport') || cat.includes('hik') || cat.includes('adventur')) {
    return 'from-emerald-600 via-teal-600 to-lime-500'
  }
  if (cat.includes('academ') || cat.includes('debat') || cat.includes('sci')) {
    return 'from-amber-600 via-orange-600 to-yellow-500'
  }
  return 'from-[#6366f1] via-[#7c3aed] to-[#4f46e5]'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function formatFullDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getDurationString(startIso, endIso) {
  if (!startIso || !endIso) return null
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (diffMs <= 0) return null
  const mins = Math.round(diffMs / (1000 * 60))
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours > 0 && remMins > 0) return `${hours} hr ${remMins} min`
  if (hours > 0) return `${hours} hr${hours > 1 ? 's' : ''}`
  return `${mins} min`
}

function EventDetailPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()

  const [event, setEvent] = useState(null)
  const [rsvps, setRsvps] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [attendance, setAttendance] = useState([])
  const [myPosition, setMyPosition] = useState(null)
  const [myRsvpStatus, setMyRsvpStatus] = useState(null)
  const [error, setError] = useState(null)
  const [showEditEvent, setShowEditEvent] = useState(false)
  const [resubmitting, setResubmitting] = useState(false)
  const [feedbackList, setFeedbackList] = useState([])
  const [avgRating, setAvgRating] = useState(0)
  const [myRating, setMyRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState(null)

  useEffect(() => {
    load()
  }, [eventId])

  const qrOpen = Boolean(qrCodeUrl)
  useEffect(() => {
    if (!qrOpen) return undefined
    const timer = setInterval(async () => {
      try {
        const res = await api.get(`/events/${eventId}/qr-code`, { responseType: 'blob' })
        setQrCodeUrl((prev) => {
          if (prev) window.URL.revokeObjectURL(prev)
          return window.URL.createObjectURL(res.data)
        })
      } catch {
        // keep showing current code
      }
    }, 120000)
    return () => clearInterval(timer)
  }, [qrOpen, eventId])

  useEffect(() => {
    const unsubscribe = subscribeToTopic(`/topic/events/${eventId}/waitlist`, (updatedWaitlist) => {
      setWaitlist(updatedWaitlist)
    })
    return unsubscribe
  }, [eventId])

  async function load() {
    try {
      const { data: eventData } = await api.get(`/events/${eventId}`)
      setEvent(eventData)

      const [rsvpRes, waitlistRes, attendanceRes, feedbackRes, avgRes] = await Promise.all([
        api.get(`/events/${eventId}/rsvps`).catch(() => ({ data: [] })),
        api.get(`/events/${eventId}/waitlist`).catch(() => ({ data: [] })),
        api.get(`/events/${eventId}/attendance`).catch(() => ({ data: [] })),
        api.get(`/events/${eventId}/feedback`).catch(() => ({ data: [] })),
        api.get(`/events/${eventId}/feedback/average`).catch(() => ({ data: { averageRating: 0 } })),
      ])
      setRsvps(rsvpRes.data || [])
      setWaitlist(waitlistRes.data || [])
      setAttendance(attendanceRes.data || [])
      setFeedbackList(feedbackRes.data || [])
      setAvgRating(avgRes.data?.averageRating || 0)

      const mine = [...(rsvpRes.data || []), ...(waitlistRes.data || [])].find((r) => r.userId === user?.id)
      setMyRsvpStatus(mine ? mine.status : null)

      try {
        const membersRes = await api.get(`/clubs/${eventData.clubId}/members`)
        const membership = membersRes.data.find((m) => m.userId === user?.id)
        setMyPosition(membership?.position || null)
      } catch {
        setMyPosition(null)
      }
    } catch {
      // ignore
    }
  }

  async function handleRsvp() {
    if (!canRsvp || isStaff) return
    try {
      if (Number(event.fee) > 0) {
        await api.post('/payments', { type: 'EVENT', referenceId: eventId, amount: event.fee })
      }
      const { data } = await api.post(`/events/${eventId}/rsvp`)
      showToast(data.status === 'WAITLISTED' ? 'Event is full — added to the waitlist' : 'RSVP confirmed')
      load()
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  async function handleCancelRsvp() {
    try {
      await api.delete(`/events/${eventId}/rsvp`)
      showToast(Number(event.fee) > 0 ? 'RSVP cancelled — your fee was refunded' : 'RSVP cancelled')
      load()
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  async function handleCancelEvent() {
    const reason = window.prompt(
      'Cancel this event? Everyone who signed up is notified and paid fees are refunded.\n\nReason (shown to attendees, optional):',
    )
    if (reason === null) return
    try {
      await api.post(`/events/${eventId}/cancel`, { reason })
      showToast('Event cancelled')
      load()
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  async function handleDeleteEvent() {
    if (!window.confirm(`Are you sure you want to permanently delete "${event.title}"? This cannot be undone.`)) {
      return
    }
    try {
      await api.delete(`/events/${eventId}`)
      showToast('Event deleted successfully')
      navigate('/events')
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete event', 'error')
    }
  }

  async function handleReviewEvent(approve) {
    const promptMsg = approve
      ? 'Approve this event for the club schedule?'
      : 'Reject this event request?'
    if (!window.confirm(promptMsg)) return
    try {
      if (approve) {
        await api.post(`/events/${eventId}/approve`)
      } else {
        const reason = window.prompt('Provide rejection reason (optional):') || 'Rejected by Faculty Advisor'
        await api.post(`/events/${eventId}/reject`, { reason })
      }
      showToast(approve ? 'Event approved 🎉' : 'Event rejected')
      load()
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleMarkManual(userId) {
    try {
      await api.post(`/events/${eventId}/attendance/manual`, { userId, method: 'MANUAL' })
      showToast('Attendance marked')
      load()
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  async function handleSubmitFeedback(e) {
    e.preventDefault()
    if (myRating < 1) return
    setSubmittingFeedback(true)
    try {
      await api.post(`/events/${eventId}/feedback`, { rating: myRating, comment: feedbackComment })
      showToast('Thanks for the feedback!')
      load()
    } catch (e2) {
      showToast(e2.response?.data?.message || 'Something went wrong', 'error')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  async function handleBulkIssueCertificates() {
    try {
      const { data } = await api.post(`/certificates/clubs/${event.clubId}/events/${eventId}/bulk-issue`)
      showToast(
        `Issued ${data.issuedCount} new certificate${data.issuedCount === 1 ? '' : 's'} — ` +
          `${data.alreadyIssuedCount} already had one for this event`,
      )
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleShowQrCode() {
    try {
      const res = await api.get(`/events/${eventId}/qr-code`, { responseType: 'blob' })
      setQrCodeUrl(window.URL.createObjectURL(res.data))
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  function closeQrCode() {
    if (qrCodeUrl) window.URL.revokeObjectURL(qrCodeUrl)
    setQrCodeUrl(null)
  }

  async function handleAddToCalendar() {
    try {
      const res = await api.get(`/events/${eventId}/ics`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${event.title}.ics`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      showToast('Could not download calendar file', 'error')
    }
  }

  async function handleDirectResubmit() {
    setResubmitting(true)
    try {
      const res = await api.post(`/events/${eventId}/resubmit`)
      setEvent(res.data)
      showToast('Event proposal resubmitted to Faculty Advisor for approval 🎉')
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to resubmit event', 'error')
    } finally {
      setResubmitting(false)
    }
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    )
  }

  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isStaff = isSuperAdmin || isFacultyAdvisor
  const isOfficer = OFFICER_POSITIONS.includes(myPosition) || isSuperAdmin
  const isPresident = myPosition === 'PRESIDENT' || isSuperAdmin
  const alreadyAttended = attendance.some((a) => a.userId === user?.id)
  const canRsvp = !event.cancelled && (event.approvalStatus === 'APPROVED' || event.approvalStatus === 'NOT_REQUIRED')
  const canSendCertificates = !event.cancelled && new Date(event.eventDate) <= new Date()

  const dateObj = new Date(event.eventDate)
  const monthStr = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const dayNum = dateObj.getDate()
  const duration = getDurationString(event.eventDate, event.endDate)
  const gradient = getCategoryGradient(event.clubCategory || event.category || '')
  const isPast = event.endDate
    ? new Date(event.endDate) < new Date()
    : new Date(event.eventDate) < new Date()

  const capacityNum = event.capacity ? Number(event.capacity) : 0
  const spotsLeft = capacityNum > 0 ? Math.max(0, capacityNum - rsvps.length) : null
  const percentFilled = capacityNum > 0 ? Math.min(100, Math.round((rsvps.length / capacityNum) * 100)) : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: 'Clubs', to: '/clubs' },
            { label: event.clubName, to: `/clubs/${event.clubId}` },
            { label: 'Events', to: '/events' },
            { label: event.title },
          ]}
        />
        <Link
          to="/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to all events</span>
        </Link>
      </div>

      {/* Hero Visual Cover Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-slate-900 shadow-md dark:border-slate-800">
        <div className="relative h-64 sm:h-80 w-full overflow-hidden">
          {event.bannerB64 && event.bannerB64.startsWith('data:image') ? (
            <img
              src={event.bannerB64}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-8 text-white relative`}>
              {/* Decorative Geometric Patterns */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/30 pointer-events-none" />
              <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -left-16 -bottom-16 h-72 w-72 rounded-full bg-black/20 blur-2xl" />

              <span className="text-4xl sm:text-6xl font-black uppercase tracking-widest opacity-20 select-none text-center">
                {event.clubName || 'SOCIETY EVENT'}
              </span>
            </div>
          )}

          {/* Vignette Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-slate-950/20" />

          {/* Floating Top Header Badges */}
          <div className="absolute left-4 top-4 right-4 flex items-center justify-between pointer-events-none">
            {/* Date Ribbon Badge */}
            <div className="pointer-events-auto flex min-w-[50px] flex-col items-center justify-center rounded-2xl bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md border border-slate-100/80 dark:bg-slate-900/95 dark:border-slate-700/80">
              <span className="text-[11px] font-black tracking-wider text-[#6366f1] uppercase dark:text-[#818cf8]">
                {monthStr}
              </span>
              <span className="text-xl font-black leading-tight text-slate-900 dark:text-white">
                {dayNum}
              </span>
            </div>

            {/* Status Pills */}
            <div className="pointer-events-auto flex items-center gap-2">
              <EventStatusBadge event={event} isPast={isPast} />
            </div>
          </div>

          {/* Bottom Hero Overlay Content */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 flex flex-col gap-2">
            <Link
              to={`/clubs/${event.clubId}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-800 shadow-sm backdrop-blur-md transition-all hover:bg-white dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-900 w-fit"
            >
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#6366f1] text-[9px] font-bold text-white">
                {(event.clubName || 'C')[0]}
              </div>
              <span>{event.clubName}</span>
            </Link>

            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              {event.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-indigo-300" />
                {formatFullDate(event.eventDate)}
              </span>
              <span className="text-slate-400">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-indigo-300" />
                {formatTime(event.eventDate)}
                {event.endDate && ` – ${formatTime(event.endDate)}`}
              </span>
              {(event.venueName || event.location) && (
                <>
                  <span className="text-slate-400">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-indigo-300" />
                    {event.venueName || event.location}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Organizer Action Toolbar */}
      {isOfficer && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="flex h-2 w-2 rounded-full bg-[#6366f1] animate-pulse" />
            <span>Organizer Management Tools</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEditEvent(true)}>
              <Edit3 className="h-3.5 w-3.5 text-slate-500" />
              Edit event
            </Button>
            <Button variant="secondary" size="sm" onClick={handleShowQrCode}>
              <QrCode className="h-3.5 w-3.5 text-slate-500" />
              Show check-in QR code
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkIssueCertificates}
              disabled={!canSendCertificates}
              title={canSendCertificates ? 'Send certificates to recorded attendees' : 'Certificates can be sent once the event starts'}
            >
              <Award className="h-3.5 w-3.5 text-slate-500" />
              Send certificates
            </Button>
            {!event.cancelled && (
              <Button variant="dangerOutline" size="sm" onClick={handleCancelEvent}>
                <Ban className="h-3.5 w-3.5" />
                Cancel event
              </Button>
            )}
            {(isSuperAdmin || isPresident) && (
              <Button variant="danger" size="sm" onClick={handleDeleteEvent}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete event
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Banner Notifications (Cancellation / Faculty Sign-off) */}
      {event.cancelled && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
          <div className="flex items-start gap-3">
            <Ban className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="text-sm font-bold">This event has been cancelled.</p>
              {event.cancelReason && (
                <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
                  Reason provided: {event.cancelReason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!event.cancelled && event.approvalStatus === 'PENDING' && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-xs dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Pending Faculty Advisor Sign-Off
              </h3>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                This event is awaiting review by a Faculty Advisor. Public registration and ticket check-ins will activate automatically once approved.
              </p>
              {isFacultyAdvisor && (
                <div className="mt-4 flex items-center gap-2.5">
                  <Button size="sm" variant="success" onClick={() => handleReviewEvent(true)}>
                    <Check className="h-3.5 w-3.5" /> Approve Event
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleReviewEvent(false)}>
                    <X className="h-3.5 w-3.5" /> Reject Event
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!event.cancelled && event.approvalStatus === 'REJECTED' && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/95 p-5 text-rose-900 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-rose-950 dark:text-rose-100">
                Event Proposal Rejected by Faculty Advisor
              </h3>
              <div className="mt-2 rounded-xl border border-rose-200/90 bg-white/70 p-3 text-xs dark:border-rose-900/50 dark:bg-rose-950/30">
                <p className="font-semibold text-rose-900 dark:text-rose-200">Advisor Feedback & Reason:</p>
                <p className="mt-0.5 text-rose-800 dark:text-rose-300">
                  {event.rejectionReason || 'No specific reason provided.'}
                </p>
              </div>
              {isPresident && !isFacultyAdvisor ? (
                <>
                  <p className="mt-2 text-xs text-rose-700 dark:text-rose-400">
                    Fix the highlighted issues and click "Fix Issues & Resubmit" to update the proposal, or resend once resolved.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-rose-200/80 pt-3 dark:border-rose-900/40">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setShowEditEvent(true)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Fix Issues & Resubmit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={resubmitting}
                      onClick={handleDirectResubmit}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${resubmitting ? 'animate-spin' : ''}`} />
                      {resubmitting ? 'Resending...' : 'Resend Proposal to Advisor'}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs italic text-rose-700 dark:text-rose-400">
                  {isFacultyAdvisor
                    ? 'Awaiting revision and resubmission from the Club President.'
                    : 'Only the Club President can revise or resubmit this rejected proposal.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Content & Community) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: About the Event */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="h-4 w-4 text-[#6366f1]" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                About this Event
              </h2>
            </div>

            <div className="mt-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {event.description || 'No detailed description provided for this event.'}
            </div>

            {/* Venue & Location Highlight */}
            {(event.venueName || event.location) && (
              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/40 dark:text-indigo-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Location & Venue Booking
                    </h4>
                    <p className="mt-0.5 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {event.venueName || event.location}
                      {event.venueBuilding && ` • ${event.venueBuilding}`}
                    </p>
                    {event.endDate && (
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        Reserved schedule: {formatTime(event.eventDate)} – {formatTime(event.endDate)}
                        {duration && ` (${duration})`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Host Club Details */}
            <div className="mt-6 flex items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#6366f1] to-purple-600 text-sm font-bold text-white shadow-xs">
                  {(event.clubName || 'C')[0]}
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Organized by
                  </p>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {event.clubName}
                  </p>
                </div>
              </div>

              <Link
                to={`/clubs/${event.clubId}`}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                View Club Profile
              </Link>
            </div>
          </div>

          {/* Card 2: Attendees & Going */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Going ({rsvps.length}{event.capacity ? ` / ${event.capacity}` : ''})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Students registered and confirmed for this event.
                  </p>
                </div>
              </div>

              {capacityNum > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${percentFilled}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {percentFilled}% full
                  </span>
                </div>
              )}
            </div>

            {rsvps.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No attendees registered yet.
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Be the first to confirm your spot!
                </p>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {rsvps.map((r) => {
                  const isCheckedIn = attendance.some((a) => a.userId === r.userId)
                  const initials = (r.userName || 'U')[0].toUpperCase()

                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/70"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {initials}
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {r.userName}
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isCheckedIn ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Attended
                          </span>
                        ) : (
                          isOfficer && (
                            <button
                              type="button"
                              onClick={() => handleMarkManual(r.userId)}
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs transition-all hover:bg-emerald-500"
                            >
                              Mark present
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Card 3: Waitlist (if active) */}
          {waitlist.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Waitlist Queue ({waitlist.length})
                  </h2>
                </div>
                <span className="text-xs text-slate-400">
                  Auto-promoted when a spot opens
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {waitlist.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50/50 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/20"
                  >
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {r.userName}
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                      #{r.waitlistOrder}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 4: Attendee Feedback & Ratings */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Attendee Reviews & Feedback
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Feedback provided by verified event attendees.
                  </p>
                </div>
              </div>

              {feedbackList.length > 0 && (
                <div className="flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {avgRating.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({feedbackList.length} reviews)
                  </span>
                </div>
              )}
            </div>

            {/* Leave Feedback Form */}
            {alreadyAttended && !feedbackList.some((f) => f.userId === user?.id) && (
              <form onSubmit={handleSubmitFeedback} className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Rate your event experience:
                </p>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setMyRating(star)}
                      className={`text-2xl transition-transform hover:scale-110 ${
                        star <= myRating ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600'
                      }`}
                      aria-label={`${star} star`}
                    >
                      ★
                    </button>
                  ))}
                  {myRating > 0 && (
                    <span className="ml-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {myRating} of 5 stars
                    </span>
                  )}
                </div>

                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Share details on speakers, activities, or venue setup (optional)..."
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-all focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <Button type="submit" disabled={myRating < 1} loading={submittingFeedback} size="sm">
                  Submit feedback
                </Button>
              </form>
            )}

            {/* Feedback List */}
            {feedbackList.length === 0 ? (
              <p className="mt-5 text-xs text-slate-400 text-center py-4">
                No feedback reviews posted yet.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {feedbackList.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-amber-400 text-sm">
                        {'★'.repeat(f.rating)}
                        <span className="text-slate-200 dark:text-slate-700">
                          {'★'.repeat(5 - f.rating)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {f.userName}
                      </span>
                    </div>
                    {f.comment && (
                      <p className="mt-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        "{f.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 5: Discussion & Q&A */}
          <EventComments eventId={eventId} isPresident={isPresident} />
        </div>

        {/* Right Column (Sticky Ticket & Logistics Sidebar) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
            {/* Ticket Header & Price */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-[#6366f1]" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Registration & Entry
                </span>
              </div>

              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                {Number(event.fee) > 0 ? `$${Number(event.fee).toFixed(2)}` : 'Free Admission'}
              </span>
            </div>

            {/* RSVP Main Action CTA */}
            <div className="space-y-2">
              {!myRsvpStatus && canRsvp && !isStaff && (
                <button
                  type="button"
                  onClick={handleRsvp}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#4f46e5] px-4 py-3 text-xs font-bold text-white shadow-sm transition-all hover:opacity-95 hover:shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{Number(event.fee) > 0 ? `RSVP (pay $${event.fee})` : 'RSVP for Event'}</span>
                </button>
              )}

              {myRsvpStatus && myRsvpStatus !== 'CANCELLED' && !isStaff && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 border border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/40">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span>{myRsvpStatus === 'WAITLISTED' ? 'You are on the waitlist' : 'RSVP Confirmed'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelRsvp}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {myRsvpStatus === 'WAITLISTED' ? 'Leave waitlist' : 'Cancel RSVP'}
                  </button>
                </div>
              )}

              {/* Staff Oversight / Read-Only Notice */}
              {isStaff && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-center dark:border-indigo-900/50 dark:bg-indigo-950/30">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <Shield className="h-4 w-4" />
                    <span>{isFacultyAdvisor ? 'Faculty Advisor Oversight' : 'Administrative Oversight'}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {isFacultyAdvisor
                      ? 'You have read-only access to view this event, monitor proposals, and inspect attendees. Faculty Advisors cannot join or RSVP to student events.'
                      : 'Super Admins have platform-wide read-only access and cannot join or RSVP to events.'}
                  </p>
                </div>
              )}

              {/* Add to Calendar Button */}
              <button
                type="button"
                onClick={handleAddToCalendar}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <CalendarPlus className="h-4 w-4 text-slate-500" />
                <span>Add to calendar (.ics)</span>
              </button>
            </div>

            {/* Check-in Status Alert */}
            {alreadyAttended ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>You are checked in to this event.</span>
              </div>
            ) : (event.approvalStatus === 'APPROVED' || event.approvalStatus === 'NOT_REQUIRED') && !event.cancelled && !isStaff ? (
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-400 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-slate-500 shrink-0" />
                <span>At the venue, scan the organiser's QR code to record attendance.</span>
              </div>
            ) : null}

            {/* Event Logistics Checklist */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Date</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {formatFullDate(event.eventDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Time & Duration</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {formatTime(event.eventDate)}
                    {event.endDate && ` – ${formatTime(event.endDate)}`}
                    {duration && ` • ${duration}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Venue / Room</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {event.venueName || event.location || 'Campus venue'}
                    {event.venueBuilding && ` (${event.venueBuilding})`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Users className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Capacity & Availability</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    {capacityNum > 0
                      ? `${spotsLeft} spots remaining (${rsvps.length} / ${capacityNum} taken)`
                      : 'Unlimited open seating'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Event Modal */}
      {showEditEvent && (
        <CreateEventModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onCreated={() => load()}
        />
      )}

      {/* QR Code Modal */}
      {qrCodeUrl && (
        <Modal title="Event Check-In QR Code" onClose={closeQrCode} maxWidth="max-w-sm">
          <div className="text-center space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Display this screen at the entrance. Attendees scan with their phone camera to check in immediately. Code refreshes automatically every 2 minutes.
            </p>
            <div className="p-4 bg-white rounded-2xl shadow-inner border border-slate-100 inline-block mx-auto">
              <img src={qrCodeUrl} alt="Event check-in QR code" className="mx-auto h-64 w-64 object-contain" />
            </div>
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              ● Live Check-In Scanner Active
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default EventDetailPage

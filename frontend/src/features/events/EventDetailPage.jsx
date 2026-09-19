import { Award, Ban, CalendarPlus, CheckCircle2, MapPin, QrCode, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import api from '../../api/axios'
import { subscribeToTopic } from '../../api/websocket'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import EventComments from './EventComments'
import CreateEventModal from './CreateEventModal'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function EventDetailPage() {
  const { eventId } = useParams()
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
        // keep showing the current code; the next tick will retry
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
    const { data: eventData } = await api.get(`/events/${eventId}`)
    setEvent(eventData)

    const [rsvpRes, waitlistRes, attendanceRes, feedbackRes, avgRes] = await Promise.all([
      api.get(`/events/${eventId}/rsvps`),
      api.get(`/events/${eventId}/waitlist`),
      api.get(`/events/${eventId}/attendance`),
      api.get(`/events/${eventId}/feedback`),
      api.get(`/events/${eventId}/feedback/average`),
    ])
    setRsvps(rsvpRes.data)
    setWaitlist(waitlistRes.data)
    setAttendance(attendanceRes.data)
    setFeedbackList(feedbackRes.data)
    setAvgRating(avgRes.data.averageRating)

    const mine = [...rsvpRes.data, ...waitlistRes.data].find((r) => r.userId === user?.id)
    setMyRsvpStatus(mine ? mine.status : null)

    try {
      const membersRes = await api.get(`/clubs/${eventData.clubId}/members`)
      const membership = membersRes.data.find((m) => m.userId === user?.id)
      setMyPosition(membership?.position || null)
    } catch {
      setMyPosition(null)
    }
  }

  async function handleRsvp() {
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
          `${data.alreadyIssuedCount} already had one, ${data.notYetEligibleCount} not yet eligible`,
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
    const res = await api.get(`/events/${eventId}/ics`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.title}.ics`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <div className="h-6 w-40 animate-pulse rounded bg-surface-muted dark:bg-surface-dark-muted" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
      </div>
    )
  }

  const isOfficer = OFFICER_POSITIONS.includes(myPosition)
  const isPresident = myPosition === 'PRESIDENT'
  const alreadyAttended = attendance.some((a) => a.userId === user?.id)

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Breadcrumbs
        items={[
          { label: 'Clubs', to: '/clubs' },
          { label: event.clubName, to: `/clubs/${event.clubId}` },
          { label: 'Events', to: '/events' },
          { label: event.title },
        ]}
      />
      <div className="flex items-center justify-between gap-2">
        <Badge tone="brand">{event.clubName}</Badge>
        {isOfficer && (
          <Button variant="secondary" size="sm" onClick={() => setShowEditEvent(true)}>
            Edit event
          </Button>
        )}
      </div>
      {isOfficer && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleShowQrCode}>
            <QrCode className="h-3.5 w-3.5" />
            Show check-in QR code
          </Button>
          <Button variant="secondary" size="sm" onClick={handleBulkIssueCertificates}>
            <Award className="h-3.5 w-3.5" />
            Bulk-issue certificates
          </Button>
          {!event.cancelled && (
            <Button variant="dangerOutline" size="sm" onClick={handleCancelEvent}>
              <Ban className="h-3.5 w-3.5" />
              Cancel event
            </Button>
          )}
        </div>
      )}
      {event.cancelled && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          This event has been cancelled{event.cancelReason ? `: ${event.cancelReason}` : '.'}
        </p>
      )}
      {!event.cancelled && event.approvalStatus === 'PENDING' && (
        <p className="mt-3 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
          Waiting for Faculty Advisor approval — not visible to students yet.
        </p>
      )}
      {!event.cancelled && event.approvalStatus === 'REJECTED' && (
        <p className="mt-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          Rejected by the Faculty Advisor{event.rejectionReason ? `: ${event.rejectionReason}` : '.'} Edit the event
          to resubmit it.
        </p>
      )}
      <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-ink-dark">{event.title}</h1>
      <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{formatDate(event.eventDate)}</p>
      {event.location && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted dark:text-ink-dark-muted">
          <MapPin className="h-4 w-4" />
          {event.location}
        </p>
      )}
      {event.venueName && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted dark:text-ink-dark-muted">
          <MapPin className="h-4 w-4" />
          Booked: {event.venueName}
          {event.venueBuilding ? ` (${event.venueBuilding})` : ''}
          {event.endDate ? ` · ${formatDate(event.eventDate)} – ${new Date(event.endDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}
        </p>
      )}
      <p className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">{event.description}</p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {!myRsvpStatus && !event.cancelled && (
          <Button onClick={handleRsvp}>
            <CheckCircle2 className="h-4 w-4" />
            {Number(event.fee) > 0 ? `RSVP (pay ${event.fee})` : 'RSVP'}
          </Button>
        )}
        {myRsvpStatus && myRsvpStatus !== 'CANCELLED' && (
          <Button variant="secondary" onClick={handleCancelRsvp}>
            <X className="h-4 w-4" />
            {myRsvpStatus === 'WAITLISTED' ? 'Leave waitlist' : 'Cancel RSVP'}
          </Button>
        )}
        {myRsvpStatus && myRsvpStatus !== 'CANCELLED' && (
          <Button variant="secondary" onClick={handleAddToCalendar}>
            <CalendarPlus className="h-4 w-4" />
            Add to calendar
          </Button>
        )}
      </div>

      {myRsvpStatus && (
        <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">Your RSVP status: {myRsvpStatus}</p>
      )}
      {alreadyAttended ? (
        <p className="mt-2 text-xs text-success">You are checked in.</p>
      ) : (
        <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">
          To check in at the event, scan the QR code the organisers are showing.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
          Going ({rsvps.length}
          {event.capacity ? ` / ${event.capacity}` : ''})
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rsvps.map((r) => (
            <Card key={r.id} interactive={false} className="flex items-center justify-between">
              <span className="text-sm text-ink dark:text-ink-dark">{r.userName}</span>
              {isOfficer && !attendance.some((a) => a.userId === r.userId) && (
                <button
                  type="button"
                  onClick={() => handleMarkManual(r.userId)}
                  className="rounded-md bg-success px-2 py-1 text-xs font-medium text-white transition-fast hover:opacity-90"
                >
                  Mark present
                </button>
              )}
              {attendance.some((a) => a.userId === r.userId) && <Badge tone="success">Attended</Badge>}
            </Card>
          ))}
        </div>
      </section>

      {waitlist.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Waitlist ({waitlist.length})</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {waitlist.map((r) => (
              <Card key={r.id} interactive={false} className="flex items-center justify-between">
                <span className="text-sm text-ink dark:text-ink-dark">{r.userName}</span>
                <span className="text-xs text-ink-muted dark:text-ink-dark-muted">#{r.waitlistOrder}</span>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
          Feedback {feedbackList.length > 0 && `(avg ${avgRating.toFixed(1)} / 5, ${feedbackList.length} review(s))`}
        </h2>

        {alreadyAttended && !feedbackList.some((f) => f.userId === user?.id) && (
          <Card interactive={false} as="form" onSubmit={handleSubmitFeedback} className="mt-3 space-y-2">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setMyRating(star)}
                  className={`text-xl ${star <= myRating ? 'text-warning' : 'text-ink-muted dark:text-ink-dark-muted'}`}
                  aria-label={`${star} star`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
              placeholder="Optional comment..."
              rows={2}
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            />
            <Button type="submit" disabled={myRating < 1} loading={submittingFeedback}>
              Submit feedback
            </Button>
          </Card>
        )}

        {feedbackList.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">No feedback yet.</p>
        )}
        <div className="mt-3 space-y-2">
          {feedbackList.map((f) => (
            <Card key={f.id} interactive={false}>
              <p className="text-sm font-medium text-warning">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</p>
              {f.comment && <p className="mt-1 text-sm text-ink dark:text-ink-dark">{f.comment}</p>}
              <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">— {f.userName}</p>
            </Card>
          ))}
        </div>
      </section>

      <EventComments eventId={eventId} isPresident={isPresident} />

      {showEditEvent && (
        <CreateEventModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onCreated={() => load()}
        />
      )}

      {qrCodeUrl && (
        <Modal title="Check-in QR code" onClose={closeQrCode} maxWidth="max-w-sm">
          <div className="text-center">
            <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
              Attendees scan this to check themselves in. The code refreshes automatically, so keep this window open
              rather than sharing a screenshot.
            </p>
            <img src={qrCodeUrl} alt="Event check-in QR code" className="mx-auto mt-4 h-64 w-64" />
          </div>
        </Modal>
      )}
    </div>
  )
}

export default EventDetailPage

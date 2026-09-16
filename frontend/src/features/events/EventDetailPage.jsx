import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import api from '../../api/axios'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
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

  useEffect(() => {
    load()
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
      showToast('RSVP cancelled')
      load()
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  async function handleQrCheckIn() {
    try {
      await api.post(`/events/${eventId}/attendance/qr-check-in`)
      showToast('Checked in')
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
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
          {event.clubName}
        </span>
        {isOfficer && (
          <button
            type="button"
            onClick={() => setShowEditEvent(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
          >
            Edit event
          </button>
        )}
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-ink dark:text-ink-dark">{event.title}</h1>
      <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{formatDate(event.eventDate)}</p>
      {event.location && (
        <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">📍 {event.location}</p>
      )}
      <p className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">{event.description}</p>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {!myRsvpStatus && (
          <button
            type="button"
            onClick={handleRsvp}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700"
          >
            {Number(event.fee) > 0 ? `RSVP (pay ${event.fee})` : 'RSVP'}
          </button>
        )}
        {myRsvpStatus && myRsvpStatus !== 'CANCELLED' && (
          <button
            type="button"
            onClick={handleCancelRsvp}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
          >
            {myRsvpStatus === 'WAITLISTED' ? 'Leave waitlist' : 'Cancel RSVP'}
          </button>
        )}
        {!alreadyAttended && (
          <button
            type="button"
            onClick={handleQrCheckIn}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
          >
            QR check-in
          </button>
        )}
        {myRsvpStatus && myRsvpStatus !== 'CANCELLED' && (
          <button
            type="button"
            onClick={handleAddToCalendar}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
          >
            Add to calendar
          </button>
        )}
      </div>

      {myRsvpStatus && (
        <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">Your RSVP status: {myRsvpStatus}</p>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
          Going ({rsvps.length}
          {event.capacity ? ` / ${event.capacity}` : ''})
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rsvps.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
            >
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
              {attendance.some((a) => a.userId === r.userId) && (
                <span className="text-xs text-success">Attended</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {waitlist.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Waitlist ({waitlist.length})</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {waitlist.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <span className="text-sm text-ink dark:text-ink-dark">{r.userName}</span>
                <span className="text-xs text-ink-muted dark:text-ink-dark-muted">#{r.waitlistOrder}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
          Feedback {feedbackList.length > 0 && `(avg ${avgRating.toFixed(1)} / 5, ${feedbackList.length} review(s))`}
        </h2>

        {alreadyAttended && !feedbackList.some((f) => f.userId === user?.id) && (
          <form onSubmit={handleSubmitFeedback} className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
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
            <button
              type="submit"
              disabled={submittingFeedback || myRating < 1}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
            >
              Submit feedback
            </button>
          </form>
        )}

        {feedbackList.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">No feedback yet.</p>
        )}
        <div className="mt-3 space-y-2">
          {feedbackList.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
              <p className="text-sm font-medium text-warning">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</p>
              {f.comment && <p className="mt-1 text-sm text-ink dark:text-ink-dark">{f.comment}</p>}
              <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">— {f.userName}</p>
            </div>
          ))}
        </div>
      </section>

      {showEditEvent && (
        <CreateEventModal
          event={event}
          onClose={() => setShowEditEvent(false)}
          onCreated={() => load()}
        />
      )}
    </div>
  )
}

export default EventDetailPage

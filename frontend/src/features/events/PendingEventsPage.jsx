import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'

function PendingEventsPage() {
  const { showToast } = useToast()
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  function load() {
    api.get('/events/pending').then((res) => setEvents(res.data)).catch((e) => setError(e.response?.data?.message))
  }

  async function review(eventId, approve) {
    try {
      await api.post(`/events/${eventId}/${approve ? 'approve' : 'reject'}`)
      setEvents((prev) => prev.filter((e) => e.id !== eventId))
      showToast(approve ? 'Event approved' : 'Event rejected')
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Pending event approvals</h1>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {events.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted dark:text-ink-dark-muted">No events awaiting approval.</p>
      )}

      <div className="mt-6 space-y-3">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
          >
            <div>
              <h2 className="font-semibold text-ink dark:text-ink-dark">{event.title}</h2>
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {event.clubName} — fee {event.fee} — {new Date(event.eventDate).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => review(event.id, true)}
                className="rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-fast hover:opacity-90"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => review(event.id, false)}
                className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white transition-fast hover:opacity-90"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PendingEventsPage

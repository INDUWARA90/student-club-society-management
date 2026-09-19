import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'

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
    let reason
    if (!approve) {
      reason = window.prompt('Reason for rejecting (shown to the club, optional):')
      if (reason === null) return
    }
    try {
      await api.post(`/events/${eventId}/${approve ? 'approve' : 'reject'}`, approve ? undefined : { reason })
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
      <PageHeader title="Pending event approvals" />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {events.length === 0 && (
        <EmptyState icon={CheckCircle2} description="No events awaiting approval." />
      )}

      <div className="mt-6 space-y-3">
        {events.map((event) => (
          <Card key={event.id} interactive={false} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink dark:text-ink-dark">{event.title}</h2>
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {event.clubName} — fee {event.fee} — {new Date(event.eventDate).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={() => review(event.id, true)}>
                Approve
              </Button>
              <Button variant="danger" size="sm" onClick={() => review(event.id, false)}>
                Reject
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default PendingEventsPage

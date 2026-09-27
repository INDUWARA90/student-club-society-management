import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, MapPin, Users, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'full' })
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
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
          <Card key={event.id} interactive={false} className="overflow-hidden p-0">
            <div className="flex flex-col md:flex-row">
              {event.bannerB64 && (
                <img src={event.bannerB64} alt="" className="h-36 w-full object-cover md:h-auto md:w-48" />
              )}
              <div className="min-w-0 flex-1 p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                      {event.clubName}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-ink dark:text-ink-dark">{event.title}</h2>
                  </div>
                  <Link
                    to={`/events/${event.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
                  >
                    View event
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {event.description && (
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-muted dark:text-ink-dark-muted">
                    {event.description}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-ink-muted dark:text-ink-dark-muted sm:grid-cols-2">
                  <p className="flex items-start gap-2">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <span>{formatDate(event.eventDate)}</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <span>
                      {formatTime(event.eventDate)}
                      {event.endDate ? ` - ${formatTime(event.endDate)}` : ''}
                    </span>
                  </p>
                  {(event.location || event.venueName) && (
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <span>{event.venueName || event.location}</span>
                    </p>
                  )}
                  {event.capacity && (
                    <p className="flex items-start gap-2">
                      <Users className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <span>Capacity: {event.capacity}</span>
                    </p>
                  )}
                  <p className="flex items-start gap-2">
                    <WalletCards className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                    <span>Fee: {Number(event.fee) > 0 ? event.fee : 'Free'}</span>
                  </p>
                  {event.budget != null && (
                    <p className="flex items-start gap-2">
                      <WalletCards className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                      <span>Budget: {event.budget}</span>
                    </p>
                  )}
                </div>

                <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 dark:border-border-dark sm:flex-row sm:justify-end">
                  <Button variant="danger" size="sm" onClick={() => review(event.id, false)}>
                    Reject
                  </Button>
                  <Button variant="success" size="sm" onClick={() => review(event.id, true)}>
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default PendingEventsPage

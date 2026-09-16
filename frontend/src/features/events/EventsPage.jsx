import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import { fetchEvents } from './eventsSlice'

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function EventsPage() {
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.events)
  const [search, setSearch] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    dispatch(fetchEvents())
  }, [dispatch])

  const visibleEvents = items.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(search.trim().toLowerCase()) ||
      event.clubName.toLowerCase().includes(search.trim().toLowerCase())
    const matchesDate = !date || event.eventDate.slice(0, 10) === date
    return matchesSearch && matchesDate
  })

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Events</h1>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events by title or club..."
          className="min-w-[200px] flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        />
        {date && (
          <button
            type="button"
            onClick={() => setDate('')}
            className="text-sm text-brand-600 hover:underline"
          >
            Clear date
          </button>
        )}
      </div>

      {status === 'loading' && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
          ))}
        </div>
      )}

      {status !== 'loading' && visibleEvents.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-4xl">📅</p>
          <p className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">
            {items.length === 0 ? 'No events yet — check back soon!' : 'No events match your search.'}
          </p>
        </div>
      )}

      {status !== 'loading' && visibleEvents.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleEvents.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="rounded-xl border border-border bg-surface p-4 shadow-card transition-base hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
            >
              <div className="flex aspect-video items-center justify-center rounded-lg bg-surface-muted text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
                {event.bannerB64 ? (
                  <img src={event.bannerB64} alt={event.title} className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <span className="text-2xl">📅</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-ink dark:text-ink-dark">{event.title}</h2>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {event.clubName}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{formatDate(event.eventDate)}</p>
              {Number(event.fee) > 0 && (
                <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">Fee: {event.fee}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default EventsPage

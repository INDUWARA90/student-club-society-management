import { CalendarDays, ChevronLeft, ChevronRight, List, LayoutGrid } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { buildMonthGrid, formatMonthYear, isSameDay, toDateKey, addMonths } from '../../utils/date'
import { fetchEvents } from '../events/eventsSlice'

const CHIP_TONES = ['brand', 'success', 'warning', 'danger', 'info']
const CHIP_CLASSES = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
}

function toneForClub(clubId) {
  let hash = 0
  for (let i = 0; i < clubId.length; i += 1) hash = (hash * 31 + clubId.charCodeAt(i)) % CHIP_TONES.length
  return CHIP_TONES[Math.abs(hash)]
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function CalendarPage() {
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.events)
  const [month, setMonth] = useState(() => new Date())
  const [clubFilter, setClubFilter] = useState('all')
  const [view, setView] = useState('month')
  const [activeDay, setActiveDay] = useState(null)

  useEffect(() => {
    dispatch(fetchEvents())
  }, [dispatch])

  const clubs = useMemo(() => {
    const map = new Map()
    items.forEach((e) => map.set(e.clubId, e.clubName))
    return Array.from(map, ([id, name]) => ({ id, name }))
  }, [items])

  const visibleEvents = useMemo(
    () => (clubFilter === 'all' ? items : items.filter((e) => e.clubId === clubFilter)),
    [items, clubFilter],
  )

  const eventsByDay = useMemo(() => {
    const map = new Map()
    visibleEvents.forEach((event) => {
      const key = toDateKey(new Date(event.eventDate))
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    })
    return map
  }, [visibleEvents])

  const grid = useMemo(() => buildMonthGrid(month), [month])
  const today = new Date()

  const upcoming = useMemo(
    () =>
      [...visibleEvents]
        .filter((e) => new Date(e.eventDate) >= new Date(new Date().toDateString()))
        .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)),
    [visibleEvents],
  )

  const activeDayEvents = activeDay ? eventsByDay.get(toDateKey(activeDay)) || [] : []

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title="Calendar"
        description="Every upcoming event across all clubs, in one place."
        actions={
          <>
            <select
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            >
              <option value="all">All clubs</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex overflow-hidden rounded-md border border-border dark:border-border-dark">
              <button
                type="button"
                onClick={() => setView('month')}
                aria-label="Month view"
                className={`p-2 transition-fast ${view === 'month' ? 'bg-brand-gradient text-white' : 'text-ink-muted hover:bg-surface-muted dark:text-ink-dark-muted dark:hover:bg-surface-dark'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView('agenda')}
                aria-label="Agenda view"
                className={`p-2 transition-fast ${view === 'agenda' ? 'bg-brand-gradient text-white' : 'text-ink-muted hover:bg-surface-muted dark:text-ink-dark-muted dark:hover:bg-surface-dark'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </>
        }
      />

      {status === 'loading' && (
        <div className="mt-6 grid grid-cols-7 gap-2">
          {Array.from({ length: 21 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {status !== 'loading' && view === 'month' && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">{formatMonthYear(month)}</h2>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setMonth(new Date())}>
                Today
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-ink-muted dark:text-ink-dark-muted">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((day) => {
              const dayEvents = eventsByDay.get(toDateKey(day)) || []
              const inMonth = day.getMonth() === month.getMonth()
              const isToday = isSameDay(day, today)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => dayEvents.length > 0 && setActiveDay(day)}
                  className={`min-h-20 rounded-lg border border-border p-1.5 text-left align-top transition-fast dark:border-border-dark ${
                    inMonth ? 'bg-surface dark:bg-surface-dark-muted' : 'bg-surface-muted/50 dark:bg-surface-dark/50'
                  } ${dayEvents.length > 0 ? 'cursor-pointer hover:shadow-card-hover' : 'cursor-default'}`}
                >
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? 'bg-brand-gradient font-semibold text-white'
                        : inMonth
                          ? 'text-ink dark:text-ink-dark'
                          : 'text-ink-muted/60 dark:text-ink-dark-muted/60'
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`truncate rounded px-1 py-0.5 text-[11px] font-medium ${CHIP_CLASSES[toneForClub(event.clubId)]}`}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="px-1 text-[11px] text-ink-muted dark:text-ink-dark-muted">
                        +{dayEvents.length - 2} more
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {status !== 'loading' && view === 'agenda' && (
        <div className="mt-6">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming events"
              description="Check back soon, or clear the club filter."
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="flex items-center gap-4 rounded-xl border border-border bg-surface p-3 shadow-card transition-fast hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
                >
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-brand-gradient-soft text-brand-600 dark:text-brand-300">
                    <span className="text-[10px] font-medium uppercase">
                      {new Date(event.eventDate).toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <span className="text-sm font-semibold">{new Date(event.eventDate).getDate()}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-ink dark:text-ink-dark">{event.title}</p>
                    <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                      {formatTime(event.eventDate)} · {event.clubName}
                    </p>
                  </div>
                  <Badge tone={toneForClub(event.clubId)}>{event.clubName}</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeDay && (
        <Modal title={activeDay.toLocaleDateString(undefined, { dateStyle: 'full' })} onClose={() => setActiveDay(null)}>
          <div className="space-y-2">
            {activeDayEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                onClick={() => setActiveDay(null)}
                className="block rounded-lg border border-border p-3 transition-fast hover:bg-surface-muted dark:border-border-dark dark:hover:bg-surface-dark"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink dark:text-ink-dark">{event.title}</p>
                  <Badge tone={toneForClub(event.clubId)}>{event.clubName}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
                  {formatTime(event.eventDate)}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default CalendarPage

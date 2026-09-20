import { ClipboardCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'

const METHOD_LABEL = { QR: 'QR check-in', MANUAL: 'Marked by an officer' }

/** A student's own attendance history across every club, newest event first. */
function MyParticipationPage() {
  const [records, setRecords] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/attendance/me')
      .then((res) => setRecords(res.data))
      .catch((e) => setError(e.response?.data?.message || 'Could not load your participation history'))
  }, [])

  const perClub = useMemo(() => {
    const counts = new Map()
    for (const r of records || []) counts.set(r.clubName, (counts.get(r.clubName) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [records])

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-4xl p-4 text-sm text-danger md:p-8">
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="My participation"
        description="Every event you have been checked in to, across all your clubs."
      />

      {!records && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {records && records.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title="No participation yet"
          description="Once you are checked in to an event, it will show up here."
        />
      )}

      {records && records.length > 0 && (
        <>
          <section aria-label="Summary" className="mt-6 flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              {records.length} event{records.length === 1 ? '' : 's'} attended
            </Badge>
            {perClub.map(([club, count]) => (
              <Badge key={club}>
                {club}: {count}
              </Badge>
            ))}
          </section>

          <ul className="mt-4 space-y-2" aria-label="Attended events">
            {records.map((r) => (
              <li key={r.eventId}>
                <Card interactive={false} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/events/${r.eventId}`}
                      className="font-medium text-ink hover:underline dark:text-ink-dark"
                    >
                      {r.eventTitle}
                    </Link>
                    <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                      <Link to={`/clubs/${r.clubId}`} className="hover:underline">
                        {r.clubName}
                      </Link>
                      {r.eventDate && ` · ${new Date(r.eventDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}`}
                    </p>
                  </div>
                  <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
                    {METHOD_LABEL[r.method] || r.method} · {new Date(r.markedAt).toLocaleString()}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default MyParticipationPage

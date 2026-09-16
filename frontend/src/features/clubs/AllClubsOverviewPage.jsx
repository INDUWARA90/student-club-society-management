import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../api/axios'

const STATUS_PILL_CLASS = {
  APPROVED: 'bg-success/10 text-success',
  PENDING: 'bg-warning/10 text-warning',
  REJECTED: 'bg-danger/10 text-danger',
}

function AllClubsOverviewPage() {
  const [clubs, setClubs] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    api.get('/clubs/all').then((res) => {
      setClubs(res.data)
      setStatus('succeeded')
    }).catch(() => setStatus('failed'))
  }, [])

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">All clubs (read-only oversight)</h1>
      <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
        University-wide view of every club regardless of status.
      </p>

      {status === 'loading' && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
          ))}
        </div>
      )}

      {status === 'succeeded' && clubs.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted dark:text-ink-dark-muted">No clubs exist yet.</p>
      )}

      <div className="mt-6 space-y-2">
        {clubs.map((club) => (
          <Link
            key={club.id}
            to={`/clubs/${club.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-fast hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
          >
            <div>
              <h2 className="font-semibold text-ink dark:text-ink-dark">{club.name}</h2>
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {club.category} — {club.description || 'No description'}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_PILL_CLASS[club.status] || ''}`}>
              {club.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default AllClubsOverviewPage

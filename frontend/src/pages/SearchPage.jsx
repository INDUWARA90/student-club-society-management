import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/axios'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import Skeleton from '../components/ui/Skeleton'

function SearchPage() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    setLoading(true)
    api
      .get('/search', { params: { q } })
      .then((res) => setResults(res.data))
      .finally(() => setLoading(false))
  }, [q])

  const totalCount = results
    ? results.clubs.length + results.events.length + results.announcements.length
    : 0

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader title={`Search results for "${q}"`} />

      {loading && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {results && totalCount === 0 && !loading && (
        <p className="mt-4 text-sm text-ink-muted dark:text-ink-dark-muted">No results found.</p>
      )}

      {results && results.clubs.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Clubs</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.clubs.map((c) => (
              <Card key={c.id} to={`/clubs/${c.id}`}>
                <p className="text-sm font-medium text-ink dark:text-ink-dark">{c.name}</p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{c.category}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {results && results.events.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Events</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.events.map((e) => (
              <Card key={e.id} to={`/events/${e.id}`}>
                <p className="text-sm font-medium text-ink dark:text-ink-dark">{e.title}</p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{e.clubName}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {results && results.announcements.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Announcements</h2>
          <div className="mt-3 space-y-2">
            {results.announcements.map((a) => (
              <Card key={a.id} to={`/clubs/${a.clubId}`}>
                <p className="text-sm text-ink dark:text-ink-dark">{a.content}</p>
                <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">— {a.authorName}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default SearchPage

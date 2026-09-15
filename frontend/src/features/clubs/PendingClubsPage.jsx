import { useEffect, useState } from 'react'
import api from '../../api/axios'

function PendingClubsPage() {
  const [clubs, setClubs] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  function load() {
    api.get('/clubs/pending').then((res) => setClubs(res.data)).catch((e) => setError(e.response?.data?.message))
  }

  async function review(clubId, approve) {
    try {
      await api.post(`/clubs/${clubId}/${approve ? 'approve' : 'reject'}`)
      setClubs((prev) => prev.filter((c) => c.id !== clubId))
    } catch (e) {
      setError(e.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Pending club proposals</h1>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {clubs.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted dark:text-ink-dark-muted">No pending club proposals.</p>
      )}

      <div className="mt-6 space-y-3">
        {clubs.map((club) => (
          <div
            key={club.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
          >
            <div>
              <h2 className="font-semibold text-ink dark:text-ink-dark">{club.name}</h2>
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {club.category} — {club.description || 'No description'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => review(club.id, true)}
                className="rounded-md bg-success px-3 py-1.5 text-sm font-medium text-white transition-fast hover:opacity-90"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => review(club.id, false)}
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

export default PendingClubsPage

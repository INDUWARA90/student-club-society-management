import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import CreateClubModal from './CreateClubModal'
import { fetchClubs } from './clubsSlice'

const statusPillClass = 'rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700'

function ClubsPage() {
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.clubs)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    dispatch(fetchClubs(category || undefined))
  }, [dispatch, category])

  const visibleClubs = items.filter((club) => club.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Clubs</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700"
        >
          + Create club
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clubs by name..."
          className="min-w-[200px] flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        >
          <option value="">All categories</option>
          <option value="Sports">Sports</option>
          <option value="Academic">Academic</option>
          <option value="Cultural">Cultural</option>
          <option value="Tech">Tech</option>
        </select>
      </div>

      {status === 'loading' && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
          ))}
        </div>
      )}

      {status !== 'loading' && visibleClubs.length === 0 && (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="text-4xl">🏳️</p>
          <p className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">
            {items.length === 0 ? 'No clubs yet — create one!' : 'No clubs match your search.'}
          </p>
        </div>
      )}

      {status !== 'loading' && visibleClubs.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleClubs.map((club) => (
            <Link
              key={club.id}
              to={`/clubs/${club.id}`}
              className="rounded-xl border border-border bg-surface p-4 shadow-card transition-base hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
            >
              <div className="flex aspect-video items-center justify-center rounded-lg bg-surface-muted text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
                {club.logoB64 ? (
                  <img src={club.logoB64} alt={club.name} className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <span className="text-2xl">🏳️</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold text-ink dark:text-ink-dark">{club.name}</h2>
                <span className={statusPillClass}>{club.category}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink-muted dark:text-ink-dark-muted">
                {club.description || 'No description yet.'}
              </p>
            </Link>
          ))}
        </div>
      )}

      {showCreate && <CreateClubModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

export default ClubsPage

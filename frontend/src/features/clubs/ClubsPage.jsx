import { Flag, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import CreateClubModal from './CreateClubModal'
import { fetchClubs } from './clubsSlice'

const chip = (active) =>
  `rounded-full px-3.5 py-1.5 text-sm font-medium transition-fast ${
    active
      ? 'bg-brand-500 text-white shadow-card'
      : 'border border-border bg-surface text-ink-muted hover:border-brand-300 hover:text-ink dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-dark-muted dark:hover:text-ink-dark'
  }`

const CATEGORIES = ['Sports', 'Academic', 'Cultural', 'Tech']

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
      <PageHeader
        title="Clubs"
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create club
          </Button>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clubs by name..."
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        {['', ...CATEGORIES].map((c) => (
          <button key={c || 'all'} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {status !== 'loading' && visibleClubs.length === 0 && (
        <EmptyState
          icon={Flag}
          description={items.length === 0 ? 'No clubs yet — create one!' : 'No clubs match your search.'}
        />
      )}

      {status !== 'loading' && visibleClubs.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleClubs.map((club) => (
            <Card key={club.id} to={`/clubs/${club.id}`} className="overflow-hidden p-0">
              <div className="flex aspect-video items-center justify-center bg-brand-gradient-soft text-brand-400 dark:text-brand-300">
                {club.logoB64 ? (
                  <img src={club.logoB64} alt={club.name} className="h-full w-full object-cover" />
                ) : (
                  <Flag className="h-7 w-7" strokeWidth={1.5} />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-ink dark:text-ink-dark">{club.name}</h2>
                  <Badge tone="brand">{club.category}</Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted dark:text-ink-dark-muted">
                  {club.description || 'No description yet.'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <CreateClubModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}

export default ClubsPage

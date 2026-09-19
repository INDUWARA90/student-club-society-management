import { Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Breadcrumbs from '../../components/Breadcrumbs'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { fetchClubMembers } from './membershipsSlice'

const POSITION_TONE = {
  PRESIDENT: 'brand',
  VP: 'info',
  SECRETARY: 'warning',
  TREASURER: 'success',
  MEMBER: 'neutral',
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function MemberDirectoryPage() {
  const { clubId } = useParams()
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.memberships)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')

  useEffect(() => {
    dispatch(fetchClubMembers(clubId))
  }, [dispatch, clubId])

  const clubName = items[0]?.clubName

  const visible = useMemo(() => {
    const filtered = items.filter((m) => m.userName.toLowerCase().includes(search.trim().toLowerCase()))
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.userName.localeCompare(b.userName)
      if (sortBy === 'position') return a.position.localeCompare(b.position)
      return new Date(a.joinedAt) - new Date(b.joinedAt)
    })
  }, [items, search, sortBy])

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <Breadcrumbs
        items={[
          { label: 'Clubs', to: '/clubs' },
          { label: clubName || 'Club', to: `/clubs/${clubId}` },
          { label: 'Members' },
        ]}
      />
      <PageHeader title="Member Directory" description={clubName ? `Everyone in ${clubName}.` : undefined} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        >
          <option value="name">Sort by name</option>
          <option value="position">Sort by position</option>
          <option value="joinedAt">Sort by join date</option>
        </select>
      </div>

      {status === 'loading' && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {status !== 'loading' && visible.length === 0 && (
        <EmptyState icon={Users} title="No members found" description="Try a different search." />
      )}

      {status !== 'loading' && visible.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border dark:border-border-dark">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs font-medium uppercase text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Position</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {visible.map((m) => (
                <tr key={m.id} className="bg-surface dark:bg-surface-dark-muted">
                  <td className="px-4 py-2.5 font-medium text-ink dark:text-ink-dark">{m.userName}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={POSITION_TONE[m.position] || 'neutral'}>{m.position}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted dark:text-ink-dark-muted">{m.status}</td>
                  <td className="px-4 py-2.5 text-ink-muted dark:text-ink-dark-muted">{formatDate(m.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MemberDirectoryPage

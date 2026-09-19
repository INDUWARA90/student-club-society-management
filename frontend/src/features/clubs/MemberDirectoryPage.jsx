import { Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import Badge from '../../components/ui/Badge'
import Breadcrumbs from '../../components/Breadcrumbs'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { fetchClubMembers } from './membershipsSlice'

const STATUS_TONE = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }

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
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <Breadcrumbs
        items={[
          { label: 'Clubs', to: '/clubs' },
          { label: clubName || 'Club', to: `/clubs/${clubId}` },
          { label: 'Members' },
        ]}
      />
      <PageHeader title="Member Directory" description={clubName ? `Everyone in ${clubName}.` : undefined} />

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Total members', items.length],
          ['Officers', items.filter((m) => m.position !== 'MEMBER').length],
          ['Approved', items.filter((m) => m.status === 'APPROVED').length],
          ['Pending', items.filter((m) => m.status === 'PENDING').length],
        ].map(([label, value]) => (
          <Card key={label} interactive={false}>
            <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink dark:text-ink-dark">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-50 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
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
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted/70 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
              <tr>
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Position</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border-dark">
              {visible.map((m) => (
                <tr key={m.id} className="transition-fast hover:bg-surface-muted/60 dark:hover:bg-surface-dark/60">
                  <td className="px-4 py-3 font-medium text-ink dark:text-ink-dark">
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        {m.userName?.[0]?.toUpperCase()}
                      </span>
                      {m.userName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={POSITION_TONE[m.position] || 'neutral'}>{m.position}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[m.status] || 'neutral'}>{m.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-muted dark:text-ink-dark-muted">{formatDate(m.joinedAt)}</td>
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

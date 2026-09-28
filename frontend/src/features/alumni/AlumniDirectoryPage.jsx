import { GraduationCap, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api/axios'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'

function AlumniDirectoryPage() {
  const [alumni, setAlumni] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api.get('/users/alumni').then((res) => setAlumni(res.data)).catch(() => setAlumni([]))
  }, [])

  const visible = (alumni || []).filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader title="Alumni Directory" description="Graduates of the university's clubs and societies." />

      <div className="relative mt-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search alumni by name..."
          className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        />
      </div>

      {alumni === null && (
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {alumni !== null && visible.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          description={alumni.length === 0 ? 'No alumni yet.' : 'No alumni match your search.'}
        />
      )}

      {alumni !== null && visible.length > 0 && (
  <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
    {visible.map((a) => (
      <Card 
        key={a.id} 
        interactive={true} 
        className="group flex min-w-0 items-center gap-4 p-4 transition-all duration-200 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700"
      >
        {/* Profile Image or Initials Avatar */}
        {a.profileImageB64 ? (
          <img 
            src={a.profileImageB64} 
            alt={a.name} 
            className="h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ring-brand-100 transition-transform duration-200 group-hover:scale-105 dark:ring-brand-900/30" 
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-bold text-brand-700 ring-2 ring-brand-100/50 transition-transform duration-200 group-hover:scale-105 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20"
          >
            {a.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()}
          </span>
        )}

        {/* Main Details (Name & Email) */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink transition-colors group-hover:text-brand-600 dark:text-ink-dark dark:group-hover:text-brand-400">
            {a.name}
          </p>
          <a
            href={`mailto:${a.email}`}
            className="mt-0.5 inline-flex items-center gap-1.5 truncate text-xs text-ink-muted transition-colors hover:text-brand-600 dark:text-ink-dark-muted dark:hover:text-brand-300"
            onClick={(e) => e.stopPropagation()} // Prevent card click if card is interactive
          >
            <span className="truncate">{a.email}</span>
          </a>
        </div>

        {/* Graduation Year Badge */}
        <div className="shrink-0 border-l border-border/60 pl-3.5 text-right dark:border-border-dark/60">
          <p className="text-base font-bold leading-tight text-brand-600 dark:text-brand-300">
            {a.graduationYear}
          </p>
        </div>
      </Card>
    ))}
  </div>
)}
    </div>
  )
}

export default AlumniDirectoryPage

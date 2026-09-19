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
            <Skeleton key={i} className="h-16" />
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
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visible.map((a) => (
            <Card key={a.id} interactive={false} className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient-soft text-brand-500">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-ink dark:text-ink-dark">{a.name}</p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">Class of {a.graduationYear}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default AlumniDirectoryPage

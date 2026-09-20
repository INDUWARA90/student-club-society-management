import { CalendarCheck, ClipboardList, Download, Flag, GraduationCap, Wallet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import BarList from '../../components/charts/BarList'
import ChartCard from '../../components/charts/ChartCard'
import ColumnChart from '../../components/charts/ColumnChart'
import { formatCompact, monthlyCounts } from '../../components/charts/chartUtils'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'

const TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
}

function countBy(items, getKey) {
  const counts = new Map()
  items.forEach((item) => {
    const key = getKey(item) || 'Uncategorised'
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return Array.from(counts, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label),
  )
}

function UniversityStatsPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [clubs, setClubs] = useState([])

  useEffect(() => {
    api.get('/analytics/university').then((res) => setStats(res.data)).catch((e) => setError(e.response?.data?.message || 'Could not load analytics'))
    api.get('/events').then((res) => setEvents(res.data)).catch(() => {})
    api.get('/clubs').then((res) => setClubs(res.data)).catch(() => {})
  }, [])

  const liveEvents = useMemo(() => events.filter((e) => !e.cancelled), [events])
  const eventsByMonth = useMemo(() => monthlyCounts(liveEvents, (e) => e.eventDate, { before: 5, after: 2 }), [liveEvents])
  const clubsByCategory = useMemo(() => countBy(clubs, (c) => c.category), [clubs])
  const busiestClubs = useMemo(() => countBy(liveEvents, (e) => e.clubName).slice(0, 6), [liveEvents])

  if (error) {
    return <div className="mx-auto max-w-6xl p-4 text-sm text-danger md:p-8">{error}</div>
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <Skeleton className="h-10 w-72" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72" />
      </div>
    )
  }

  const cards = [
    ['Approved clubs', stats.totalClubs, Flag, 'brand'],
    ['Students', stats.totalStudents, GraduationCap, 'info'],
    ['Published events', stats.totalEvents, CalendarCheck, 'success'],
    ['Payments collected', stats.totalPaymentsCollected, Wallet, 'success'],
    ['Pending club proposals', stats.pendingClubProposals, ClipboardList, 'warning'],
    ['Pending event approvals', stats.pendingEventApprovals, ClipboardList, 'warning'],
  ]

  async function handleDownload(format) {
    const res = await api.get(`/analytics/university/${format}`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `university-stats.${format}`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const monthlySeries = [{ label: 'Events', color: 'var(--chart-series-1)' }]

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title="University-wide analytics"
        description="Clubs, events and money across the whole university."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => handleDownload('csv')}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleDownload('pdf')}>
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {cards.map(([label, value, Icon, tone]) => (
          <Card key={label} interactive={false} className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-ink dark:text-ink-dark">
                {Number.isFinite(Number(value)) ? formatCompact(Number(value)) : value}
              </p>
              <p className="mt-1 truncate text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ChartCard
          title="Events per month"
          subtitle="Scheduled, non-cancelled events - past 5 months and next 2"
          className="lg:col-span-2"
          empty={liveEvents.length === 0 ? 'No events yet.' : null}
          table={{
            columns: ['Month', 'Events'],
            rows: eventsByMonth.map((m) => [m.fullLabel, m.value]),
          }}
        >
          <ColumnChart
            ariaLabel="Events per month"
            series={monthlySeries}
            data={eventsByMonth.map((m) => ({ label: m.label, fullLabel: m.fullLabel, values: [m.value] }))}
          />
        </ChartCard>

        <ChartCard
          title="Clubs by category"
          subtitle="Approved clubs"
          empty={clubsByCategory.length === 0 ? 'No clubs yet.' : null}
          table={{ columns: ['Category', 'Clubs'], rows: clubsByCategory.map((c) => [c.label, c.value]) }}
        >
          <BarList items={clubsByCategory} />
        </ChartCard>

        <ChartCard
          title="Most active clubs"
          subtitle="By number of events"
          className="lg:col-span-3"
          empty={busiestClubs.length === 0 ? 'No events yet.' : null}
          table={{ columns: ['Club', 'Events'], rows: busiestClubs.map((c) => [c.label, c.value]) }}
        >
          <BarList items={busiestClubs} unit="events" />
        </ChartCard>
      </div>
    </div>
  )
}

export default UniversityStatsPage

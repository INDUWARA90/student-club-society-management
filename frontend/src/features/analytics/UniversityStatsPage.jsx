import {
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  Download,
  Flag,
  GraduationCap,
  Search,
  ShieldAlert,
  Wallet,
  WalletCards,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import ChartCard from '../../components/charts/ChartCard'
import BarChartJS from '../../components/charts/chartjs/BarChartJS'
import DoughnutChartJS from '../../components/charts/chartjs/DoughnutChartJS'
import LineChartJS from '../../components/charts/chartjs/LineChartJS'
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
  const user = useSelector((state) => state.auth.user)
  const isAuthorized = user?.role === 'SUPER_ADMIN' || user?.role === 'FACULTY_ADVISOR'

  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])
  const [clubs, setClubs] = useState([])
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('')

  useEffect(() => {
    if (!isAuthorized) return
    api.get('/analytics/university').then((res) => setStats(res.data)).catch((e) => setError(e.response?.data?.message || 'Could not load analytics'))
    api.get('/events').then((res) => setEvents(res.data)).catch(() => {})
    api.get('/clubs').then((res) => setClubs(res.data)).catch(() => {})
  }, [isAuthorized])

  const liveEvents = useMemo(() => events.filter((e) => !e.cancelled), [events])
  const eventsByMonth = useMemo(() => monthlyCounts(liveEvents, (e) => e.eventDate, { before: 5, after: 2 }), [liveEvents])
  const clubsByCategory = useMemo(() => countBy(clubs, (c) => c.category), [clubs])
  const busiestClubs = useMemo(() => countBy(liveEvents, (e) => e.clubName).slice(0, 6), [liveEvents])

  // Chart.js Datasets
  const eventsTrendChartData = useMemo(() => {
    return {
      labels: eventsByMonth.map((m) => m.label),
      datasets: [
        {
          label: 'Events Scheduled',
          data: eventsByMonth.map((m) => m.value),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    }
  }, [eventsByMonth])

  const categoryDoughnutData = useMemo(() => {
    const palette = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b', '#f97316']
    return {
      labels: clubsByCategory.map((c) => c.label),
      datasets: [
        {
          data: clubsByCategory.map((c) => c.value),
          backgroundColor: palette.slice(0, clubsByCategory.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6,
        },
      ],
    }
  }, [clubsByCategory])

  const activeClubsBarData = useMemo(() => {
    return {
      labels: busiestClubs.map((c) => c.label),
      datasets: [
        {
          label: 'Events Hosted',
          data: busiestClubs.map((c) => c.value),
          backgroundColor: 'rgba(99, 102, 241, 0.85)',
          hoverBackgroundColor: '#4f46e5',
          borderRadius: 6,
        },
      ],
    }
  }, [busiestClubs])

  const eventStatusDoughnutData = useMemo(() => {
    const approved = events.filter((e) => e.approvalStatus === 'APPROVED' && !e.cancelled).length
    const pending = events.filter((e) => e.approvalStatus === 'PENDING').length
    const cancelled = events.filter((e) => e.cancelled).length
    return {
      labels: ['Approved & Live', 'Pending Sign-off', 'Cancelled'],
      datasets: [
        {
          data: [approved, pending, cancelled],
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4,
        },
      ],
    }
  }, [events])

  const clubPayments = useMemo(() => stats?.clubPayments || [], [stats])

  const filteredClubPayments = useMemo(() => {
    if (!paymentSearchQuery.trim()) return clubPayments
    const q = paymentSearchQuery.toLowerCase()
    return clubPayments.filter(
      (c) =>
        c.clubName?.toLowerCase().includes(q) ||
        c.clubCategory?.toLowerCase().includes(q),
    )
  }, [clubPayments, paymentSearchQuery])

  const totalMembershipFees = useMemo(() => {
    return clubPayments.reduce((acc, c) => acc + Number(c.membershipPayments || 0), 0)
  }, [clubPayments])

  const totalEventFees = useMemo(() => {
    return clubPayments.reduce((acc, c) => acc + Number(c.eventPayments || 0), 0)
  }, [clubPayments])

  const paymentsByClubBarData = useMemo(() => {
    const topClubs = clubPayments.slice(0, 8)
    return {
      labels: topClubs.map((c) => c.clubName),
      datasets: [
        {
          label: 'Membership Fees ($)',
          data: topClubs.map((c) => Number(c.membershipPayments || 0)),
          backgroundColor: 'rgba(99, 102, 241, 0.85)',
          borderRadius: 6,
        },
        {
          label: 'Event Fees ($)',
          data: topClubs.map((c) => Number(c.eventPayments || 0)),
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderRadius: 6,
        },
      ],
    }
  }, [clubPayments])

  if (user && !isAuthorized) {
    return (
      <div className="mx-auto max-w-xl p-4 py-16 md:p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Restricted Access
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          University budget and analytics are restricted to faculty advisors and university administrators.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

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

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <PageHeader
        title="University-wide analytics"
        description="Real-time interactive intelligence: society activities, distribution and student engagement."
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

      {/* KPI Cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {cards.map(([label, value, Icon, tone]) => (
          <Card key={label} interactive={false} className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-ink dark:text-ink-dark">
                {Number.isFinite(Number(value))
                  ? label === 'Payments collected'
                    ? `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : formatCompact(Number(value))
                  : value}
              </p>
              <p className="mt-1 truncate text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Chart.js Interactive Visualizations */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart 1: Line Chart for Events per month */}
        <ChartCard
          title="Events per month"
          subtitle="Scheduled, non-cancelled events — past 5 months and next 2"
          className="lg:col-span-2"
          empty={liveEvents.length === 0 ? 'No events yet.' : null}
          table={{
            columns: ['Month', 'Events'],
            rows: eventsByMonth.map((m) => [m.fullLabel, m.value]),
          }}
        >
          <LineChartJS
            data={eventsTrendChartData}
            height={260}
            ariaLabel="Events per month trend"
          />
        </ChartCard>

        {/* Chart 2: Doughnut Chart for Clubs by category */}
        <ChartCard
          title="Clubs by category"
          subtitle="Approved society distribution"
          empty={clubsByCategory.length === 0 ? 'No clubs yet.' : null}
          table={{ columns: ['Category', 'Clubs'], rows: clubsByCategory.map((c) => [c.label, c.value]) }}
        >
          <DoughnutChartJS
            data={categoryDoughnutData}
            height={240}
            centerLabel={String(clubs.length)}
            centerSublabel="Societies"
            ariaLabel="Clubs by category doughnut"
          />
        </ChartCard>

        {/* Chart 3: Horizontal Bar Chart for Most active clubs */}
        <ChartCard
          title="Most active clubs"
          subtitle="Ranked by total events organized"
          className="lg:col-span-2"
          empty={busiestClubs.length === 0 ? 'No events yet.' : null}
          table={{ columns: ['Club', 'Events'], rows: busiestClubs.map((c) => [c.label, c.value]) }}
        >
          <BarChartJS
            data={activeClubsBarData}
            horizontal={true}
            height={260}
            ariaLabel="Most active clubs bar chart"
          />
        </ChartCard>

        {/* Chart 4: Doughnut Chart for Event proposal lifecycle */}
        <ChartCard
          title="Event proposal statuses"
          subtitle="Lifecycle of campus activities"
          empty={events.length === 0 ? 'No proposals registered.' : null}
          table={{
            columns: ['Status', 'Count'],
            rows: [
              ['Approved & Live', events.filter((e) => e.approvalStatus === 'APPROVED' && !e.cancelled).length],
              ['Pending Sign-off', events.filter((e) => e.approvalStatus === 'PENDING').length],
              ['Cancelled', events.filter((e) => e.cancelled).length],
            ],
          }}
        >
          <DoughnutChartJS
            data={eventStatusDoughnutData}
            height={240}
            centerLabel={String(events.length)}
            centerSublabel="Proposals"
            ariaLabel="Event proposal statuses"
          />
        </ChartCard>
      </div>

      {/* Payments Collected by Club Section */}
      <div className="mt-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-ink dark:text-ink-dark flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              Payments Collected by Society
            </h2>
            <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
              Individual breakdown of membership subscriptions and event fees collected by each club.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search club or category..."
              value={paymentSearchQuery}
              onChange={(e) => setPaymentSearchQuery(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Payments Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card interactive={false} className="p-4 border-l-4 border-l-brand-500">
            <p className="text-xs font-medium text-ink-muted dark:text-ink-dark-muted">Total Payments Collected</p>
            <p className="text-xl font-bold text-ink dark:text-ink-dark mt-1">
              ${Number(stats.totalPaymentsCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-ink-muted dark:text-ink-dark-muted mt-0.5">Across all active societies</p>
          </Card>
          <Card interactive={false} className="p-4 border-l-4 border-l-indigo-500">
            <p className="text-xs font-medium text-ink-muted dark:text-ink-dark-muted">Membership Fees</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              ${totalMembershipFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-ink-muted dark:text-ink-dark-muted mt-0.5">Direct membership subscriptions</p>
          </Card>
          <Card interactive={false} className="p-4 border-l-4 border-l-emerald-500">
            <p className="text-xs font-medium text-ink-muted dark:text-ink-dark-muted">Event Ticket Fees</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ${totalEventFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-ink-muted dark:text-ink-dark-muted mt-0.5">Paid event participant admissions</p>
          </Card>
        </div>

        {/* Revenue Comparison by Society Bar Chart */}
        {clubPayments.length > 0 && (
          <ChartCard
            title="Revenue Comparison by Society"
            subtitle="Breakdown of membership dues and event ticket revenues for top collecting societies"
            empty={null}
            table={{
              columns: ['Club', 'Membership ($)', 'Events ($)', 'Total ($)'],
              rows: filteredClubPayments.map((c) => [
                c.clubName,
                Number(c.membershipPayments || 0).toFixed(2),
                Number(c.eventPayments || 0).toFixed(2),
                Number(c.totalCollected || 0).toFixed(2),
              ]),
            }}
          >
            <BarChartJS
              data={paymentsByClubBarData}
              height={260}
              ariaLabel="Payments collected per club comparison bar chart"
            />
          </ChartCard>
        )}

        {/* Detailed Breakdown Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-[#181b24]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Society / Club</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold text-right">Membership Fees</th>
                  <th className="px-4 py-3 font-semibold text-right">Event Fees</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Collected</th>
                  <th className="px-4 py-3 font-semibold text-center">Transactions</th>
                  <th className="px-4 py-3 font-semibold text-right">Budget & Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClubPayments.length > 0 ? (
                  filteredClubPayments.map((club) => {
                    const total = Number(club.totalCollected || 0)
                    const membership = Number(club.membershipPayments || 0)
                    const event = Number(club.eventPayments || 0)
                    return (
                      <tr key={club.clubId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          <span className="truncate">{club.clubName}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {club.clubCategory || 'General'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          ${membership.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                          ${event.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                          <span className={total > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                            ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {club.transactionCount || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/budget?clubId=${club.clubId}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <span>Ledger</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      No society payments found matching your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UniversityStatsPage

import {
  Award,
  Calendar,
  ChevronRight,
  ClipboardList,
  Compass,
  Download,
  FileText,
  LogOut,
  ScrollText,
  Shield,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import ChartCard from '../components/charts/ChartCard'
import LineChart from '../components/charts/LineChart'
import { monthlyCounts } from '../components/charts/chartUtils'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { logout } from '../features/auth/authSlice'

const ROLE_LABEL = {
  STUDENT: 'Student',
  FACULTY_ADVISOR: 'Faculty Advisor',
  SUPER_ADMIN: 'Super Admin',
}

const STAT_TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
}

const quickLink =
  'flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-ink transition-fast hover:border-brand-300 hover:bg-brand-50 dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:border-brand-500/50 dark:hover:bg-brand-500/10'

function QuickLinks({ title, icon: Icon, accent, links }) {
  return (
    <Card interactive={false}>
      <h2 className={`flex items-center gap-2 text-sm font-semibold ${accent}`}>
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      <div className="mt-3 space-y-2">
        {links.map(({ to, label }) => (
          <Link key={to} to={to} className={quickLink}>
            {label}
            <ChevronRight className="h-4 w-4 text-ink-muted dark:text-ink-dark-muted" />
          </Link>
        ))}
      </div>
    </Card>
  )
}

function DashboardPage() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const [certificates, setCertificates] = useState([])
  const [memberships, setMemberships] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    api.get('/certificates/me').then((res) => setCertificates(res.data)).catch(() => {})
    api.get('/memberships/me').then((res) => setMemberships(res.data)).catch(() => {})
    api.get('/events').then((res) => setEvents(res.data)).catch(() => {})
  }, [])

  async function downloadCertificate(id) {
    const res = await api.get(`/certificates/${id}/download`, { responseType: 'blob' })
    const url = window.URL.createObjectURL(res.data)
    const link = document.createElement('a')
    link.href = url
    link.download = 'certificate.pdf'
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const activity = useMemo(
    () => monthlyCounts(events.filter((e) => !e.cancelled), (e) => e.eventDate, { before: 5, after: 2 }),
    [events],
  )

  const approvedMemberships = memberships.filter((m) => m.status === 'APPROVED')
  const pendingMemberships = memberships.filter((m) => m.status === 'PENDING')
  const adminClubs = approvedMemberships.filter((m) => m.position === 'PRESIDENT')

  const stats = [
    { label: 'Clubs joined', value: approvedMemberships.length, icon: Users, tone: 'brand' },
    { label: 'Managing', value: adminClubs.length, icon: Shield, tone: 'info' },
    { label: 'Certificates', value: certificates.length, icon: Award, tone: 'success' },
    { label: 'Pending requests', value: pendingMemberships.length, icon: ClipboardList, tone: 'warning' },
  ]

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-card md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium">
              {ROLE_LABEL[user?.role] || user?.role}
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Welcome back, {user?.name}</h1>
            <p className="mt-1 text-sm text-white/80">Here’s what’s happening across your clubs and events.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/clubs" variant="secondary" className="border-transparent">
              <Compass className="h-4 w-4" />
              Browse clubs
            </Button>
            <Button as={Link} to="/events" variant="secondary" className="border-transparent">
              <Calendar className="h-4 w-4" />
              Browse events
            </Button>
            <Button
              variant="ghost"
              onClick={() => dispatch(logout())}
              className="text-white hover:bg-white/15 hover:text-white lg:hidden dark:text-white dark:hover:bg-white/15 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} interactive={false} className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${STAT_TONES[tone]}`}>
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none text-ink dark:text-ink-dark">{value}</p>
              <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ChartCard
            title="Campus event activity"
            subtitle="Events per month across all clubs - past 5 months and next 2"
            empty={events.length === 0 ? 'No events yet.' : null}
            table={{ columns: ['Month', 'Events'], rows: activity.map((m) => [m.fullLabel, m.value]) }}
          >
            <LineChart
              ariaLabel="Campus events per month"
              series={{ label: 'Events', color: 'var(--chart-series-1)' }}
              data={activity.map((m) => ({ label: m.label, fullLabel: m.fullLabel, value: m.value }))}
            />
          </ChartCard>

          <section>
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">My clubs</h2>
            {approvedMemberships.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {approvedMemberships.map((m) => (
                  <Card key={m.id} to={`/clubs/${m.clubId}`} className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-sm font-semibold text-white">
                      {m.clubName?.[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink dark:text-ink-dark">
                        {m.clubName}
                      </span>
                      <span className="mt-0.5 inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
                        {m.position}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-muted dark:text-ink-dark-muted" />
                  </Card>
                ))}
              </div>
            ) : (
              <Card interactive={false} className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">
                You haven’t joined any clubs yet.{' '}
                <Link to="/clubs" className="font-medium text-brand-600 hover:underline">
                  Browse clubs
                </Link>
              </Card>
            )}
            {pendingMemberships.length > 0 && (
              <p className="mt-3 text-xs text-ink-muted dark:text-ink-dark-muted">
                You have {pendingMemberships.length} join request(s) awaiting approval.
              </p>
            )}
          </section>

          {certificates.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-ink-dark">
                  <FileText className="h-4 w-4 text-brand-500" />
                  Your certificates
                </h2>
                <Link to="/certificates" className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {certificates.map((c) => (
                  <Card key={c.id} interactive={false} className="flex items-center justify-between">
                    <span className="text-sm text-ink dark:text-ink-dark">{c.clubName}</span>
                    <button
                      type="button"
                      onClick={() => downloadCertificate(c.id)}
                      className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {/* Club Admin widget — shown to whoever currently holds PRESIDENT in any club, regardless of base role */}
          {adminClubs.length > 0 && (
            <Card interactive={false}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-role-admin">
                <Shield className="h-4 w-4" />
                Clubs you manage
              </h2>
              <div className="mt-3 space-y-2">
                {adminClubs.map((m) => (
                  <Link key={m.id} to={`/clubs/${m.clubId}`} className={`${quickLink} flex-col items-start gap-0.5`}>
                    <span>{m.clubName}</span>
                    <span className="text-xs font-normal text-ink-muted dark:text-ink-dark-muted">
                      Membership requests &amp; budget ledger
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {user?.role === 'SUPER_ADMIN' && (
            <QuickLinks
              title="Super Admin"
              icon={ShieldCheck}
              accent="text-role-super"
              links={[
                { to: '/admin/pending-clubs', label: 'Review pending clubs' },
                { to: '/analytics', label: 'University-wide analytics' },
                { to: '/admin/audit-log', label: 'Audit log' },
                { to: '/admin/venues', label: 'Manage venues' },
              ]}
            />
          )}

          {user?.role === 'FACULTY_ADVISOR' && (
            <QuickLinks
              title="Faculty Advisor"
              icon={ScrollText}
              accent="text-role-advisor"
              links={[
                { to: '/advisor/pending-events', label: 'Review pending events' },
                { to: '/advisor/clubs', label: 'All clubs (read-only)' },
                { to: '/analytics', label: 'University-wide analytics' },
              ]}
            />
          )}
        </aside>
      </div>
    </div>
  )
}

export default DashboardPage

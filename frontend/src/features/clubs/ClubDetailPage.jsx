import { Archive, CalendarDays, Download, LogOut, Pencil, Plus, UserMinus, UserPlus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import BarList from '../../components/charts/BarList'
import ChartCard from '../../components/charts/ChartCard'
import ColumnChart from '../../components/charts/ColumnChart'
import { monthlyCounts } from '../../components/charts/chartUtils'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import CreateEventModal from '../events/CreateEventModal'
import { joinClub } from './clubsSlice'
import AnnouncementComments from './AnnouncementComments'
import ClubResources from './ClubResources'
import CreateClubModal from './CreateClubModal'
import LogExpenseModal from './LogExpenseModal'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']
const LEDGER_POSITIONS = ['PRESIDENT', 'TREASURER']
const RECORDS_POSITIONS = ['PRESIDENT', 'SECRETARY']
const ALL_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER', 'MEMBER']
const POSITION_TONE = { PRESIDENT: 'brand', VP: 'info', SECRETARY: 'warning', TREASURER: 'success', MEMBER: 'neutral' }

const inputClass =
  'rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark dark:focus:ring-brand-500/20'

async function downloadBlob(path, filename) {
  const res = await api.get(path, { responseType: 'blob' })
  const url = window.URL.createObjectURL(res.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

function MemberAvatar({ name, className = 'h-9 w-9' }) {
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300`}
    >
      {name?.[0]?.toUpperCase()}
    </span>
  )
}

function SectionCard({ title, action, children, className = '' }) {
  return (
    <Card interactive={false} className={className}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Card>
  )
}

function StatTile({ label, value, className = '' }) {
  return (
    <div className={`rounded-lg bg-surface-muted p-3 dark:bg-surface-dark ${className}`}>
      <p className="text-lg font-bold text-ink dark:text-ink-dark">{value}</p>
      <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
    </div>
  )
}

function Donut({ value, total }) {
  const r = 42
  const c = 2 * Math.PI * r
  const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-surface-muted dark:stroke-surface-dark" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          className="stroke-brand-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-ink dark:text-ink-dark">{Math.round(pct * 100)}%</span>
        <span className="text-[11px] text-ink-muted dark:text-ink-dark-muted">of income spent</span>
      </div>
    </div>
  )
}

function ClubDetailPage() {
  const { clubId } = useParams()
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()

  const [club, setClub] = useState(null)
  const [members, setMembers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [reports, setReports] = useState([])
  const [joinStatus, setJoinStatus] = useState(null)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showLogExpense, setShowLogExpense] = useState(false)
  const [showEditClub, setShowEditClub] = useState(false)
  const [tab, setTab] = useState('overview')
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

  useEffect(() => {
    api.get(`/clubs/${clubId}`).then((res) => setClub(res.data))
    api.get(`/clubs/${clubId}/members`).then((res) => setMembers(res.data))
    api.get(`/clubs/${clubId}/announcements`).then((res) => setAnnouncements(res.data))
    api.get(`/clubs/${clubId}/members/pending`).then((res) => setPendingRequests(res.data)).catch(() => {})
    api.get('/events', { params: { clubId } }).then((res) => setEvents(res.data))
    api.get(`/analytics/clubs/${clubId}`).then((res) => setStats(res.data)).catch(() => {})
  }, [clubId])

  const myMembership = members.find((m) => m.userId === user?.id)
  const isOfficer = OFFICER_POSITIONS.includes(myMembership?.position)
  const canManageLedger = LEDGER_POSITIONS.includes(myMembership?.position)
  const canManageRecords = RECORDS_POSITIONS.includes(myMembership?.position)
  const isPresident = myMembership?.position === 'PRESIDENT'
  const effectiveMembershipStatus =
    joinStatus === 'LEFT' ? null : joinStatus || (myMembership ? 'APPROVED' : pendingRequests.some((p) => p.userId === user?.id) ? 'PENDING' : null)

  useEffect(() => {
    if (!canManageLedger) return
    api.get(`/clubs/${clubId}/expenses/ledger`).then((res) => setLedger(res.data)).catch(() => {})
  }, [clubId, canManageLedger])

  useEffect(() => {
    if (!isPresident) return
    api.get(`/clubs/${clubId}/comment-reports`).then((res) => setReports(res.data)).catch(() => {})
  }, [clubId, isPresident])

  async function handleResolveReport(reportId, action) {
    if (action === 'DELETE_COMMENT' && !window.confirm('Remove this comment for everyone?')) return
    try {
      await api.post(`/clubs/${clubId}/comment-reports/${reportId}/resolve`, { action })
      setReports((prev) => prev.filter((r) => r.id !== reportId))
      showToast(action === 'DELETE_COMMENT' ? 'Comment removed' : 'Report dismissed')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleClaimPresidency() {
    if (!window.confirm('Take over as President? This only works once the current President has been marked as graduated.')) return
    try {
      await api.post(`/clubs/${clubId}/claim-presidency`)
      const res = await api.get(`/clubs/${clubId}/members`)
      setMembers(res.data)
      showToast('You are now the President')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleJoin() {
    const fee = Number(club.membershipFee) || 0
    if (fee > 0) {
      // The fee is paid up front (it is refunded if the request is rejected or withdrawn).
      if (!window.confirm(`This club charges a membership fee of ${fee}. Pay it and join?`)) return
      try {
        await api.post('/payments', { type: 'MEMBERSHIP', referenceId: clubId, amount: fee })
      } catch (e) {
        // 409 means the fee was already paid earlier (e.g. a previous join attempt failed) — carry on and join.
        if (e.response?.status !== 409) {
          showToast(e.response?.data?.message || 'Payment failed', 'error')
          return
        }
      }
    }
    const result = await dispatch(joinClub(clubId))
    if (joinClub.fulfilled.match(result)) {
      setJoinStatus(result.payload.status)
      showToast(result.payload.status === 'APPROVED' ? 'Joined club' : 'Join request sent — awaiting approval')
    } else {
      showToast(result.payload, 'error')
    }
  }

  async function handleLeave() {
    try {
      await api.delete(`/clubs/${clubId}/join`)
      setJoinStatus('LEFT')
      const res = await api.get(`/clubs/${clubId}/members`)
      setMembers(res.data)
      showToast('You left the club')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleArchiveClub() {
    if (!window.confirm('Archive this club? It is hidden from browsing, upcoming events are cancelled (paid fees refunded) and members are notified.')) return
    try {
      const { data } = await api.post(`/clubs/${clubId}/archive`)
      setClub(data)
      showToast('Club archived')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleRemoveMember(membershipId, name) {
    if (!window.confirm(`Remove ${name} from the club?`)) return
    try {
      await api.delete(`/memberships/${membershipId}`)
      const res = await api.get(`/clubs/${clubId}/members`)
      setMembers(res.data)
      showToast('Member removed')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleAssignPosition(membershipId, position) {
    try {
      await api.put(`/memberships/${membershipId}/position`, { position })
      const res = await api.get(`/clubs/${clubId}/members`)
      setMembers(res.data)
      showToast('Position updated')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handlePostAnnouncement(e) {
    e.preventDefault()
    if (!announcementDraft.trim()) return
    setPostingAnnouncement(true)
    try {
      const { data } = await api.post(`/clubs/${clubId}/announcements`, { content: announcementDraft.trim() })
      setAnnouncements((prev) => [data, ...prev])
      setAnnouncementDraft('')
      showToast('Announcement posted')
    } catch (e2) {
      showToast(e2.response?.data?.message || 'Something went wrong', 'error')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  async function handleDeleteAnnouncement(announcementId) {
    try {
      await api.delete(`/clubs/${clubId}/announcements/${announcementId}`)
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId))
      showToast('Announcement deleted')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleDeleteExpense(expenseId) {
    try {
      await api.delete(`/clubs/${clubId}/expenses/${expenseId}`)
      setLedger((prev) => {
        const removed = prev.expenses.find((e) => e.id === expenseId)
        return {
          ...prev,
          totalExpenses: (Number(prev.totalExpenses) - Number(removed.amount)).toString(),
          balance: (Number(prev.balance) + Number(removed.amount)).toString(),
          expenses: prev.expenses.filter((e) => e.id !== expenseId),
        }
      })
      showToast('Expense deleted')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleImportMembers(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const emails = text
      .split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (emails.length === 0) return
    try {
      const { data } = await api.post(`/clubs/${clubId}/members/import`, { emails })
      const res = await api.get(`/clubs/${clubId}/members`)
      setMembers(res.data)
      showToast(
        `Imported ${data.imported} member(s)` +
          (data.skipped.length > 0 ? `, skipped ${data.skipped.length}` : ''),
      )
    } catch (e2) {
      showToast(e2.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function reviewRequest(membershipId, approve) {
    try {
      await api.post(`/memberships/${membershipId}/${approve ? 'approve' : 'reject'}`)
      setPendingRequests((prev) => prev.filter((m) => m.id !== membershipId))
      showToast(approve ? 'Join request approved' : 'Join request rejected')
      if (approve) {
        const res = await api.get(`/clubs/${clubId}/members`)
        setMembers(res.data)
      }
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <div className="h-6 w-40 animate-pulse rounded bg-surface-muted dark:bg-surface-dark-muted" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-surface-muted dark:bg-surface-dark-muted" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
          ))}
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'events', label: `Events (${events.length})` },
    { id: 'members', label: `Members (${members.length})` },
    ...(canManageLedger && ledger ? [{ id: 'budget', label: 'Budget' }] : []),
  ]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'overview'
  const startOfToday = new Date(new Date().toDateString())
  const futureEvents = events
    .filter((e) => new Date(e.eventDate) >= startOfToday)
    .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
  const showingRecent = futureEvents.length === 0
  const upcomingEvents = showingRecent
    ? [...events].sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate)).slice(0, 4)
    : futureEvents.slice(0, 4)
  const totalIncome = Number(ledger?.totalIncome) || 0
  const totalExpenses = Number(ledger?.totalExpenses) || 0
  const engagement = (stats?.events || []).slice(-8)
  const membersByRole = ALL_POSITIONS.map((p) => ({ label: p, value: members.filter((m) => m.position === p).length })).filter(
    (r) => r.value > 0,
  )
  const spendingByMonth = monthlyCounts(ledger?.expenses || [], (e) => `${e.expenseDate}T12:00:00`, {
    before: 5,
    getValue: (e) => Number(e.amount) || 0,
  })

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <Breadcrumbs items={[{ label: 'Clubs', to: '/clubs' }, { label: club.name }]} />

      <div className="relative h-44 overflow-hidden rounded-2xl bg-brand-gradient shadow-card md:h-56">
        {club.logoB64 && (
          <img src={club.logoB64} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5 md:p-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{club.name}</h1>
            <span className="mt-1.5 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {club.category}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPresident && (
              <Button variant="secondary" size="sm" onClick={() => setShowEditClub(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit club
              </Button>
            )}
            {isPresident && !club.archived && (
              <Button variant="danger" size="sm" onClick={handleArchiveClub}>
                <Archive className="h-3.5 w-3.5" />
                Archive club
              </Button>
            )}
            {isOfficer && !isPresident && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleClaimPresidency}
                title="Available when the current President has graduated"
              >
                Claim presidency
              </Button>
            )}
            {effectiveMembershipStatus === 'APPROVED' && !isPresident && (
              <Button variant="danger" size="sm" onClick={handleLeave}>
                <LogOut className="h-3.5 w-3.5" />
                Leave club
              </Button>
            )}
            {effectiveMembershipStatus !== 'APPROVED' && !club.archived && (
              <Button size="sm" onClick={handleJoin} disabled={effectiveMembershipStatus === 'PENDING'}>
                <UserPlus className="h-3.5 w-3.5" />
                {effectiveMembershipStatus === 'PENDING'
                  ? 'Request pending'
                  : Number(club.membershipFee) > 0
                    ? `Join club (fee ${club.membershipFee})`
                    : 'Join club'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {club.archived && (
        <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          This club is archived — it no longer accepts members or events.
        </p>
      )}

      <div role="tablist" className="mt-5 flex gap-1 overflow-x-auto border-b border-border dark:border-border-dark">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-fast ${
              activeTab === t.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-300'
                : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SectionCard title="About">
              <p className="text-sm leading-relaxed text-ink-muted dark:text-ink-dark-muted">
                {club.description || 'No description yet.'}
              </p>
            </SectionCard>

            {isOfficer && engagement.length > 0 && (
              <ChartCard
                title="Event engagement"
                subtitle="RSVPs versus people who actually attended, per event"
                legend={[
                  { label: 'RSVPs', color: 'var(--chart-series-1)' },
                  { label: 'Attended', color: 'var(--chart-series-2)' },
                ]}
                table={{
                  columns: ['Event', 'RSVPs', 'Attended', 'No-shows'],
                  rows: engagement.map((e) => [e.title, e.going, e.attended, e.noShows]),
                }}
              >
                <ColumnChart
                  ariaLabel="RSVPs versus attendance per event"
                  series={[
                    { label: 'RSVPs', color: 'var(--chart-series-1)' },
                    { label: 'Attended', color: 'var(--chart-series-2)' },
                  ]}
                  data={engagement.map((e) => ({ label: e.title, values: [e.going, e.attended] }))}
                />
              </ChartCard>
            )}

            <SectionCard title="Announcements">
              {isOfficer && (
                <form onSubmit={handlePostAnnouncement} className="mb-4 flex gap-2">
                  <input
                    type="text"
                    value={announcementDraft}
                    onChange={(e) => setAnnouncementDraft(e.target.value)}
                    placeholder="Post an update to the club feed..."
                    className={`${inputClass} flex-1`}
                  />
                  <Button type="submit" disabled={postingAnnouncement || !announcementDraft.trim()}>
                    Post
                  </Button>
                </form>
              )}
              {announcements.length === 0 && (
                <p className="text-sm text-ink-muted dark:text-ink-dark-muted">No announcements yet.</p>
              )}
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-lg bg-surface-muted p-4 dark:bg-surface-dark"
                  >
                    <MemberAvatar name={a.authorName} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink dark:text-ink-dark">{a.authorName}</p>
                      <p className="mt-0.5 text-sm text-ink dark:text-ink-dark">{a.content}</p>
                      <AnnouncementComments clubId={clubId} announcementId={a.id} isPresident={isPresident} />
                    </div>
                    {(a.authorId === user?.id || isPresident) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="shrink-0 text-xs text-danger hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            <ClubResources clubId={clubId} isOfficer={isOfficer} isPresident={isPresident} />

            {isPresident && reports.length > 0 && (
              <SectionCard title={`Reported comments (${reports.length})`}>
                <div className="space-y-3">
                  {reports.map((r) => (
                    <div key={r.id} className="rounded-lg bg-surface-muted p-3 dark:bg-surface-dark">
                      <p className="text-sm text-ink dark:text-ink-dark">
                        <span className="font-medium">{r.commentAuthorName}:</span> {r.commentContent}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
                        Reported by {r.reporterName}: {r.reason}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button variant="secondary" size="sm" onClick={() => handleResolveReport(r.id, 'DISMISS')}>
                          Dismiss
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleResolveReport(r.id, 'DELETE_COMMENT')}>
                          Remove comment
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {pendingRequests.length > 0 && (
              <SectionCard title={`Pending join requests (${pendingRequests.length})`}>
                <div className="space-y-2">
                  {pendingRequests.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-surface-muted p-3 dark:bg-surface-dark"
                    >
                      <span className="flex items-center gap-2 text-sm text-ink dark:text-ink-dark">
                        <MemberAvatar name={m.userName} className="h-8 w-8" />
                        {m.userName}
                      </span>
                      <div className="flex gap-2">
                        <Button variant="success" size="sm" onClick={() => reviewRequest(m.id, true)}>
                          Approve
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => reviewRequest(m.id, false)}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          <aside className="space-y-6">
            {isOfficer && stats && (
              <SectionCard title="Club stats">
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Members" value={stats.memberCount} />
                  <StatTile label="Events" value={stats.eventCount} />
                  <StatTile label="RSVPs" value={stats.totalRsvps} />
                  <StatTile label="Attendance" value={stats.totalAttendance} />
                  <StatTile label="Income" value={stats.totalIncome} />
                  <StatTile label="Expenses" value={stats.totalExpenses} />
                  <StatTile label="Balance" value={stats.balance} className="col-span-2" />
                </div>
                {stats.totalRsvps > 0 && (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="text-ink-muted dark:text-ink-dark-muted">Attendance rate</span>
                      <span className="font-semibold tabular-nums text-ink dark:text-ink-dark">
                        {Math.round(stats.attendanceRatePercent)}%
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2 overflow-hidden rounded-full"
                      style={{ background: 'var(--chart-track)' }}
                      role="meter"
                      aria-label="Attendance rate"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(stats.attendanceRatePercent)}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(Math.max(stats.attendanceRatePercent, 0), 100)}%`,
                          background: 'var(--chart-series-1)',
                        }}
                      />
                    </div>
                    {stats.averageEventRating > 0 && (
                      <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">
                        Average event rating {stats.averageEventRating.toFixed(1)} / 5
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => downloadBlob(`/analytics/clubs/${clubId}/csv`, 'club-stats.csv')}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Stats CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBlob(`/analytics/clubs/${clubId}/pdf`, 'club-report.pdf')}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Stats PDF
                  </button>
                </div>
              </SectionCard>
            )}

            <SectionCard
              title={showingRecent ? 'Recent events' : 'Upcoming events'}
              action={
                events.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab('events')}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    View all
                  </button>
                )
              }
            >
              {upcomingEvents.length === 0 && (
                <p className="text-sm text-ink-muted dark:text-ink-dark-muted">No events yet.</p>
              )}
              <div className="space-y-2">
                {upcomingEvents.map((e) => (
                  <Link
                    key={e.id}
                    to={`/events/${e.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 transition-fast hover:bg-surface-muted dark:hover:bg-surface-dark"
                  >
                    <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        {new Date(e.eventDate).toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-sm font-bold leading-tight">{new Date(e.eventDate).getDate()}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink dark:text-ink-dark">{e.title}</span>
                      <span className="block text-xs text-ink-muted dark:text-ink-dark-muted">
                        {new Date(e.eventDate).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Members"
              action={
                <button
                  type="button"
                  onClick={() => setTab('members')}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  View all
                </button>
              }
            >
              <div className="flex -space-x-2">
                {members.slice(0, 6).map((m) => (
                  <MemberAvatar
                    key={m.id}
                    name={m.userName}
                    className="h-9 w-9 ring-2 ring-surface dark:ring-surface-dark-muted"
                  />
                ))}
                {members.length > 6 && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-ink-muted ring-2 ring-surface dark:bg-surface-dark dark:text-ink-dark-muted dark:ring-surface-dark-muted">
                    +{members.length - 6}
                  </span>
                )}
              </div>
            </SectionCard>

            <ChartCard
              title="Members by role"
              table={{ columns: ['Role', 'Members'], rows: membersByRole.map((r) => [r.label, r.value]) }}
              empty={membersByRole.length === 0 ? 'No members yet.' : null}
            >
              <BarList items={membersByRole} />
            </ChartCard>
          </aside>
        </div>
      )}

      {activeTab === 'events' && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Events</h2>
            {isOfficer && (
              <Button size="sm" onClick={() => setShowCreateEvent(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create event
              </Button>
            )}
          </div>
          {events.length === 0 && (
            <p className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">No events yet.</p>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Card key={e.id} to={`/events/${e.id}`} className="overflow-hidden p-0">
                <div className="flex aspect-video items-center justify-center bg-brand-gradient-soft text-brand-400 dark:text-brand-300">
                  {e.bannerB64 ? (
                    <img src={e.bannerB64} alt={e.title} className="h-full w-full object-cover" />
                  ) : (
                    <CalendarDays className="h-7 w-7" strokeWidth={1.5} />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-ink dark:text-ink-dark">{e.title}</p>
                  <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
                    {new Date(e.eventDate).toLocaleDateString()}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'members' && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink dark:text-ink-dark">
              <Users className="h-4 w-4 text-brand-500" />
              Members ({members.length})
            </h2>
            <div className="flex items-center gap-2">
              <Button as={Link} to={`/clubs/${clubId}/members`} variant="secondary" size="sm">
                View directory
              </Button>
              {canManageRecords && (
                <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark">
                  Import CSV
                  <input type="file" accept=".csv,text/csv" onChange={handleImportMembers} className="hidden" />
                </label>
              )}
              {canManageRecords && (
                <Button variant="secondary" size="sm" onClick={() => downloadBlob(`/clubs/${clubId}/members/csv`, 'members.csv')}>
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <Card key={m.id} interactive={false} className="flex items-center gap-3">
                <MemberAvatar name={m.userName} className="h-10 w-10" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink dark:text-ink-dark">{m.userName}</span>
                  {isPresident ? (
                    <select
                      value={m.position}
                      onChange={(e) => handleAssignPosition(m.id, e.target.value)}
                      className="mt-0.5 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark-muted"
                    >
                      {ALL_POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge tone={POSITION_TONE[m.position] || 'neutral'} className="mt-0.5">
                      {m.position}
                    </Badge>
                  )}
                </span>
                {isPresident && m.position !== 'PRESIDENT' && (
                  <button
                    type="button"
                    title="Remove from club"
                    aria-label={`Remove ${m.userName}`}
                    onClick={() => handleRemoveMember(m.id, m.userName)}
                    className="rounded-md p-1.5 text-ink-muted transition-fast hover:bg-danger/10 hover:text-danger"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'budget' && canManageLedger && ledger && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Budget ledger</h2>
            <Button size="sm" onClick={() => setShowLogExpense(true)}>
              <Plus className="h-3.5 w-3.5" />
              Log expense
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="grid grid-cols-3 gap-3">
                <Card interactive={false}>
                  <p className="text-xs text-ink-muted dark:text-ink-dark-muted">Total income</p>
                  <p className="mt-1 text-xl font-bold text-success">{ledger.totalIncome}</p>
                </Card>
                <Card interactive={false}>
                  <p className="text-xs text-ink-muted dark:text-ink-dark-muted">Total expenses</p>
                  <p className="mt-1 text-xl font-bold text-danger">{ledger.totalExpenses}</p>
                </Card>
                <Card interactive={false}>
                  <p className="text-xs text-ink-muted dark:text-ink-dark-muted">Balance</p>
                  <p className="mt-1 text-xl font-bold text-ink dark:text-ink-dark">{ledger.balance}</p>
                </Card>
              </div>

              {ledger.eventBudgets?.length > 0 && (
                <SectionCard title="Event budgets" className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-ink-muted dark:text-ink-dark-muted">
                      <tr>
                        <th className="pb-2 font-medium">Event</th>
                        <th className="pb-2 font-medium">Budget</th>
                        <th className="pb-2 font-medium">Spent</th>
                        <th className="pb-2 font-medium">Left</th>
                        <th className="pb-2 font-medium">Fees in</th>
                      </tr>
                    </thead>
                    <tbody className="text-ink dark:text-ink-dark">
                      {ledger.eventBudgets.map((b) => (
                        <tr key={b.eventId} className="border-t border-border dark:border-border-dark">
                          <td className="py-2.5 font-medium">{b.title}</td>
                          <td className="py-2.5">{b.budget ?? '—'}</td>
                          <td className="py-2.5">{b.spent}</td>
                          <td className={`py-2.5 ${b.remaining != null && Number(b.remaining) < 0 ? 'text-danger' : ''}`}>
                            {b.remaining ?? '—'}
                          </td>
                          <td className="py-2.5">{b.income}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SectionCard>
              )}

              {ledger.expenses.length > 0 && (
                <ChartCard
                  title="Spending by month"
                  subtitle="Logged expenses, past 6 months"
                  table={{
                    columns: ['Month', 'Spent'],
                    rows: spendingByMonth.map((m) => [m.fullLabel, m.value.toLocaleString()]),
                  }}
                >
                  <ColumnChart
                    ariaLabel="Spending by month"
                    series={[{ label: 'Spent', color: 'var(--chart-series-1)' }]}
                    data={spendingByMonth.map((m) => ({ label: m.label, fullLabel: m.fullLabel, values: [m.value] }))}
                  />
                </ChartCard>
              )}

              <SectionCard title="Expenses">
                {ledger.expenses.length === 0 && (
                  <p className="text-sm text-ink-muted dark:text-ink-dark-muted">No expenses logged yet.</p>
                )}
                <div className="divide-y divide-border dark:divide-border-dark">
                  {ledger.expenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-ink-dark">{e.description}</p>
                        <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                          {e.expenseDate} — logged by {e.loggedByName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-danger">-{e.amount}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(e.id)}
                          className="text-xs text-danger hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Spending" className="flex flex-col items-center self-start">
              <Donut value={totalExpenses} total={totalIncome} />
              <dl className="mt-4 w-full space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-ink-muted dark:text-ink-dark-muted">
                    <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                    Spent
                  </dt>
                  <dd className="font-medium text-ink dark:text-ink-dark">{ledger.totalExpenses}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2 text-ink-muted dark:text-ink-dark-muted">
                    <span className="h-2.5 w-2.5 rounded-full bg-surface-muted ring-1 ring-border dark:bg-surface-dark dark:ring-border-dark" />
                    Remaining
                  </dt>
                  <dd className="font-medium text-ink dark:text-ink-dark">{ledger.balance}</dd>
                </div>
              </dl>
            </SectionCard>
          </div>
        </section>
      )}

      {showCreateEvent && (
        <CreateEventModal
          clubId={clubId}
          onClose={() => setShowCreateEvent(false)}
          onCreated={(created) => setEvents((prev) => [...prev, created])}
        />
      )}

      {showLogExpense && (
        <LogExpenseModal
          clubId={clubId}
          onClose={() => setShowLogExpense(false)}
          onLogged={(expense) =>
            setLedger((prev) => ({
              ...prev,
              totalExpenses: (Number(prev.totalExpenses) + Number(expense.amount)).toString(),
              balance: (Number(prev.balance) - Number(expense.amount)).toString(),
              expenses: [expense, ...prev.expenses],
            }))
          }
        />
      )}

      {showEditClub && (
        <CreateClubModal
          club={club}
          onClose={() => setShowEditClub(false)}
          onCreated={(updated) => setClub(updated)}
        />
      )}
    </div>
  )
}

export default ClubDetailPage

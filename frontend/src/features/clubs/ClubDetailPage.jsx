import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import CreateEventModal from '../events/CreateEventModal'
import { joinClub } from './clubsSlice'
import AnnouncementComments from './AnnouncementComments'
import CreateClubModal from './CreateClubModal'
import LogExpenseModal from './LogExpenseModal'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']
const LEDGER_POSITIONS = ['PRESIDENT', 'TREASURER']
const ALL_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER', 'MEMBER']

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
  const [joinStatus, setJoinStatus] = useState(null)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showLogExpense, setShowLogExpense] = useState(false)
  const [showEditClub, setShowEditClub] = useState(false)
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
  const isPresident = myMembership?.position === 'PRESIDENT'
  const effectiveMembershipStatus =
    joinStatus === 'LEFT' ? null : joinStatus || (myMembership ? 'APPROVED' : pendingRequests.some((p) => p.userId === user?.id) ? 'PENDING' : null)

  useEffect(() => {
    if (!canManageLedger) return
    api.get(`/clubs/${clubId}/expenses/ledger`).then((res) => setLedger(res.data)).catch(() => {})
  }, [clubId, canManageLedger])

  async function handleJoin() {
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
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <div className="h-6 w-40 animate-pulse rounded bg-surface-muted dark:bg-surface-dark-muted" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
        <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <Breadcrumbs items={[{ label: 'Clubs', to: '/clubs' }, { label: club.name }]} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">{club.name}</h1>
          <span className="mt-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
            {club.category}
          </span>
        </div>
        <div className="flex gap-2">
          {isPresident && (
            <button
              type="button"
              onClick={() => setShowEditClub(true)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
            >
              Edit club
            </button>
          )}
          {effectiveMembershipStatus === 'APPROVED' && !isPresident && (
            <button
              type="button"
              onClick={handleLeave}
              className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger transition-fast hover:bg-danger/10"
            >
              Leave club
            </button>
          )}
          {effectiveMembershipStatus !== 'APPROVED' && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={effectiveMembershipStatus === 'PENDING'}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
            >
              {effectiveMembershipStatus === 'PENDING' ? 'Request pending' : 'Join club'}
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm text-ink-muted dark:text-ink-dark-muted">
        {club.description || 'No description yet.'}
      </p>

      {isOfficer && stats && (
        <section className="mt-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Members', stats.memberCount],
              ['Events', stats.eventCount],
              ['RSVPs', stats.totalRsvps],
              ['Attendance', stats.totalAttendance],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-border bg-surface p-3 text-center shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <p className="text-xl font-semibold text-ink dark:text-ink-dark">{value}</p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => {
                api.get(`/analytics/clubs/${clubId}/csv`, { responseType: 'blob' }).then((res) => {
                  const url = window.URL.createObjectURL(res.data)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'club-stats.csv'
                  link.click()
                  window.URL.revokeObjectURL(url)
                })
              }}
              className="text-xs text-brand-600 hover:underline"
            >
              Download stats as CSV
            </button>
            <button
              type="button"
              onClick={() => {
                api.get(`/analytics/clubs/${clubId}/pdf`, { responseType: 'blob' }).then((res) => {
                  const url = window.URL.createObjectURL(res.data)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'club-report.pdf'
                  link.click()
                  window.URL.revokeObjectURL(url)
                })
              }}
              className="text-xs text-brand-600 hover:underline"
            >
              Download stats as PDF
            </button>
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Events</h2>
          {isOfficer && (
            <button
              type="button"
              onClick={() => setShowCreateEvent(true)}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-fast hover:bg-brand-700"
            >
              + Create event
            </button>
          )}
        </div>
        {events.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">No events yet.</p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {events.map((e) => (
            <Link
              key={e.id}
              to={`/events/${e.id}`}
              className="rounded-xl border border-border bg-surface p-3 shadow-card transition-fast hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
            >
              <p className="text-sm font-medium text-ink dark:text-ink-dark">{e.title}</p>
              <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                {new Date(e.eventDate).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Announcements</h2>
        {isOfficer && (
          <form onSubmit={handlePostAnnouncement} className="mt-3 flex gap-2">
            <input
              type="text"
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              placeholder="Post an update to the club feed..."
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            />
            <button
              type="submit"
              disabled={postingAnnouncement || !announcementDraft.trim()}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
            >
              Post
            </button>
          </form>
        )}
        {announcements.length === 0 && (
          <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">No announcements yet.</p>
        )}
        <div className="mt-3 space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
            >
              <div className="flex-1">
                <p className="text-sm text-ink dark:text-ink-dark">{a.content}</p>
                <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">— {a.authorName}</p>
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
      </section>

      {pendingRequests.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
            Pending join requests ({pendingRequests.length})
          </h2>
          <div className="mt-3 space-y-2">
            {pendingRequests.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <span className="text-sm text-ink dark:text-ink-dark">{m.userName}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewRequest(m.id, true)}
                    className="rounded-md bg-success px-3 py-1 text-xs font-medium text-white transition-fast hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest(m.id, false)}
                    className="rounded-md bg-danger px-3 py-1 text-xs font-medium text-white transition-fast hover:opacity-90"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Members ({members.length})</h2>
          <div className="flex items-center gap-3">
            {isPresident && (
              <label className="cursor-pointer text-xs text-brand-600 hover:underline">
                Import CSV
                <input type="file" accept=".csv,text/csv" onChange={handleImportMembers} className="hidden" />
              </label>
            )}
            {isOfficer && (
              <button
                type="button"
                onClick={() => {
                  api.get(`/clubs/${clubId}/members/csv`, { responseType: 'blob' }).then((res) => {
                    const url = window.URL.createObjectURL(res.data)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = 'members.csv'
                    link.click()
                    window.URL.revokeObjectURL(url)
                  })
                }}
                className="text-xs text-brand-600 hover:underline"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
            >
              <span className="text-sm text-ink dark:text-ink-dark">{m.userName}</span>
              {isPresident ? (
                <select
                  value={m.position}
                  onChange={(e) => handleAssignPosition(m.id, e.target.value)}
                  className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark-muted"
                >
                  {ALL_POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
                  {m.position}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {canManageLedger && ledger && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Budget ledger</h2>
            <button
              type="button"
              onClick={() => setShowLogExpense(true)}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-fast hover:bg-brand-700"
            >
              + Log expense
            </button>
          </div>
          <div className="mt-3 flex gap-3">
            <div className="flex-1 rounded-xl border border-border bg-surface p-3 text-center shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
              <p className="text-xl font-semibold text-ink dark:text-ink-dark">{ledger.totalExpenses}</p>
              <p className="text-xs text-ink-muted dark:text-ink-dark-muted">Total expenses</p>
            </div>
            <div className="flex-1 rounded-xl border border-border bg-surface p-3 text-center shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
              <p className="text-xl font-semibold text-ink dark:text-ink-dark">{ledger.balance}</p>
              <p className="text-xs text-ink-muted dark:text-ink-dark-muted">Balance</p>
            </div>
          </div>
          {ledger.expenses.length === 0 && (
            <p className="mt-3 text-sm text-ink-muted dark:text-ink-dark-muted">No expenses logged yet.</p>
          )}
          <div className="mt-3 space-y-2">
            {ledger.expenses.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <div>
                  <p className="text-sm text-ink dark:text-ink-dark">{e.description}</p>
                  <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                    {e.expenseDate} — logged by {e.loggedByName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-danger">-{e.amount}</span>
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

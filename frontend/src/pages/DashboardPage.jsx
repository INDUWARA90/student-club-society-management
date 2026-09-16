import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { logout } from '../features/auth/authSlice'

const ROLE_BADGE_CLASS = {
  STUDENT: 'bg-role-student/10 text-role-student',
  FACULTY_ADVISOR: 'bg-role-advisor/10 text-role-advisor',
  SUPER_ADMIN: 'bg-role-super/10 text-role-super',
}

const ROLE_LABEL = {
  STUDENT: 'Student',
  FACULTY_ADVISOR: 'Faculty Advisor',
  SUPER_ADMIN: 'Super Admin',
}

function DashboardPage() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const [certificates, setCertificates] = useState([])
  const [memberships, setMemberships] = useState([])

  useEffect(() => {
    api.get('/certificates/me').then((res) => setCertificates(res.data)).catch(() => {})
    api.get('/memberships/me').then((res) => setMemberships(res.data)).catch(() => {})
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

  const approvedMemberships = memberships.filter((m) => m.status === 'APPROVED')
  const pendingMemberships = memberships.filter((m) => m.status === 'PENDING')
  const adminClubs = approvedMemberships.filter((m) => m.position === 'PRESIDENT')

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Welcome, {user?.name}</h1>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASS[user?.role] || ''}`}
          >
            {ROLE_LABEL[user?.role] || user?.role}
          </span>
        </div>
        <button
          type="button"
          onClick={() => dispatch(logout())}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
        >
          Log out
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          to="/clubs"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700"
        >
          Browse clubs
        </Link>
        <Link
          to="/events"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
        >
          Browse events
        </Link>
      </div>

      {/* Club Admin widget — shown to whoever currently holds PRESIDENT in any club, regardless of base role */}
      {adminClubs.length > 0 && (
        <section className="mt-8 rounded-xl border border-role-admin/30 bg-role-admin/5 p-4">
          <h2 className="text-sm font-semibold text-role-admin">Clubs you manage</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {adminClubs.map((m) => (
              <Link
                key={m.id}
                to={`/clubs/${m.clubId}`}
                className="rounded-xl border border-border bg-surface p-3 shadow-card transition-fast hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <p className="text-sm font-medium text-ink dark:text-ink-dark">{m.clubName}</p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  President — membership requests &amp; budget ledger inside
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {user?.role === 'SUPER_ADMIN' && (
        <section className="mt-8 rounded-xl border border-role-super/30 bg-role-super/5 p-4">
          <h2 className="text-sm font-semibold text-role-super">Super Admin</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/admin/pending-clubs"
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card transition-fast hover:-translate-y-0.5 dark:bg-surface-dark-muted dark:text-ink-dark"
            >
              Review pending clubs
            </Link>
            <Link
              to="/analytics"
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card transition-fast hover:-translate-y-0.5 dark:bg-surface-dark-muted dark:text-ink-dark"
            >
              University-wide analytics
            </Link>
            <Link
              to="/admin/audit-log"
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card transition-fast hover:-translate-y-0.5 dark:bg-surface-dark-muted dark:text-ink-dark"
            >
              Audit log
            </Link>
          </div>
        </section>
      )}

      {user?.role === 'FACULTY_ADVISOR' && (
        <section className="mt-8 rounded-xl border border-role-advisor/30 bg-role-advisor/5 p-4">
          <h2 className="text-sm font-semibold text-role-advisor">Faculty Advisor</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/advisor/pending-events"
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card transition-fast hover:-translate-y-0.5 dark:bg-surface-dark-muted dark:text-ink-dark"
            >
              Review pending events
            </Link>
            <Link
              to="/advisor/clubs"
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card transition-fast hover:-translate-y-0.5 dark:bg-surface-dark-muted dark:text-ink-dark"
            >
              All clubs (read-only)
            </Link>
            <Link
              to="/analytics"
              className="rounded-md bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-card transition-fast hover:-translate-y-0.5 dark:bg-surface-dark-muted dark:text-ink-dark"
            >
              University-wide analytics
            </Link>
          </div>
        </section>
      )}

      {approvedMemberships.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">My clubs</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {approvedMemberships.map((m) => (
              <Link
                key={m.id}
                to={`/clubs/${m.clubId}`}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card transition-fast hover:-translate-y-0.5 hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <span className="text-sm text-ink dark:text-ink-dark">{m.clubName}</span>
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted">
                  {m.position}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {pendingMemberships.length > 0 && (
        <p className="mt-3 text-xs text-ink-muted dark:text-ink-dark-muted">
          You have {pendingMemberships.length} join request(s) awaiting approval.
        </p>
      )}

      {certificates.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Your certificates</h2>
          <div className="mt-3 space-y-2">
            {certificates.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
              >
                <span className="text-sm text-ink dark:text-ink-dark">{c.clubName}</span>
                <button type="button" onClick={() => downloadCertificate(c.id)} className="text-sm text-brand-600 hover:underline">
                  Download PDF
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default DashboardPage

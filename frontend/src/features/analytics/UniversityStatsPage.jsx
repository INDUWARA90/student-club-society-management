import { useEffect, useState } from 'react'
import api from '../../api/axios'

function UniversityStatsPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/analytics/university').then((res) => setStats(res.data)).catch((e) => setError(e.response?.data?.message))
  }, [])

  if (error) {
    return <div className="mx-auto max-w-4xl p-4 md:p-8 text-sm text-danger">{error}</div>
  }

  if (!stats) {
    return <div className="mx-auto max-w-4xl p-4 md:p-8">Loading…</div>
  }

  const cards = [
    ['Approved clubs', stats.totalClubs],
    ['Students', stats.totalStudents],
    ['Published events', stats.totalEvents],
    ['Payments collected', stats.totalPaymentsCollected],
    ['Pending club proposals', stats.pendingClubProposals],
    ['Pending event approvals', stats.pendingEventApprovals],
  ]

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">University-wide analytics</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-surface p-4 text-center shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
          >
            <p className="text-2xl font-semibold text-ink dark:text-ink-dark">{value}</p>
            <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UniversityStatsPage

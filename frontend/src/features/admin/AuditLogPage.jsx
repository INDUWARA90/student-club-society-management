import { useEffect, useState } from 'react'
import api from '../../api/axios'

function AuditLogPage() {
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/audit-logs').then((res) => setLogs(res.data)).catch((e) => setError(e.response?.data?.message))
  }, [])

  if (error) {
    return <div className="mx-auto max-w-4xl p-4 md:p-8 text-sm text-danger">{error}</div>
  }

  if (!logs) {
    return <div className="mx-auto max-w-4xl p-4 md:p-8">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Admin audit log</h1>
      {logs.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted dark:text-ink-dark-muted">No admin actions recorded yet.</p>
      )}
      <div className="mt-6 space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-xl border border-border bg-surface p-3 shadow-card dark:border-border-dark dark:bg-surface-dark-muted"
          >
            <p className="text-sm text-ink dark:text-ink-dark">
              <span className="font-medium">{log.actorName}</span> — {log.action.replace(/_/g, ' ').toLowerCase()}
              {log.details && <> ({log.details})</>}
            </p>
            <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
              {new Date(log.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AuditLogPage

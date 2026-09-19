import { ScrollText } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api/axios'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'

function AuditLogPage() {
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/audit-logs').then((res) => setLogs(res.data)).catch((e) => setError(e.response?.data?.message))
  }, [])

  if (error) {
    return <div className="mx-auto max-w-4xl p-4 md:p-8 text-sm text-danger">{error}</div>
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader title="Admin audit log" />

      {!logs && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {logs && logs.length === 0 && (
        <EmptyState icon={ScrollText} description="No admin actions recorded yet." />
      )}

      {logs && logs.length > 0 && (
        <div className="mt-6 space-y-2">
          {logs.map((log) => (
            <Card key={log.id} interactive={false}>
              <p className="text-sm text-ink dark:text-ink-dark">
                <span className="font-medium">{log.actorName}</span> — {log.action.replace(/_/g, ' ').toLowerCase()}
                {log.details && <> ({log.details})</>}
              </p>
              <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default AuditLogPage

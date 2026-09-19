import { CheckCircle2, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'

function PendingClubsPage() {
  const { showToast } = useToast()
  const [clubs, setClubs] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  function load() {
    api.get('/clubs/pending').then((res) => setClubs(res.data)).catch((e) => setError(e.response?.data?.message))
  }

  async function review(clubId, approve) {
    try {
      await api.post(`/clubs/${clubId}/${approve ? 'approve' : 'reject'}`)
      setClubs((prev) => prev.filter((c) => c.id !== clubId))
      showToast(approve ? 'Club approved' : 'Club rejected')
    } catch (e) {
      const message = e.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader title="Pending club proposals" />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {clubs.length === 0 && (
        <EmptyState icon={CheckCircle2} description="No pending club proposals." />
      )}

      <div className="mt-6 space-y-3">
        {clubs.map((club) => (
          <Card key={club.id} interactive={false} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink dark:text-ink-dark">{club.name}</h2>
              <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
                {club.category} — {club.description || 'No description'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="success" size="sm" onClick={() => review(club.id, true)}>
                Approve
              </Button>
              <Button variant="danger" size="sm" onClick={() => review(club.id, false)}>
                Reject
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default PendingClubsPage

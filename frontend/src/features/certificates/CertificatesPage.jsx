import { Award, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../api/axios'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ToastProvider'
import { fetchMyCertificates } from './certificatesSlice'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function CertificatesPage() {
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.certificates)
  const { showToast } = useToast()
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    dispatch(fetchMyCertificates())
  }, [dispatch])

  async function handleDownload(certificate) {
    setDownloadingId(certificate.id)
    try {
      const res = await api.get(`/certificates/${certificate.id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${certificate.clubName.replace(/\s+/g, '-')}-certificate.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      showToast('Could not download certificate', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader title="My Certificates" description="Certificates you've earned across clubs." />

      {status === 'loading' && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {status !== 'loading' && items.length === 0 && (
        <EmptyState
          icon={Award}
          title="No certificates yet"
          description="Certificates appear here once a club issues one to you."
        />
      )}

      {status !== 'loading' && items.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((certificate) => (
            <Card key={certificate.id} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-gradient-soft text-brand-500">
                <Award className="h-5 w-5" />
              </span>
              <h2 className="mt-3 font-semibold text-ink dark:text-ink-dark">{certificate.clubName}</h2>
              <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">
                Issued {formatDate(certificate.issuedAt)}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                loading={downloadingId === certificate.id}
                onClick={() => handleDownload(certificate)}
              >
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default CertificatesPage

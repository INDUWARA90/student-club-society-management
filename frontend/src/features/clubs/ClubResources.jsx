import { Download, FileText, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { fileToDataUrl } from '../../utils/fileToDataUrl'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

function ClubResources({ clubId, isOfficer, isPresident }) {
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [resources, setResources] = useState(null)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get(`/clubs/${clubId}/resources`).then((res) => setResources(res.data)).catch(() => setResources([]))
  }, [clubId])

  async function handleUpload(e) {
    e.preventDefault()
    if (!title.trim() || !file) return
    setUploading(true)
    try {
      const fileB64 = await fileToDataUrl(file)
      const { data } = await api.post(`/clubs/${clubId}/resources`, {
        title: title.trim(),
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileB64,
      })
      setResources((prev) => [data, ...(prev || [])])
      setTitle('')
      setFile(null)
      showToast('Resource uploaded')
    } catch (e2) {
      showToast(e2.response?.data?.message || 'Something went wrong', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(resource) {
    try {
      const res = await api.get(`/clubs/${clubId}/resources/${resource.id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = resource.fileName
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not download resource', 'error')
    }
  }

  async function handleDelete(resourceId) {
    try {
      await api.delete(`/clubs/${clubId}/resources/${resourceId}`)
      setResources((prev) => prev.filter((r) => r.id !== resourceId))
      showToast('Resource deleted')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  return (
    <Card interactive={false}>
      <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">Resources</h2>

      {isOfficer && (
        <form onSubmit={handleUpload} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (e.g. Club Constitution)"
            className="min-w-50 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
          />
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 dark:text-ink-dark dark:file:bg-brand-500/15 dark:file:text-brand-300"
          />
          <Button type="submit" size="sm" loading={uploading} disabled={!title.trim() || !file}>
            <Plus className="h-3.5 w-3.5" />
            Upload
          </Button>
        </form>
      )}

      {resources?.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-ink-muted dark:text-ink-dark-muted">
          <FileText className="h-4 w-4" />
          No resources yet.
        </p>
      )}

      {resources && resources.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {resources.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-lg bg-surface-muted p-3 dark:bg-surface-dark"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-brand-500" />
                <div>
                  <p className="text-sm font-medium text-ink dark:text-ink-dark">{r.title}</p>
                  <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                    {r.uploadedByName} · {formatDate(r.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleDownload(r)} aria-label="Download">
                  <Download className="h-4 w-4" />
                </Button>
                {(r.uploadedById === user?.id || isPresident) && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default ClubResources

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  File,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { fileToDataUrl } from '../../utils/fileToDataUrl'

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function isImageResource(r) {
  if (!r) return false
  if (r.contentType && r.contentType.startsWith('image/')) return true
  if (r.fileB64 && r.fileB64.startsWith('data:image/')) return true
  if (r.fileName && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(r.fileName)) return true
  return false
}

function getFileExtension(fileName) {
  if (!fileName) return 'FILE'
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE'
}

function ClubResources({ clubId, isOfficer, isPresident }) {
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()

  const [resources, setResources] = useState(null)
  const [activeFilter, setActiveFilter] = useState('ALL') // 'ALL' | 'PHOTOS' | 'DOCS'
  const [uploadModalOpen, setUploadModalOpen] = useState(false)

  // Upload state
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [previewB64, setPreviewB64] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Lightbox modal state
  const [lightboxIndex, setLightboxIndex] = useState(null)

  useEffect(() => {
    if (!clubId) return
    api
      .get(`/clubs/${clubId}/resources`)
      .then((res) => setResources(Array.isArray(res.data) ? res.data : []))
      .catch(() => setResources([]))
  }, [clubId])

  // Split resources into photos and docs
  const imageResources = useMemo(() => {
    if (!resources) return []
    return resources.filter(isImageResource)
  }, [resources])

  const docResources = useMemo(() => {
    if (!resources) return []
    return resources.filter((r) => !isImageResource(r))
  }, [resources])

  const displayedResources = useMemo(() => {
    if (!resources) return []
    if (activeFilter === 'PHOTOS') return imageResources
    if (activeFilter === 'DOCS') return docResources
    return resources
  }, [resources, activeFilter, imageResources, docResources])

  async function handleFileSelect(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > 15 * 1024 * 1024) {
      showToast('File size must be under 15MB', 'error')
      return
    }
    setFile(selected)
    // Default title from file name without extension if title is blank
    if (!title.trim()) {
      const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1))
    }
    // Generate preview if image
    if (selected.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(selected.name)) {
      try {
        const b64 = await fileToDataUrl(selected)
        setPreviewB64(b64)
      } catch {
        setPreviewB64(null)
      }
    } else {
      setPreviewB64(null)
    }
  }

  async function handleUploadSubmit(e) {
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
      setPreviewB64(null)
      setUploadModalOpen(false)
      showToast('Media uploaded to gallery 🎉')
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  function handleDownload(resource) {
    if (resource.fileB64) {
      const link = document.createElement('a')
      link.href = resource.fileB64
      link.download = resource.fileName || `${resource.title || 'media'}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showToast('Download started')
      return
    }

    api
      .get(`/clubs/${clubId}/resources/${resource.id}/download`, { responseType: 'blob' })
      .then((res) => {
        const url = window.URL.createObjectURL(res.data)
        const link = document.createElement('a')
        link.href = url
        link.download = resource.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      })
      .catch((e) => {
        showToast(e.response?.data?.message || 'Could not download media', 'error')
      })
  }

  async function handleDelete(resourceId, resourceTitle) {
    if (!window.confirm(`Delete "${resourceTitle || 'this item'}" from the gallery?`)) return
    try {
      await api.delete(`/clubs/${clubId}/resources/${resourceId}`)
      setResources((prev) => prev.filter((r) => r.id !== resourceId))
      if (lightboxIndex !== null) setLightboxIndex(null)
      showToast('Item deleted')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete item', 'error')
    }
  }

  // Keyboard navigation for Lightbox modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (lightboxIndex === null) return
      if (e.key === 'Escape') {
        setLightboxIndex(null)
      } else if (e.key === 'ArrowLeft' && imageResources.length > 1) {
        setLightboxIndex((prev) => (prev > 0 ? prev - 1 : imageResources.length - 1))
      } else if (e.key === 'ArrowRight' && imageResources.length > 1) {
        setLightboxIndex((prev) => (prev < imageResources.length - 1 ? prev + 1 : 0))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, imageResources.length])

  const currentLightboxImage =
    lightboxIndex !== null && imageResources[lightboxIndex]
      ? imageResources[lightboxIndex]
      : null

  return (
    <div className="space-y-6">
      {/* Gallery Header with Title, Stats, and Upload Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl flex items-center gap-2">
            <ImageIcon className="h-6 w-6 text-[#6366f1]" />
            Club Gallery &amp; Media
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Browse event photos, meeting memories, and official club documents.
          </p>
        </div>

        {isOfficer && (
          <button
            type="button"
            onClick={() => {
              setTitle('')
              setFile(null)
              setPreviewB64(null)
              setUploadModalOpen(true)
            }}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
          >
            <Plus className="h-4 w-4" />
            Upload Photo / File
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeFilter === 'ALL'
              ? 'bg-[#6366f1] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          All Media ({resources ? resources.length : 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('PHOTOS')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeFilter === 'PHOTOS'
              ? 'bg-[#6366f1] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Photos ({imageResources.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter('DOCS')}
          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
            activeFilter === 'DOCS'
              ? 'bg-[#6366f1] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Documents ({docResources.length})
        </button>
      </div>

      {/* Empty State */}
      {resources && displayedResources.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
            <ImageIcon className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
            {activeFilter === 'PHOTOS'
              ? 'No photos in the gallery yet'
              : activeFilter === 'DOCS'
              ? 'No documents uploaded yet'
              : 'No gallery items found'}
          </h3>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {isOfficer
              ? 'Upload meeting photos, event snapshots, or documents using the button above.'
              : 'Club officers will post event photos and shared files here.'}
          </p>
        </div>
      )}

      {/* Main Grid: Images & Files */}
      {resources && displayedResources.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {displayedResources.map((item) => {
            const isImg = isImageResource(item)
            const canDelete = item.uploadedById === user?.id || isPresident

            if (isImg) {
              const imageIndex = imageResources.findIndex((img) => img.id === item.id)

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* Photo Preview Container */}
                  <div
                    onClick={() => setLightboxIndex(imageIndex >= 0 ? imageIndex : 0)}
                    className="relative aspect-4/3 w-full cursor-pointer overflow-hidden bg-slate-100 dark:bg-slate-800"
                  >
                    <img
                      src={item.fileB64}
                      alt={item.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Gradient Overlay & Hover Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex flex-col justify-between p-3">
                      <div className="flex items-center justify-end gap-1.5 self-end">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(item.id, item.title)
                            }}
                            title="Delete photo"
                            className="rounded-lg bg-slate-900/80 p-1.5 text-white hover:bg-rose-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownload(item)
                          }}
                          title="Download photo"
                          className="rounded-lg bg-slate-900/80 p-1.5 text-white hover:bg-indigo-600 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-white">
                        <Maximize2 className="h-4 w-4 shrink-0 text-white/90" />
                        <span className="text-xs font-semibold drop-shadow-xs">Click to enlarge</span>
                      </div>
                    </div>
                  </div>

                  {/* Photo Info */}
                  <div className="p-3">
                    <p
                      title={item.title}
                      onClick={() => setLightboxIndex(imageIndex >= 0 ? imageIndex : 0)}
                      className="cursor-pointer truncate text-xs font-bold text-slate-900 hover:text-[#6366f1] dark:text-white dark:hover:text-[#818cf8]"
                    >
                      {item.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[120px]">{item.uploadedByName || 'Member'}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            }

            // Non-image Document Card
            const ext = getFileExtension(item.fileName)
            return (
              <div
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs dark:bg-indigo-950/50 dark:text-indigo-400">
                      {ext}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        title="Download document"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.title)}
                          title="Delete document"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="mt-3 text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                    {item.title}
                  </h4>
                  <p className="mt-1 text-[11px] text-slate-400 truncate">{item.fileName}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate max-w-[120px]">{item.uploadedByName || 'Officer'}</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {currentLightboxImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={currentLightboxImage.title}
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/90 p-4 sm:p-6 backdrop-blur-md transition-all"
        >
          {/* Lightbox Top Bar */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between text-white"
          >
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white drop-shadow-xs">
                {currentLightboxImage.title}
              </h3>
              <p className="text-xs text-slate-300">
                Photo {lightboxIndex + 1} of {imageResources.length} • Uploaded by{' '}
                {currentLightboxImage.uploadedByName || 'Member'} on{' '}
                {formatDate(currentLightboxImage.createdAt)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownload(currentLightboxImage)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                title="Download Photo"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </button>

              {currentLightboxImage.uploadedById === user?.id || isPresident ? (
                <button
                  type="button"
                  onClick={() => handleDelete(currentLightboxImage.id, currentLightboxImage.title)}
                  className="rounded-xl bg-white/10 p-2 text-white hover:bg-rose-600 transition-colors"
                  title="Delete Photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
                title="Close Lightbox"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Center Image with Carousel Arrows */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-1 items-center justify-center py-4"
          >
            {imageResources.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) => (prev > 0 ? prev - 1 : imageResources.length - 1))
                }
                className="absolute left-2 sm:left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-white shadow-lg hover:bg-slate-900 transition-colors"
                title="Previous photo (Left arrow)"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <img
              src={currentLightboxImage.fileB64}
              alt={currentLightboxImage.title}
              className="max-h-[75vh] max-w-[92vw] rounded-2xl object-contain shadow-2xl transition-all"
            />

            {imageResources.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) => (prev < imageResources.length - 1 ? prev + 1 : 0))
                }
                className="absolute right-2 sm:right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/70 text-white shadow-lg hover:bg-slate-900 transition-colors"
                title="Next photo (Right arrow)"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Lightbox Bottom Footer / Hints */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="text-center text-xs text-slate-400"
          >
            Use <kbd className="rounded bg-white/10 px-1 py-0.5">←</kbd> and{' '}
            <kbd className="rounded bg-white/10 px-1 py-0.5">→</kbd> keys to browse • Press{' '}
            <kbd className="rounded bg-white/10 px-1 py-0.5">Esc</kbd> to close
          </div>
        </div>
      )}

      {/* Upload Photo & Resource Modal */}
      {uploadModalOpen && (
        <Modal
          isOpen={true}
          title="Upload Photo or Document"
          onClose={() => {
            if (!uploading) {
              setUploadModalOpen(false)
              setPreviewB64(null)
            }
          }}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
              Add photos from club activities, events, workshops, or upload official documents.
            </p>

            <div>
              <label
                htmlFor="media-title"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Photo / Document Title *
              </label>
              <input
                id="media-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hackathon 2026 Opening Ceremony"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label
                htmlFor="media-file"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Choose File *
              </label>

              {!previewB64 ? (
                <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center transition-all hover:bg-slate-100/70 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:bg-slate-800/80">
                  <Upload className="h-7 w-7 text-slate-400" />
                  <span className="mt-2 text-xs font-semibold text-[#6366f1]">
                    Click or drag photo / document to upload
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-400">
                    PNG, JPG, WebP, PDF, DOCX up to 15MB
                  </span>
                  {file && (
                    <span className="mt-2 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-[#6366f1] dark:bg-indigo-950/50">
                      Selected: {file.name}
                    </span>
                  )}
                  <input
                    id="media-file"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.zip"
                    onChange={handleFileSelect}
                    className="hidden"
                    required
                  />
                </label>
              ) : (
                <div className="relative mt-1.5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                  <img
                    src={previewB64}
                    alt="Uploaded preview"
                    className="aspect-video w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 to-transparent flex items-end justify-between p-3 text-white">
                    <span className="text-xs font-medium truncate max-w-[220px]">
                      {file?.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        setPreviewB64(null)
                      }}
                      className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-600 transition-colors"
                    >
                      Change File
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="secondary"
                type="button"
                disabled={uploading}
                onClick={() => {
                  setUploadModalOpen(false)
                  setPreviewB64(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" loading={uploading} disabled={!title.trim() || !file}>
                {uploading ? 'Uploading...' : 'Upload to Gallery'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ClubResources

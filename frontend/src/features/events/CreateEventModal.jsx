import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useToast } from '../../components/ToastProvider'
import { fileToBase64 } from '../../utils/fileToBase64'
import { createEvent } from './eventsSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function CreateEventModal({ clubId, onClose, onCreated }) {
  const dispatch = useDispatch()
  const { showToast } = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [fee, setFee] = useState('0')
  const [capacity, setCapacity] = useState('')
  const [bannerB64, setBannerB64] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleBannerChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerB64(await fileToBase64(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !eventDate) {
      setError('Title and event date are required')
      return
    }
    setSubmitting(true)
    const payload = {
      title,
      description,
      bannerB64,
      eventDate: new Date(eventDate).toISOString(),
      fee: Number(fee) || 0,
      capacity: capacity ? Number(capacity) : null,
    }
    const result = await dispatch(createEvent({ clubId, payload }))
    setSubmitting(false)
    if (createEvent.fulfilled.match(result)) {
      const created = result.payload
      showToast(
        created.approvalStatus === 'PENDING'
          ? 'Event submitted for Faculty Advisor approval'
          : 'Event created',
      )
      onCreated?.(created)
      onClose()
    } else {
      setError(result.payload)
      showToast(result.payload, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Create an event</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-title">Title</label>
            <input id="event-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-description">Description</label>
            <textarea
              id="event-description"
              className={inputClass}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-date">Date &amp; time</label>
            <input
              id="event-date"
              type="datetime-local"
              className={inputClass}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-banner">Banner</label>
            <input id="event-banner" type="file" accept="image/*" onChange={handleBannerChange} className="block text-sm text-ink dark:text-ink-dark" />
            {bannerB64 && <img src={bannerB64} alt="Banner preview" className="mt-2 h-24 w-full rounded-lg object-cover" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-fee">Fee</label>
              <input
                id="event-fee"
                type="number"
                min="0"
                className={inputClass}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-capacity">
                Capacity (blank = unlimited)
              </label>
              <input
                id="event-capacity"
                type="number"
                min="1"
                className={inputClass}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateEventModal

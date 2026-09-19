import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { fileToBase64 } from '../../utils/fileToBase64'
import { fetchVenues } from '../venues/venuesSlice'
import { createEvent, updateEvent } from './eventsSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function CreateEventModal({ clubId, event, onClose, onCreated }) {
  const dispatch = useDispatch()
  const { showToast } = useToast()
  const { items: venues } = useSelector((state) => state.venues)
  const isEdit = Boolean(event)
  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')
  const [eventDate, setEventDate] = useState(toDatetimeLocal(event?.eventDate))
  const [fee, setFee] = useState(event ? String(event.fee) : '0')
  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : '')
  const [budget, setBudget] = useState(event?.budget != null ? String(event.budget) : '')
  const [bannerB64, setBannerB64] = useState(event?.bannerB64 || null)
  const [venueId, setVenueId] = useState(event?.venueId || '')
  const [endDate, setEndDate] = useState(toDatetimeLocal(event?.endDate))
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availability, setAvailability] = useState(null)

  useEffect(() => {
    dispatch(fetchVenues())
  }, [dispatch])

  async function handleCheckAvailability() {
    if (!venueId || !eventDate) return
    setCheckingAvailability(true)
    setAvailability(null)
    try {
      const desiredStart = new Date(eventDate).toISOString()
      const durationMinutes = endDate
        ? Math.max(1, Math.round((new Date(endDate) - new Date(eventDate)) / 60000))
        : 60
      const { data } = await api.get(`/venues/${venueId}/next-available-slot`, {
        params: { desiredStart, durationMinutes },
      })
      const isFree = data.found && new Date(data.start).getTime() === new Date(desiredStart).getTime()
      setAvailability({ ...data, isFree })
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not check availability', 'error')
    } finally {
      setCheckingAvailability(false)
    }
  }

  function useSuggestedSlot() {
    if (!availability?.found) return
    setEventDate(toDatetimeLocal(availability.start))
    setEndDate(toDatetimeLocal(availability.end))
    setAvailability(null)
  }

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
    if (venueId && !endDate) {
      setError('An end time is required when booking a venue')
      return
    }
    setSubmitting(true)
    const payload = {
      title,
      description,
      location,
      bannerB64,
      eventDate: new Date(eventDate).toISOString(),
      fee: Number(fee) || 0,
      capacity: capacity ? Number(capacity) : null,
      budget: budget !== '' ? Number(budget) : null,
      venueId: venueId || null,
      endDate: venueId && endDate ? new Date(endDate).toISOString() : null,
    }
    const result = isEdit
      ? await dispatch(updateEvent({ eventId: event.id, payload }))
      : await dispatch(createEvent({ clubId, payload }))
    setSubmitting(false)
    const action = isEdit ? updateEvent : createEvent
    if (action.fulfilled.match(result)) {
      const saved = result.payload
      showToast(
        saved.approvalStatus === 'PENDING'
          ? 'Event submitted for Faculty Advisor approval'
          : isEdit ? 'Event updated' : 'Event created',
      )
      onCreated?.(saved)
      onClose()
    } else {
      setError(result.payload)
      showToast(result.payload, 'error')
    }
  }

  return (
    <Modal title={isEdit ? 'Edit event' : 'Create an event'} onClose={onClose}>
        <form className="space-y-4" onSubmit={handleSubmit}>
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
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-location">Location</label>
            <input
              id="event-location"
              className={inputClass}
              placeholder="Room, building, or venue..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-venue">
              Book a venue (optional)
            </label>
            <select
              id="event-venue"
              className={inputClass}
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            >
              <option value="">No specific venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.building ? ` — ${v.building}` : ''}
                </option>
              ))}
            </select>
          </div>
          {venueId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-end-date">
                Booking end time
              </label>
              <input
                id="event-end-date"
                type="datetime-local"
                className={inputClass}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setAvailability(null)
                }}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  loading={checkingAvailability}
                  disabled={!eventDate}
                  onClick={handleCheckAvailability}
                >
                  Check availability
                </Button>
                {availability && availability.isFree && (
                  <span className="text-xs text-success">That time is free ✓</span>
                )}
                {availability && !availability.isFree && availability.found && (
                  <span className="text-xs text-warning">
                    Busy — next available {new Date(availability.start).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    –{new Date(availability.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{' '}
                    <button type="button" onClick={useSuggestedSlot} className="text-brand-600 hover:underline">
                      Use this time
                    </button>
                  </span>
                )}
                {availability && !availability.found && (
                  <span className="text-xs text-danger">No availability found in the next 14 days</span>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-date">Date &amp; time</label>
            <input
              id="event-date"
              type="datetime-local"
              className={inputClass}
              value={eventDate}
              onChange={(e) => {
                setEventDate(e.target.value)
                setAvailability(null)
              }}
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

          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="event-budget">
              Budget (optional)
            </label>
            <input
              id="event-budget"
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
              Compared with the expenses you link to this event in the club ledger.
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </form>
    </Modal>
  )
}

export default CreateEventModal

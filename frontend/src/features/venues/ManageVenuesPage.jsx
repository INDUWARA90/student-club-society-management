import { Building2, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ToastProvider'
import { createVenue, deactivateVenue, fetchVenues, fetchVenueUtilization, updateVenue } from './venuesSlice'

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function VenueFormModal({ venue, onClose, onSubmit }) {
  const [name, setName] = useState(venue?.name || '')
  const [building, setBuilding] = useState(venue?.building || '')
  const [capacity, setCapacity] = useState(venue?.capacity ? String(venue.capacity) : '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit({ name, building: building || null, capacity: capacity ? Number(capacity) : null })
    setSubmitting(false)
  }

  return (
    <Modal title={venue ? 'Edit venue' : 'New venue'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="venue-name">
            Name
          </label>
          <input id="venue-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="venue-building">
            Building (optional)
          </label>
          <input
            id="venue-building"
            className={inputClass}
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="venue-capacity">
            Capacity (optional)
          </label>
          <input
            id="venue-capacity"
            type="number"
            min="1"
            className={inputClass}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!name.trim()}>
            {venue ? 'Save changes' : 'Create venue'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ManageVenuesPage() {
  const dispatch = useDispatch()
  const { items, status, utilization, utilizationStatus } = useSelector((state) => state.venues)
  const { showToast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [editingVenue, setEditingVenue] = useState(null)

  useEffect(() => {
    dispatch(fetchVenues())
    dispatch(fetchVenueUtilization())
  }, [dispatch])

  async function handleCreate(payload) {
    const result = await dispatch(createVenue(payload))
    if (createVenue.fulfilled.match(result)) {
      showToast('Venue created')
      setShowCreate(false)
    } else {
      showToast(result.payload, 'error')
    }
  }

  async function handleUpdate(payload) {
    const result = await dispatch(updateVenue({ venueId: editingVenue.id, payload }))
    if (updateVenue.fulfilled.match(result)) {
      showToast('Venue updated')
      setEditingVenue(null)
    } else {
      showToast(result.payload, 'error')
    }
  }

  async function handleDeactivate(venueId) {
    const result = await dispatch(deactivateVenue(venueId))
    if (deactivateVenue.fulfilled.match(result)) {
      showToast('Venue deactivated')
    } else {
      showToast(result.payload, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHeader
        title="Manage Venues"
        description="Bookable rooms/halls clubs can reserve for events."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New venue
          </Button>
        }
      />

      {utilizationStatus !== 'loading' && utilization.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink dark:text-ink-dark">
            <TrendingUp className="h-4 w-4 text-brand-500" />
            Busiest venues
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {utilization.map((v) => (
              <Card key={v.venueId} interactive={false}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-ink dark:text-ink-dark">{v.venueName}</p>
                  <Badge tone={v.upcomingBookingCount > 0 ? 'brand' : 'neutral'}>
                    {v.upcomingBookingCount} upcoming
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
                  {v.totalBookings} booking{v.totalBookings === 1 ? '' : 's'} total
                </p>
                {v.nextBooking ? (
                  <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">
                    Next: <span className="text-ink dark:text-ink-dark">{v.nextBooking.title}</span> (
                    {v.nextBooking.clubName}) — {formatDateTime(v.nextBooking.eventDate)}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink-muted dark:text-ink-dark-muted">No upcoming bookings</p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {status === 'loading' && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {status !== 'loading' && items.length === 0 && (
        <EmptyState icon={Building2} title="No venues yet" description="Add one so clubs can book it for events." />
      )}

      {status !== 'loading' && items.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">All venues</h2>
          {items.map((venue) => (
            <Card key={venue.id} interactive={false} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink dark:text-ink-dark">{venue.name}</p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  {venue.building || 'No building set'}
                  {venue.capacity ? ` · Capacity ${venue.capacity}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!venue.active && <Badge tone="neutral">Inactive</Badge>}
                <Button variant="ghost" size="sm" onClick={() => setEditingVenue(venue)} aria-label="Edit venue">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeactivate(venue.id)} aria-label="Deactivate venue">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showCreate && <VenueFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editingVenue && (
        <VenueFormModal venue={editingVenue} onClose={() => setEditingVenue(null)} onSubmit={handleUpdate} />
      )}
    </div>
  )
}

export default ManageVenuesPage

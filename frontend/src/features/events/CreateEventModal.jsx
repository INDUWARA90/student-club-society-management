import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Info,
  MapPin,
  Sparkles,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { fileToBase64 } from '../../utils/fileToBase64'
import { fetchVenues } from '../venues/venuesSlice'
import { createEvent, updateEvent } from './eventsSlice'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

// Standard 30-minute time intervals from 07:00 AM to 11:30 PM
const TIME_OPTIONS = []
for (let h = 7; h <= 23; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hh = String(h).padStart(2, '0')
    const mm = String(m).padStart(2, '0')
    const hour12 = h % 12 === 0 ? 12 : h % 12
    const ampm = h >= 12 ? 'PM' : 'AM'
    TIME_OPTIONS.push({
      value: `${hh}:${mm}`,
      label: `${String(hour12).padStart(2, '0')}:${mm} ${ampm}`,
    })
  }
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDateString(d) {
  if (!d || isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function formatTimeString(d) {
  if (!d || isNaN(d.getTime())) return '10:00'
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseIsoToParts(iso) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: '', time: '' }
  return {
    date: formatDateString(d),
    time: formatTimeString(d),
  }
}

// Visual calendar date picker component with clickable monthly calendar popover
function CalendarDatePicker({ value, onChange, min, label = 'Date', id = 'event-date' }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const initialDate = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(initialDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth())

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  const today = new Date()
  const todayStr = formatDateString(today)
  const minStr = min || todayStr

  const formattedDisplay = useMemo(() => {
    if (!value) return ''
    try {
      const d = new Date(value + 'T00:00:00')
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return value
    }
  }, [value])

  function handleSelectDate(day) {
    const selectedDateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
    onChange(selectedDateStr)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        {/* Hidden date input for accessibility & test runner access */}
        <input
          id={id}
          type="date"
          aria-label={label}
          min={minStr}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-left text-slate-800 outline-none transition-all hover:border-[#6366f1] focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
            !value ? 'text-slate-400' : ''
          }`}
          aria-label={label}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#6366f1]" />
            <span className="font-medium">{formattedDisplay || 'Select date...'}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400">
            {weekDays.map((wd) => (
              <span key={wd} className="py-1">
                {wd}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1 text-xs">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <span
                key={`prev-${i}`}
                className="flex h-8 w-8 items-center justify-center text-slate-300 dark:text-slate-600"
              >
                {daysInPrevMonth - firstDayOfMonth + i + 1}
              </span>
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const cellDateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`
              const isSelected = value === cellDateStr
              const isToday = todayStr === cellDateStr
              const isPast = minStr ? cellDateStr < minStr : false

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  disabled={isPast}
                  onClick={() => handleSelectDate(day)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg font-medium transition-all ${
                    isSelected
                      ? 'bg-[#6366f1] text-white font-bold shadow-xs'
                      : isToday
                      ? 'border border-[#6366f1] text-[#6366f1] font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                      : isPast
                      ? 'text-slate-300 cursor-not-allowed dark:text-slate-600'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[11px]">
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                setViewYear(now.getFullYear())
                setViewMonth(now.getMonth())
                handleSelectDate(now.getDate())
              }}
              className="text-[#6366f1] hover:underline font-semibold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateEventModal({ clubId, event, onClose, onCreated, clubs = [] }) {
  const user = useSelector((state) => state.auth?.user)
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [availableClubs, setAvailableClubs] = useState(clubs)
  const [selectedClubId, setSelectedClubId] = useState(clubId || event?.clubId || '')
  const dispatch = useDispatch()
  const { showToast } = useToast()
  const { items: rawVenues } = useSelector((state) => state.venues)
  const venues = Array.isArray(rawVenues) ? rawVenues : []
  const isEdit = Boolean(event)

  const [title, setTitle] = useState(event?.title || '')
  const [description, setDescription] = useState(event?.description || '')
  const [location, setLocation] = useState(event?.location || '')

  // Parse initial dates & times
  const initialStartParts = parseIsoToParts(event?.eventDate)
  const initialEndParts = parseIsoToParts(event?.endDate)

  // Default date to tomorrow if empty
  const defaultDateStr = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return formatDateString(d)
  }, [])

  const [startDate, setStartDate] = useState(initialStartParts.date || defaultDateStr)
  const [startTime, setStartTime] = useState(initialStartParts.time || '10:00')
  const [endDate, setEndDate] = useState(initialEndParts.date || initialStartParts.date || defaultDateStr)
  const [endTime, setEndTime] = useState(initialEndParts.time || '12:00')
  const [isMultiDay, setIsMultiDay] = useState(
    Boolean(initialEndParts.date && initialEndParts.date !== initialStartParts.date),
  )

  const [capacity, setCapacity] = useState(event?.capacity ? String(event.capacity) : '')
  const [bannerB64, setBannerB64] = useState(event?.bannerB64 || null)
  const [venueId, setVenueId] = useState(event?.venueId || '')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availability, setAvailability] = useState(null)
  const [conflictInfo, setConflictInfo] = useState(null)
  const [checkingConflict, setCheckingConflict] = useState(false)

  useEffect(() => {
    dispatch(fetchVenues())
  }, [dispatch])

  useEffect(() => {
    if (!isEdit && availableClubs.length === 0) {
      if (isSuperAdmin) {
        Promise.resolve(api.get('/clubs'))
          .then((res) => {
            const list = Array.isArray(res?.data) ? res.data : []
            setAvailableClubs(list)
            if (!selectedClubId && list.length > 0) {
              setSelectedClubId(list[0].id)
            }
          })
          .catch(() => {})
      } else {
        Promise.resolve(api.get('/memberships/me'))
          .then((res) => {
            const list = Array.isArray(res?.data) ? res.data : []
            const presClubs = list
              .filter((m) => m.status === 'APPROVED' && m.position === 'PRESIDENT')
              .map((m) => ({ id: m.clubId, name: m.clubName }))
            setAvailableClubs(presClubs)
            if (!selectedClubId && presClubs.length > 0) {
              setSelectedClubId(presClubs[0].id)
            }
          })
          .catch(() => {})
      }
    }
  }, [dispatch, isSuperAdmin, isEdit])

  // Real-time schedule formatted summary
  const scheduleSummary = useMemo(() => {
    if (!startDate) return null
    const effectiveEndDate = isMultiDay && endDate ? endDate : startDate
    const startIso = `${startDate}T${startTime || '00:00'}:00`
    const endIso = `${effectiveEndDate}T${endTime || '23:59'}:00`

    const s = new Date(startIso)
    const e = new Date(endIso)
    if (isNaN(s.getTime())) return null

    const dateFormatted = s.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const startTimeFormatted = s.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    if (!endTime) {
      return { invalid: false, text: `${dateFormatted} at ${startTimeFormatted}` }
    }

    if (isNaN(e.getTime()) || e.getTime() <= s.getTime()) {
      return {
        invalid: true,
        text: 'End time must be after the start time',
      }
    }

    const diffMs = e.getTime() - s.getTime()
    const durationMin = Math.round(diffMs / 60000)
    const hours = Math.floor(durationMin / 60)
    const mins = durationMin % 60
    const durationText =
      hours > 0
        ? mins > 0
          ? `${hours}h ${mins}m`
          : `${hours} hour${hours > 1 ? 's' : ''}`
        : `${mins} minutes`

    const endTimeFormatted = e.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })

    if (startDate === effectiveEndDate) {
      return {
        invalid: false,
        date: dateFormatted,
        time: `${startTimeFormatted} – ${endTimeFormatted}`,
        duration: durationText,
      }
    } else {
      const endDateFormatted = e.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      return {
        invalid: false,
        date: `${dateFormatted} to ${endDateFormatted}`,
        time: `${startTimeFormatted} – ${endTimeFormatted}`,
        duration: durationText,
      }
    }
  }, [startDate, startTime, endDate, endTime, isMultiDay])

  async function handleCheckAvailability() {
    if (!venueId || !startDate) return
    setCheckingAvailability(true)
    setAvailability(null)
    try {
      const effectiveEndDate = isMultiDay && endDate ? endDate : startDate
      const desiredStart = new Date(`${startDate}T${startTime}:00`).toISOString()
      const desiredEnd = new Date(`${effectiveEndDate}T${endTime}:00`).toISOString()
      const durationMinutes = Math.max(
        1,
        Math.round((new Date(desiredEnd) - new Date(desiredStart)) / 60000),
      )
      const { data } = await api.get(`/venues/${venueId}/next-available-slot`, {
        params: { desiredStart, durationMinutes },
      })
      const isFree =
        data.found && new Date(data.start).getTime() === new Date(desiredStart).getTime()
      setAvailability({ ...data, isFree })
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not check availability', 'error')
    } finally {
      setCheckingAvailability(false)
    }
  }

  function useSuggestedSlot() {
    if (!availability?.found) return
    const s = parseIsoToParts(availability.start)
    const e = parseIsoToParts(availability.end)
    setStartDate(s.date)
    setStartTime(s.time)
    setEndDate(e.date)
    setEndTime(e.time)
    if (s.date !== e.date) {
      setIsMultiDay(true)
    }
    setAvailability(null)
  }

  useEffect(() => {
    if (!startDate || (!venueId && !location.trim())) {
      setConflictInfo(null)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingConflict(true)
        const effectiveEndDate = isMultiDay && endDate ? endDate : startDate
        const startDateTime = new Date(`${startDate}T${startTime}:00`)
        const endDateTime = endTime ? new Date(`${effectiveEndDate}T${endTime}:00`) : null

        if (isNaN(startDateTime.getTime())) return

        const params = {
          eventDate: startDateTime.toISOString(),
          endDate:
            endDateTime && !isNaN(endDateTime.getTime()) && endDateTime > startDateTime
              ? endDateTime.toISOString()
              : undefined,
          venueId: venueId || undefined,
          location: location.trim() || undefined,
          excludeEventId: event?.id || undefined,
        }

        const res = await api.get('/events/check-conflict', { params })
        if (res.data?.hasConflict) {
          setConflictInfo(res.data)
        } else {
          setConflictInfo(null)
        }
      } catch (e) {
        // Silent catch for background collision inspector
      } finally {
        setCheckingConflict(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [startDate, startTime, endDate, endTime, isMultiDay, venueId, location, event?.id])

  function applySuggestedSlot(startIso, endIso) {
    if (!startIso) return
    const s = parseIsoToParts(startIso)
    const e = endIso ? parseIsoToParts(endIso) : null
    setStartDate(s.date)
    setStartTime(s.time)
    if (e && e.date) {
      setEndDate(e.date)
      setEndTime(e.time)
      if (s.date !== e.date) {
        setIsMultiDay(true)
      }
    }
    setConflictInfo(null)
    showToast('Applied recommended open time slot', 'success')
  }

  async function handleBannerChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit', 'error')
      return
    }
    setBannerB64(await fileToBase64(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Please enter an event title')
      return
    }
    if (!startDate) {
      setError('Please specify when the event takes place')
      return
    }

    const effectiveEndDate = isMultiDay && endDate ? endDate : startDate
    const startDateTime = new Date(`${startDate}T${startTime}:00`)
    const endDateTime = endTime ? new Date(`${effectiveEndDate}T${endTime}:00`) : null

    if (isNaN(startDateTime.getTime())) {
      setError('Invalid start date & time')
      return
    }

    if (endDateTime && endDateTime <= startDateTime) {
      setError('Event end date & time must be later than the start date & time')
      return
    }

    if (venueId && !endTime) {
      setError('An end time is required when booking a university venue')
      return
    }

    if (conflictInfo?.hasConflict) {
      setError(`${conflictInfo.message} Please select an open time slot or switch to an available venue.`)
      return
    }

    const targetClubId = selectedClubId || clubId
    if (!isEdit && !targetClubId) {
      setError('Please select an organizing club for this event')
      return
    }

    setSubmitting(true)
    const payload = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      bannerB64,
      eventDate: startDateTime.toISOString(),
      endDate: endDateTime ? endDateTime.toISOString() : null,
      fee: 0, // Registration fee removed - free admission
      capacity: capacity ? Number(capacity) : null,
      budget: null, // Allocated event budget removed
      venueId: venueId || null,
    }

    const result = isEdit
      ? await dispatch(updateEvent({ eventId: event.id, payload }))
      : await dispatch(createEvent({ clubId: targetClubId, payload }))

    setSubmitting(false)
    const action = isEdit ? updateEvent : createEvent
    if (action.fulfilled.match(result)) {
      const saved = result.payload
      showToast(
        isEdit && event?.approvalStatus === 'REJECTED'
          ? 'Event proposal revised and resubmitted to Faculty Advisor for approval 🎉'
          : saved.approvalStatus === 'PENDING'
          ? 'Event proposal submitted for Faculty Advisor approval 🎉'
          : isEdit
          ? 'Event updated successfully'
          : 'Event proposal created and sent to Advisor for review 🎉',
      )
      onCreated?.(saved)
      onClose()
    } else {
      setError(result.payload)
      showToast(result.payload, 'error')
    }
  }

  return (
    <Modal
      isOpen={true}
      title={isEdit ? 'Edit Event' : 'Create New Event'}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 max-h-[80vh] overflow-y-auto px-1 pr-2">
        <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isEdit
            ? 'Update event details, timing, venue reservations, or attendance settings.'
            : 'Fill in the information below to schedule an event. Proposals require Faculty Advisor sign-off before publishing.'}
        </p>

        {/* Advisor Rejection Feedback Callout (Visible if Rejected) */}
        {isEdit && event?.approvalStatus === 'REJECTED' && (
          <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-4 dark:border-rose-900/60 dark:bg-rose-950/40">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  Advisor Rejection Feedback:
                </p>
                <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                  {event.rejectionReason || 'No specific reason provided.'}
                </p>
                <p className="mt-2 text-[11px] font-medium text-rose-700 dark:text-rose-400">
                  Please address the issues flagged above. Saving your revised details will automatically resubmit the event to the Faculty Advisor for review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Club Selector */}
        {!isEdit && availableClubs.length > 0 && (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            <label
              htmlFor="event-club"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <Users className="h-3.5 w-3.5 text-[#6366f1]" />
              Organizing Club / Society *
            </label>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Only clubs you lead as President can host and manage events.
            </p>
            <select
              id="event-club"
              className={`mt-2 ${inputClass}`}
              value={selectedClubId}
              onChange={(e) => setSelectedClubId(e.target.value)}
              required
            >
              <option value="" disabled>
                Select an organizing club
              </option>
              {availableClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.category ? `(${c.category})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="event-title"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#6366f1]" />
              Event Title *
            </label>
            <input
              id="event-title"
              className={`mt-1.5 ${inputClass}`}
              placeholder="e.g. Annual AI & Robotics Hackathon 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div>
            <label
              htmlFor="event-description"
              className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Event Description & Agenda
            </label>
            <textarea
              id="event-description"
              className={`mt-1.5 ${inputClass}`}
              rows={3}
              placeholder="Outline the event schedule, guest speakers, key topics, and prerequisites for participants..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Clean Date & Time Picker */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-950/60 dark:bg-indigo-950/20 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
              <Calendar className="h-4 w-4 text-[#6366f1]" />
              Event Schedule & Timing *
            </span>

            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isMultiDay}
                onChange={(e) => setIsMultiDay(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-[#6366f1] focus:ring-[#6366f1]"
              />
              Multi-day event
            </label>
          </div>

          {/* Date Picker Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="event-date"
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {isMultiDay ? 'Start Date *' : 'Event Date *'}
              </label>
              <CalendarDatePicker
                id="event-date"
                label={isMultiDay ? 'Start Date' : 'Event Date'}
                value={startDate}
                onChange={(d) => {
                  setStartDate(d)
                  if (!isMultiDay) setEndDate(d)
                  setAvailability(null)
                }}
              />
            </div>

            {isMultiDay ? (
              <div>
                <label
                  htmlFor="event-end-date"
                  className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  End Date *
                </label>
                <CalendarDatePicker
                  id="event-end-date"
                  label="End Date"
                  min={startDate}
                  value={endDate}
                  onChange={(d) => {
                    setEndDate(d)
                    setAvailability(null)
                  }}
                />
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          {/* Time Picker Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="event-start-time"
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Starts At (Time) *
              </label>
              <select
                id="event-start-time"
                className={inputClass}
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value)
                  setAvailability(null)
                }}
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="event-end-time"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  Ends At (Time)
                </span>
                {venueId && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    Required for venue
                  </span>
                )}
              </label>
              <select
                id="event-end-time"
                className={inputClass}
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value)
                  setAvailability(null)
                }}
              >
                <option value="">No end time specified</option>
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Formatted Schedule Summary Preview */}
          {scheduleSummary && (
            <div
              className={`flex items-center gap-2 rounded-xl p-2.5 text-xs ${
                scheduleSummary.invalid
                  ? 'border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
                  : 'border border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300'
              }`}
            >
              {scheduleSummary.invalid ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <div className="flex-1 font-medium">
                {scheduleSummary.invalid ? (
                  scheduleSummary.text
                ) : (
                  <span>
                    <strong>{scheduleSummary.date}</strong> • {scheduleSummary.time} (
                    {scheduleSummary.duration})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Location & Campus Venue Booking */}
        <div className="space-y-3.5">
          <div>
            <label
              htmlFor="event-location"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <MapPin className="h-3.5 w-3.5 text-[#6366f1]" />
              Location / Room / Meeting Link
            </label>
            <input
              id="event-location"
              className={`mt-1.5 ${inputClass}`}
              placeholder="e.g. Science Complex Room 204 or https://meet.google.com/xyz"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Physical address, room number, or video call link for virtual attendees.
            </p>
          </div>

          <div>
            <label
              htmlFor="event-venue"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <Building2 className="h-3.5 w-3.5 text-[#6366f1]" />
              Campus Venue Reservation (Optional)
            </label>
            <select
              id="event-venue"
              className={`mt-1.5 ${inputClass}`}
              value={venueId}
              onChange={(e) => {
                setVenueId(e.target.value)
                setAvailability(null)
              }}
            >
              <option value="">No campus venue (External location or online)</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.building ? ` — ${v.building}` : ''}
                  {v.capacity ? ` (Cap: ${v.capacity})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Live Scheduling Conflict & Venue Availability Inspector */}
          {(venueId || location.trim()) && (
            <div className="space-y-2">
              {venueId && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Verify venue scheduling:
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    loading={checkingAvailability || checkingConflict}
                    disabled={!startDate}
                    onClick={handleCheckAvailability}
                  >
                    Check Venue Availability
                  </Button>
                </div>
              )}

              {availability && (
                <div className="mt-1">
                  {availability.isFree ? (
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>Venue is completely free for your selected schedule!</span>
                    </div>
                  ) : availability.found ? (
                    <div className="space-y-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
                      <p className="font-medium">Selected time overlaps another event. Next open slot at this venue:</p>
                      <p className="font-mono text-amber-950 dark:text-amber-100">
                        {new Date(availability.start).toLocaleString()} -{' '}
                        {new Date(availability.end).toLocaleTimeString()}
                      </p>
                      <button
                        type="button"
                        onClick={useSuggestedSlot}
                        className="font-semibold text-amber-900 underline hover:text-amber-950 dark:text-amber-200"
                      >
                        Use this slot
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">No free slot found in the next 14 days.</p>
                  )}
                </div>
              )}

              {conflictInfo?.hasConflict && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 dark:border-amber-700/60 dark:bg-amber-950/40 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Scheduling Conflict Detected (Same Time & Place)
                      </h4>
                      <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                        {conflictInfo.message}
                      </p>
                    </div>
                  </div>

                  {/* 1-Click Conflict Resolution Actions */}
                  <div className="space-y-2 pt-2 border-t border-amber-200/70 dark:border-amber-800/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                      Recommended Solutions:
                    </span>

                    {/* Action 1: Next Open Time Slot */}
                    {conflictInfo.nextAvailableStart && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white/80 p-2.5 dark:border-amber-900/40 dark:bg-slate-900/60">
                        <div className="text-xs text-slate-700 dark:text-slate-300">
                          <span className="font-semibold text-slate-900 dark:text-white">Next Available Slot: </span>
                          <span>
                            {new Date(conflictInfo.nextAvailableStart).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}{' '}
                            to{' '}
                            {new Date(conflictInfo.nextAvailableEnd).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => applySuggestedSlot(conflictInfo.nextAvailableStart, conflictInfo.nextAvailableEnd)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 transition-colors shrink-0"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>Shift to This Slot</span>
                        </button>
                      </div>
                    )}

                    {/* Action 2: Alternative Free Venues */}
                    {conflictInfo.alternativeVenues?.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-white/80 p-2.5 dark:border-amber-900/40 dark:bg-slate-900/60 space-y-1.5">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          Available Alternative Venues at Your Requested Time:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {conflictInfo.alternativeVenues.map((alt) => (
                            <button
                              key={alt.id}
                              type="button"
                              onClick={() => {
                                setVenueId(alt.id)
                                showToast(`Switched venue to ${alt.name}`, 'info')
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Building2 className="h-3 w-3 text-indigo-500" />
                              <span>Switch to {alt.name}</span>
                              {alt.capacity && (
                                <span className="text-[10px] text-slate-400">({alt.capacity} seats)</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Conflict Live Confirmation */}
              {!conflictInfo?.hasConflict && !checkingConflict && startDate && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900/40">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>
                    No schedule conflicts detected. {venueId ? 'Venue reservation is clear.' : 'Location is open.'}
                  </span>
                </div>
              )}

              {checkingConflict && (
                <div className="flex items-center gap-2 px-1 text-xs text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                  <span>Verifying schedule & venue availability...</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Attendance Limit & Cover Banner (Fee and Budget removed) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="event-capacity"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <Users className="h-3.5 w-3.5 text-[#6366f1]" />
              Attendee Limit (Capacity)
            </label>
            <input
              id="event-capacity"
              type="number"
              min="1"
              placeholder="Unlimited"
              className={`mt-1.5 ${inputClass}`}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Maximum participant RSVPs. Leave blank for unlimited.
            </p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <ImageIcon className="h-3.5 w-3.5 text-[#6366f1]" />
              Event Cover Banner
            </label>

            {!bannerB64 ? (
              <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-3 text-center transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750">
                <Upload className="h-5 w-5 text-slate-400" />
                <span className="mt-1 text-[11px] font-semibold text-[#6366f1]">
                  Click to upload cover image
                </span>
                <span className="text-[10px] text-slate-400">PNG, JPG, WebP up to 5MB</span>
                <input
                  id="event-banner"
                  type="file"
                  accept="image/*"
                  onChange={handleBannerChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative mt-1.5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 group">
                <img
                  src={bannerB64}
                  alt="Event cover banner preview"
                  className="h-24 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setBannerB64(null)}
                  className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1 text-white hover:bg-rose-600 transition-colors"
                  title="Remove banner"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Footer info note */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-100/70 p-2.5 text-[11px] text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
          <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            Events are submitted for Faculty Advisor approval before appearing publicly on the
            campus calendar.
          </span>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting
              ? isEdit
                ? 'Submitting revisions...'
                : 'Publishing event...'
              : isEdit
              ? event?.approvalStatus === 'REJECTED'
                ? 'Save & Resubmit to Advisor'
                : 'Save Changes'
              : 'Publish Event Proposal'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default CreateEventModal

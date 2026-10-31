import {
  Calendar,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  Search,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import CreateEventModal from './CreateEventModal'
import EventCard from './EventCard'
import { fetchEvents } from './eventsSlice'

const ITEMS_PER_PAGE = 6

function formatEventTime(startIso, endIso) {
  if (!startIso) return 'TBA'
  try {
    const start = new Date(startIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (!endIso) return start
    const end = new Date(endIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${start} - ${end}`
  } catch {
    return 'TBA'
  }
}

function getCategoryGradient(category = '') {
  const cat = (category || '').toLowerCase()
  if (cat.includes('tech') || cat.includes('code') || cat.includes('ai') || cat.includes('cyber')) {
    return 'from-blue-600 via-indigo-600 to-cyan-500'
  }
  if (cat.includes('art') || cat.includes('cultur') || cat.includes('photo') || cat.includes('design')) {
    return 'from-purple-600 via-fuchsia-600 to-pink-500'
  }
  if (cat.includes('sport') || cat.includes('hik') || cat.includes('adventur')) {
    return 'from-emerald-600 via-teal-600 to-lime-500'
  }
  if (cat.includes('academ') || cat.includes('debat') || cat.includes('sci')) {
    return 'from-amber-600 via-orange-600 to-yellow-500'
  }
  return 'from-[#6366f1] via-[#7c5cfc] to-[#4f46e5]'
}

function EventsPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { items: events, status } = useSelector((state) => state.events)
  const { showToast } = useToast()

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedDate, setSelectedDate] = useState('')
  const [activeTab, setActiveTab] = useState('upcoming') // 'all' | 'upcoming' | 'past' | 'my-rsvps'
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'list'
  const [currentPage, setCurrentPage] = useState(1)

  const [userRsvps, setUserRsvps] = useState([])
  const [userMemberships, setUserMemberships] = useState([])
  const [clubsList, setClubsList] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [targetClubId, setTargetClubId] = useState(null)

  useEffect(() => {
    dispatch(fetchEvents())
    api.get('/rsvps/me').then((r) => setUserRsvps(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    api.get('/memberships/me').then((r) => setUserMemberships(Array.isArray(r.data) ? r.data : [])).catch(() => {})
    api.get('/clubs').then((r) => setClubsList(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }, [dispatch])

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'
  const isStaff = isSuperAdmin || isFacultyAdvisor

  // Clubs user manages as President (only the Club President can create events)
  const managedClubs = useMemo(() => {
    return userMemberships.filter((m) => m.status === 'APPROVED' && m.position === 'PRESIDENT')
  }, [userMemberships])

  const canCreateEvent = managedClubs.length > 0 && !isSuperAdmin && !isFacultyAdvisor

  // Dynamic categories from real clubs and events
  const categoryOptions = useMemo(() => {
    const set = new Set()
    clubsList.forEach((c) => {
      if (c.category) set.add(c.category)
    })
    events.forEach((e) => {
      const match = clubsList.find((c) => c.id === e.clubId)
      if (match?.category) set.add(match.category)
    })
    return ['All Categories', ...Array.from(set)]
  }, [clubsList, events])

  // Real RSVP interaction
  async function handleRsvpToggle(e, event) {
    e.stopPropagation()
    if (isStaff) {
      navigate(`/events/${event.id}`)
      return
    }
    const isGoing = userRsvps.some((r) => r.eventId === event.id && r.status === 'GOING')
    try {
      if (isGoing) {
        await api.delete(`/events/${event.id}/rsvp`)
        setUserRsvps((prev) => prev.filter((r) => r.eventId !== event.id))
        showToast('RSVP cancelled')
      } else {
        const res = await api.post(`/events/${event.id}/rsvp`)
        setUserRsvps((prev) => [...prev.filter((r) => r.eventId !== event.id), res.data])
        showToast('RSVP confirmed! See you there 🎉')
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update RSVP', 'error')
    }
  }

  // Filter events based on real search, category, date, and tab
  const filteredEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return events.filter((event) => {
      // Search
      const q = search.trim().toLowerCase()
      if (q) {
        const matchesTitle = event.title?.toLowerCase().includes(q)
        const matchesClub = event.clubName?.toLowerCase().includes(q)
        const matchesLoc = event.location?.toLowerCase().includes(q) || event.venueName?.toLowerCase().includes(q)
        if (!matchesTitle && !matchesClub && !matchesLoc) return false
      }

      // Category
      if (selectedCategory !== 'All Categories') {
        const club = clubsList.find((c) => c.id === event.clubId)
        if (club && club.category !== selectedCategory) return false
      }

      // Date
      if (selectedDate) {
        const eventDateStr = event.eventDate?.slice(0, 10)
        if (eventDateStr !== selectedDate) return false
      }

      // Tab
      const isPast = new Date(event.eventDate) < today
      if (activeTab === 'upcoming' && (isPast || event.cancelled)) return false
      if (activeTab === 'past' && !isPast) return false
      if (activeTab === 'my-rsvps') {
        const hasRsvp = userRsvps.some((r) => r.eventId === event.id && r.status === 'GOING')
        if (!hasRsvp) return false
      }

      return true
    })
  }, [events, search, selectedCategory, selectedDate, activeTab, clubsList, userRsvps])

  // Pagination
  const totalItems = filteredEvents.length
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems)
  const currentEvents = filteredEvents.slice(startIndex, endIndex)

  function handleCreateClick() {
    if (managedClubs.length > 0) {
      setTargetClubId(managedClubs[0].clubId)
    } else if (clubsList.length > 0) {
      setTargetClubId(clubsList[0].id)
    }
    setShowCreateModal(true)
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      {/* Breadcrumb Top */}
      <div className="flex items-center gap-2 text-xs md:text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 font-medium">
          Home
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-semibold text-slate-900 dark:text-white">Events</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Events &amp; Workshops
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            Stay connected and expand your horizons with active campus life.
          </p>
        </div>

        {canCreateEvent && (
          <button
            type="button"
            onClick={handleCreateClick}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5] hover:shadow-md shrink-0 self-start md:self-center"
          >
            <Plus className="h-4 w-4" />
            <span>Create Event</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
        {/* Left Side Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search events..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#6366f1] focus:bg-white focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              setCurrentPage(1)
            }}
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs font-medium text-slate-700 outline-none transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
          >
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Select Date Input */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setCurrentPage(1)
              }}
              className="bg-transparent text-xs text-slate-700 outline-none dark:text-slate-300"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-[#6366f1] hover:underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Right Side Tabs & View Mode */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-between lg:justify-end">
          {/* Pills Filter */}
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'past', label: 'Past' },
              ...(!isStaff ? [{ id: 'my-rsvps', label: 'My RSVPs' }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  setCurrentPage(1)
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#eff0fe] text-[#6366f1] dark:bg-[#6366f1]/20 dark:text-[#818cf8]'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-slate-700" />

          {/* View Toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`rounded-lg p-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-slate-100 text-[#6366f1] dark:bg-slate-800 dark:text-[#818cf8]'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`rounded-lg p-1.5 transition-all ${
                viewMode === 'list'
                  ? 'bg-slate-100 text-[#6366f1] dark:bg-slate-800 dark:text-[#818cf8]'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Events Grid / List Display */}
      {status === 'loading' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/60"
            />
          ))}
        </div>
      )}

      {status !== 'loading' && filteredEvents.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <CalendarX2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {events.length === 0 ? 'No events posted yet.' : 'No events match your search or filter.'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Try adjusting your search query, selecting another category, or clearing the date filter.
          </p>
        </div>
      )}

      {status !== 'loading' && filteredEvents.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentEvents.map((event) => {
            const isGoing = userRsvps.some((r) => r.eventId === event.id && r.status === 'GOING')

            return (
              <EventCard
                key={event.id}
                event={event}
                isGoing={isGoing}
                onRsvpToggle={handleRsvpToggle}
                isFacultyAdvisor={isFacultyAdvisor}
                isSuperAdmin={isSuperAdmin}
              />
            )
          })}
        </div>
      )}

      {/* List View Mode */}
      {status !== 'loading' && filteredEvents.length > 0 && viewMode === 'list' && (
        <div className="space-y-3">
          {currentEvents.map((event) => {
            const dateObj = new Date(event.eventDate)
            const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
            const day = dateObj.getDate()
            const timeStr = formatEventTime(event.eventDate, event.endDate)
            const locationStr = event.venueName
              ? `${event.venueName}${event.venueBuilding ? `, ${event.venueBuilding}` : ''}`
              : event.location || 'Campus venue'
            const isGoing = userRsvps.some((r) => r.eventId === event.id && r.status === 'GOING')

            return (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:shadow-md dark:border-slate-800/80 dark:bg-[#181b24] cursor-pointer"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/60 dark:text-indigo-400">
                    <span className="text-[10px] font-bold uppercase">{month}</span>
                    <span className="text-base font-extrabold leading-none">{day}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6366f1]">
                      {event.clubName}
                    </span>
                    <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{event.title}</h3>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-400">
                      <span>{timeStr}</span>
                      <span>•</span>
                      <span className="truncate">{locationStr}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isGoing ? (
                    <button
                      type="button"
                      onClick={(e) => handleRsvpToggle(e, event)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-100"
                    >
                      <span>Going</span>
                      <Check className="h-3 w-3 stroke-[2.5]" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleRsvpToggle(e, event)}
                      className="rounded-lg border border-indigo-200 px-3.5 py-1 text-xs font-semibold text-[#6366f1] hover:bg-indigo-50"
                    >
                      Join
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing {startIndex + 1}–{endIndex} of {totalItems} Events
          </p>

          <div className="flex items-center gap-1.5 self-center sm:self-auto">
            {/* Prev Button */}
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Page Number Buttons */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                  safeCurrentPage === page
                    ? 'bg-[#6366f1] text-white shadow-xs'
                    : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {page}
              </button>
            ))}

            {/* Next Button */}
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && targetClubId && (
        <CreateEventModal
          clubId={targetClubId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            dispatch(fetchEvents())
            showToast('Event created successfully')
          }}
        />
      )}
    </div>
  )
}

export default EventsPage

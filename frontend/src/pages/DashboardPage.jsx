import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  GraduationCap,
  History,
  MapPin,
  Megaphone,
  MessageSquare,
  Shield,
  Trash2,
  UserCog,
  Users,
  WalletCards,
  ScrollText,
  Plus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import DoughnutChartJS from '../components/charts/chartjs/DoughnutChartJS'
import LineChartJS from '../components/charts/chartjs/LineChartJS'
import { monthlyCounts } from '../components/charts/chartUtils'
import { useToast } from '../components/ToastProvider'
import StatCard from '../components/ui/StatCard'
import EventCard from '../features/events/EventCard'
import DashboardModals from './dashboard/DashboardModals'
import RecentActivity from './dashboard/RecentActivity'
import { formatEventTime, getClubCoverGradient } from './dashboard/dashboardUtils'

function DashboardPage() {
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()

  const [memberships, setMemberships] = useState([])
  const [events, setEvents] = useState([])
  const [rsvps, setRsvps] = useState([])
  const [notifications, setNotifications] = useState([])
  const [clubsList, setClubsList] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [pendingEvents, setPendingEvents] = useState([])
  const [advisorRequests, setAdvisorRequests] = useState([])
  const [universityStats, setUniversityStats] = useState(null)

  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [showCreateClubModal, setShowCreateClubModal] = useState(false)
  const [editingClub, setEditingClub] = useState(null)
  const [showAdvisorRequestModal, setShowAdvisorRequestModal] = useState(false)
  const [selectedAdvisorRequest, setSelectedAdvisorRequest] = useState(null)
  const [showContactAdvisorModal, setShowContactAdvisorModal] = useState(false)

  useEffect(() => {
    let mounted = true

    const pMemberships = api.get('/memberships/me').then((r) => r.data).catch(() => [])
    const pEvents = api.get('/events').then((r) => r.data).catch(() => [])
    const pRsvps = api.get('/rsvps/me').then((r) => r.data).catch(() => [])
    const pNotifications = api.get('/notifications/me').then((r) => r.data).catch(() => [])
    const pClubs = api.get('/clubs').then((r) => r.data).catch(() => [])
    const pAudit =
      user?.role === 'SUPER_ADMIN' || user?.role === 'FACULTY_ADVISOR'
        ? api.get('/audit-logs').then((r) => r.data).catch(() => [])
        : Promise.resolve([])
    const pPendingEvents =
      user?.role === 'FACULTY_ADVISOR'
        ? api.get('/events/pending').then((r) => r.data).catch(() => [])
        : Promise.resolve([])
    const pAdvisorRequests =
      user?.role === 'FACULTY_ADVISOR' || user?.role === 'SUPER_ADMIN'
        ? api.get('/advisor-requests').then((r) => r.data).catch(() => [])
        : Promise.resolve([])
    const pUniversityStats =
      user?.role === 'FACULTY_ADVISOR' || user?.role === 'SUPER_ADMIN'
        ? api.get('/analytics/university').then((r) => r.data).catch(() => null)
        : Promise.resolve(null)

    Promise.all([
      pMemberships,
      pEvents,
      pRsvps,
      pNotifications,
      pClubs,
      pAudit,
      pPendingEvents,
      pAdvisorRequests,
      pUniversityStats,
    ]).then(([memData, evtData, rsvpData, notifData, clubData, auditData, pendingEvtData, advData, uStatsData]) => {
      if (!mounted) return
      setMemberships(Array.isArray(memData) ? memData : [])
      setEvents(Array.isArray(evtData) ? evtData : [])
      setRsvps(Array.isArray(rsvpData) ? rsvpData : [])
      setNotifications(Array.isArray(notifData) ? notifData : [])
      setClubsList(Array.isArray(clubData) ? clubData : [])
      setAuditLogs(Array.isArray(auditData) ? auditData : [])
      setPendingEvents(Array.isArray(pendingEvtData) ? pendingEvtData : [])
      setAdvisorRequests(Array.isArray(advData) ? advData : [])
      if (uStatsData) setUniversityStats(uStatsData)
    })

    return () => {
      mounted = false
    }
  }, [user?.role])

  function handleAdvisorRequestCreated(newReq) {
    setAdvisorRequests((prev) => [newReq, ...prev])
  }

  function handleAdvisorRequestResolved(updatedReq) {
    setAdvisorRequests((prev) => prev.map((r) => (r.id === updatedReq.id ? updatedReq : r)))
  }

  async function handleAdvisorReview(eventId, approve) {
    let reason
    if (!approve) {
      reason = window.prompt('Reason for rejecting (shown to the club, optional):')
      if (reason === null) return
    }
    try {
      await api.post(`/events/${eventId}/${approve ? 'approve' : 'reject'}`, approve ? undefined : { reason })
      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId))
      showToast(approve ? 'Event approved!' : 'Event rejected')
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update event status', 'error')
    }
  }

  async function handleDeleteEvent(evt) {
    if (!window.confirm(`Are you sure you want to permanently delete "${evt.title}"? This cannot be undone.`)) {
      return
    }
    try {
      await api.delete(`/events/${evt.id}`)
      setEvents((prev) => prev.filter((e) => e.id !== evt.id))
      showToast('Event deleted successfully')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete event', 'error')
    }
  }

  async function handleDeleteClub(club) {
    if (!window.confirm(`Are you sure you want to permanently delete club "${club.name}"? This cannot be undone.`)) {
      return
    }
    try {
      await api.delete(`/clubs/${club.id}`)
      setClubsList((prev) => prev.filter((c) => c.id !== club.id))
      showToast('Club deleted successfully')
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete club', 'error')
    }
  }

  function handleEventCreatedOrUpdated() {
    api.get('/events').then((r) => setEvents(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }

  function handleClubCreated() {
    api.get('/clubs').then((r) => setClubsList(Array.isArray(r.data) ? r.data : [])).catch(() => {})
  }

  // Real membership derivations
  const approvedMemberships = useMemo(
    () => memberships.filter((m) => m.status === 'APPROVED'),
    [memberships],
  )
  const pendingMemberships = useMemo(
    () => memberships.filter((m) => m.status === 'PENDING'),
    [memberships],
  )
  const adminClubs = useMemo(
    () => approvedMemberships.filter((m) => m.position === 'PRESIDENT'),
    [approvedMemberships],
  )

  // Map club details by ID for fast lookup
  const clubMap = useMemo(() => {
    const map = new Map()
    clubsList.forEach((c) => map.set(c.id, c))
    return map
  }, [clubsList])

  // Real upcoming events sorted chronologically
  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return events
      .filter((e) => !e.cancelled && new Date(e.eventDate) >= now)
      .sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate))
  }, [events])

  const [analyticsView, setAnalyticsView] = useState('events')

  const liveEvents = useMemo(() => events.filter((e) => !e.cancelled), [events])
  const eventsByMonth = useMemo(
    () => monthlyCounts(liveEvents, (e) => e.eventDate, { before: 5, after: 2 }),
    [liveEvents],
  )

  const clubsByCategory = useMemo(() => {
    const counts = new Map()
    clubsList.forEach((c) => {
      const cat = c.category || 'General'
      counts.set(cat, (counts.get(cat) || 0) + 1)
    })
    return Array.from(counts, ([label, value]) => ({ label, value })).sort(
      (a, b) => b.value - a.value || a.label.localeCompare(b.label),
    )
  }, [clubsList])

  const chartPalette = useMemo(
    () => ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#64748b', '#f97316'],
    [],
  )

  const dashboardEventsChartData = useMemo(() => {
    return {
      labels: eventsByMonth.map((m) => m.label),
      datasets: [
        {
          label: 'Campus Events',
          data: eventsByMonth.map((m) => m.value),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3.5,
          pointHoverRadius: 6,
        },
      ],
    }
  }, [eventsByMonth])

  const dashboardCategoryChartData = useMemo(() => {
    return {
      labels: clubsByCategory.map((c) => c.label),
      datasets: [
        {
          data: clubsByCategory.map((c) => c.value),
          backgroundColor: chartPalette.slice(0, clubsByCategory.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 6,
        },
      ],
    }
  }, [clubsByCategory, chartPalette])

  // Real RSVP interaction
  async function handleRsvpToggle(event) {
    const isGoing = rsvps.some((r) => r.eventId === event.id && r.status === 'GOING')
    try {
      if (isGoing) {
        await api.delete(`/events/${event.id}/rsvp`)
        setRsvps((prev) => prev.filter((r) => r.eventId !== event.id))
        showToast('RSVP cancelled')
      } else {
        const res = await api.post(`/events/${event.id}/rsvp`)
        setRsvps((prev) => [...prev.filter((r) => r.eventId !== event.id), res.data])
        showToast('RSVP confirmed! See you there 🎉')
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update RSVP', 'error')
    }
  }

  // Real recent activities: notifications + audit logs
  const recentActivities = useMemo(() => {
    const items = []

    notifications.forEach((n) => {
      items.push({
        id: `notif-${n.id}`,
        content: n.message,
        createdAt: n.createdAt,
      })
    })

    auditLogs.slice(0, 5).forEach((log) => {
      items.push({
        id: `audit-${log.id}`,
        content: (
          <>
            <strong className="font-semibold text-slate-900 dark:text-white">{log.actorName}</strong>{' '}
            <span>{log.details || log.action}</span>
          </>
        ),
        createdAt: log.createdAt,
      })
    })

    return items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
  }, [notifications, auditLogs])

  // Real metric counts
  const myClubsCount =
    user?.role === 'SUPER_ADMIN' && approvedMemberships.length === 0
      ? clubsList.length
      : approvedMemberships.length

  const upcomingEventsCount = upcomingEvents.length
  const waitlistedCount = rsvps.filter((r) => r.status === 'WAITLISTED').length
  const pendingRsvpsCount = pendingMemberships.length + waitlistedCount
  const announcementsCount = notifications.length

  // Clubs to showcase: user's registered clubs or campus clubs
  const registeredClubCards = useMemo(() => {
    if (approvedMemberships.length > 0) {
      return approvedMemberships.map((m) => {
        const club = clubMap.get(m.clubId)
        return {
          id: m.clubId,
          name: m.clubName,
          category: club?.category || 'General',
          badge: m.position,
          logoB64: club?.logoB64,
          isMember: true,
        }
      })
    }
    // If not joined any yet, show top approved campus clubs
    return clubsList.slice(0, 4).map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category || 'General',
      badge: 'Explore',
      logoB64: c.logoB64,
      isMember: false,
    }))
  }, [approvedMemberships, clubsList, clubMap])

  const firstName = user?.name ? user.name.split(' ')[0] : 'User'

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      {/* Hero Welcome Banner */}
      {isFacultyAdvisor ? (
        <div className="relative overflow-hidden rounded-2xl border border-purple-200/90 bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-purple-50/90 p-6 shadow-xs md:p-8 dark:border-purple-900/50 dark:bg-gradient-to-r dark:from-purple-950/40 dark:via-[#1c1836] dark:to-purple-950/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 dark:bg-purple-900/60 px-3 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Faculty Advisor Portal
                </span>
                {pendingEvents.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800">
                    <AlertCircle className="h-3 w-3" />
                    {pendingEvents.length} Pending Approval{pendingEvents.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back, {user?.name || 'Faculty Advisor'}! 🎓
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {pendingEvents.length > 0 ? (
                  <>
                    You have <strong className="text-purple-600 dark:text-purple-400 font-semibold">{pendingEvents.length} event proposal{pendingEvents.length === 1 ? '' : 's'}</strong> awaiting your review and approval. You oversee <strong className="font-semibold text-slate-800 dark:text-slate-200">{clubsList.length} registered campus societies</strong>.
                  </>
                ) : (
                  <>
                    All club proposals are up to date. You are actively overseeing <strong className="font-semibold text-slate-800 dark:text-slate-200">{clubsList.length} registered campus societies</strong> and student activities.
                  </>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
              <Link
                to="/advisor/pending-events"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs transition-all hover:bg-purple-700"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Review Events</span>
                {pendingEvents.length > 0 && (
                  <span className="rounded-full bg-white text-purple-700 px-1.5 py-0.2 text-[10px] font-bold">
                    {pendingEvents.length}
                  </span>
                )}
              </Link>
              <Link
                to="/advisor/clubs"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs md:text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Shield className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>Clubs</span>
              </Link>
            </div>
          </div>
        </div>
      ) : isSuperAdmin ? (
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-indigo-50/90 p-6 shadow-xs md:p-8 dark:border-indigo-900/50 dark:bg-gradient-to-r dark:from-indigo-950/40 dark:via-[#191830] dark:to-indigo-950/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 px-3 py-0.5 text-xs font-semibold text-[#6366f1] dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800">
                  <Shield className="h-3.5 w-3.5" />
                  Super Admin Command Center
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Full System Authority
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back, {user?.name || 'Super Admin'}! ⚡
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                You have administrative oversight across all <strong className="font-semibold text-slate-800 dark:text-slate-200">{clubsList.length} campus societies</strong> and <strong className="font-semibold text-slate-800 dark:text-slate-200">{events.length} campus events</strong>. Review, edit, cancel, or delete events, manage societies, and oversee platform security logs below.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-center">
              <button
                type="button"
                onClick={() => setShowCreateClubModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
              >
                <Plus className="h-4 w-4" />
                <span>Create Club</span>
              </button>
              <Link
                to="/admin/users"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs md:text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <UserCog className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span>Users</span>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-[#e4dafa] bg-gradient-to-r from-[#f5f1fe] via-[#ede7fe] to-[#f5f1fe] p-6 shadow-xs md:p-8 dark:border-[#382f63] dark:bg-gradient-to-r dark:from-[#1b1735] dark:via-[#251d48] dark:to-[#1b1735]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="max-w-2xl">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back, {firstName}! 👋
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {upcomingEventsCount > 0 ? (
                  <>
                    You have {upcomingEventsCount} upcoming event{upcomingEventsCount === 1 ? '' : 's'} scheduled.{' '}
                    {upcomingEvents[0]?.title ? `Next up is "${upcomingEvents[0].title}". ` : ''}
                    Get ready to participate and explore new opportunities!
                  </>
                ) : myClubsCount > 0 ? (
                  <>
                    You are a member of {myClubsCount} student club{myClubsCount === 1 ? '' : 's'}. Browse upcoming
                    activities and discover new societies below.
                  </>
                ) : (
                  <>
                    Welcome to your campus club portal! Discover exciting student societies, join clubs, and attend
                    campus events.
                  </>
                )}
              </p>
            </div>

            <Link
              to="/clubs"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5] hover:shadow-md dark:bg-gradient-to-r dark:from-[#6366f1] dark:to-[#9333ea] shrink-0 self-start md:self-center"
            >
              <span>Explore New Clubs</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* 4 Metric / Stat Cards */}
      {isFacultyAdvisor ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Clubs Under Oversight"
            value={clubsList.length}
            icon={Shield}
            tone="purple"
            trend={`${clubsList.length} societies`}
            trendLabel="monitored"
            to="/advisor/clubs"
          />
          <StatCard
            label="Pending Approvals"
            value={pendingEvents.length}
            icon={ClipboardCheck}
            tone="amber"
            trend={pendingEvents.length > 0 ? 'Action Needed' : 'All clear'}
            trendLabel={pendingEvents.length > 0 ? 'awaiting review' : 'no pending sign-offs'}
            to="/advisor/pending-events"
          />
          <StatCard
            label="Scheduled Events"
            value={upcomingEventsCount}
            icon={CalendarDays}
            tone="indigo"
            trend={`${upcomingEventsCount} campus`}
            trendLabel="scheduled events"
            to="/events"
          />
          <StatCard
            label="Payments Collected"
            value={
              universityStats?.totalPaymentsCollected != null
                ? `$${Number(universityStats.totalPaymentsCollected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'Analytics'
            }
            icon={WalletCards}
            tone="emerald"
            trend={
              universityStats?.clubPayments?.length
                ? `${universityStats.clubPayments.length} societies`
                : 'Per club'
            }
            trendLabel="separate breakdown"
            to="/analytics"
          />
        </div>
      ) : isSuperAdmin ? (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Total Societies"
            value={clubsList.length}
            icon={Shield}
            tone="indigo"
            trend={`${clubsList.filter((c) => c.status === 'APPROVED').length} active`}
            trendLabel="chartered clubs"
            to="/clubs"
          />
          <StatCard
            label="Campus Events"
            value={events.length}
            icon={CalendarDays}
            tone="purple"
            trend={`${upcomingEventsCount} upcoming`}
            trendLabel="across campus"
            to="/events"
          />
          <StatCard
            label="Audit Activity"
            value={auditLogs.length}
            icon={ClipboardCheck}
            tone="amber"
            trend="Security Trail"
            trendLabel="system logs"
            to="/admin/audit-log"
          />
          <StatCard
            label="Platform Analytics"
            value="Overview"
            icon={BarChart3}
            tone="emerald"
            trend="Live Metrics"
            trendLabel="university trends"
            to="/analytics"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="My Clubs"
            value={myClubsCount}
            icon={Users}
            tone="indigo"
            trend="Active"
            trendLabel="societies joined"
            to="/clubs"
          />
          <StatCard
            label="Upcoming Events"
            value={upcomingEventsCount}
            icon={CalendarDays}
            tone="purple"
            trend="↑ 12%"
            trendLabel="since last month"
            to="/events"
          />
          <StatCard
            label="Pending RSVPs"
            value={pendingRsvpsCount}
            icon={Clock}
            tone="blue"
            trend="Awaiting"
            trendLabel="sign-offs"
            to="/events"
          />
          <StatCard
            label="Announcements"
            value={announcementsCount}
            icon={Megaphone}
            tone="emerald"
            trend="Latest updates"
            trendLabel="campus feeds"
            to="/clubs"
          />
        </div>
      )}

      {/* Main Content Layout: 2 Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (Clubs & Events) */}
        <div className="space-y-6 lg:col-span-8">
          {isFacultyAdvisor ? (
            <>
              {/* Section 1: Events Awaiting Your Approval */}
              <section className="rounded-2xl border border-purple-200/90 bg-white p-5 shadow-xs dark:border-purple-900/50 dark:bg-[#181b24]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Events Awaiting Your Approval</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Review student club events requiring Faculty Advisor sign-off</p>
                    </div>
                  </div>
                  <Link
                    to="/advisor/pending-events"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-xs hover:bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                  >
                    <History className="h-3.5 w-3.5" />
                    Approvals & History {pendingEvents.length > 0 && `(${pendingEvents.length})`}
                  </Link>
                </div>

                {pendingEvents.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {pendingEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-amber-200/90 bg-amber-50/40 p-4 transition-all hover:bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                              {evt.clubName || 'Student Club'}
                            </span>
                            {evt.fee > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <WalletCards className="h-3 w-3" />
                                Fee: ${Number(evt.fee).toFixed(2)}
                              </span>
                            )}
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              Pending Sign-off
                            </span>
                          </div>

                          <h3 className="mt-1.5 text-sm font-bold text-slate-900 dark:text-white">
                            {evt.title}
                          </h3>

                          {evt.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                              {evt.description}
                            </p>
                          )}

                          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                {evt.eventDate
                                  ? new Date(evt.eventDate).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })
                                  : 'Date TBA'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              <span>{formatEventTime(evt.eventDate, evt.endDate)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                {evt.venueName
                                  ? `${evt.venueName}${evt.venueBuilding ? ` (${evt.venueBuilding})` : ''}`
                                  : evt.location || 'Campus'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                          <button
                            type="button"
                            onClick={() => handleAdvisorReview(evt.id, true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>Approve</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdvisorReview(evt.id, false)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 shadow-xs transition-all hover:bg-red-50 dark:border-red-900/50 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-emerald-200/90 bg-emerald-50/30 p-6 text-center dark:border-emerald-900/50 dark:bg-emerald-950/10">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                      All event proposals reviewed!
                    </p>
                    <p className="mt-0.5 max-w-sm text-[11px] text-slate-500 dark:text-slate-400">
                      There are no student club events currently pending your sign-off.
                    </p>
                    <Link
                      to="/advisor/pending-events"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 shadow-xs hover:bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    >
                      <History className="h-3.5 w-3.5" />
                      View Approval History
                    </Link>
                  </div>
                )}
              </section>

              {/* Section 2: Societies Under Faculty Oversight */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Societies Under Faculty Oversight
                  </h2>
                  <Link
                    to="/advisor/clubs"
                    className="text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
                  >
                    View All ({clubsList.length})
                  </Link>
                </div>

                {clubsList.length > 0 ? (
                  <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {clubsList.slice(0, 4).map((club) => {
                      const gradient = getClubCoverGradient(club.category)
                      return (
                        <div
                          key={club.id}
                          className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-[#181b24] dark:hover:border-slate-700"
                        >
                          <div className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {club.logoB64 ? (
                              <img
                                src={club.logoB64}
                                alt={club.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div
                                className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4 text-white shadow-inner`}
                              >
                                <span className="text-2xl font-extrabold tracking-wider drop-shadow-xs">
                                  {club.name
                                    .split(' ')
                                    .map((w) => w[0])
                                    .slice(0, 3)
                                    .join('')
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Floating category pill on cover */}
                            <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white backdrop-blur-md shadow-xs">
                              {club.category || 'General'}
                            </span>

                            {/* Floating oversight pill on cover */}
                            <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full bg-purple-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                              Oversight
                            </span>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400" title={club.name}>
                                {club.name}
                              </h3>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span>{club.memberCount || 0} Member{club.memberCount === 1 ? '' : 's'}</span>
                              </p>
                            </div>

                            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => navigate(`/clubs/${club.id}`)}
                                className="w-full inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                View Club
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No clubs found in the system yet.{' '}
                    <Link to="/clubs" className="font-semibold text-purple-600 hover:underline">
                      Browse clubs
                    </Link>
                  </div>
                )}
              </section>

              {/* Advisor Section: Escalations & Super Admin Requests */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Advisor Escalations & Admin Requests
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Discuss club misconduct, propose club deletion, or consult directly with Super Admin
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvisorRequestModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 shrink-0 self-start sm:self-center"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Request to Admin</span>
                  </button>
                </div>

                {advisorRequests.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {advisorRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5 dark:border-slate-800/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              {req.requestType?.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                req.priority === 'URGENT'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                  : req.priority === 'HIGH'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                              }`}
                            >
                              {req.priority} Priority
                            </span>
                            {req.clubName && (
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Club: <strong className="text-slate-900 dark:text-white">{req.clubName}</strong>
                              </span>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                              req.status === 'RESOLVED'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : req.status === 'IN_REVIEW'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                  : req.status === 'DISMISSED'
                                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400'
                            }`}
                          >
                            {req.status?.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="mt-2.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {req.subject}
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {req.message}
                          </p>
                          <span className="mt-2 block text-[10px] text-slate-400 dark:text-slate-500">
                            Submitted on {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {req.adminResponse && (
                          <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 text-xs dark:border-indigo-900/50 dark:bg-indigo-950/30">
                            <div className="flex items-center gap-1.5 font-bold text-[#6366f1] dark:text-indigo-300">
                              <Shield className="h-3.5 w-3.5" />
                              <span>Super Admin Response {req.resolvedByName ? `(${req.resolvedByName})` : ''}:</span>
                            </div>
                            <p className="mt-1 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                              {req.adminResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <p>No active escalations or requests submitted to Super Admin yet.</p>
                    <button
                      type="button"
                      onClick={() => setShowAdvisorRequestModal(true)}
                      className="mt-2 text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
                    >
                      Report club concern or request dissolution
                    </button>
                  </div>
                )}
              </section>

              {/* Section 3: Scheduled Campus Events */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Scheduled Campus Events</h2>
                  <Link
                    to="/events"
                    className="text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
                  >
                    View All ({upcomingEventsCount})
                  </Link>
                </div>

                {upcomingEvents.length > 0 ? (
                  <div className="mt-3.5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {upcomingEvents.slice(0, 3).map((evt) => (
                      <EventCard key={evt.id} event={evt} isFacultyAdvisor={true} />
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No upcoming campus events scheduled.{' '}
                    <Link to="/events" className="font-semibold text-purple-600 hover:underline">
                      Browse all events
                    </Link>
                  </div>
                )}
              </section>
            </>
          ) : isSuperAdmin ? (
            <>
              {/* Section 1: Campus Events Management (Full CRUD) */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/50 dark:text-indigo-400">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Campus Events Management</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Review, edit, cancel, and delete events across all societies</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      to="/events"
                      className="text-xs font-semibold text-[#6366f1] hover:underline dark:text-indigo-400"
                    >
                      View All ({events.length})
                    </Link>
                  </div>
                </div>

                {events.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {events.slice(0, 5).map((evt) => (
                      <div
                        key={evt.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-all hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-[#6366f1] dark:bg-indigo-950/60 dark:text-indigo-300">
                              {evt.clubName || 'Club Event'}
                            </span>
                            {evt.cancelled ? (
                              <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-400">
                                Cancelled
                              </span>
                            ) : evt.approvalStatus === 'PENDING' ? (
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Pending Sign-off
                              </span>
                            ) : (
                              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                Live
                              </span>
                            )}
                            {Number(evt.fee) > 0 && (
                              <span className="text-[11px] font-medium text-slate-500">
                                Fee: ${Number(evt.fee).toFixed(2)}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white truncate">
                            {evt.title}
                          </h3>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                              <span>
                                {evt.eventDate
                                  ? new Date(evt.eventDate).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'Date TBA'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate max-w-[200px]">
                                {evt.venueName || evt.location || 'Campus'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => navigate(`/events/${evt.id}`)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent(evt)
                              setShowCreateEventModal(true)
                            }}
                            className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-2.5 py-1.5 text-xs font-semibold text-[#6366f1] transition-all hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(evt)}
                            className="rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No campus events created yet.
                  </div>
                )}
              </section>

              {/* Section 2: All Campus Societies (Full Club CRUD) */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/50 dark:text-indigo-400">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Campus Societies</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Create, oversee, edit, and delete student societies</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClub(null)
                        setShowCreateClubModal(true)
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#6366f1] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#4f46e5]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Club</span>
                    </button>
                    <Link
                      to="/clubs"
                      className="text-xs font-semibold text-[#6366f1] hover:underline dark:text-indigo-400"
                    >
                      View All ({clubsList.length})
                    </Link>
                  </div>
                </div>

                {clubsList.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {clubsList.slice(0, 4).map((club) => {
                      const gradient = getClubCoverGradient(club.category)
                      return (
                        <div
                          key={club.id}
                          className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-[#181b24] dark:hover:border-slate-700"
                        >
                          <div className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {club.logoB64 ? (
                              <img
                                src={club.logoB64}
                                alt={club.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4 text-white shadow-inner`}>
                                <span className="text-2xl font-extrabold tracking-wider drop-shadow-xs">
                                  {club.name
                                    .split(' ')
                                    .map((w) => w[0])
                                    .slice(0, 3)
                                    .join('')
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Floating category pill on cover */}
                            <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white backdrop-blur-md shadow-xs">
                              {club.category || 'General'}
                            </span>

                            {/* Floating status pill on cover */}
                            <span
                              className={`absolute right-2.5 top-2.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-xs backdrop-blur-md ${
                                club.status === 'APPROVED'
                                  ? 'bg-emerald-600/90 text-white'
                                  : club.status === 'PENDING'
                                    ? 'bg-amber-500/90 text-white'
                                    : 'bg-slate-800/80 text-white'
                              }`}
                            >
                              {club.status || 'Active'}
                            </span>
                          </div>

                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-[#6366f1] dark:text-white dark:group-hover:text-indigo-400" title={club.name}>
                                {club.name}
                              </h3>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span>{club.memberCount || 0} Member{club.memberCount === 1 ? '' : 's'}</span>
                              </p>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => navigate(`/clubs/${club.id}`)}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                Manage
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClub(club)
                                  setShowCreateClubModal(true)
                                }}
                                className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50/70 py-1.5 text-xs font-semibold text-[#6366f1] shadow-2xs transition-all hover:bg-indigo-100 hover:border-indigo-300 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClub(club)}
                                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50/70 py-1.5 text-xs font-semibold text-red-600 shadow-2xs transition-all hover:bg-red-100 hover:border-red-300 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/60"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No clubs found in the system yet.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClub(null)
                        setShowCreateClubModal(true)
                      }}
                      className="font-semibold text-[#6366f1] hover:underline"
                    >
                      Create first club
                    </button>
                  </div>
                )}
              </section>

              {/* Section: Advisor Escalations & Disciplinary Reports */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Advisor Escalations & Disciplinary Reports
                        </h2>
                        {advisorRequests.filter((r) => r.status === 'PENDING').length > 0 && (
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                            {advisorRequests.filter((r) => r.status === 'PENDING').length} Pending Review
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Faculty Advisor misconduct reports, club dissolution recommendations, and administrative requests
                      </p>
                    </div>
                  </div>
                </div>

                {advisorRequests.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {advisorRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all dark:border-slate-800 dark:bg-slate-900/40"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5 dark:border-slate-800/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              {req.requestType?.replace(/_/g, ' ')}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                req.priority === 'URGENT'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                                  : req.priority === 'HIGH'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                              }`}
                            >
                              {req.priority}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              From: <strong className="text-slate-900 dark:text-white">{req.advisorName}</strong> ({req.advisorEmail})
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                req.status === 'RESOLVED'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : req.status === 'IN_REVIEW'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                    : req.status === 'DISMISSED'
                                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400'
                              }`}
                            >
                              {req.status?.replace(/_/g, ' ')}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedAdvisorRequest(req)}
                              className="rounded-lg bg-[#6366f1] px-3 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-[#4f46e5]"
                            >
                              Review & Respond
                            </button>
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                              {req.subject}
                            </h4>
                            {req.clubName && (
                              <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                Target Club: {req.clubName}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {req.message}
                          </p>
                          <span className="mt-2 block text-[10px] text-slate-400 dark:text-slate-500">
                            Received {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {req.adminResponse && (
                          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                            <span className="font-bold text-slate-900 dark:text-white">
                              Resolution Response ({req.resolvedByName || 'Admin'}):
                            </span>
                            <p className="mt-1 text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                              {req.adminResponse}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No advisor requests or club disciplinary escalations received yet.
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              {/* Section: My Registered Clubs */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {approvedMemberships.length > 0 ? 'My Registered Clubs' : 'Discover Campus Clubs'}
                  </h2>
                  <Link
                    to="/clubs"
                    className="text-xs font-semibold text-[#6366f1] hover:underline dark:text-[#818cf8]"
                  >
                    View All
                  </Link>
                </div>

                {registeredClubCards.length > 0 ? (
                  <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {registeredClubCards.map((club) => {
                      const gradient = getClubCoverGradient(club.category)
                      return (
                        <div
                          key={club.id}
                          className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-[#181b24] dark:hover:border-slate-700"
                        >
                          <div className="relative h-32 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                            {club.logoB64 ? (
                              <img
                                src={club.logoB64}
                                alt={club.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div
                                className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4 text-white shadow-inner`}
                              >
                                <span className="text-2xl font-extrabold tracking-wider drop-shadow-xs">
                                  {club.name
                                    .split(' ')
                                    .map((w) => w[0])
                                    .slice(0, 3)
                                    .join('')
                                    .toUpperCase()}
                                </span>
                              </div>
                            )}

                            {/* Floating category pill on cover */}
                            <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-white backdrop-blur-md shadow-xs">
                              {club.category || 'General'}
                            </span>

                            {/* Floating membership badge on cover */}
                            <span className="absolute right-2.5 top-2.5 inline-flex items-center rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                              {club.badge || 'Member'}
                            </span>
                          </div>
                          <div className="flex flex-1 flex-col justify-between p-4">
                            <div>
                              <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-[#6366f1] dark:text-white dark:group-hover:text-indigo-400" title={club.name}>
                                {club.name}
                              </h3>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                                <span>{club.memberCount || 0} Member{club.memberCount === 1 ? '' : 's'}</span>
                              </p>
                            </div>

                            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                              <button
                                type="button"
                                onClick={() => navigate(`/clubs/${club.id}`)}
                                className="w-full inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              >
                                View Club
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No clubs found in the system yet.{' '}
                    <Link to="/clubs" className="font-semibold text-[#6366f1] hover:underline">
                      Browse clubs
                    </Link>
                  </div>
                )}
              </section>

              {/* Section: Upcoming Events */}
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Upcoming Events</h2>
                  <Link
                    to="/events"
                    className="text-xs font-semibold text-[#6366f1] hover:underline dark:text-[#818cf8]"
                  >
                    View All
                  </Link>
                </div>

                {upcomingEvents.length > 0 ? (
                  <div className="mt-3.5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    {upcomingEvents.slice(0, 3).map((evt) => {
                      const isGoing = rsvps.some((r) => r.eventId === evt.id && r.status === 'GOING')
                      return (
                        <EventCard
                          key={evt.id}
                          event={evt}
                          isGoing={isGoing}
                          onRsvpToggle={(e, eventItem) => handleRsvpToggle(eventItem)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No upcoming events scheduled right now.{' '}
                    <Link to="/events" className="font-semibold text-[#6366f1] hover:underline">
                      Browse all events
                    </Link>
                  </div>
                )}
              </section>
            </>
          )}

          {/* Interactive Society Analytics & Trends Section (Chart.js) */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/50 dark:text-indigo-400">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Campus Activity &amp; Analytics</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Interactive trends across society events and categories</p>
                </div>
              </div>
              <div className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setAnalyticsView('events')}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    analyticsView === 'events'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Event Timeline
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsView('categories')}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    analyticsView === 'categories'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Categories
                </button>
              </div>
            </div>

            {analyticsView === 'events' ? (
              <div className="pt-2">
                <LineChartJS
                  data={dashboardEventsChartData}
                  height={220}
                  ariaLabel="Campus event timeline chart"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
                <DoughnutChartJS
                  data={dashboardCategoryChartData}
                  height={220}
                  centerLabel={String(clubsList.length)}
                  centerSublabel="Societies"
                  ariaLabel="Society categories distribution"
                />
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Category Breakdown</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {clubsByCategory.map((c, idx) => (
                      <div key={c.label} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 truncate">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: chartPalette[idx % chartPalette.length] }}
                          />
                          <span className="truncate">{c.label}</span>
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white ml-2 shrink-0">
                          {c.value} ({clubsList.length > 0 ? Math.round((c.value / clubsList.length) * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Recent Activity & Management */}
        <aside className="space-y-5 lg:col-span-4">
          {isFacultyAdvisor ? (
            <>
              {/* Faculty Advisor Profile & Oversight Card */}
              <div className="overflow-hidden rounded-2xl border border-purple-200/90 bg-white p-5 shadow-xs dark:border-purple-900/60 dark:bg-[#181b24]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Faculty Advisor
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Staff
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3.5">
                  {user?.profileImageB64 ? (
                    <img
                      src={user.profileImageB64}
                      alt={user?.name || 'Faculty Advisor'}
                      className="h-14 w-14 rounded-full object-cover ring-2 ring-purple-400/50"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-lg font-bold text-white shadow-sm ring-2 ring-purple-200 dark:ring-purple-900">
                      {user?.name
                        ? user.name
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : 'FA'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                      {user?.name || 'Faculty Advisor'}
                    </h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email || 'advisor@example.com'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-purple-600 dark:text-purple-400">
                      Academic Affairs & Student Clubs
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">Governance & Responsibilities</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-purple-600 dark:text-purple-400 stroke-[3]" />
                      <span>Student event proposal & fee sign-off</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-purple-600 dark:text-purple-400 stroke-[3]" />
                      <span>Society governance & activity oversight</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-purple-600 dark:text-purple-400 stroke-[3]" />
                      <span>Institutional compliance & student participation</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-3.5 flex justify-end">
                  <Link
                    to="/profile"
                    className="text-xs font-semibold text-purple-600 hover:text-purple-700 hover:underline dark:text-purple-400"
                  >
                    Manage Profile & Preferences →
                  </Link>
                </div>
              </div>

              {/* Advisor Quick Actions */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  <Shield className="h-4 w-4" />
                  Advisor Quick Actions
                </h3>
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvisorRequestModal(true)}
                    className="w-full flex items-center justify-between rounded-lg border border-purple-200 bg-purple-50/60 p-2.5 text-xs font-semibold text-purple-700 transition-all hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300 dark:hover:bg-purple-900/50"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Send Request to Super Admin
                    </span>
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <Link
                    to="/advisor/pending-events"
                    className="flex items-center justify-between rounded-lg border border-purple-100 bg-purple-50/40 p-2.5 text-xs font-medium text-slate-800 transition-all hover:bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/20 dark:text-slate-200 dark:hover:bg-purple-950/40"
                  >
                    <span className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Review Pending Events
                    </span>
                    {pendingEvents.length > 0 ? (
                      <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                        {pendingEvents.length}
                      </span>
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    )}
                  </Link>
                  <Link
                    to="/advisor/clubs"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-purple-200 hover:bg-purple-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      All Campus Societies
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                  <Link
                    to="/analytics"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-purple-200 hover:bg-purple-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      University Analytics
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                  <Link
                    to="/admin/venues"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-purple-200 hover:bg-purple-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Campus Venues
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                  <Link
                    to="/calendar"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-purple-200 hover:bg-purple-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      Master Events Calendar
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>

              {/* Payments Collected by Society Widget */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    <WalletCards className="h-4 w-4" />
                    Society Payments Collected
                  </h3>
                  <Link
                    to="/analytics"
                    className="text-[11px] font-semibold text-purple-600 hover:underline dark:text-purple-400"
                  >
                    View All
                  </Link>
                </div>
                <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {universityStats?.clubPayments && universityStats.clubPayments.length > 0 ? (
                    universityStats.clubPayments.slice(0, 5).map((stat) => (
                      <div key={stat.clubId} className="flex items-center justify-between py-2.5">
                        <div className="min-w-0 pr-2">
                          <p className="truncate font-medium text-slate-800 dark:text-slate-200" title={stat.clubName}>
                            {stat.clubName}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {stat.clubCategory || 'Society'} • {stat.transactionCount || 0} txn{(stat.transactionCount || 0) === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ${Number(stat.totalCollected || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-3 text-center text-[11px] text-slate-400">No society payment records recorded yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : isSuperAdmin ? (
            <>
              {/* Super Admin Profile & Privileges Card */}
              <div className="overflow-hidden rounded-2xl border border-indigo-200/90 bg-white p-5 shadow-xs dark:border-indigo-900/60 dark:bg-[#181b24]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-[#6366f1] dark:bg-indigo-900/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Shield className="h-3.5 w-3.5" />
                    Super Admin
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    System Active
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] via-indigo-600 to-purple-700 text-lg font-black text-white shadow-sm ring-2 ring-indigo-200 dark:ring-indigo-900">
                    {user?.name
                      ? user.name
                          .split(' ')
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'SA'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">
                      {user?.name || 'Super Administrator'}
                    </h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {user?.email || 'admin@university.edu'}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#6366f1] dark:text-indigo-400">
                      Platform Administrator &amp; System Governor
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">System Privileges &amp; Control</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-[#6366f1] dark:text-indigo-400 stroke-[3]" />
                      <span>Full CRUD access to all events and workshops</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-[#6366f1] dark:text-indigo-400 stroke-[3]" />
                      <span>Club creation, status approval, and lifecycle</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-[#6366f1] dark:text-indigo-400 stroke-[3]" />
                      <span>User account management and role delegation</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-[#6366f1] dark:text-indigo-400 stroke-[3]" />
                      <span>System-wide audit trail and security governance</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Super Admin Quick Links */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#6366f1] dark:text-indigo-400">
                  <Shield className="h-4 w-4" />
                  Administration Links
                </h3>
                <div className="mt-3 space-y-2">
                  <Link
                    to="/admin/users"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-[#6366f1] dark:text-indigo-400" />
                      User Management
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                  <Link
                    to="/admin/venues"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Campus Venues
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                  <Link
                    to="/admin/audit-log"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <ScrollText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                      Audit Logs &amp; Trail
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                  <Link
                    to="/analytics"
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-indigo-200 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      University Analytics
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Quick Management Tools (if user manages clubs) */}
              {adminClubs.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    <Shield className="h-4 w-4" />
                    Clubs You Manage
                  </h3>
                  <div className="mt-3 space-y-2">
                    {adminClubs.map((m) => (
                      <Link
                        key={m.id}
                        to={`/clubs/${m.clubId}`}
                        className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs font-medium text-slate-800 transition-all hover:border-purple-200 hover:bg-purple-50/50 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200"
                      >
                        <span>{m.clubName}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Faculty Advisor Support Card */}
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-5 shadow-xs dark:border-indigo-900/60 dark:from-indigo-950/30 dark:via-[#181b24] dark:to-purple-950/20">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Faculty Advisory
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Guidance &amp; society support
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  Have questions about organizing an event, proposal approvals, or society guidance? Contact a faculty advisor directly.
                </p>
                <button
                  type="button"
                  onClick={() => setShowContactAdvisorModal(true)}
                  className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-500 active:scale-[0.99]"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Contact Faculty Advisor</span>
                </button>
              </div>
            </>
          )}

          <RecentActivity activities={recentActivities} />
        </aside>
      </div>

      <DashboardModals
        clubs={clubsList}
        editingClub={editingClub}
        editingEvent={editingEvent}
        onAdvisorRequestCreated={handleAdvisorRequestCreated}
        onCloseAdvisorRequest={() => setShowAdvisorRequestModal(false)}
        onCloseClub={() => {
          setEditingClub(null)
          setShowCreateClubModal(false)
        }}
        onCloseEvent={() => {
          setShowCreateEventModal(false)
          setEditingEvent(null)
        }}
        onCloseResolution={() => setSelectedAdvisorRequest(null)}
        onClubSaved={(saved) => {
          setClubsList((previous) => editingClub ? previous.map((club) => (club.id === saved.id ? saved : club)) : [saved, ...previous])
          setEditingClub(null)
          setShowCreateClubModal(false)
        }}
        onDeleteClub={handleDeleteClub}
        onEventSaved={handleEventCreatedOrUpdated}
        onRequestResolved={handleAdvisorRequestResolved}
        selectedAdvisorRequest={selectedAdvisorRequest}
        showAdvisorRequestModal={showAdvisorRequestModal}
        showContactAdvisorModal={showContactAdvisorModal}
        onCloseContactAdvisor={() => setShowContactAdvisorModal(false)}
        showCreateClubModal={showCreateClubModal}
        showCreateEventModal={showCreateEventModal}
      />
    </div>
  )
}

export default DashboardPage

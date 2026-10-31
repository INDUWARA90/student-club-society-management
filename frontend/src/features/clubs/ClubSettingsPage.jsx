import {
  Bell,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  Layers,
  Lock,
  MapPin,
  Megaphone,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  Trash2,
  UploadCloud,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import Skeleton from '../../components/ui/Skeleton'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']
const ALL_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER', 'MEMBER']

function ClubSettingsPage() {
  const { clubId: routeClubId } = useParams()
  const [searchParams] = useSearchParams()
  const queryClubId = searchParams.get('clubId')
  const lastClubId = typeof window !== 'undefined' ? sessionStorage.getItem('lastViewedClubId') : null
  const preferredClubId = routeClubId || queryClubId || lastClubId || ''

  const { showToast } = useToast()
  const user = useSelector((state) => state.auth.user)

  const [activeTab, setActiveTab] = useState('Profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [managedClubs, setManagedClubs] = useState([])
  const [userMemberships, setUserMemberships] = useState([])
  const [activeClubId, setActiveClubId] = useState(preferredClubId)

  // Form State
  const [clubName, setClubName] = useState('')
  const [category, setCategory] = useState('Arts & Culture')
  const [description, setDescription] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [iconImage, setIconImage] = useState('')
  const [tags, setTags] = useState([])
  const [newTagInput, setNewTagInput] = useState('')
  const [isAddingTag, setIsAddingTag] = useState(false)

  // Privacy & Access State
  const [joinPolicy, setJoinPolicy] = useState('OPEN')
  const [membershipFee, setMembershipFee] = useState(0)
  const [certificateThreshold, setCertificateThreshold] = useState(3)
  const [showBudgetToMembers, setShowBudgetToMembers] = useState(false)

  // Gathering Info
  const [gatheringDay, setGatheringDay] = useState('Every Wednesday')
  const [gatheringTime, setGatheringTime] = useState('5:00 PM')
  const [gatheringLocation, setGatheringLocation] = useState('Student Center')

  // Announcements broadcast state
  const [announcements, setAnnouncements] = useState([])
  const [announcementDraft, setAnnouncementDraft] = useState('')
  const [postingAnnouncement, setPostingAnnouncement] = useState(false)

  // Members & Roles state
  const [clubMembers, setClubMembers] = useState([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'

  useEffect(() => {
    if (activeClubId && typeof window !== 'undefined') {
      sessionStorage.setItem('lastViewedClubId', activeClubId)
    }
  }, [activeClubId])

  // Discover user's accessible clubs
  useEffect(() => {
    async function loadInitial() {
      try {
        let memList = []
        try {
          const res = await api.get('/memberships/me')
          memList = Array.isArray(res.data) ? res.data : []
          setUserMemberships(memList)
        } catch {
          // ignore
        }

        let clubList = []
        try {
          const res = await api.get('/clubs')
          clubList = Array.isArray(res.data) ? res.data : []
        } catch {
          // ignore
        }

        let mapped = []
        if (isSuperAdmin || isFacultyAdvisor) {
          mapped = clubList.map((c) => {
            const inMem = memList.find((m) => String(m.clubId).toLowerCase() === String(c.id).toLowerCase())
            return { id: c.id, name: c.name, position: inMem?.position || 'ADVISOR' }
          })
        } else {
          // Normal students do not manage club settings - only include clubs where user holds an approved officer position
          const approvedOfficers = memList.filter(
            (m) => m.status === 'APPROVED' && OFFICER_POSITIONS.includes(m.position),
          )
          mapped = approvedOfficers.map((m) => ({ id: m.clubId, name: m.clubName, position: m.position }))
        }

        setManagedClubs(mapped)

        // Select preferred or officer club
        const targetId = routeClubId || queryClubId || lastClubId
        const targetMatched =
          targetId &&
          mapped.some((c) => String(c.id).toLowerCase() === String(targetId).toLowerCase())

        if (targetMatched) {
          setActiveClubId(targetId)
        } else if (mapped.length > 0) {
          setActiveClubId(mapped[0].id)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [routeClubId, queryClubId, isSuperAdmin, isFacultyAdvisor, user?.id])

  // Load selected club details from backend
  useEffect(() => {
    if (!activeClubId) return
    api
      .get(`/clubs/${activeClubId}`)
      .then((res) => {
        if (res.data) {
          const c = res.data
          setClubName(c.name || '')
          setCategory(c.category || 'Arts & Culture')
          setDescription(c.description || '')
          if (c.joinPolicy) setJoinPolicy(c.joinPolicy)
          if (c.membershipFee !== undefined) setMembershipFee(c.membershipFee)
          if (c.certificateThreshold !== undefined) setCertificateThreshold(c.certificateThreshold)
          if (c.showBudgetToMembers !== undefined) setShowBudgetToMembers(Boolean(c.showBudgetToMembers))
          if (c.logoB64) setIconImage(c.logoB64)
          if (c.category) {
            setTags([c.category, 'Student Society'])
          }
        }
      })
      .catch(() => {})
  }, [activeClubId])

  // Load announcements for active club
  useEffect(() => {
    if (!activeClubId) return
    api
      .get(`/clubs/${activeClubId}/announcements`)
      .then((res) => {
        if (Array.isArray(res.data)) {
          setAnnouncements(res.data)
        }
      })
      .catch(() => {})
  }, [activeClubId])

  // Load members for active club
  const loadClubMembers = useCallback(async () => {
    if (!activeClubId) return
    setLoadingMembers(true)
    try {
      const res = await api.get(`/clubs/${activeClubId}/members`)
      setClubMembers(Array.isArray(res.data) ? res.data : [])
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false)
    }
  }, [activeClubId])

  useEffect(() => {
    loadClubMembers()
  }, [loadClubMembers])

  async function handleSendAnnouncement(e) {
    e.preventDefault()
    if (!announcementDraft.trim() || !activeClubId) return
    setPostingAnnouncement(true)
    try {
      const res = await api.post(`/clubs/${activeClubId}/announcements`, {
        content: announcementDraft.trim(),
      })
      setAnnouncements((prev) => [res.data, ...prev])
      setAnnouncementDraft('')
      showToast('Announcement broadcasted to all club members!')
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not send announcement', 'error')
    } finally {
      setPostingAnnouncement(false)
    }
  }

  async function handleDeleteAnnouncement(announcementId) {
    if (!window.confirm('Delete this announcement?')) return
    try {
      await api.delete(`/clubs/${activeClubId}/announcements/${announcementId}`)
      setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId))
      showToast('Announcement deleted')
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete announcement', 'error')
    }
  }

  // Save changes via backend API
  async function handleSaveProfile(e) {
    e.preventDefault()
    if (!activeClubId) {
      showToast('No active club selected to update', 'error')
      return
    }

    setSaving(true)
    try {
      await api.put(`/clubs/${activeClubId}`, {
        name: clubName.trim(),
        description: description.trim(),
        category,
        joinPolicy,
        membershipFee: Number(membershipFee) || 0,
        certificateThreshold: Number(certificateThreshold) || 3,
        showBudgetToMembers: Boolean(showBudgetToMembers),
        logoB64: iconImage || null,
      })
      showToast('Club settings saved successfully')
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save club settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Handle position change for a member
  async function handleChangePosition(membershipId, memberName, newPosition) {
    if (newPosition === 'PRESIDENT') {
      if (!window.confirm(`Transfer Presidency of this society to ${memberName}? You will step down to Member.`)) {
        return
      }
    }
    try {
      await api.put(`/memberships/${membershipId}/position`, { position: newPosition })
      showToast(`Assigned ${newPosition} role to ${memberName}`)
      loadClubMembers()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update position', 'error')
    }
  }

  // Handle activate / deactivate user account by President or Super Admin
  async function handleToggleUserActive(member, makeActive) {
    if (!member.userId) {
      showToast('Cannot identify user account', 'error')
      return
    }
    const actionLabel = makeActive ? 'reactivate' : 'deactivate'
    const confirmMsg = makeActive
      ? `Reactivate account for ${member.userName || 'this user'}? They will be able to sign in again.`
      : `Deactivate account for ${member.userName || 'this user'}? They will be signed out and unable to log in until reactivated.`
    if (!window.confirm(confirmMsg)) return

    try {
      setClubMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? { ...m, userActive: makeActive } : m)),
      )
      await api.post(`/admin/users/${member.userId}/${makeActive ? 'activate' : 'deactivate'}`)
      showToast(makeActive ? 'User account reactivated' : 'User account deactivated')
      loadClubMembers()
    } catch (err) {
      loadClubMembers()
      showToast(err.response?.data?.message || `Could not ${actionLabel} user`, 'error')
    }
  }

  function handleAddTag() {
    if (newTagInput.trim() && !tags.includes(newTagInput.trim())) {
      setTags([...tags, newTagInput.trim()])
      setNewTagInput('')
      setIsAddingTag(false)
    }
  }

  function handleRemoveTag(tagToRemove) {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  function handleBannerUpload(e) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setCoverImage(reader.result)
      reader.readAsDataURL(file)
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => setIconImage(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const myMembership = useMemo(() => {
    // 1. From userMemberships loaded from /memberships/me
    const fromUserMemberships = userMemberships.find(
      (m) =>
        String(m.clubId || m.id).toLowerCase() === String(activeClubId).toLowerCase() &&
        m.status === 'APPROVED',
    )
    if (fromUserMemberships) return fromUserMemberships

    // 2. From clubMembers loaded from /clubs/:clubId/members
    const fromClubMembers = clubMembers.find(
      (m) =>
        (m.userId && user?.id && String(m.userId).toLowerCase() === String(user.id).toLowerCase()) ||
        (m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase()),
    )
    if (fromClubMembers) return fromClubMembers

    // 3. From managedClubs
    const fromManaged = managedClubs.find(
      (c) => String(c.id).toLowerCase() === String(activeClubId).toLowerCase(),
    )
    if (fromManaged) return fromManaged

    return null
  }, [userMemberships, clubMembers, managedClubs, activeClubId, user])

  const isPresident = useMemo(() => {
    if (isSuperAdmin || isFacultyAdvisor) return true
    if (myMembership?.position === 'PRESIDENT') return true
    if (
      userMemberships.some(
        (m) =>
          String(m.clubId || m.id).toLowerCase() === String(activeClubId).toLowerCase() &&
          m.status === 'APPROVED' &&
          m.position === 'PRESIDENT',
      )
    ) {
      return true
    }
    return managedClubs.some(
      (c) =>
        String(c.id).toLowerCase() === String(activeClubId).toLowerCase() &&
        c.position === 'PRESIDENT',
    )
  }, [isSuperAdmin, isFacultyAdvisor, myMembership, userMemberships, managedClubs, activeClubId])

  const isOfficer = useMemo(() => {
    if (isSuperAdmin || isFacultyAdvisor || isPresident) return true
    if (myMembership && OFFICER_POSITIONS.includes(myMembership.position)) return true
    if (
      userMemberships.some(
        (m) =>
          String(m.clubId || m.id).toLowerCase() === String(activeClubId).toLowerCase() &&
          m.status === 'APPROVED' &&
          OFFICER_POSITIONS.includes(m.position),
      )
    ) {
      return true
    }
    return managedClubs.some(
      (c) =>
        String(c.id).toLowerCase() === String(activeClubId).toLowerCase() &&
        OFFICER_POSITIONS.includes(c.position),
    )
  }, [isSuperAdmin, isFacultyAdvisor, isPresident, myMembership, userMemberships, managedClubs, activeClubId])

  // Whether user holds a leadership / officer / president role in this club
  const hasClubRole = isPresident || isOfficer

  const officerMemberships = useMemo(() => {
    return userMemberships.filter(
      (m) => m.status === 'APPROVED' && OFFICER_POSITIONS.includes(m.position),
    )
  }, [userMemberships])

  const hasAnyLeadershipRole =
    isSuperAdmin || isFacultyAdvisor || officerMemberships.length > 0 || managedClubs.length > 0

  const availableTabs = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { id: 'Profile', label: 'Profile', icon: Layers },
        { id: 'Notifications', label: 'Announcements & Alerts', icon: Megaphone },
      ]
    }
    return [
      { id: 'Profile', label: 'Profile', icon: Layers },
      { id: 'Notifications', label: 'Announcements & Alerts', icon: Megaphone },
      { id: 'Roles & Permissions', label: 'Roles & Permissions', icon: Shield },
      { id: 'Privacy Settings', label: 'Privacy & Access', icon: Lock },
    ]
  }, [isSuperAdmin])

  useEffect(() => {
    if (isSuperAdmin && (activeTab === 'Roles & Permissions' || activeTab === 'Privacy Settings')) {
      setActiveTab('Profile')
    }
  }, [isSuperAdmin, activeTab])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  // Normal students who do not hold any leadership positions are blocked from Club Settings
  if (!loading && !hasAnyLeadershipRole) {
    return (
      <div className="mx-auto max-w-2xl p-6 py-16 md:p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mb-4 shadow-xs">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
          Club Leadership Only
        </h1>
        <p className="mt-2 text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          The Club Settings section is reserved for club leadership positions (President, Vice President, Secretary, Treasurer), Faculty Advisors, and Super Admins. Normal students cannot access club settings.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4f46e5]"
          >
            Return to Dashboard
          </Link>
          <Link
            to="/clubs"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Browse Clubs
          </Link>
        </div>
      </div>
    )
  }

  // Officer in some clubs but not in the currently active club
  if (!loading && hasAnyLeadershipRole && !hasClubRole) {
    return (
      <div className="mx-auto max-w-2xl p-6 py-16 md:p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mb-4 shadow-xs">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
          Officer Access Restricted
        </h1>
        <p className="mt-2 text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          You do not hold an officer position in this club. You can only manage settings for societies where you hold an approved leadership position.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {officerMemberships.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveClubId(officerMemberships[0].clubId)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4f46e5]"
            >
              Switch to {officerMemberships[0].clubName || 'My Club'}
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 pb-28">
      {/* Hidden marker for vitest */}
      <span className="sr-only">Club Settings</span>

      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Settings', to: '/settings' },
          { label: clubName || 'Club Settings' },
        ]}
      />

      {/* Header with Title and Club Switcher */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Club Settings
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isSuperAdmin
              ? 'Configure profile parameters, society branding, broadcast alerts, and club management.'
              : hasClubRole
              ? 'Configure profile parameters, assign officer roles, broadcast alerts, and access controls.'
              : 'View society profile parameters and live platform preview.'}
          </p>
        </div>

        {/* Club Switcher dropdown if multiple managed clubs */}
        {managedClubs.length > 1 && (
          <div className="relative">
            <select
              value={activeClubId}
              onChange={(e) => setActiveClubId(e.target.value)}
              className="appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-700 shadow-xs outline-none hover:bg-slate-50 focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {managedClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.position && c.position !== 'MEMBER' ? `(${c.position})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        )}
      </div>

      {/* Main Layout Grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Column 1: Left Navigation Tabs (3 cols) */}
        <div className="lg:col-span-3 space-y-1">
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#eff0fe] text-[#6366f1] dark:bg-indigo-950/50 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* TAB 2: ANNOUNCEMENTS & ALERTS */}
        {hasClubRole && activeTab === 'Notifications' && (
          <div className="lg:col-span-9 space-y-6">
            {/* Send Announcement Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Send Club Announcement
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Broadcast important updates, alerts, and meeting details to all registered club members.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div>
                  <textarea
                    rows={4}
                    value={announcementDraft}
                    onChange={(e) => setAnnouncementDraft(e.target.value)}
                    placeholder="Type your announcement message here... (e.g. Schedule changes, room updates, upcoming deadlines, or urgent society news)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#6366f1] focus:bg-white focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-400">
                    Broadcast reaches {clubMembers.length} active registered members.
                  </span>
                  <button
                    type="submit"
                    disabled={postingAnnouncement || !announcementDraft.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {postingAnnouncement ? 'Sending...' : 'Broadcast Announcement'}
                  </button>
                </div>
              </form>
            </div>

            {/* Announcement History Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Recent Broadcasts ({announcements.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Past broadcasts sent to society members
                  </p>
                </div>
              </div>

              {announcements.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No announcements broadcasted yet for this club.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 transition-colors dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {a.authorName || 'Club Officer'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            • {new Date(a.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                          {a.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteAnnouncement(a.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40"
                        title="Delete announcement"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ROLES & PERMISSIONS */}
        {!isSuperAdmin && hasClubRole && activeTab === 'Roles & Permissions' && (
          <div className="lg:col-span-9 space-y-6">
            {/* Roles Matrix Overview Card */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Society Roles &amp; Permissions Matrix
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Defines platform access privileges, officer capabilities, and member authority.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      President
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Executive</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                    Full authority: Manage member roster, assign officer positions, activate/deactivate accounts, oversee budgets, and dispatch announcements.
                  </p>
                </div>

                <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Vice President
                    </span>
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">Operations</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                    Operational co-leadership: Create events, verify event attendance check-ins, send announcements, and presidential succession.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Treasurer
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Finance</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                    Financial stewardship: Record club expenses, view ledger and allocation donut charts, download receipts packs, and monitor funds.
                  </p>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Secretary
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">Records</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                    Documentation: Track meeting minutes, manage announcements feed, review attendance records, and export member rolls.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Member
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">General</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-800 dark:text-slate-200">
                    Society participant: RSVP to club events, check in with QR code, view announcements, and earn verified certificates.
                  </p>
                </div>
              </div>
            </div>

            {/* Officer Assignment & Member User Status Table */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Member Roles &amp; Account Status ({clubMembers.length})
                  </h3>
                  <p className="text-xs text-slate-400">
                    Assign officer positions and manage user active/deactivated platform access.
                  </p>
                </div>
              </div>

              {loadingMembers ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Loading member directory...
                </div>
              ) : clubMembers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No approved members found for this club.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-4 py-3">MEMBER</th>
                        <th className="px-4 py-3">EMAIL</th>
                        <th className="px-4 py-3">ASSIGNED POSITION</th>
                        <th className="px-4 py-3">USER STATUS</th>
                        <th className="px-4 py-3 text-right">ACCOUNT ACCESS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {clubMembers.map((m) => {
                        const isSelf =
                          (m.userId && user?.id && String(m.userId) === String(user.id)) ||
                          (m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase())
                        const isTargetAdmin = m.userRole === 'SUPER_ADMIN' || m.userRole === 'FACULTY_ADVISOR'
                        const canManageUser = (isPresident || isSuperAdmin) && !isSelf && !isTargetAdmin
                        const isDeactivated = m.userActive === false

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                              <div className="flex items-center gap-2.5">
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366f1] to-purple-500 text-[11px] font-bold text-white">
                                  {(m.userName || 'U')[0]?.toUpperCase()}
                                </div>
                                <span className="truncate max-w-[150px]">{m.userName || 'Member'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                              {m.userEmail || '—'}
                            </td>
                            <td className="px-4 py-3">
                              {isPresident && !isTargetAdmin ? (
                                <div className="relative inline-flex items-center">
                                  <select
                                    value={m.position || 'MEMBER'}
                                    onChange={(e) => handleChangePosition(m.id, m.userName, e.target.value)}
                                    className={`appearance-none rounded-full pl-2.5 pr-6 py-0.5 text-xs font-semibold outline-none border transition-all cursor-pointer shadow-2xs ${
                                      m.position === 'PRESIDENT'
                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                                        : m.position === 'VP' || m.position === 'SECRETARY' || m.position === 'TREASURER'
                                          ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    }`}
                                  >
                                    {ALL_POSITIONS.map((p) => (
                                      <option key={p} value={p}>
                                        {p === 'VP' ? 'Vice President' : p.charAt(0) + p.slice(1).toLowerCase()}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-60 text-slate-500 dark:text-slate-400" />
                                </div>
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {m.position}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isDeactivated ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                  Deactivated
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canManageUser ? (
                                isDeactivated ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserActive(m, true)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                    title="Reactivate account"
                                  >
                                    <UserCheck className="h-3 w-3" />
                                    Activate User
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserActive(m, false)}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                                    title="Deactivate account"
                                  >
                                    <UserX className="h-3 w-3" />
                                    Deactivate User
                                  </button>
                                )
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PRIVACY & ACCESS SETTINGS */}
        {!isSuperAdmin && hasClubRole && activeTab === 'Privacy Settings' && (
          <div className="lg:col-span-9 space-y-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Society Privacy &amp; Access Controls
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure join policies, membership enrollment fees, and certificate eligibility.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Membership Join Policy
                  </label>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      {
                        value: 'OPEN',
                        title: 'Open Enrollment',
                        desc: 'Any student can join instantly without requiring prior approval.',
                      },
                      {
                        value: 'APPLICATION_REQUIRED',
                        title: 'Approval Required',
                        desc: 'Applicants submit a join request for President or Officer review.',
                      },
                      {
                        value: 'INVITATION_ONLY',
                        title: 'Invitation Only',
                        desc: 'Membership is restricted to students invited by club leadership.',
                      },
                    ].map((item) => (
                      <label
                        key={item.value}
                        className={`flex flex-col p-4 rounded-xl border cursor-pointer transition-all ${
                          joinPolicy === item.value
                            ? 'border-[#6366f1] bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/30'
                            : 'border-slate-200 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{item.title}</span>
                          <input
                            type="radio"
                            name="joinPolicy"
                            value={item.value}
                            checked={joinPolicy === item.value}
                            onChange={(e) => setJoinPolicy(e.target.value)}
                            className="text-[#6366f1] focus:ring-[#6366f1]"
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {item.desc}
                        </p>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Membership Dues / Fee ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={membershipFee}
                      onChange={(e) => setMembershipFee(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Set to 0 for free society membership.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Certificate Attendance Threshold
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={certificateThreshold}
                      onChange={(e) => setCertificateThreshold(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Number of verified event check-ins required to earn certificate.
                    </p>
                  </div>
                </div>

                {/* Section: President Budget Visibility Controls for Club Members */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Club Budget &amp; Financial Ledger Visibility
                    </label>
                    {isPresident ? (
                      <span className="rounded-md bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                        President Authority
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        President Only
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                    Control whether general club members (enrolled students) can view the Budget &amp; Finance tab, balance, and income/expense ledger.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label
                      className={`flex flex-col p-4 rounded-xl border transition-all ${
                        !isPresident && !isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        !showBudgetToMembers
                          ? 'border-[#6366f1] bg-indigo-50/40 dark:border-indigo-500 dark:bg-indigo-950/30'
                          : 'border-slate-200 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <EyeOff className="h-4 w-4 text-slate-500" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Hidden from Members (Default)
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="showBudgetToMembers"
                          disabled={!isPresident && !isSuperAdmin}
                          checked={!showBudgetToMembers}
                          onChange={() => setShowBudgetToMembers(false)}
                          className="text-[#6366f1] focus:ring-[#6366f1]"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Only club leadership positions (President, VP, Secretary, Treasurer), Faculty Advisors, and Admins can view the budget section and ledger.
                      </p>
                    </label>

                    <label
                      className={`flex flex-col p-4 rounded-xl border transition-all ${
                        !isPresident && !isSuperAdmin ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
                      } ${
                        showBudgetToMembers
                          ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500 dark:bg-emerald-950/30'
                          : 'border-slate-200 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            Visible to Club Members
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="showBudgetToMembers"
                          disabled={!isPresident && !isSuperAdmin}
                          checked={showBudgetToMembers}
                          onChange={() => setShowBudgetToMembers(true)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enrolled student members can view the club's Budget section in read-only mode to see financial balance, allocations, and expenditures.
                      </p>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5] disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Privacy & Access Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 1: PROFILE PARAMETERS & PLATFORM LIVE PREVIEW */}
        {activeTab === 'Profile' && (
          <>
            {/* Column 2: Center Main Form: Club Profile Parameters (5.5 cols) */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Club Profile Parameters
                  </h2>
                  {!hasClubRole && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Read-Only View
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Row 1: Club Name & Category */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Club Name
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!hasClubRole}
                        value={clubName}
                        onChange={(e) => setClubName(e.target.value)}
                        className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                          !hasClubRole ? 'cursor-not-allowed bg-slate-50 opacity-80 dark:bg-slate-800/60' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Category
                      </label>
                      <div className="relative">
                        <select
                          value={category}
                          disabled={!hasClubRole}
                          onChange={(e) => setCategory(e.target.value)}
                          className={`w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-medium text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                            !hasClubRole ? 'cursor-not-allowed bg-slate-50 opacity-80 dark:bg-slate-800/60' : ''
                          }`}
                        >
                          <option value="Arts & Culture">Arts & Culture</option>
                          <option value="Tech">Tech</option>
                          <option value="Cultural">Cultural</option>
                          <option value="Academic">Academic</option>
                          <option value="Sports">Sports</option>
                          <option value="Special Interest">Special Interest</option>
                        </select>
                        {hasClubRole && (
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Description */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      disabled={!hasClubRole}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white ${
                        !hasClubRole ? 'cursor-not-allowed bg-slate-50 opacity-80 dark:bg-slate-800/60' : ''
                      }`}
                    />
                  </div>

                  {/* Row 3: Banner Image Upload */}
                  {hasClubRole && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Banner Image
                      </label>
                      <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 cursor-pointer hover:bg-slate-100/50 transition-colors dark:border-slate-700 dark:bg-slate-800/40">
                        <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-xs font-semibold text-[#6366f1]">
                          Click to upload banner
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          SVG, PNG, JPG (1200x300 recommended)
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleBannerUpload}
                        />
                      </label>
                    </div>
                  )}

                  {/* Row 4: Society Icon */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Society Icon / Logo
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 overflow-hidden border border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700">
                        {iconImage ? (
                          <img
                            src={iconImage}
                            alt="Society Icon"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="h-6 w-6" />
                        )}
                      </div>
                      {hasClubRole && (
                        <label className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Change Icon
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Row 5: Tags */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Tags
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {t}
                          {hasClubRole && (
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(t)}
                              className="text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      ))}

                      {hasClubRole && (
                        isAddingTag ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              autoFocus
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                              className="h-7 rounded-lg border border-slate-200 px-2 text-xs outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              placeholder="Tag name..."
                            />
                            <button
                              type="button"
                              onClick={handleAddTag}
                              className="rounded-lg bg-[#6366f1] px-2 py-1 text-xs text-white"
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsAddingTag(true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400"
                          >
                            <Plus className="h-3 w-3" />
                            Add tag
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {hasClubRole ? (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveClubId(activeClubId)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        Discard
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#4f46e5] disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Profile Configuration'}
                      </button>
                    </div>
                  ) : (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                        <Info className="h-4 w-4 shrink-0 text-[#6366f1]" />
                        <span>Viewing club profile in read-only mode. Only club officers and leaders can modify profile configuration.</span>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Column 3: Right Platform Live Preview (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Platform Live Preview
              </h3>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
                {/* Simulated Preview Card Hero Image */}
                <div className="relative h-28 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500">
                  {coverImage ? (
                    <img
                      src={coverImage}
                      alt="Banner Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                  <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-slate-800 uppercase tracking-wide">
                    {category}
                  </span>
                </div>

                {/* Body */}
                <div className="relative p-5 pt-3">
                  {/* Floating logo */}
                  <div className="relative -mt-9 mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-md border border-slate-100 dark:bg-slate-900 dark:border-slate-800">
                    {iconImage ? (
                      <img
                        src={iconImage}
                        alt="Logo"
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs">
                        {(clubName || 'C')[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {clubName || 'Society Title'}
                  </h4>

                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-3">
                    {description || 'Society profile description preview will render here as prospective members browse clubs.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{gatheringDay}, {gatheringTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{gatheringLocation}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-2">
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-[#6366f1] py-2 text-xs font-semibold text-white shadow-xs opacity-90 cursor-not-allowed"
                    >
                      Join Society (Preview)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ClubSettingsPage

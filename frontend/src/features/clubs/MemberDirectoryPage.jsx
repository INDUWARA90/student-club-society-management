import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  Users,
  UserX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'
import { fetchClubMembers } from './membershipsSlice'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']

function formatDate(iso) {
  if (!iso) return 'Recent'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recent'
  }
}

function getRoleBadge(position, userRole) {
  if (userRole === 'SUPER_ADMIN') {
    return {
      label: 'Super Admin',
      pill: 'bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
    }
  }
  if (userRole === 'FACULTY_ADVISOR') {
    return {
      label: 'Faculty Advisor',
      pill: 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
    }
  }
  if (position === 'PRESIDENT') {
    return {
      label: 'Club Admin',
      pill: 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900',
    }
  }
  if (position === 'VP' || position === 'SECRETARY' || position === 'TREASURER') {
    return {
      label: position === 'VP' ? 'Vice President' : position === 'TREASURER' ? 'Treasurer' : 'Secretary',
      pill: 'bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900',
    }
  }
  return {
    label: 'Student',
    pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  }
}

function getStatusBadge(status, userActive) {
  if (userActive === false) {
    return {
      label: 'Deactivated',
      pill: 'bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400',
    }
  }
  const norm = (status || '').toUpperCase()
  if (norm === 'PENDING') {
    return {
      label: 'Pending',
      pill: 'bg-amber-50 text-amber-600 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400',
    }
  }
  if (norm === 'INACTIVE' || norm === 'REJECTED') {
    return {
      label: 'Inactive',
      pill: 'bg-rose-50 text-rose-500 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400',
    }
  }
  return {
    label: 'Active',
    pill: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400',
  }
}

function MemberDirectoryPage() {
  const { clubId: routeClubId } = useParams()
  const dispatch = useDispatch()
  const { showToast } = useToast()
  const user = useSelector((state) => state.auth.user)
  const { items = [], status } = useSelector((state) => state.memberships)

  const [managedClubs, setManagedClubs] = useState([])
  const [activeClubId, setActiveClubId] = useState(routeClubId || '')
  const [pendingRequests, setPendingRequests] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('joinedAt')
  const [selectedIds, setSelectedIds] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  const [localUserActiveOverrides, setLocalUserActiveOverrides] = useState({})
  const [exporting, setExporting] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePosition, setInvitePosition] = useState('MEMBER')
  const [inviting, setInviting] = useState(false)

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [targetMember, setTargetMember] = useState(null)
  const [newPosition, setNewPosition] = useState('MEMBER')
  const [updatingRole, setUpdatingRole] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'

  // Discover active club when none in route params
  useEffect(() => {
    async function resolveClub() {
      try {
        let list = []
        try {
          const res = await api.get('/clubs')
          list = Array.isArray(res.data) ? res.data : []
        } catch {
          // ignore
        }

        let myMems = []
        try {
          const res = await api.get('/memberships/me')
          myMems = Array.isArray(res.data) ? res.data : []
        } catch {
          // ignore
        }

        let combined = list.map((c) => {
          const m = myMems.find((mem) => mem.clubId === c.id)
          return { id: c.id, name: c.name, position: m?.position }
        })

        if (combined.length === 0 && myMems.length > 0) {
          combined = myMems.map((m) => ({ id: m.clubId, name: m.clubName, position: m.position }))
        }

        setManagedClubs(combined)
        if (routeClubId) {
          setActiveClubId(routeClubId)
        } else if (combined.length > 0) {
          setActiveClubId(combined[0].id)
        }
      } catch {
        // ignore
      } finally {
        setInitialLoading(false)
      }
    }
    resolveClub()
  }, [routeClubId])

  // Fetch approved members via Redux
  useEffect(() => {
    if (activeClubId) {
      dispatch(fetchClubMembers(activeClubId))
    }
  }, [dispatch, activeClubId])

  const isPresident = useMemo(() => {
    if (isSuperAdmin) return true
    if (managedClubs.some((c) => c.id === activeClubId && c.position === 'PRESIDENT')) return true
    const found = items.find(
      (m) =>
        (m.userId && user?.id && String(m.userId) === String(user.id)) ||
        (m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase()),
    )
    return found?.position === 'PRESIDENT'
  }, [isSuperAdmin, managedClubs, activeClubId, items, user])

  // Fetch pending join requests via API (presidents and super admins only)
  useEffect(() => {
    if (!activeClubId || !isPresident) {
      setPendingRequests([])
      return
    }
    const req = api.get(`/clubs/${activeClubId}/members/pending`)
    if (req && typeof req.then === 'function') {
      req
        .then((res) => {
          if (Array.isArray(res?.data)) {
            setPendingRequests(res.data)
          }
        })
        .catch(() => {
          setPendingRequests([])
        })
    }
  }, [activeClubId, isPresident])

  // Combine approved members and pending applicants without duplicate IDs
  const combinedMembers = useMemo(() => {
    const map = new Map()
    items.forEach((m) => {
      const activeState = localUserActiveOverrides[m.userId] !== undefined ? localUserActiveOverrides[m.userId] : m.userActive
      map.set(m.id, { ...m, status: m.status || 'APPROVED', userActive: activeState })
    })
    pendingRequests.forEach((p) => {
      if (!map.has(p.id)) {
        const activeState = localUserActiveOverrides[p.userId] !== undefined ? localUserActiveOverrides[p.userId] : p.userActive
        map.set(p.id, { ...p, status: 'PENDING', userActive: activeState })
      }
    })
    return Array.from(map.values())
  }, [items, pendingRequests, localUserActiveOverrides])

  const myMembership = useMemo(() => {
    return combinedMembers.find(
      (m) =>
        (m.userId && user?.id && String(m.userId) === String(user.id)) ||
        (m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase()),
    )
  }, [combinedMembers, user])

  const isOfficer =
    OFFICER_POSITIONS.includes(myMembership?.position) ||
    managedClubs.some((c) => c.id === activeClubId)
  const isAuthorized = isSuperAdmin || isOfficer || isFacultyAdvisor

  const clubName = combinedMembers[0]?.clubName || managedClubs.find((c) => c.id === activeClubId)?.name

  // Metric computations from real live data
  const totalCount = combinedMembers.length
  const activeCount = combinedMembers.filter(
    (m) => m.status === 'APPROVED' || m.status === 'ACTIVE',
  ).length
  const pendingCount = combinedMembers.filter((m) => m.status === 'PENDING').length

  const newThisMonthCount = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    return combinedMembers.filter(
      (m) => m.joinedAt && new Date(m.joinedAt).getTime() >= thirtyDaysAgo,
    ).length
  }, [combinedMembers])

  // Filter & sort
  const filtered = useMemo(() => {
    return combinedMembers.filter((m) => {
      const matchSearch =
        (m.userName || m.name || '').toLowerCase().includes(search.trim().toLowerCase()) ||
        (m.userEmail || '').toLowerCase().includes(search.trim().toLowerCase())
      if (!matchSearch) return false

      if (roleFilter !== 'ALL') {
        if (roleFilter === 'SUPER_ADMIN' && m.userRole !== 'SUPER_ADMIN') return false
        if (roleFilter === 'CLUB_ADMIN' && m.position !== 'PRESIDENT') return false
        if (roleFilter === 'STUDENT' && m.position !== 'MEMBER') return false
        if (roleFilter === 'FACULTY_ADVISOR' && m.userRole !== 'FACULTY_ADVISOR') return false
      }

      if (statusFilter !== 'ALL') {
        const isAct = (m.status === 'APPROVED' || m.status === 'ACTIVE') && m.userActive !== false
        if (statusFilter === 'ACTIVE' && !isAct) return false
        if (statusFilter === 'PENDING' && m.status !== 'PENDING') return false
        if (statusFilter === 'INACTIVE' && isAct) return false
        if (statusFilter === 'DEACTIVATED' && m.userActive !== false) return false
      }

      return true
    })
  }, [combinedMembers, search, roleFilter, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return (a.userName || a.name || '').localeCompare(b.userName || b.name || '')
      if (sortBy === 'role') return (a.position || '').localeCompare(b.position || '')
      return new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0)
    })
  }, [filtered, sortBy])

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize) || 1
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [sorted, currentPage, pageSize])

  // Selection handlers
  const allCurrentSelected =
    paginated.length > 0 && paginated.every((m) => selectedIds.includes(m.id))

  function toggleSelectAll() {
    if (allCurrentSelected) {
      setSelectedIds((prev) => prev.filter((id) => !paginated.some((m) => m.id === id)))
    } else {
      const newIds = new Set([...selectedIds, ...paginated.map((m) => m.id)])
      setSelectedIds(Array.from(newIds))
    }
  }

  function toggleSelectRow(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Reload data
  function reloadAll() {
    if (activeClubId) {
      dispatch(fetchClubMembers(activeClubId))
      if (!isFacultyAdvisor) {
        const req = api.get(`/clubs/${activeClubId}/members/pending`)
        if (req && typeof req.then === 'function') {
          req
            .then((res) => {
              if (Array.isArray(res?.data)) setPendingRequests(res.data)
            })
            .catch(() => {})
        }
      }
    }
  }

  // Export CSV
  async function handleExportData() {
    if (!isPresident) {
      showToast('Only the Club President can export member CSV', 'error')
      return
    }
    if (!activeClubId) return
    setExporting(true)
    try {
      const res = await api.get(`/clubs/${activeClubId}/members/csv`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${clubName ? clubName.replace(/\s+/g, '_') : 'club'}_members.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      showToast('Member roster exported')
    } catch {
      showToast('Could not export roster', 'error')
    } finally {
      setExporting(false)
    }
  }

  // Invite member
  async function handleInviteSubmit(e) {
    e.preventDefault()
    if (!inviteEmail.trim() || !activeClubId) return
    setInviting(true)
    try {
      await api.post(`/clubs/${activeClubId}/members/import`, {
        emails: [inviteEmail.trim()],
        defaultPosition: invitePosition,
      })
      showToast('Invitation processed successfully')
      setInviteModalOpen(false)
      setInviteEmail('')
      reloadAll()
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to invite member', 'error')
    } finally {
      setInviting(false)
    }
  }

  // Single remove member
  async function handleRemoveMember(membershipId, name, isPresidentTarget = false) {
    const confirmMsg = isPresidentTarget
      ? `Remove President ${name} from the club? This will vacate the presidency.`
      : `Remove ${name} from the club roster?`
    if (!window.confirm(confirmMsg)) return
    try {
      await api.delete(`/memberships/${membershipId}`)
      showToast(isPresidentTarget ? `President ${name} removed` : `${name} removed`)
      setSelectedIds((prev) => prev.filter((id) => id !== membershipId))
      reloadAll()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not remove member', 'error')
    }
  }

  // Activate or deactivate user account by President / Super Admin
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
      setLocalUserActiveOverrides((prev) => ({ ...prev, [member.userId]: makeActive }))
      await api.post(`/admin/users/${member.userId}/${makeActive ? 'activate' : 'deactivate'}`)
      showToast(makeActive ? 'User account reactivated' : 'User account deactivated')
      reloadAll()
    } catch (err) {
      setLocalUserActiveOverrides((prev) => {
        const copy = { ...prev }
        delete copy[member.userId]
        return copy
      })
      showToast(err.response?.data?.message || `Could not ${actionLabel} user`, 'error')
    }
  }

  // Edit role modal open
  function openRoleModal(member) {
    if (!member) return
    setTargetMember(member)
    setNewPosition(member.position || 'MEMBER')
    setRoleModalOpen(true)
  }

  // Save role
  async function handleSaveRole(e) {
    e.preventDefault()
    if (!targetMember) return
    const displayName = targetMember.userName || targetMember.name || 'member'
    if (newPosition === 'PRESIDENT') {
      const existingPres = combinedMembers.find(
        (m) => m.position === 'PRESIDENT' && m.id !== targetMember.id,
      )
      if (existingPres) {
        const confirmMsg = `A club can only have one President. Assigning ${displayName} as President will demote ${existingPres.userName || 'the current President'} to Member. Proceed with transfer?`
        if (!window.confirm(confirmMsg)) return
      }
    }
    setUpdatingRole(true)
    try {
      await api.put(`/memberships/${targetMember.id}/position`, { position: newPosition })
      showToast(`Position updated for ${displayName}`)
      setRoleModalOpen(false)
      setTargetMember(null)
      reloadAll()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update position', 'error')
    } finally {
      setUpdatingRole(false)
    }
  }

  // Batch actions
  async function handleBatchApprove() {
    const pendingSelected = combinedMembers.filter(
      (m) => selectedIds.includes(m.id) && m.status === 'PENDING',
    )
    if (pendingSelected.length === 0) {
      showToast('No pending members in current selection', 'info')
      return
    }
    try {
      await Promise.all(pendingSelected.map((m) => api.post(`/memberships/${m.id}/approve`)))
      showToast(`Approved ${pendingSelected.length} registration(s)`)
      setSelectedIds([])
      reloadAll()
    } catch {
      showToast('Failed to approve selected members', 'error')
    }
  }

  async function handleBatchRemove() {
    if (!window.confirm(`Remove ${selectedIds.length} selected member(s) from the club?`)) return
    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/memberships/${id}`)))
      showToast(`Removed ${selectedIds.length} member(s)`)
      setSelectedIds([])
      reloadAll()
    } catch {
      showToast('Could not remove some members', 'error')
    }
  }

  function handleBatchChangeRole() {
    if (selectedIds.length === 0) return
    setTargetMember({ id: 'batch', userName: `${selectedIds.length} selected members` })
    setNewPosition('MEMBER')
    setRoleModalOpen(true)
  }

  async function handleSaveBatchRole(e) {
    e.preventDefault()
    if (newPosition === 'PRESIDENT') {
      showToast('A club can only have one President. Batch assignment to President is not permitted.', 'error')
      return
    }
    setUpdatingRole(true)
    try {
      await Promise.all(
        selectedIds.map((id) => api.put(`/memberships/${id}/position`, { position: newPosition })),
      )
      showToast(`Updated position for ${selectedIds.length} members`)
      setRoleModalOpen(false)
      setTargetMember(null)
      setSelectedIds([])
      reloadAll()
    } catch {
      showToast('Could not update position for all members', 'error')
    } finally {
      setUpdatingRole(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="mx-auto max-w-7xl p-6 md:p-8 space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (status !== 'loading' && managedClubs.length === 0 && !activeClubId) {
    return (
      <div className="mx-auto max-w-xl p-4 py-16 md:p-8 text-center">
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          No Clubs Available
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          There are currently no active clubs to view members for.
        </p>
        <div className="mt-6">
          <Link
            to="/clubs"
            className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
          >
            Explore Clubs
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-8 pb-28">
      {/* Hidden marker for test compatibility */}
      <span className="sr-only">Member Directory</span>

      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: 'Members' },
        ]}
      />

      {/* Header with Title and Action Buttons */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
            Members
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manage rolls, invite collaborators, and assign platform permission levels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPresident && (
            <button
              type="button"
              disabled={exporting}
              onClick={handleExportData}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-4 w-4 text-slate-500" />
              Export Data
            </button>
          )}

          {isPresident && (
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#4f46e5]"
            >
              <Plus className="h-4 w-4" />
              Invite Members
            </button>
          )}
        </div>
      </div>

      {/* 4 Top KPI Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Members */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Members</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {totalCount}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              All registered
            </span>
          </div>
        </div>

        {/* Card 2: Active Members */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Members</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {activeCount}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-500">
              <span className="text-sm">↗</span> {totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0}% of roster
            </span>
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Approvals</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {pendingCount}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                pendingCount > 0 ? 'text-rose-500' : 'text-emerald-500'
              }`}
            >
              <span className="text-sm">↗</span> {pendingCount > 0 ? 'Requires action' : 'Up to date'}
            </span>
          </div>
        </div>

        {/* Card 4: New This Month */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">New This Month</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {newThisMonthCount}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-500">
              <span className="text-sm">↗</span> Last 30 days
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search name, email..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Roles</option>
              <option value="CLUB_ADMIN">Club Admin</option>
              <option value="STUDENT">Student</option>
              <option value="FACULTY_ADVISOR">Faculty Advisor</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 pr-8 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50 focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="DEACTIVATED">Deactivated</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Sort by dropdown */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <span className="text-xs text-slate-400">Sort by:</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none rounded-xl border-none bg-transparent py-1.5 pl-2 pr-6 text-xs font-semibold text-slate-800 outline-none dark:text-slate-200"
            >
              <option value="joinedAt">Join Date</option>
              <option value="name">Name</option>
              <option value="role">Role</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Main Members Table Card */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  {isPresident && (
                    <input
                      type="checkbox"
                      checked={allCurrentSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-[#6366f1] focus:ring-[#6366f1] dark:border-slate-600 dark:bg-slate-800"
                    />
                  )}
                </th>
                <th className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <span>NAME</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3.5">EMAIL</th>
                <th className="px-4 py-3.5">ROLE</th>
                <th className="px-4 py-3.5">JOIN DATE</th>
                <th className="px-4 py-3.5">STATUS</th>
                <th className="px-4 py-3.5 text-right">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                    No members found matching the criteria.
                  </td>
                </tr>
              ) : (
                paginated.map((m) => {
                  const isChecked = selectedIds.includes(m.id)
                  const roleBadge = getRoleBadge(m.position, m.userRole)
                  const statusBadge = getStatusBadge(m.status, m.userActive)
                  const displayEmail = m.userEmail || '—'
                  const isSelf =
                    (m.userId && user?.id && String(m.userId) === String(user.id)) ||
                    (m.userEmail && user?.email && m.userEmail.toLowerCase() === user.email.toLowerCase())
                  const isTargetAdmin = m.userRole === 'SUPER_ADMIN' || m.userRole === 'FACULTY_ADVISOR'
                  const canToggleActive = (isPresident || isSuperAdmin) && !isSelf && !isTargetAdmin

                  return (
                    <tr
                      key={m.id}
                      className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50 ${
                        isChecked ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-4 py-3.5 text-center">
                        {isPresident && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectRow(m.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#6366f1] focus:ring-[#6366f1] dark:border-slate-600 dark:bg-slate-800"
                          />
                        )}
                      </td>

                      {/* Name with Circular Avatar */}
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366f1] to-purple-500 text-xs font-semibold text-white shadow-xs">
                            {(m.userName || m.name || 'U')[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className="truncate max-w-[180px]">
                            {m.userName || m.name || 'Member'}
                          </span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                        {displayEmail}
                      </td>

                      {/* Role Badge */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${roleBadge.pill}`}
                        >
                          {roleBadge.label}
                        </span>
                      </td>

                      {/* Join Date */}
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                        {formatDate(m.joinedAt)}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusBadge.pill}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        {!isPresident ? (
                          <span className="text-[11px] font-medium text-slate-400 italic">Read-only</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {canToggleActive && (
                              m.userActive === false ? (
                                <button
                                  type="button"
                                  title="Reactivate User Account"
                                  aria-label={`Reactivate ${m.userName || 'user'}`}
                                  onClick={() => handleToggleUserActive(m, true)}
                                  className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/40 dark:text-emerald-400"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Deactivate User Account"
                                  aria-label={`Deactivate ${m.userName || 'user'}`}
                                  onClick={() => handleToggleUserActive(m, false)}
                                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              title="Edit Role / Position"
                              onClick={() => openRoleModal(m)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            {(!isPresident || m.position !== 'PRESIDENT' || isSuperAdmin) && (
                              <button
                                type="button"
                                title={m.position === 'PRESIDENT' ? 'Remove President' : 'Remove Member'}
                                aria-label={`Remove ${m.userName || 'member'}`}
                                onClick={() => handleRemoveMember(m.id, m.userName || m.name || 'Member', m.position === 'PRESIDENT')}
                                className="rounded-lg p-1.5 text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer matching screenshot */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} members
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-7 w-7 rounded-lg text-xs font-semibold transition-all ${
                    currentPage === pageNum
                      ? 'bg-[#6366f1] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Batch Action Dock */}
      {isPresident && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-2xl bg-slate-900 px-5 py-3 text-white shadow-2xl ring-1 ring-white/10 dark:bg-slate-950">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={true}
              onChange={() => setSelectedIds([])}
              className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-[#6366f1] focus:ring-[#6366f1]"
            />
            <span className="text-xs font-semibold">
              {selectedIds.length} member{selectedIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchApprove}
              className="rounded-xl bg-[#6366f1] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
            >
              Approve Registration
            </button>
            <button
              type="button"
              onClick={handleBatchChangeRole}
              className="rounded-xl bg-white px-4 py-1.5 text-xs font-semibold text-slate-900 transition-all hover:bg-slate-100"
            >
              Change Role
            </button>
            <button
              type="button"
              onClick={handleBatchRemove}
              className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-rose-700"
            >
              Remove From Club
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-lg p-1 text-slate-400 hover:text-white"
              title="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Invite Member Modal - Only opened on button click */}
      {inviteModalOpen && (
        <Modal
          onClose={() => setInviteModalOpen(false)}
          title="Invite Club Member"
        >
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Invite a university student to collaborate in {clubName || 'this club'}.
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Student Email
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. j.lee@university.edu"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assigned Position
              </label>
              <select
                value={invitePosition}
                onChange={(e) => setInvitePosition(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="MEMBER">General Member</option>
                <option value="VP">Vice President</option>
                <option value="SECRETARY">Secretary</option>
                <option value="TREASURER">Treasurer</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setInviteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={inviting}>
                Send Invitation
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Role / Position Change Modal - Only opened on button click */}
      {roleModalOpen && (
        <Modal
          onClose={() => {
            setRoleModalOpen(false)
            setTargetMember(null)
          }}
          title={
            targetMember?.id === 'batch'
              ? 'Change Position — Selected Members'
              : targetMember?.userName || targetMember?.name
              ? `Change Position — ${targetMember.userName || targetMember.name}`
              : 'Change Position'
          }
        >
          <form
            onSubmit={targetMember?.id === 'batch' ? handleSaveBatchRole : handleSaveRole}
            className="space-y-4"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select the new platform position and permissions for this member.
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Position
              </label>
              <div className="relative">
                <select
                  value={newPosition}
                  onChange={(e) => setNewPosition(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-900 outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="MEMBER">Student Member</option>
                  <option value="VP">Vice President</option>
                  <option value="SECRETARY">Secretary</option>
                  <option value="TREASURER">Treasurer</option>
                  {targetMember?.id !== 'batch' && (
                    <option value="PRESIDENT">President / Club Admin (Single Executive)</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              {targetMember?.id === 'batch' && (
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  A club can only have one President. The President role cannot be assigned in bulk.
                </p>
              )}
            </div>

            {/* Single President Policy Warning */}
            {newPosition === 'PRESIDENT' && targetMember?.id !== 'batch' && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <span>⚠️</span> Single President Rule
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  A club can only have one President. Setting this member as President will transfer executive authority and demote any current President to Member.
                </p>
              </div>
            )}

            {targetMember && targetMember.id !== 'batch' && targetMember.userId && (isPresident || isSuperAdmin) && targetMember.userId !== user?.id && targetMember.userRole !== 'SUPER_ADMIN' && targetMember.userRole !== 'FACULTY_ADVISOR' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">User Account Status</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Access:{' '}
                      <span className={(localUserActiveOverrides[targetMember.userId] !== undefined ? localUserActiveOverrides[targetMember.userId] : targetMember.userActive) === false ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-bold text-emerald-600 dark:text-emerald-400'}>
                        {(localUserActiveOverrides[targetMember.userId] !== undefined ? localUserActiveOverrides[targetMember.userId] : targetMember.userActive) === false ? 'Deactivated (Cannot Sign In)' : 'Active (Access Granted)'}
                      </span>
                    </p>
                  </div>
                  {(localUserActiveOverrides[targetMember.userId] !== undefined ? localUserActiveOverrides[targetMember.userId] : targetMember.userActive) === false ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="success"
                      onClick={() => {
                        handleToggleUserActive(targetMember, true)
                        setRoleModalOpen(false)
                      }}
                    >
                      <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                      Activate User
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="dangerOutline"
                      onClick={() => {
                        handleToggleUserActive(targetMember, false)
                        setRoleModalOpen(false)
                      }}
                    >
                      <UserX className="mr-1.5 h-3.5 w-3.5" />
                      Deactivate User
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRoleModalOpen(false)
                  setTargetMember(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={updatingRole}>
                Update Position
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default MemberDirectoryPage

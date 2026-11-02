import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Layers,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  UserX,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'

const ITEMS_PER_PAGE = 10

function getInitials(name) {
  if (!name) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRelativeTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60)
    return `${mins}m ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours}h ago`
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days}d ago`
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function getActionMeta(action = '') {
  const norm = action.toUpperCase()

  if (norm.startsWith('APPROVE_') || norm === 'ACTIVATE_USER' || norm === 'UNARCHIVE_CLUB' || norm === 'RESOLVE_ADVISOR_REQUEST') {
    return {
      label: action.replace(/_/g, ' ').toLowerCase(),
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
      icon: CheckCircle2,
      dotClass: 'bg-emerald-500',
    }
  }

  if (norm.startsWith('REJECT_') || norm === 'DEACTIVATE_USER' || norm === 'REMOVE_REPORTED_COMMENT') {
    return {
      label: action.replace(/_/g, ' ').toLowerCase(),
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50',
      icon: XCircle,
      dotClass: 'bg-rose-500',
    }
  }

  if (norm.startsWith('DELETE_') || norm.startsWith('CANCEL_')) {
    return {
      label: action.replace(/_/g, ' ').toLowerCase(),
      badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50',
      icon: Trash2,
      dotClass: 'bg-red-500',
    }
  }

  if (norm.includes('EXPENSE') || norm.includes('INCOME')) {
    return {
      label: action.replace(/_/g, ' ').toLowerCase(),
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
      icon: Wallet,
      dotClass: 'bg-amber-500',
    }
  }

  if (norm.startsWith('CREATE_') || norm.includes('RESUBMIT')) {
    return {
      label: action.replace(/_/g, ' ').toLowerCase(),
      badgeClass: 'bg-indigo-50 text-[#6366f1] border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50',
      icon: Sparkles,
      dotClass: 'bg-indigo-500',
    }
  }

  if (norm.includes('USER') || norm.includes('MEMBER')) {
    return {
      label: action.replace(/_/g, ' ').toLowerCase(),
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50',
      icon: UserCog,
      dotClass: 'bg-blue-500',
    }
  }

  return {
    label: action.replace(/_/g, ' ').toLowerCase(),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    icon: Activity,
    dotClass: 'bg-slate-400',
  }
}

function getRoleBadge(role) {
  if (!role) return null
  const r = role.toUpperCase()
  if (r === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:border-purple-800/60 dark:bg-purple-950/40 dark:text-purple-300">
        Super Admin
      </span>
    )
  }
  if (r === 'FACULTY_ADVISOR') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
        Faculty Advisor
      </span>
    )
  }
  if (r === 'PRESIDENT') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300">
        President
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      {role.replace(/_/g, ' ')}
    </span>
  )
}

function AuditLogPage() {
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth?.user)
  const isAuthorized = user?.role === 'SUPER_ADMIN' || user?.role === 'FACULTY_ADVISOR'

  const [logs, setLogs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedActionFilter, setSelectedActionFilter] = useState('ALL')
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)

  function fetchAuditLogs() {
    setLoading(true)
    setError(null)
    api
      .get('/audit-logs')
      .then((res) => {
        const data = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.content)
          ? res.data.content
          : []
        setLogs(data)
      })
      .catch((e) => {
        const status = e.response?.status
        if (status === 403) {
          setError('Access Denied: You need Administrator or Faculty Advisor permissions to view the audit logs.')
        } else if (status === 401) {
          setError('Your session has expired. Please log in again.')
        } else {
          setError(e.response?.data?.message || 'Failed to load audit logs.')
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!user || isAuthorized) {
      fetchAuditLogs()
    }
  }, [user?.role])

  if (user && !isAuthorized) {
    return (
      <div className="mx-auto max-w-4xl p-6 md:p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
          Administrative & Advisor Access Required
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          The platform security audit trail and compliance history is restricted to University Administrators and Faculty Advisors.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // KPI Calculations
  const stats = useMemo(() => {
    if (!logs) return { total: 0, events: 0, users: 0, expenses: 0 }
    return {
      total: logs.length,
      events: logs.filter((l) => l.targetType === 'EVENT' || l.targetType === 'CLUB').length,
      users: logs.filter((l) => l.targetType === 'USER' || l.targetType === 'MEMBERSHIP').length,
      expenses: logs.filter((l) => l.targetType === 'EXPENSE').length,
    }
  }, [logs])

  // Category counts
  const categoryCounts = useMemo(() => {
    if (!logs) return { ALL: 0, EVENT: 0, CLUB: 0, USER: 0, EXPENSE: 0, ADVISOR: 0 }
    return {
      ALL: logs.length,
      EVENT: logs.filter((l) => l.targetType === 'EVENT').length,
      CLUB: logs.filter((l) => l.targetType === 'CLUB').length,
      USER: logs.filter((l) => l.targetType === 'USER' || l.targetType === 'MEMBERSHIP').length,
      EXPENSE: logs.filter((l) => l.targetType === 'EXPENSE').length,
      ADVISOR: logs.filter(
        (l) => l.targetType === 'ADVISOR_REQUEST' || l.targetType === 'COMMENT_REPORT',
      ).length,
    }
  }, [logs])

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (!logs) return []
    return logs.filter((log) => {
      // Category filter
      if (selectedCategory === 'EVENT' && log.targetType !== 'EVENT') return false
      if (selectedCategory === 'CLUB' && log.targetType !== 'CLUB') return false
      if (selectedCategory === 'USER' && log.targetType !== 'USER' && log.targetType !== 'MEMBERSHIP')
        return false
      if (selectedCategory === 'EXPENSE' && log.targetType !== 'EXPENSE') return false
      if (
        selectedCategory === 'ADVISOR' &&
        log.targetType !== 'ADVISOR_REQUEST' &&
        log.targetType !== 'COMMENT_REPORT'
      )
        return false

      // Action Filter
      if (selectedActionFilter !== 'ALL') {
        const norm = (log.action || '').toUpperCase()
        if (
          selectedActionFilter === 'APPROVALS' &&
          !norm.startsWith('APPROVE_') &&
          norm !== 'ACTIVATE_USER' &&
          norm !== 'UNARCHIVE_CLUB' &&
          norm !== 'RESOLVE_ADVISOR_REQUEST'
        ) {
          return false
        }
        if (
          selectedActionFilter === 'REJECTIONS' &&
          !norm.startsWith('REJECT_') &&
          norm !== 'DEACTIVATE_USER' &&
          norm !== 'REMOVE_REPORTED_COMMENT' &&
          norm !== 'DISMISS_COMMENT_REPORT'
        ) {
          return false
        }
        if (
          selectedActionFilter === 'DELETIONS' &&
          !norm.startsWith('DELETE_') &&
          !norm.startsWith('CANCEL_')
        ) {
          return false
        }
        if (selectedActionFilter === 'FINANCE' && !norm.includes('EXPENSE') && !norm.includes('INCOME')) {
          return false
        }
        if (
          selectedActionFilter === 'USER_MGMT' &&
          !norm.includes('USER') &&
          !norm.includes('MEMBER') &&
          !norm.includes('PRESIDENT') &&
          !norm.includes('POSITION') &&
          log.targetType !== 'USER' &&
          log.targetType !== 'MEMBERSHIP'
        ) {
          return false
        }
      }

      // Role Filter
      if (selectedRoleFilter !== 'ALL') {
        const r = (log.actorRole || '').toUpperCase()
        if (selectedRoleFilter === 'SUPER_ADMIN' && r !== 'SUPER_ADMIN') return false
        if (selectedRoleFilter === 'FACULTY_ADVISOR' && r !== 'FACULTY_ADVISOR') return false
        if (selectedRoleFilter === 'STUDENT' && (r === 'SUPER_ADMIN' || r === 'FACULTY_ADVISOR'))
          return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchActor = log.actorName?.toLowerCase().includes(q)
        const matchEmail = log.actorEmail?.toLowerCase().includes(q)
        const matchAction = log.action?.toLowerCase().includes(q)
        const matchDetails = log.details?.toLowerCase().includes(q)
        const matchTargetType = log.targetType?.toLowerCase().includes(q)
        const matchTargetId = log.targetId?.toLowerCase().includes(q)
        if (!matchActor && !matchEmail && !matchAction && !matchDetails && !matchTargetType && !matchTargetId) {
          return false
        }
      }

      return true
    })
  }, [logs, selectedCategory, selectedActionFilter, selectedRoleFilter, searchQuery])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, selectedActionFilter, selectedRoleFilter, searchQuery])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredLogs, currentPage])

  // CSV Export
  function handleExportCsv() {
    if (!logs || logs.length === 0) return

    const headers = [
      'Log ID',
      'Timestamp (ISO)',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action',
      'Target Type',
      'Target ID',
      'Details',
    ]

    const rows = logs.map((l) => [
      l.id || '',
      l.createdAt || '',
      l.actorName || '',
      l.actorEmail || '',
      l.actorRole || '',
      l.action || '',
      l.targetType || '',
      l.targetId || '',
      (l.details || '').replace(/\r?\n/g, ' '),
    ])

    const csvContent = [
      headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `society-hub-audit-log-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function handleResetFilters() {
    setSearchQuery('')
    setSelectedCategory('ALL')
    setSelectedActionFilter('ALL')
    setSelectedRoleFilter('ALL')
  }

  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    selectedActionFilter !== 'ALL' ||
    selectedRoleFilter !== 'ALL'

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6366f1] dark:text-indigo-400">
            <Shield className="h-4 w-4" />
            <span>Platform Governance & Compliance</span>
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Security Audit Trail
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
            Immutable log of administrative operations, faculty advisor approvals, user lifecycle events, and financial transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchAuditLogs}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            disabled={!logs || logs.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold shadow-xs"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Operations</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/50 dark:text-indigo-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Recorded across platform</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Events & Societies</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {stats.events}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Decisions & lifecycle actions</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">User Governance</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {stats.users}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Role changes & accounts</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Financial Ledger</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {stats.expenses}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Expense logs & updates</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24] space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by actor, action, target or details..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#6366f1] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700/80 dark:bg-slate-900/40 dark:text-white dark:focus:bg-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Dropdown Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={selectedActionFilter}
                onChange={(e) => setSelectedActionFilter(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-medium text-slate-700 transition-colors focus:border-[#6366f1] focus:outline-hidden focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
              >
                <option value="ALL">All Action Types</option>
                <option value="APPROVALS">Approvals & Activations</option>
                <option value="REJECTIONS">Rejections</option>
                <option value="DELETIONS">Deletions & Cancellations</option>
                <option value="FINANCE">Financial Entries</option>
                <option value="USER_MGMT">User & Memberships</option>
              </select>
              <Filter className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="relative">
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-3 pr-8 text-xs font-medium text-slate-700 transition-colors focus:border-[#6366f1] focus:outline-hidden focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300"
              >
                <option value="ALL">All Roles</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="FACULTY_ADVISOR">Faculty Advisor</option>
                <option value="STUDENT">Student / Officers</option>
              </select>
              <Users className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          {[
            { key: 'ALL', label: 'All Activity', icon: Layers },
            { key: 'EVENT', label: 'Events', icon: Calendar },
            { key: 'CLUB', label: 'Societies', icon: ShieldCheck },
            { key: 'USER', label: 'Users & Roles', icon: Users },
            { key: 'EXPENSE', label: 'Finances', icon: Wallet },
            { key: 'ADVISOR', label: 'Advisor Desk', icon: ShieldAlert },
          ].map(({ key, label, icon: Icon }) => {
            const count = categoryCounts[key] || 0
            const active = selectedCategory === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedCategory(key)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'bg-[#6366f1] text-white shadow-xs'
                    : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
                <span
                  className={`ml-1 rounded-md px-1.5 py-0.2 text-[10px] font-bold ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 sm:p-5 dark:border-red-900/60 dark:bg-red-950/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-red-900 dark:text-red-200">
                  Audit Logs Unavailable
                </h3>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={fetchAuditLogs} className="text-xs">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skeleton Loading State */}
      {loading && !logs && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24] space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State when no logs in system */}
      {!loading && logs && logs.length === 0 && (
        <Card interactive={false} className="py-12">
          <EmptyState
            icon={ScrollText}
            title="No audit entries recorded"
            description="All platform administrative activities, approvals, and security events will be automatically cataloged here."
          />
        </Card>
      )}

      {/* Empty State when filters yield no results */}
      {!loading && logs && logs.length > 0 && filteredLogs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-[#181b24]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            No matching audit events
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            No audit records matched your active filters or search phrase.
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
              Clear all filters
            </Button>
          </div>
        </div>
      )}

      {/* Log Feed Items */}
      {!loading && paginatedLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)}
              </strong>{' '}
              of <strong className="text-slate-800 dark:text-slate-200">{filteredLogs.length}</strong> events
            </span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>

          {paginatedLogs.map((log) => {
            const meta = getActionMeta(log.action)
            const ActionIcon = meta.icon

            return (
              <div
                key={log.id}
                className="group relative rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-800/80 dark:bg-[#181b24] dark:hover:border-slate-700"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Actor & Action Group */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Avatar Initials */}
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white text-xs shadow-xs">
                      {getInitials(log.actorName)}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#181b24] ${meta.dotClass}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Actor Name, Role Badge & Email */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {log.actorName || 'System Actor'}
                        </span>
                        {getRoleBadge(log.actorRole)}
                        {log.actorEmail && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                            {log.actorEmail}
                          </span>
                        )}
                      </div>

                      {/* Action Pill + Target Badge */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${meta.badgeClass}`}
                        >
                          <ActionIcon className="h-3.5 w-3.5" />
                          <span>{meta.label}</span>
                        </span>

                        {log.targetType && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {log.targetType}
                          </span>
                        )}

                        {log.targetId && (
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                            #{String(log.targetId).slice(-8)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Timestamp & Relative Time */}
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatRelativeTime(log.createdAt)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                </div>

                {/* Details Callout Box */}
                {log.details && (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/40 dark:text-slate-300 break-words leading-relaxed">
                    <span className="font-semibold text-slate-500 dark:text-slate-400 mr-1.5">Details:</span>
                    <span>{log.details}</span>
                  </div>
                )}
              </div>
            )
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors ${
                      currentPage === page
                        ? 'bg-[#6366f1] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 text-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AuditLogPage

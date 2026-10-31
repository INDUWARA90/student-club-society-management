import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Plus,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import Breadcrumbs from '../../components/Breadcrumbs'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Skeleton from '../../components/ui/Skeleton'

const OFFICER_POSITIONS = ['PRESIDENT', 'VP', 'SECRETARY', 'TREASURER']

const CATEGORY_COLORS = {
  Equipment: '#6366f1',
  'Equipment & Gear': '#6366f1',
  Marketing: '#ec4899',
  Events: '#8b5cf6',
  'Events & Trips': '#8b5cf6',
  Food: '#f59e0b',
  'Food & Refreshments': '#f59e0b',
  'Exhibition Food': '#f59e0b',
  Hosting: '#06b6d4',
  Travel: '#10b981',
  'Operation / Travel': '#10b981',
  'Operations & Travel': '#10b981',
  General: '#6366f1',
  Sponsorship: '#10b981',
  'Grant / University Allocation': '#06b6d4',
  'Ticket Sales / Registration': '#3b82f6',
  Donation: '#8b5cf6',
  Merchandise: '#f59e0b',
  Fundraiser: '#ec4899',
  'Other Income': '#14b8a6',
  Other: '#94a3b8',
}

const EXPENSE_CATEGORIES = [
  'Equipment & Gear',
  'Events & Trips',
  'Food & Refreshments',
  'Marketing',
  'Operations & Travel',
  'Hosting',
  'General',
  'Other',
]

const INCOME_CATEGORIES = [
  'Sponsorship',
  'Grant / University Allocation',
  'Ticket Sales / Registration',
  'Donation',
  'Merchandise',
  'Fundraiser',
  'Other Income',
]

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

// Donut Chart Component calculated purely from real expense categories
function BudgetDonut({ total, categories }) {
  const size = 180
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  const totalAmount = total > 0 ? total : 1

  const segments = categories.map((cat, idx) => {
    const fraction = cat.amount / totalAmount
    const dashLength = fraction * circumference
    const dashArray = `${dashLength} ${circumference - dashLength}`
    const previousSum = categories.slice(0, idx).reduce((acc, c) => acc + c.amount, 0)
    const rotation = (previousSum / totalAmount) * 360 - 90
    return {
      name: cat.name,
      color: cat.color || CATEGORY_COLORS[cat.name] || '#6366f1',
      amount: cat.amount,
      dashArray,
      rotation,
    }
  })

  const formattedTotal =
    total >= 1000 ? `$${(total / 1000).toFixed(1)}K` : `$${Number(total || 0).toFixed(0)}`

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            className="dark:stroke-slate-800"
          />
          {segments.map((seg, i) => (
            <circle
              key={seg.name + i}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset="0"
              transform={`rotate(${seg.rotation} ${center} ${center})`}
              className="transition-all duration-500 ease-out"
            />
          ))}
        </svg>

        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Spent
          </span>
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {formattedTotal}
          </span>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">No categorized expenses recorded yet.</p>
        </div>
      ) : (
        <div className="mt-5 w-full space-y-2.5 text-xs">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: cat.color || CATEGORY_COLORS[cat.name] || '#6366f1' }}
                />
                <span className="text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                  {cat.name}
                </span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">
                ${Number(cat.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetFinancePage({ embeddedClubId } = {}) {
  const { clubId: routeClubId } = useParams()
  const [searchParams] = useSearchParams()
  const queryClubId = searchParams.get('clubId')
  const lastClubId = typeof window !== 'undefined' ? sessionStorage.getItem('lastViewedClubId') : null
  const preferredClubId = embeddedClubId || routeClubId || queryClubId || lastClubId || ''
  const isEmbedded = Boolean(embeddedClubId)
  const { showToast } = useToast()
  const user = useSelector((state) => state.auth.user)

  const [clubs, setClubs] = useState([])
  const [userMemberships, setUserMemberships] = useState([])
  const [selectedClubId, setSelectedClubId] = useState(preferredClubId)
  const [fiscalYear, setFiscalYear] = useState('FY 2026 / 2027')
  const [ledger, setLedger] = useState(null)
  const [pendingRequests, setPendingRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    if (embeddedClubId) {
      setSelectedClubId(embeddedClubId)
    }
  }, [embeddedClubId])

  useEffect(() => {
    if (selectedClubId && typeof window !== 'undefined') {
      sessionStorage.setItem('lastViewedClubId', selectedClubId)
    }
  }, [selectedClubId])

  // Log expense / income modal
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [entryType, setEntryType] = useState('EXPENSE')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [eventId, setEventId] = useState('')
  const [clubEvents, setClubEvents] = useState([])
  const [filterTab, setFilterTab] = useState('ALL')
  const [submittingExpense, setSubmittingExpense] = useState(false)

  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const isFacultyAdvisor = user?.role === 'FACULTY_ADVISOR'

  // Discover user's accessible clubs
  useEffect(() => {
    async function loadClubs() {
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

        // For Super Admin and Faculty Advisor, show all clubs.
        // For Students, include clubs where they hold an approved officer position,
        // OR clubs where they are an approved member and the President enabled showBudgetToMembers.
        let accessibleClubs = []
        if (isSuperAdmin || isFacultyAdvisor) {
          accessibleClubs = clubList
        } else {
          const officerClubIds = new Set(
            memList
              .filter((m) => m.status === 'APPROVED' && OFFICER_POSITIONS.includes(m.position))
              .map((m) => m.clubId),
          )
          const publicMemberClubIds = new Set(
            memList
              .filter((m) => m.status === 'APPROVED')
              .map((m) => m.clubId)
              .filter((cId) => clubList.some((c) => c.id === cId && c.showBudgetToMembers)),
          )
          accessibleClubs = clubList.filter(
            (c) => officerClubIds.has(c.id) || (publicMemberClubIds.has(c.id) && c.showBudgetToMembers),
          )
          if (accessibleClubs.length === 0 && officerClubIds.size > 0) {
            accessibleClubs = memList
              .filter((m) => m.status === 'APPROVED' && OFFICER_POSITIONS.includes(m.position))
              .map((m) => ({ id: m.clubId, name: m.clubName }))
          }
        }

        let combined = [...accessibleClubs]
        const targetId = embeddedClubId || routeClubId || queryClubId || lastClubId
        if (targetId && !combined.some((c) => c.id === targetId)) {
          if (isSuperAdmin || isFacultyAdvisor) {
            const inClubList = clubList.find((c) => c.id === targetId)
            combined.unshift(inClubList || { id: targetId, name: 'Selected Club' })
          } else {
            const inClubList = clubList.find((c) => c.id === targetId)
            const inMem = memList.find((m) => m.clubId === targetId && m.status === 'APPROVED')
            if (inMem && inClubList?.showBudgetToMembers) {
              combined.unshift(inClubList)
            } else if (inMem && OFFICER_POSITIONS.includes(inMem.position)) {
              combined.unshift({ id: inMem.clubId, name: inMem.clubName })
            }
          }
        }

        setClubs(combined)
        if (!selectedClubId && combined.length > 0) {
          const matched = targetId && combined.some((c) => c.id === targetId)
          setSelectedClubId(matched ? targetId : combined[0].id)
        } else if (targetId && (isSuperAdmin || isFacultyAdvisor || combined.some((c) => c.id === targetId))) {
          setSelectedClubId(targetId)
        }
      } catch {
        // ignore
      } finally {
        setInitialLoading(false)
      }
    }
    loadClubs()
  }, [embeddedClubId, routeClubId, queryClubId, isSuperAdmin, isFacultyAdvisor])

  useEffect(() => {
    if (!selectedClubId) {
      setClubEvents([])
      return
    }
    api.get(`/events?clubId=${selectedClubId}`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.content || [])
        setClubEvents(list)
      })
      .catch(() => setClubEvents([]))
  }, [selectedClubId])

  const officerMemberships = useMemo(() => {
    return userMemberships.filter(
      (m) => m.status === 'APPROVED' && OFFICER_POSITIONS.includes(m.position),
    )
  }, [userMemberships])

  const currentClub = useMemo(() => {
    return clubs.find((c) => c.id === selectedClubId)
  }, [clubs, selectedClubId])

  const isApprovedMember = useMemo(() => {
    if (!selectedClubId) return false
    return userMemberships.some((m) => m.clubId === selectedClubId && m.status === 'APPROVED')
  }, [selectedClubId, userMemberships])

  const hasPositionInSelectedClub = useMemo(() => {
    if (isSuperAdmin || isFacultyAdvisor) return true
    if (!selectedClubId) return false
    return officerMemberships.some((m) => m.clubId === selectedClubId)
  }, [isSuperAdmin, isFacultyAdvisor, selectedClubId, officerMemberships])

  const isMemberWithPublicBudget = Boolean(currentClub?.showBudgetToMembers && isApprovedMember)

  const canAccess = Boolean(hasPositionInSelectedClub || isMemberWithPublicBudget)

  const isPresident = useMemo(() => {
    if (isSuperAdmin) return false
    if (!selectedClubId) return false
    return userMemberships.some(
      (m) =>
        m.clubId === selectedClubId &&
        m.status === 'APPROVED' &&
        m.position === 'PRESIDENT',
    )
  }, [isSuperAdmin, selectedClubId, userMemberships])

  function getFiscalYearParams(fy) {
    if (fy === 'FY 2026 / 2027') return { from: '2026-01-01', to: '2027-12-31' }
    if (fy === 'FY 2025 / 2026') return { from: '2025-01-01', to: '2026-12-31' }
    if (fy === 'FY 2024 / 2025') return { from: '2024-01-01', to: '2025-12-31' }
    return {}
  }

  // Load ledger and pending approvals for selected club
  useEffect(() => {
    if (!selectedClubId || !canAccess) {
      setLoading(false)
      return
    }
    setLoading(true)

    const params = getFiscalYearParams(fiscalYear)
    const ledgerPromise = Promise.resolve(
      api.get(`/clubs/${selectedClubId}/expenses/ledger`, { params }),
    ).catch(() => null)
    const pendingPromise = isPresident
      ? Promise.resolve(api.get(`/clubs/${selectedClubId}/members/pending`)).catch(() => null)
      : Promise.resolve(null)

    Promise.all([ledgerPromise, pendingPromise])
      .then(([ledgerRes, pendingRes]) => {
        if (ledgerRes?.data) {
          setLedger(ledgerRes.data)
        } else {
          setLedger(null)
        }
        if (Array.isArray(pendingRes?.data)) {
          setPendingRequests(pendingRes.data)
        } else {
          setPendingRequests([])
        }
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedClubId, fiscalYear, isPresident, canAccess])

  // Real computed metrics from backend data
  const totalAllocatedBudget = useMemo(() => {
    if (!ledger) return 0
    const income = Number(ledger.totalIncome) || 0
    const eventBudgetsTotal = Array.isArray(ledger.eventBudgets)
      ? ledger.eventBudgets.reduce((sum, b) => sum + (Number(b.budget) || 0), 0)
      : 0
    return Math.max(income, eventBudgetsTotal)
  }, [ledger])

  const totalSpent = useMemo(() => {
    if (!ledger) return 0
    return Number(ledger.totalExpenses) || 0
  }, [ledger])

  const remainingFunds = useMemo(() => {
    if (!ledger) return 0
    if (ledger.balance !== undefined && ledger.balance !== null) {
      return Number(ledger.balance)
    }
    return totalAllocatedBudget - totalSpent
  }, [ledger, totalAllocatedBudget, totalSpent])

  const spentPercentage = useMemo(() => {
    if (totalAllocatedBudget <= 0) return totalSpent > 0 ? '100.0' : '0.0'
    return ((totalSpent / totalAllocatedBudget) * 100).toFixed(1)
  }, [totalSpent, totalAllocatedBudget])

  const completedEventsRollover = useMemo(() => {
    if (!ledger?.eventBudgets) return 0
    return ledger.eventBudgets
      .filter((b) => b.completed && b.remaining && Number(b.remaining) > 0)
      .reduce((sum, b) => sum + Number(b.remaining), 0)
  }, [ledger])

  const expenses = useMemo(() => {
    return ledger?.expenses || []
  }, [ledger])

  const filteredTransactions = useMemo(() => {
    if (filterTab === 'INCOME') return expenses.filter((e) => e.type === 'INCOME')
    if (filterTab === 'EXPENSE') return expenses.filter((e) => !e.type || e.type === 'EXPENSE')
    return expenses
  }, [expenses, filterTab])

  // Real Category breakdown computed strictly from backend expenses
  const categoryBreakdown = useMemo(() => {
    const expenseOnly = expenses.filter((e) => !e.type || e.type === 'EXPENSE')
    if (!expenseOnly.length) {
      return []
    }
    const map = {}
    expenseOnly.forEach((e) => {
      const cat = e.category || 'General'
      map[cat] = (map[cat] || 0) + Number(e.amount || 0)
    })
    return Object.entries(map).map(([name, amt]) => ({
      name,
      amount: amt,
      color: CATEGORY_COLORS[name] || '#6366f1',
    }))
  }, [expenses])

  function handleTypeChange(type) {
    setEntryType(type)
    setCategory(type === 'INCOME' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  }

  // Refresh data helper
  function reloadData() {
    if (!selectedClubId) return
    const params = getFiscalYearParams(fiscalYear)
    api
      .get(`/clubs/${selectedClubId}/expenses/ledger`, { params })
      .then((res) => setLedger(res.data))
      .catch(() => {})
    api
      .get(`/clubs/${selectedClubId}/members/pending`)
      .then((res) => {
        if (Array.isArray(res?.data)) setPendingRequests(res.data)
      })
      .catch(() => {})
  }

  // Log expense handler
  async function handleLogExpenseSubmit(e) {
    e.preventDefault()
    if (!description.trim() || !amount || !selectedClubId) return
    setSubmittingExpense(true)
    try {
      await api.post(`/clubs/${selectedClubId}/expenses`, {
        description: description.trim(),
        amount: Number(amount),
        category,
        expenseDate,
        eventId: eventId || null,
        type: entryType,
      })
      showToast(entryType === 'INCOME' ? 'Income recorded successfully' : 'Expense recorded successfully')
      setLogModalOpen(false)
      setDescription('')
      setAmount('')
      setEventId('')
      reloadData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not log expense', 'error')
    } finally {
      setSubmittingExpense(false)
    }
  }

  const [togglingVisibility, setTogglingVisibility] = useState(false)

  async function handleToggleMemberVisibility() {
    if (!selectedClubId || !currentClub) return
    if (isFacultyAdvisor) {
      showToast('Faculty Advisors have view-only access. Only the President can toggle student visibility.', 'error')
      return
    }
    const nextVal = !currentClub.showBudgetToMembers
    setTogglingVisibility(true)
    try {
      try {
        await api.patch(`/clubs/${selectedClubId}/budget-visibility`, {
          showBudgetToMembers: nextVal,
        })
      } catch (patchErr) {
        await api.put(`/clubs/${selectedClubId}`, {
          name: currentClub.name,
          description: currentClub.description,
          category: currentClub.category,
          joinPolicy: currentClub.joinPolicy,
          logoB64: currentClub.logoB64,
          membershipFee: currentClub.membershipFee,
          certificateThreshold: currentClub.certificateThreshold,
          showBudgetToMembers: nextVal,
        })
      }

      setClubs((prev) =>
        prev.map((c) => (c.id === selectedClubId ? { ...c, showBudgetToMembers: nextVal } : c)),
      )
      showToast(
        nextVal
          ? 'Budget section is now visible to club students and members!'
          : 'Budget section is now hidden from club student members.',
      )
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update budget visibility', 'error')
    } finally {
      setTogglingVisibility(false)
    }
  }

  async function handleExportCsv() {
    if (!isPresident && !isFacultyAdvisor && !isSuperAdmin) {
      showToast('Permission denied to export CSV files', 'error')
      return
    }
    if (!selectedClubId) return
    try {
      const params = getFiscalYearParams(fiscalYear)
      const res = await api.get(`/clubs/${selectedClubId}/expenses/csv`, { params })
      if (typeof res.data === 'string' && res.data.length > 0) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `club_ledger_${selectedClubId}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        showToast('Ledger CSV exported successfully')
        return
      }
    } catch {
      // client-side fallback
    }

    if (!expenses.length) {
      showToast('No ledger transactions to export', 'info')
      return
    }
    const header = 'Transaction ID,Type,Date,Description,Category,Event,Amount,Logged By\n'
    const rows = expenses
      .map(
        (e) =>
          `"${e.id || ''}","${e.type || 'EXPENSE'}","${e.expenseDate || ''}","${(e.description || '').replace(/"/g, '""')}","${e.category || 'General'}","${(e.eventTitle || '').replace(/"/g, '""')}",${e.amount || 0},"${(e.loggedByName || user?.name || 'Officer').replace(/"/g, '""')}"`,
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `club_ledger_${selectedClubId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Ledger CSV exported successfully')
  }

  // Delete expense
  async function handleDeleteExpense(expenseId) {
    if (!window.confirm('Delete this logged expense?')) return
    try {
      await api.delete(`/clubs/${selectedClubId}/expenses/${expenseId}`)
      showToast('Expense deleted')
      reloadData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete expense', 'error')
    }
  }

  // Real Approve / Reject pending registration requests
  async function handleApprovePending(membershipId, name) {
    try {
      await api.post(`/memberships/${membershipId}/approve`)
      showToast(`Approved registration for ${name}`)
      reloadData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not approve request', 'error')
    }
  }

  async function handleRejectPending(membershipId, name) {
    try {
      await api.post(`/memberships/${membershipId}/reject`)
      showToast(`Rejected registration for ${name}`, 'info')
      reloadData()
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not reject request', 'error')
    }
  }

  // Download/export receipts pack directly without any pop-up modal
  function handleDownloadReceiptsPack() {
    if (!isPresident) {
      showToast('Only the Club President can export CSV files', 'error')
      return
    }
    if (!expenses.length) {
      showToast('No archived receipts found for this club', 'info')
      return
    }
    const csvHeader = 'Receipt ID,Date,Description,Category,Amount,Submitted By\n'
    const csvRows = expenses
      .map(
        (e) =>
          `REC-${(e.id || '').slice(0, 8).toUpperCase()},${e.expenseDate || ''},"${(e.description || '').replace(/"/g, '""')}",${e.category || 'General'},${e.amount || 0},"${(e.loggedByName || user?.name || 'Officer').replace(/"/g, '""')}"`,
      )
      .join('\n')
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `receipts_pack_${selectedClubId || 'club'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Receipts pack downloaded')
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

  if (!initialLoading && !canAccess) {
    const hasOtherOfficerClub = officerMemberships.length > 0
    return (
      <div className={isEmbedded ? 'p-6 text-center' : 'mx-auto max-w-2xl p-6 py-16 md:p-12 text-center'}>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 mb-4 shadow-xs">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
          {hasOtherOfficerClub ? 'Officer Access Restricted' : 'Club Position Members Only'}
        </h1>
        <p className="mt-2 text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {hasOtherOfficerClub
            ? 'You do not hold an officer position in this club. You can only view financial records for clubs where you are an active officer, or where the Club President has enabled member visibility.'
            : 'The Budget & Finance section is restricted to club position holders (President, Vice President, Secretary, Treasurer), Faculty Advisors, and Super Admins. The Club President can enable member visibility in Club Settings.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {hasOtherOfficerClub && (
            <button
              type="button"
              onClick={() => setSelectedClubId(officerMemberships[0].clubId)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4f46e5]"
            >
              Switch to {officerMemberships[0].clubName || 'My Club'}
            </button>
          )}
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

  if (clubs.length === 0) {
    return (
      <div className="mx-auto max-w-xl p-4 py-16 md:p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          No Clubs Available
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          There are currently no active clubs to view finances for.
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

  const progressPercent =
    totalAllocatedBudget > 0
      ? Math.min(100, Math.max(0, (remainingFunds / totalAllocatedBudget) * 100))
      : 0

  return (
    <div className={isEmbedded ? 'space-y-6' : 'mx-auto max-w-7xl p-6 md:p-8 pb-28'}>
      {/* Hidden marker for vitest */}
      <span className="sr-only">Budget & Finance</span>

      {/* Breadcrumbs - only when not embedded inside a club tab */}
      {!isEmbedded && (
        <Breadcrumbs
          items={[
            { label: 'Home', to: '/' },
            ...(selectedClubId && clubs.some((c) => c.id === selectedClubId)
              ? [
                  {
                    label: clubs.find((c) => c.id === selectedClubId)?.name || 'Club',
                    to: `/clubs/${selectedClubId}`,
                  },
                ]
              : []),
            { label: 'Budget & Finance' },
          ]}
        />
      )}

      {/* Header with Title, Fiscal Year Dropdown, and Add Button */}
      {isEmbedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">
              Budget &amp; Finance
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Synchronized society financial ledger, income streams, and event budget allocations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to={`/clubs/${selectedClubId || embeddedClubId}/budget`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#6366f1]" />
              <span>Open Full Dashboard</span>
            </Link>

            {/* Fiscal Year Selector */}
            <div className="relative">
              <select
                aria-label="Fiscal Year"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-7 text-xs font-semibold text-slate-700 shadow-xs outline-none hover:bg-slate-50 focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="All Time">All Time</option>
                <option value="FY 2026 / 2027">FY 2026 / 2027</option>
                <option value="FY 2025 / 2026">FY 2025 / 2026</option>
                <option value="FY 2024 / 2025">FY 2024 / 2025</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {(isPresident || isFacultyAdvisor || isSuperAdmin) && (
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}

            {isPresident && (
              <button
                type="button"
                onClick={() => setLogModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#6366f1] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
              >
                <Plus className="h-4 w-4" />
                Log Transaction
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white md:text-3xl">
              Budget & Finance
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Review allocations, log expenses, and dispatch funding approvals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Club Selector when user manages multiple clubs */}
            {clubs.length > 1 ? (
              <div className="relative">
                <select
                  aria-label="Select Club"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  className="appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-700 shadow-xs outline-none hover:bg-slate-50 focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              </div>
            ) : clubs.length === 1 ? (
              <div className="hidden sm:inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {clubs[0].name}
              </div>
            ) : null}

            {/* Fiscal Year Selector */}
            <div className="relative">
              <select
                aria-label="Fiscal Year"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-8 text-xs font-semibold text-slate-700 shadow-xs outline-none hover:bg-slate-50 focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="All Time">All Time</option>
                <option value="FY 2026 / 2027">FY 2026 / 2027</option>
                <option value="FY 2025 / 2026">FY 2025 / 2026</option>
                <option value="FY 2024 / 2025">FY 2024 / 2025</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {isPresident && (
              <button
                type="button"
                onClick={() => setLogModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#4f46e5]"
              >
                <Plus className="h-4 w-4" />
                Log Expense / Add
              </button>
            )}
          </div>
        </div>
      )}

      {/* President Member Budget Visibility Control Section */}
      {(isPresident || isFacultyAdvisor || isSuperAdmin) && (
        <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/30 to-white p-4 sm:p-5 shadow-xs dark:border-indigo-950/60 dark:from-[#181b28] dark:via-[#151722] dark:to-[#12141c]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-xs transition-colors ${
                  currentClub?.showBudgetToMembers
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'
                }`}
              >
                {currentClub?.showBudgetToMembers ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Student Member Budget Visibility
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      currentClub?.showBudgetToMembers
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {currentClub?.showBudgetToMembers ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Visible to Students
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Hidden from Students
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                  {currentClub?.showBudgetToMembers
                    ? 'All enrolled student club members can see this entire budget section (treasury balance, inflow/outflow charts, full transaction ledger, and receipts).'
                    : 'Budget & financials are currently hidden from general students. Only club leadership (President, Treasurer, VP) and Faculty Advisors can access this page.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              {isPresident ? (
                <button
                  type="button"
                  disabled={togglingVisibility}
                  onClick={handleToggleMemberVisibility}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-xs transition-all ${
                    currentClub?.showBudgetToMembers
                      ? 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:bg-slate-900 dark:text-rose-400 dark:hover:bg-rose-950/30'
                      : 'bg-[#6366f1] text-white hover:bg-[#4f46e5]'
                  }`}
                >
                  {currentClub?.showBudgetToMembers ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span>Hide for Students</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>Show for Students</span>
                    </>
                  )}
                </button>
              ) : isFacultyAdvisor || isSuperAdmin ? (
                <div className="flex flex-col items-start sm:items-end gap-1">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-2 text-xs font-bold text-indigo-700 shadow-2xs dark:border-indigo-900/60 dark:bg-indigo-950/50 dark:text-indigo-300">
                    <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>{isSuperAdmin ? 'Admin View Only' : 'Advisor View Only'}</span>
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    Only President can toggle visibility
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Banner for normal members when President enabled public budget */}
      {isMemberWithPublicBudget && !hasPositionInSelectedClub && !isSuperAdmin && !isFacultyAdvisor && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Public Club Budget — Member Transparency Mode
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                The Club President has enabled member visibility. Enrolled students of this club can view the balance, expenditures, and financial ledger.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4 Top KPI Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Allocated Budget */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Allocated Budget</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              ${totalAllocatedBudget.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-500">
              <span className="text-sm">↗</span>{' '}
              {totalAllocatedBudget > 0 ? 'Active allocation' : 'Zero balance'}
            </span>
          </div>
        </div>

        {/* Card 2: Total Spent */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Spent</p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              ${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-500">
              <span className="text-sm">↗</span> {spentPercentage}% of total
            </span>
          </div>
        </div>

        {/* Card 3: Remaining Funds with Progress Bar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Remaining Funds</p>
          <div className="mt-2">
            <span className="text-3xl font-bold tracking-tight text-emerald-500">
              ${remainingFunds.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Pending Request Approvals or Total Activity */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {isPresident ? 'Pending Request Approvals' : 'Total Transactions'}
          </p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {isPresident ? pendingRequests.length : expenses.length}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                isPresident
                  ? pendingRequests.length > 0
                    ? 'text-rose-500'
                    : 'text-emerald-500'
                  : 'text-emerald-500'
              }`}
            >
              <span className="text-sm">↗</span>{' '}
              {isPresident
                ? pendingRequests.length > 0
                  ? 'Requires action'
                  : 'Up to date'
                : `${expenses.length} recorded`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left (Expense & Income History Table) & Right (Allocation & Approvals) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Expense & Income History (2 cols wide) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Expense History & Incomes</h2>
              <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterTab('ALL')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    filterTab === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  All ({expenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('INCOME')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    filterTab === 'INCOME'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  Incomes ({expenses.filter((e) => e.type === 'INCOME').length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('EXPENSE')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    filterTab === 'EXPENSE'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                  }`}
                >
                  Expenses ({expenses.filter((e) => !e.type || e.type === 'EXPENSE').length})
                </button>
              </div>
            </div>

            {(isPresident || isFacultyAdvisor || isSuperAdmin) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleDownloadReceiptsPack}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  View Receipts Pack
                </button>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">DATE</th>
                    <th className="px-4 py-3">TYPE</th>
                    <th className="px-4 py-3">DESCRIPTION</th>
                    <th className="px-4 py-3">CATEGORY</th>
                    <th className="px-4 py-3">EVENT</th>
                    <th className="px-4 py-3">AMOUNT</th>
                    <th className="px-4 py-3">STATUS</th>
                    <th className="px-4 py-3 text-right">SUBMITTED BY</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No transactions logged yet for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((e) => {
                      const isIncome = e.type === 'INCOME'
                      return (
                        <tr
                          key={e.id}
                          className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {formatDate(e.expenseDate)}
                          </td>
                          <td className="px-4 py-3">
                            {isIncome ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                <ArrowUpRight className="h-3 w-3" /> Income
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                                <ArrowDownRight className="h-3 w-3" /> Expense
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white max-w-[180px] truncate">
                            {e.description}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {e.category || 'General'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-400 truncate max-w-[130px]">
                            {e.eventTitle || '—'}
                          </td>
                          <td className="px-4 py-3 font-bold">
                            {isIncome ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                +${Number(e.amount).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-900 dark:text-white">
                                -${Number(e.amount).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Approved
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                {e.loggedByName || user?.name || 'Officer'}
                              </span>
                              {isPresident && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteExpense(e.id)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1 rounded-md"
                                  title="Delete expense"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Stacked Cards (Budget Allocation & Recent Approvals) */}
        <div className="space-y-6">
          {/* Card 1: Budget Allocation */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Budget Allocation
            </h2>
            <BudgetDonut total={totalSpent} categories={categoryBreakdown} />
          </div>

          {/* Card 2: Recent Approvals / Recent Financial Transactions */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
              Recent Approvals {isPresident ? `(${pendingRequests.length})` : ''}
            </h2>

            {!isPresident ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Approval actions are restricted to the Club President.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No pending approval requests for this club.
                  </div>
                ) : (
                  pendingRequests.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 to-[#6366f1] text-xs font-semibold text-white shadow-xs">
                          {(item.userName || item.name || 'U')[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {item.userName || item.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {item.userEmail || `Applicant • ${formatDate(item.joinedAt)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReviewMember(item.id, true)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400"
                          title="Approve Member"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewMember(item.id, false)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400"
                          title="Reject Member"
                        >
                          <X className="h-3.5 w-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Budgets & Financial Performance Section */}
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Event Budgets & Financial Performance
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Incomes and expenses maintained per event. When an event is completed, any remaining unspent budget stays retained as club balance.
            </p>
          </div>
          {completedEventsRollover > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>+${completedEventsRollover.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unspent event budget retained</span>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3">EVENT</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">BUDGET ALLOCATED</th>
                <th className="px-4 py-3">EXPENSES SPENT</th>
                <th className="px-4 py-3">INCOME GENERATED</th>
                <th className="px-4 py-3">NET PROFIT / DEFICIT</th>
                <th className="px-4 py-3 text-right">REMAINING BUDGET</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(!ledger?.eventBudgets || ledger.eventBudgets.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No event budgets or linked expenses/incomes recorded yet for this club.
                  </td>
                </tr>
              ) : (
                ledger.eventBudgets.map((b) => {
                  const hasBudget = b.budget !== null && b.budget !== undefined
                  const remaining = Number(b.remaining || 0)
                  const net = Number(b.net !== undefined ? b.net : (Number(b.income || 0) - Number(b.spent || 0)))
                  return (
                    <tr key={b.eventId || b.title} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {b.title}
                      </td>
                      <td className="px-4 py-3">
                        {b.completed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Check className="h-3 w-3 text-emerald-500" /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                            Active / Upcoming
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                        {hasBudget ? `$${Number(b.budget).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-rose-600 dark:text-rose-400">
                        ${Number(b.spent || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400">
                        ${Number(b.income || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        <span className={net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                          {net >= 0 ? `+$${net.toFixed(2)}` : `-$${Math.abs(net).toFixed(2)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasBudget ? (
                          <div className="flex flex-col items-end">
                            <span className={`font-bold ${remaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                              ${remaining.toFixed(2)}
                            </span>
                            {b.completed && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {remaining >= 0 ? 'Retained in Club Balance' : 'Over Budget'}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense / Income Modal (President only) */}
      {logModalOpen && isPresident && (
        <Modal
          onClose={() => setLogModalOpen(false)}
          title={entryType === 'INCOME' ? 'Log Society Income' : 'Log Society Expense'}
        >
          <form onSubmit={handleLogExpenseSubmit} className="space-y-4">
            {/* Segmented type switcher: Expense vs Income */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => handleTypeChange('EXPENSE')}
                className={`flex items-center justify-center rounded-lg py-2 text-xs font-semibold transition-all ${
                  entryType === 'EXPENSE'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Expense (-$)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('INCOME')}
                className={`flex items-center justify-center rounded-lg py-2 text-xs font-semibold transition-all ${
                  entryType === 'INCOME'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Income (+$$)
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {entryType === 'INCOME'
                ? 'Record a sponsorship grant, university allocation, merchandise sale, or fundraiser.'
                : 'Record an operational purchase, event booking, or equipment invoice.'}
            </p>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Description
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={entryType === 'INCOME' ? 'e.g. Annual Hackathon Sponsor' : 'e.g. Workshop Materials'}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {(entryType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Date
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Linked Event (Optional)
                </label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-[#6366f1] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">None (General Club)</option>
                  {clubEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLogModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={submittingExpense}>
                {entryType === 'INCOME' ? 'Save Income Record' : 'Save Expense Record'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default BudgetFinancePage

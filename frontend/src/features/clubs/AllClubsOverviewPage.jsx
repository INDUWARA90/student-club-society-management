import {
  CheckCircle2,
  Clock,
  Filter,
  GraduationCap,
  Search,
  Shield,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import Skeleton from '../../components/ui/Skeleton'
import StatCard from '../../components/ui/StatCard'
import ClubCard from './ClubCard'

export default function AllClubsOverviewPage() {
  const user = useSelector((state) => state.auth?.user)
  const [clubs, setClubs] = useState([])
  const [status, setStatus] = useState('loading')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [selectedStatus, setSelectedStatus] = useState('ALL')

  useEffect(() => {
    setStatus('loading')
    api
      .get('/clubs/all')
      .then((res) => {
        setClubs(Array.isArray(res.data) ? res.data : [])
        setStatus('succeeded')
      })
      .catch(() => setStatus('failed'))
  }, [])

  // Categories dynamically derived from returned clubs
  const categories = useMemo(() => {
    const set = new Set()
    clubs.forEach((c) => {
      if (c.category) set.add(c.category)
    })
    return Array.from(set)
  }, [clubs])

  // Filtered clubs
  const filteredClubs = useMemo(() => {
    return clubs.filter((club) => {
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const matchName = club.name?.toLowerCase().includes(q)
        const matchDesc = club.description?.toLowerCase().includes(q)
        const matchCat = club.category?.toLowerCase().includes(q)
        if (!matchName && !matchDesc && !matchCat) return false
      }

      // Category filter
      if (selectedCategory !== 'ALL' && club.category !== selectedCategory) {
        return false
      }

      // Status filter
      if (selectedStatus !== 'ALL' && club.status !== selectedStatus) {
        return false
      }

      return true
    })
  }, [clubs, search, selectedCategory, selectedStatus])

  // Overview metrics
  const totalClubs = clubs.length
  const approvedCount = clubs.filter((c) => c.status === 'APPROVED').length
  const pendingCount = clubs.filter((c) => c.status === 'PENDING').length
  const totalCategories = categories.length

  const hasActiveFilters = search.trim() !== '' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL'

  function handleResetFilters() {
    setSearch('')
    setSelectedCategory('ALL')
    setSelectedStatus('ALL')
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs md:text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 font-medium">
          Home
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-semibold text-slate-900 dark:text-white">Clubs</span>
      </div>

      {/* Hero Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-200/80 bg-gradient-to-r from-purple-50 via-indigo-50/40 to-purple-50 p-6 md:p-8 shadow-xs dark:border-purple-900/40 dark:bg-gradient-to-r dark:from-[#1b1735] dark:via-[#251d48] dark:to-[#1b1735]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white/80 px-3 py-1 text-xs font-bold text-purple-700 shadow-2xs backdrop-blur-xs dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
              <Shield className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Faculty Oversight &amp; Society Governance</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              All Clubs &amp; Societies
            </h1>
            <p className="text-xs md:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              University-wide directory of all student-led organizations. Monitor active societies, inspect club
              activities, and supervise governance and event compliance.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <Link
              to="/advisor/pending-events"
              className="inline-flex items-center gap-2 rounded-xl bg-[#6366f1] px-4 py-2.5 text-xs md:text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5] hover:shadow-md"
            >
              <Clock className="h-4 w-4" />
              <span>Pending Event Approvals</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Total Registered Societies"
          value={totalClubs}
          icon={Users}
          tone="indigo"
          trend={`${totalClubs} organizations`}
          trendLabel="on campus"
        />
        <StatCard
          label="Approved & In Good Standing"
          value={approvedCount}
          icon={CheckCircle2}
          tone="emerald"
          trend="Active"
          trendLabel="chartered societies"
        />
        <StatCard
          label="Pending Charter Review"
          value={pendingCount}
          icon={Clock}
          tone="amber"
          trend={pendingCount > 0 ? 'Action Needed' : 'All clear'}
          trendLabel={pendingCount > 0 ? 'proposals awaiting review' : 'no pending reviews'}
          to="/advisor/clubs"
        />
        <StatCard
          label="Distinct Disciplines"
          value={totalCategories || 1}
          icon={GraduationCap}
          tone="purple"
          trend="Diverse"
          trendLabel="activity domains"
        />
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Live Search Input */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clubs by name, description, or category..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-9 text-xs sm:text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#6366f1] focus:bg-white focus:ring-2 focus:ring-[#6366f1]/20 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Results count & Clear button */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Showing {filteredClubs.length} of {clubs.length} clubs
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-[#6366f1] hover:underline dark:text-indigo-400"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Categories and Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5" /> Filter by:
          </span>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-[#6366f1] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#6366f1] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* Status Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Statuses' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'PENDING', label: 'Pending' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStatus(st.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedStatus === st.id
                    ? 'border border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : 'border border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {status === 'loading' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24] space-y-4"
            >
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-5 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {status !== 'loading' && filteredClubs.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs dark:border-slate-800 dark:bg-[#181b24]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
            <Shield className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
            {clubs.length === 0 ? 'No clubs registered yet' : 'No clubs match your filters'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            {clubs.length === 0
              ? 'When student organizations register and are approved on campus, they will appear here under your oversight.'
              : 'Try adjusting your search keywords, category, or status filter to see other societies.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-4 rounded-xl bg-[#6366f1] px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#4f46e5]"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Clubs Grid matching design mockup */}
      {status !== 'loading' && filteredClubs.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club}
              user={user}
              showStatus={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}

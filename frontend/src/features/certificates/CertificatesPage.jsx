import { Award, CheckCircle2, Download, ExternalLink, Eye, Printer, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link } from 'react-router-dom'
import api from '../../api/axios'
import EmptyState from '../../components/ui/EmptyState'
import Skeleton from '../../components/ui/Skeleton'
import { useToast } from '../../components/ToastProvider'
import { fetchMyCertificates } from './certificatesSlice'

function formatDate(iso) {
  if (!iso) return 'Recent'
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return 'Recent'
  }
}

/** Theme configuration based on club category */
function getClubCategoryTheme(category) {
  const cat = (category || '').toLowerCase()
  if (cat.includes('tech') || cat.includes('coding') || cat.includes('robot') || cat.includes('stem') || cat.includes('comput')) {
    return {
      name: 'Technology',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
      gradient: 'from-indigo-600 via-indigo-700 to-sky-700',
      borderAccent: 'border-indigo-200 dark:border-indigo-900/60',
      glow: 'shadow-indigo-500/20',
      ribbon: 'TECHNOLOGY & INNOVATION DIVISION',
      accentColor: '#4f46e5',
      sealColor: 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    }
  }
  if (cat.includes('art') || cat.includes('cultur') || cat.includes('music') || cat.includes('drama') || cat.includes('design')) {
    return {
      name: 'Arts & Culture',
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
      gradient: 'from-rose-600 via-pink-700 to-amber-700',
      borderAccent: 'border-rose-200 dark:border-rose-900/60',
      glow: 'shadow-rose-500/20',
      ribbon: 'CREATIVE ARTS & CULTURAL DIVISION',
      accentColor: '#e11d48',
      sealColor: 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    }
  }
  if (cat.includes('sport') || cat.includes('athlet') || cat.includes('fitness') || cat.includes('recreat')) {
    return {
      name: 'Sports & Athletics',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
      gradient: 'from-emerald-600 via-teal-700 to-green-700',
      borderAccent: 'border-emerald-200 dark:border-emerald-900/60',
      glow: 'shadow-emerald-500/20',
      ribbon: 'ATHLETICS & RECREATION DIVISION',
      accentColor: '#059669',
      sealColor: 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    }
  }
  if (cat.includes('acad') || cat.includes('scienc') || cat.includes('debat') || cat.includes('business') || cat.includes('financ')) {
    return {
      name: 'Academic & Professional',
      badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
      gradient: 'from-blue-700 via-indigo-800 to-amber-600',
      borderAccent: 'border-blue-200 dark:border-blue-900/60',
      glow: 'shadow-blue-500/20',
      ribbon: 'ACADEMIC SOCIETIES COUNCIL',
      accentColor: '#2563eb',
      sealColor: 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    }
  }
  return {
    name: category || 'Student Society',
    badge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    gradient: 'from-violet-600 via-purple-700 to-indigo-700',
    borderAccent: 'border-violet-200 dark:border-violet-900/60',
    glow: 'shadow-violet-500/20',
    ribbon: 'STUDENT CLUBS & SOCIETIES ASSOCIATION',
    accentColor: '#7c3aed',
    sealColor: 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  }
}

function DemoSignature({ variant = 'administrator' }) {
  const path = variant === 'advisor'
    ? 'M8 31c8-19 13-22 16-8 2 11 4-16 11-17 6-1-5 27 5 23 7-3 5-18 10-18 6 0-4 20 7 15 7-3 10-11 15-5 5 5-7 15 7 10 9-5 15-11 24-2'
    : 'M9 30c7-16 12-24 16-20 6 6-6 24 2 20 8-4 7-24 14-23 7 1-7 27 5 21 9-5 6-17 13-15 8 2-6 19 6 16 8-2 9-10 15-7 5 3-6 12 9 8 11-4 15-7 22-3'

  return (
    <svg
      aria-label="Demo signature"
      className="mx-auto -mb-px h-7 w-28 sm:w-36"
      viewBox="0 0 120 38"
      fill="none"
      role="img"
    >
      <path d={path} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 34c22-3 54-3 89-1" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

function CertificatesPage() {
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.certificates)
  const { showToast } = useToast()
  const [downloadingId, setDownloadingId] = useState(null)
  const [previewCert, setPreviewCert] = useState(null)

  useEffect(() => {
    dispatch(fetchMyCertificates())
  }, [dispatch])

  const uniqueClubsCount = useMemo(() => {
    const set = new Set(items.map((c) => c.clubId || c.clubName))
    return set.size
  }, [items])

  async function handleDownload(certificate) {
    setDownloadingId(certificate.id)
    try {
      const res = await api.get(`/certificates/${certificate.id}/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(certificate.clubName || 'club').replace(/\s+/g, '-')}-certificate.pdf`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch {
      showToast('Could not download certificate', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
      {/* Breadcrumb Top */}
      <div className="flex items-center gap-2 text-xs md:text-sm">
        <Link to="/" className="text-slate-400 hover:text-slate-600 dark:text-slate-500 font-medium">
          Home
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-semibold text-slate-900 dark:text-white">Certificates</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            My Certificates
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500 dark:text-slate-400">
            Official completion and merit certificates earned through active society engagement and event participation.
          </p>
        </div>

        <Link
          to="/events"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 self-start md:self-center"
        >
          <span>Explore More Events</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Summary Metrics Row (when items exist) */}
      {status !== 'loading' && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Earned</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{items.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Verified Credentials</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{items.length}</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/40 dark:text-indigo-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Societies Honored</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{uniqueClubsCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24] space-y-4"
            >
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <Skeleton className="h-5 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {status !== 'loading' && items.length === 0 && (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-8 md:p-12 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
          <EmptyState
            icon={Award}
            title="No certificates earned yet"
            description="You will automatically earn a verified certificate for every event you attend."
          />
          <div className="mt-6 text-center">
            <Link
              to="/events"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#a855f7] px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-xs hover:shadow-md transition-all"
            >
              <span>Explore Upcoming Events</span>
            </Link>
          </div>
        </div>
      )}

      {/* Certificates Grid */}
      {status !== 'loading' && items.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((certificate) => {
            const theme = getClubCategoryTheme(certificate.clubCategory)
            return (
              <div
                key={certificate.id}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border bg-white p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:bg-[#181b24] ${theme.borderAccent}`}
              >
                {/* Decorative Top Accent Stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${theme.gradient}`} />

                <div className="space-y-4">
                  {/* Top Row: Club Logo / Icon + Category Pill & Verified Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {certificate.clubLogoB64 ? (
                        <img
                          src={certificate.clubLogoB64}
                          alt={certificate.clubName}
                          className="h-12 w-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                      ) : (
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.gradient} text-white shadow-md ${theme.glow}`}
                        >
                          <Award className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${theme.badge}`}
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          {certificate.clubCategory || theme.name}
                        </span>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>

                  {/* Society Name & Certificate Info */}
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-[#6366f1] dark:text-white dark:group-hover:text-[#818cf8] transition-colors line-clamp-1">
                      {certificate.eventTitle || certificate.clubName}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {certificate.eventTitle ? `Organized by ${certificate.clubName}` : 'Certificate of Event Attendance'}
                    </p>
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      Awarded on {formatDate(certificate.issuedAt)}
                    </p>
                  </div>

                  {/* Verification Code Box */}
                  {certificate.verificationCode && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-900/50 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Code</span>
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide">
                        {certificate.verificationCode}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons Row */}
                <div className="mt-6 flex flex-col gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewCert(certificate)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                      title="View Parchment Certificate"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-500" />
                      <span>View</span>
                    </button>

                    {certificate.verificationCode && (
                      <Link
                        to={`/verify-certificate/${certificate.verificationCode}`}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800 transition-all"
                        title="Public Certificate Verification"
                      >
                        <span>Verify</span>
                        <ExternalLink className="h-3 w-3 text-slate-400" />
                      </Link>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={downloadingId === certificate.id}
                    onClick={() => handleDownload(certificate)}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${theme.gradient} py-2.5 px-3 text-xs font-semibold text-white shadow-xs hover:opacity-95 transition-all disabled:opacity-60`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{downloadingId === certificate.id ? 'Downloading…' : 'Download PDF'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Interactive Certificate View Modal */}
      {previewCert && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm overflow-y-auto"
          onClick={() => setPreviewCert(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-3xl bg-white p-4 sm:p-8 shadow-2xl dark:bg-[#12151e] dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header Actions */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Award className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Official Society Certificate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewCert(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Parchment Diploma Frame */}
            {(() => {
              const theme = getClubCategoryTheme(previewCert.clubCategory)
              return (
                <div className="mt-4 rounded-2xl border-4 border-amber-500/30 bg-gradient-to-b from-[#fdfbf7] to-[#f9f5ec] p-6 sm:p-10 text-center text-slate-900 shadow-inner dark:from-[#1e2230] dark:to-[#171a26] dark:text-slate-100">
                  <div className="rounded-xl border border-dashed border-amber-600/40 p-6 sm:p-8 relative">
                    {/* Club Category Ribbon */}
                    <div className="text-[10px] font-bold tracking-widest text-amber-700 dark:text-amber-400 uppercase">
                      [ {theme.ribbon} ]
                    </div>
                    <div className="mt-1 text-xs font-semibold tracking-wider text-slate-600 dark:text-slate-400 uppercase">
                      Student Clubs & Societies Association
                    </div>

                    {/* Certificate Title */}
                    <h2 className="mt-4 text-xl sm:text-2xl font-serif font-bold tracking-tight text-slate-900 dark:text-white">
                      Certificate of Merit & Participation
                    </h2>
                    <div className="mx-auto mt-2 h-0.5 w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

                    <p className="mt-4 text-xs italic text-slate-500 dark:text-slate-400">
                      This certificate is proudly conferred upon
                    </p>

                    {/* Recipient Name */}
                    <p className="mt-2 font-serif text-2xl sm:text-3xl font-extrabold tracking-wide text-slate-900 dark:text-white underline decoration-amber-500 decoration-1 underline-offset-8">
                      {previewCert.holderName || 'Honored Student'}
                    </p>

                    <p className="mt-4 max-w-lg mx-auto text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      for commendable dedication, active participation, and meritorious engagement in
                    </p>

                    {/* Club Name */}
                    <div className="mt-2 flex items-center justify-center gap-2">
                      {previewCert.clubLogoB64 && (
                        <img
                          src={previewCert.clubLogoB64}
                          alt=""
                          className="h-7 w-7 rounded-lg object-cover border border-amber-500/30 shadow-xs"
                        />
                      )}
                      <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-amber-300">
                        {previewCert.eventTitle || previewCert.clubName}
                      </p>
                    </div>

                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {previewCert.clubName} &bull; Verified Event Attendance
                    </p>

                    <p className="mt-2 text-[11px] text-slate-400">
                      Officially conferred on {formatDate(previewCert.issuedAt)}
                    </p>

                    {/* Signatures & Seal Section */}
                    <div className="mt-8 grid grid-cols-3 items-end gap-2 text-center text-xs">
                      <div>
                        <DemoSignature />
                        <div className="mx-auto w-24 sm:w-32 border-b border-slate-400 dark:border-slate-600" />
                        <p className="mt-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">Club Administrator</p>
                        <p className="text-[10px] text-slate-400 truncate">Demo signature · {previewCert.clubName}</p>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50 shadow-md dark:bg-amber-950/60 dark:border-amber-400">
                          <Award className="h-6 w-6 text-amber-600 dark:text-amber-300" />
                        </div>
                        <span className="mt-1 text-[9px] font-bold tracking-wider text-amber-700 dark:text-amber-400 uppercase">
                          Verified Seal
                        </span>
                      </div>

                      <div>
                        <DemoSignature variant="advisor" />
                        <div className="mx-auto w-24 sm:w-32 border-b border-slate-400 dark:border-slate-600" />
                        <p className="mt-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">Faculty Advisor</p>
                        <p className="text-[10px] text-slate-400">Demo signature · Office of Student Affairs</p>
                      </div>
                    </div>

                    {/* Bottom Security Code */}
                    {previewCert.verificationCode && (
                      <div className="mt-6 pt-3 border-t border-dashed border-amber-500/30 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
                        <span className="font-mono">
                          Verification Code: <strong className="text-slate-700 dark:text-slate-200">{previewCert.verificationCode}</strong>
                        </span>
                        <Link
                          to={`/verify-certificate/${previewCert.verificationCode}`}
                          className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          <span>Public Verification</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Modal Footer Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Close Preview
              </button>
              <button
                type="button"
                disabled={downloadingId === previewCert.id}
                onClick={() => handleDownload(previewCert)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#a855f7] px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:opacity-95 disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{downloadingId === previewCert.id ? 'Downloading…' : 'Download PDF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CertificatesPage

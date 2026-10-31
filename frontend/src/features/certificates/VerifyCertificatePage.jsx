import { Award, BadgeCheck, CheckCircle2, ExternalLink, ShieldCheck, ShieldX, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'

/** Public page (no login) that confirms whether a certificate code printed on a PDF is genuine. */
function VerifyCertificatePage() {
  const { code } = useParams()
  const [result, setResult] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api
      .get(`/certificates/verify/${encodeURIComponent(code)}`)
      .then((res) => setResult(res.data))
      .catch(() => setFailed(true))
  }, [code])

  return (
    <div className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="w-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-xl dark:border-slate-800/80 dark:bg-[#181b24]">
        {/* Loading state */}
        {!result && !failed && (
          <div className="py-8 space-y-3">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#6366f1]" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Checking certificate…</p>
          </div>
        )}

        {/* Failed check error state */}
        {failed && (
          <div className="py-6 space-y-3">
            <ShieldX className="mx-auto h-12 w-12 text-rose-500" />
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
              Could not check this certificate right now. Please try again.
            </p>
          </div>
        )}

        {/* Genuine Certificate State */}
        {result?.valid && (
          <div className="space-y-6">
            {/* Top Verified Shield */}
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-md shadow-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-400">
                <BadgeCheck className="h-10 w-10 text-success" />
              </div>
              <h1 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Genuine certificate
              </h1>
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-100/70 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified Student Credential
              </span>
            </div>

            {/* Certificate Parchment Details Box */}
            <div className="rounded-2xl border-2 border-amber-500/30 bg-gradient-to-b from-[#fdfbf7] to-[#f9f5ec] p-6 text-slate-900 shadow-inner dark:from-[#1e2230] dark:to-[#171a26] dark:text-slate-100">
              {/* Category / Division Ribbon */}
              <div className="flex items-center justify-center gap-2">
                {result.clubCategory && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-amber-700 dark:text-amber-300 uppercase">
                    <Sparkles className="h-3 w-3" />
                    {result.clubCategory} Society
                  </span>
                )}
              </div>

              {/* Recipient Name */}
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-slate-400">Issued To</p>
                <p className="mt-1 font-serif text-2xl font-bold text-slate-900 dark:text-white">
                  {result.holderName}
                </p>
              </div>

              {/* Society & Date Citation */}
              <div className="mt-4 pt-3 border-t border-dashed border-amber-500/30">
                <div className="flex items-center justify-center gap-2">
                  {result.clubLogoB64 && (
                    <img
                      src={result.clubLogoB64}
                      alt=""
                      className="h-6 w-6 rounded-md object-cover border border-amber-500/30"
                    />
                  )}
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {result.clubName} — issued {new Date(result.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Active Society Participation &amp; Attendance Merit
                </p>
              </div>

              {/* Security ID Stamp */}
              <div className="mt-4 rounded-xl border border-slate-200/80 bg-white/70 p-2.5 text-xs font-mono text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                Code: <strong>{code}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Not Found / Invalid Certificate State */}
        {result && !result.valid && (
          <div className="py-6 space-y-4">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <ShieldX className="h-10 w-10 text-danger" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Certificate not found</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No certificate matches this code. It may be mistyped or forged.
            </p>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 text-xs font-mono text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
              Checked Code: {code}
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-4 text-xs font-medium">
          <Link to="/" className="text-[#6366f1] hover:text-[#4f46e5] dark:text-[#818cf8] hover:underline">
            Back to the app
          </Link>
          <span className="text-slate-300 dark:text-slate-700">&bull;</span>
          <Link to="/events" className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            Browse Events
          </Link>
        </div>
      </div>
    </div>
  )
}

export default VerifyCertificatePage

import { BadgeCheck, ShieldX } from 'lucide-react'
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
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center p-6 text-center">
      <div className="w-full rounded-xl border border-border bg-surface p-8 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        {!result && !failed && <p className="text-sm text-ink-muted dark:text-ink-dark-muted">Checking certificate…</p>}
        {failed && <p className="text-sm text-danger">Could not check this certificate right now. Please try again.</p>}
        {result?.valid && (
          <>
            <BadgeCheck className="mx-auto h-10 w-10 text-success" />
            <h1 className="mt-3 text-lg font-semibold text-ink dark:text-ink-dark">Genuine certificate</h1>
            <p className="mt-2 text-sm text-ink dark:text-ink-dark">{result.holderName}</p>
            <p className="text-sm text-ink-muted dark:text-ink-dark-muted">
              {result.clubName} — issued {new Date(result.issuedAt).toLocaleDateString()}
            </p>
          </>
        )}
        {result && !result.valid && (
          <>
            <ShieldX className="mx-auto h-10 w-10 text-danger" />
            <h1 className="mt-3 text-lg font-semibold text-ink dark:text-ink-dark">Certificate not found</h1>
            <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">
              No certificate matches this code. It may be mistyped or forged.
            </p>
          </>
        )}
        <Link to="/" className="mt-6 inline-block text-sm text-brand-600 hover:underline">
          Back to the app
        </Link>
      </div>
    </div>
  )
}

export default VerifyCertificatePage

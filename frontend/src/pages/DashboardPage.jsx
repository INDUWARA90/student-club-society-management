import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/auth/authSlice'

function DashboardPage() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-muted p-4 dark:bg-surface-dark">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        <h1 className="text-xl font-semibold text-ink dark:text-ink-dark">
          Welcome, {user?.name}
        </h1>
        <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">
          Role-specific dashboards land in a later phase — this is a placeholder to confirm auth works end-to-end.
        </p>
        <button
          type="button"
          onClick={() => dispatch(logout())}
          className="mt-6 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
        >
          Log out
        </button>
      </div>
    </div>
  )
}

export default DashboardPage

import { useDispatch, useSelector } from 'react-redux'
import { Outlet, Link } from 'react-router-dom'
import { toggleTheme } from '../features/theme/themeSlice'
import NotificationBell from './NotificationBell'

function AppLayout() {
  const dispatch = useDispatch()
  const themeMode = useSelector((state) => state.theme.mode)

  return (
    <div className="min-h-svh bg-surface-muted dark:bg-surface-dark">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3 dark:border-border-dark dark:bg-surface-dark-muted">
        <Link to="/" className="text-sm font-semibold text-ink dark:text-ink-dark">
          Club & Society
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => dispatch(toggleTheme())}
            className="rounded-full p-2 text-ink transition-fast hover:bg-surface-muted dark:text-ink-dark dark:hover:bg-surface-dark"
            aria-label="Toggle dark mode"
          >
            {themeMode === 'dark' ? '☀️' : '🌙'}
          </button>
          <NotificationBell />
        </div>
      </header>
      <Outlet />
    </div>
  )
}

export default AppLayout

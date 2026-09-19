import { BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from './notificationsSlice'

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function NotificationsPage() {
  const dispatch = useDispatch()
  const { items, status } = useSelector((state) => state.notifications)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    dispatch(fetchNotifications())
  }, [dispatch])

  const unreadCount = items.filter((n) => !n.read).length
  const visible = filter === 'unread' ? items.filter((n) => !n.read) : items

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHeader
        title="Notifications"
        description={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
        actions={
          unreadCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => dispatch(markAllNotificationsRead())}>
              Mark all as read
            </Button>
          )
        }
      />

      <div className="mt-4 flex gap-2">
        {['all', 'unread'].map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-fast ${
              filter === key
                ? 'bg-brand-gradient text-white'
                : 'bg-surface-muted text-ink-muted hover:text-ink dark:bg-surface-dark dark:text-ink-dark-muted dark:hover:text-ink-dark'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {status !== 'loading' && visible.length === 0 && (
        <EmptyState
          icon={BellOff}
          title="No notifications"
          description={filter === 'unread' ? "You've read everything." : "You'll see updates here as they happen."}
        />
      )}

      {status !== 'loading' && visible.length > 0 && (
        <div className="mt-6 space-y-2">
          {visible.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => !n.read && dispatch(markNotificationRead(n.id))}
              className={`flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-card transition-fast hover:shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted ${
                n.read ? '' : 'ring-1 ring-brand-200 dark:ring-brand-500/30'
              }`}
            >
              <div>
                <p
                  className={`text-sm ${n.read ? 'text-ink-muted dark:text-ink-dark-muted' : 'font-medium text-ink dark:text-ink-dark'}`}
                >
                  {n.message}
                </p>
                <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">{formatDate(n.createdAt)}</p>
              </div>
              {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default NotificationsPage

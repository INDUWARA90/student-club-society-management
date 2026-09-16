import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../api/axios'
import { subscribeToNotifications } from '../api/websocket'
import { useToast } from './ToastProvider'

function NotificationBell() {
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    load()
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!user?.id) return
    const unsubscribe = subscribeToNotifications(user.id, (notification) => {
      setNotifications((prev) => [notification, ...prev])
      showToast(notification.message)
    })
    return unsubscribe
  }, [user?.id])

  function load() {
    api.get('/notifications/me').then((res) => setNotifications(res.data)).catch(() => {})
  }

  async function markRead(id) {
    await api.post(`/notifications/${id}/read`)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  async function markAllRead() {
    await api.post('/notifications/read-all')
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-full p-2 text-ink-muted transition-fast hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark dark:hover:text-ink-dark"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-white ring-2 ring-surface dark:ring-surface-dark-muted">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-border bg-surface p-2 shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="mb-1 block w-full rounded-md p-2 text-left text-xs font-medium text-brand-600 transition-fast hover:bg-surface-muted dark:hover:bg-surface-dark"
            >
              Mark all as read
            </button>
          )}
          {notifications.length === 0 && (
            <p className="p-3 text-sm text-ink-muted dark:text-ink-dark-muted">No notifications yet.</p>
          )}
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={`block w-full rounded-md p-2 text-left text-sm transition-fast hover:bg-surface-muted dark:hover:bg-surface-dark ${
                  n.read ? 'text-ink-muted dark:text-ink-dark-muted' : 'font-medium text-ink dark:text-ink-dark'
                }`}
              >
                {n.message}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell

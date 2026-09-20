import { CheckCircle2, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

const VARIANT_CLASS = {
  success: 'border-success/30 bg-surface text-ink dark:bg-surface-dark-muted dark:text-ink-dark',
  error: 'border-danger/30 bg-surface text-ink dark:bg-surface-dark-muted dark:text-ink-dark',
}

const VARIANT_ICON = {
  success: CheckCircle2,
  error: XCircle,
}

const VARIANT_ICON_CLASS = {
  success: 'text-success',
  error: 'text-danger',
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const showToast = useCallback((message, variant = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => {
          const Icon = VARIANT_ICON[t.variant] || VARIANT_ICON.success
          return (
            <div
              key={t.id}
              role={t.variant === 'error' ? 'alert' : 'status'}
              className={`toast-enter pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-card-hover backdrop-blur-sm ${VARIANT_CLASS[t.variant] || VARIANT_CLASS.success}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${VARIANT_ICON_CLASS[t.variant] || VARIANT_ICON_CLASS.success}`} />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider

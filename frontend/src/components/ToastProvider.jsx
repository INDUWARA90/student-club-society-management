import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

const VARIANT_CLASS = {
  success: 'border-success/30 bg-surface text-ink dark:bg-surface-dark-muted dark:text-ink-dark',
  error: 'border-danger/30 bg-surface text-ink dark:bg-surface-dark-muted dark:text-ink-dark',
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
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow-card-hover ${VARIANT_CLASS[t.variant] || VARIANT_CLASS.success}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider

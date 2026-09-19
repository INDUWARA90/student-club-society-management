import { X } from 'lucide-react'
import { useEffect } from 'react'

/** Accessible modal dialog: backdrop click + Esc close. */
function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} rounded-xl border border-border bg-surface p-5 shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted`}
      >
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-full p-1.5 text-ink-muted transition-fast hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark dark:hover:text-ink-dark"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

export default Modal

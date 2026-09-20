import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Accessible modal dialog: backdrop click + Esc close, focus moves into the dialog when it opens, Tab stays inside
 * it, and focus returns to whatever opened it when it closes.
 */
function Modal({ title, onClose, children, maxWidth = 'max-w-lg' }) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  // Keep the latest onClose without re-running the focus setup below on every parent render.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement
    const dialog = dialogRef.current
    const first = dialog?.querySelector('input, select, textarea') || dialog?.querySelector(FOCUSABLE)
    ;(first || dialog)?.focus()

    function handleKey(e) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll(FOCUSABLE)]
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === firstItem || document.activeElement === dialog)) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} rounded-xl border border-border bg-surface p-5 shadow-card-hover outline-none dark:border-border-dark dark:bg-surface-dark-muted`}
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

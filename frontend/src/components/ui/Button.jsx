import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'

const VARIANTS = {
  primary:
    'bg-brand-gradient text-white shadow-card hover:brightness-110 hover:shadow-card-hover disabled:hover:brightness-100',
  secondary:
    'border border-border bg-surface text-ink hover:bg-surface-muted dark:border-border-dark dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark',
  ghost:
    'text-ink-muted hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark dark:hover:text-ink-dark',
  danger: 'bg-danger text-white shadow-card hover:opacity-90',
  dangerOutline: 'border border-danger text-danger hover:bg-danger/10',
  success: 'bg-success text-white shadow-card hover:opacity-90',
}

const SIZES = {
  sm: 'gap-1 rounded-md px-3 py-1.5 text-xs',
  md: 'gap-1.5 rounded-md px-4 py-2 text-sm',
  lg: 'gap-2 rounded-lg px-5 py-2.5 text-sm',
}

/** Shared button primitive. `variant`: primary|secondary|ghost|danger|dangerOutline|success. `size`: sm|md|lg. `as`: element/component to render (e.g. react-router `Link`) instead of `<button>`. */
const Button = forwardRef(function Button(
  { as: As = 'button', variant = 'primary', size = 'md', loading = false, disabled = false, className = '', children, ...rest },
  ref,
) {
  const isButton = As === 'button'
  return (
    <As
      ref={ref}
      {...(isButton ? { type: rest.type || 'button', disabled: disabled || loading } : {})}
      className={`inline-flex items-center justify-center font-medium transition-fast disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </As>
  )
})

export default Button

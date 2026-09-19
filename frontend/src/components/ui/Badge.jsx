const TONES = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  neutral: 'bg-surface-muted text-ink-muted dark:bg-surface-dark dark:text-ink-dark-muted',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
}

/** Small status/role pill. `tone`: brand|neutral|success|warning|danger|info. */
function Badge({ tone = 'neutral', className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export default Badge

/** Shimmering placeholder block for loading states. */
function Skeleton({ className = '' }) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl border border-border/60 bg-surface-muted dark:border-border-dark/60 dark:bg-surface-dark-muted ${className}`}
    />
  )
}

export default Skeleton

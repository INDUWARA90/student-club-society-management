/** Pulsing placeholder block for loading states. */
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted ${className}`} />
}

export default Skeleton

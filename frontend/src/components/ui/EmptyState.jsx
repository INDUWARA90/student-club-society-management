/** Centered empty-state block: icon + message + optional action. */
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="mx-auto mt-12 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center dark:border-border-dark dark:bg-surface-dark-muted/40">
      {Icon && (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500 ring-8 ring-brand-50/60 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/5">
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </span>
      )}
      {title && <p className="mt-4 text-base font-semibold text-ink dark:text-ink-dark">{title}</p>}
      {description && (
        <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default EmptyState

/** Centered empty-state block: icon + message + optional action. */
function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient-soft text-brand-500">
          <Icon className="h-6 w-6" />
        </span>
      )}
      {title && <p className="mt-3 text-sm font-medium text-ink dark:text-ink-dark">{title}</p>}
      {description && (
        <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default EmptyState

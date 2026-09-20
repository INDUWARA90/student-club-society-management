/** Page title row with optional trailing actions. */
function PageHeader({ title, description, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink dark:text-ink-dark">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export default PageHeader

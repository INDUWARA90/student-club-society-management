function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-muted p-4 dark:bg-surface-dark">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        <h1 className="text-xl font-semibold text-ink dark:text-ink-dark">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-ink-muted dark:text-ink-dark-muted">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export default AuthCard

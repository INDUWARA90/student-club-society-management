import { Sparkles } from 'lucide-react'

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-surface-muted p-4 dark:bg-surface-dark">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface/90 p-8 shadow-card-hover backdrop-blur-sm dark:border-border-dark dark:bg-surface-dark-muted/90">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-card">
          <Sparkles className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <h1 className="mt-4 text-center text-xl font-semibold text-ink dark:text-ink-dark">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-center text-sm text-ink-muted dark:text-ink-dark-muted">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export default AuthCard

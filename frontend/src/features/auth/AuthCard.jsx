import { BarChart3, CalendarDays, Sparkles, Users } from 'lucide-react'

const HIGHLIGHTS = [
  { icon: CalendarDays, text: 'Plan events, collect RSVPs and check people in with a QR code' },
  { icon: Users, text: 'Manage members, officer roles and join requests' },
  { icon: BarChart3, text: 'Track attendance, budgets and club growth' },
]

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="app-backdrop grid min-h-svh lg:grid-cols-2">
      <aside
        aria-hidden="true"
        className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-white lg:flex"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute bottom-40 right-16 h-40 w-40 rounded-full bg-white/10" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold">Club &amp; Society Management</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Everything your club needs, in one place.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">Built for university clubs, societies and their advisors.</p>
      </aside>

      <main className="relative flex items-center justify-center overflow-hidden p-4">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl lg:hidden" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />

        <div className="page-enter relative w-full max-w-sm rounded-2xl border border-border bg-surface/90 p-8 shadow-card-hover backdrop-blur-sm dark:border-border-dark dark:bg-surface-dark-muted/90">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-card lg:hidden">
            <Sparkles className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <h1 className="mt-4 text-center text-xl font-semibold text-ink dark:text-ink-dark lg:mt-0">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-center text-sm text-ink-muted dark:text-ink-dark-muted">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}

export default AuthCard

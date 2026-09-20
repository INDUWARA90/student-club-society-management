/**
 * Hover readout for SVG charts, positioned inside a `relative` wrapper.
 * Values lead (strong), series names follow (secondary); rows are keyed with a short stroke.
 * All text goes through React text nodes, so labels from API data are never parsed as HTML.
 */
function ChartTooltip({ x, y = 0, width, title, rows }) {
  const half = 80
  const left = Math.min(Math.max(x, half), Math.max(width - half, half))
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-32 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-card-hover dark:border-border-dark dark:bg-surface-dark-muted"
      style={{ left, top: y }}
    >
      <p className="font-medium text-ink-muted dark:text-ink-dark-muted">{title}</p>
      <div className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <p key={row.label} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: row.color }} />
            <span className="font-semibold tabular-nums text-ink dark:text-ink-dark">{row.value}</span>
            <span className="text-ink-muted dark:text-ink-dark-muted">{row.label}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

export default ChartTooltip

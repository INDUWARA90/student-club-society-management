import { formatNumber } from './chartUtils'

/**
 * Ranked horizontal bars for nominal categories: one series, so one colour for every bar.
 * The value sits at the bar end. `items`: [{ label, value }].
 */
function BarList({ items, unit = '' }) {
  const max = Math.max(0, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-ink dark:text-ink-dark">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink dark:text-ink-dark">
              {formatNumber(item.value)}
              {unit && <span className="ml-0.5 text-xs font-normal text-ink-muted dark:text-ink-dark-muted">{unit}</span>}
            </span>
          </div>
          <div
            className="mt-1.5 h-2 w-full overflow-hidden rounded-r-[4px]"
            style={{ background: 'var(--chart-track)' }}
            role="meter"
            aria-label={item.label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={item.value}
          >
            <div
              className="h-full rounded-r-[4px]"
              style={{
                width: max > 0 ? `${(item.value / max) * 100}%` : '0%',
                background: 'var(--chart-series-1)',
                transition: 'width 320ms cubic-bezier(0.2, 0, 0, 1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default BarList

import { useState } from 'react'
import ChartTooltip from './ChartTooltip'
import { formatCompact, formatNumber, niceScale, useElementWidth } from './chartUtils'

const MARGIN = { top: 16, right: 16, bottom: 26, left: 34 }

/**
 * Single-series area line with a snapping crosshair.
 * `data`: [{ label, fullLabel?, value }] - `series`: { label, color }.
 */
function LineChart({ data, series, height = 220, ariaLabel }) {
  const [ref, width] = useElementWidth()
  const [active, setActive] = useState(null)

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 40)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const max = Math.max(0, ...data.map((d) => d.value))
  const { top, ticks } = niceScale(max)
  const n = data.length
  const x = (i) => MARGIN.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW)
  const y = (v) => MARGIN.top + plotH - (v / top) * plotH

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`)
  const line = `M${points.join(' L')}`
  const area = `${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`
  const last = data[n - 1]

  function handlePointer(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = e.clientX - rect.left - MARGIN.left
    const idx = Math.round((rel / plotW) * (n - 1))
    setActive(Math.min(Math.max(idx, 0), n - 1))
  }

  function handleKey(e) {
    if (e.key === 'ArrowRight') setActive((a) => Math.min((a ?? -1) + 1, n - 1))
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max((a ?? n) - 1, 0))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const activeDatum = active != null ? data[active] : null

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
      <svg width={width} height={height} role="group" aria-label={ariaLabel} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={y(t)}
              y2={y(t)}
              strokeWidth="1"
              style={{ stroke: t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)' }}
            />
            <text
              x={MARGIN.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="11"
              className="tabular-nums"
              style={{ fill: 'var(--chart-muted)' }}
            >
              {formatCompact(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => (
          <text
            key={d.label + i}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            style={{ fill: 'var(--chart-muted)' }}
          >
            {d.label}
          </text>
        ))}

        <path d={area} style={{ fill: series.color, opacity: 0.1 }} />
        <path
          d={line}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: series.color }}
        />

        {activeDatum && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotH}
            strokeWidth="1"
            style={{ stroke: 'var(--chart-axis)' }}
          />
        )}

        {/* End-dot always; the hovered point gets the same dot. 2px surface ring keeps it legible over the line. */}
        {[active != null ? active : n - 1].map((i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(data[i].value)}
            r="4"
            strokeWidth="2"
            style={{ fill: series.color, stroke: 'var(--chart-surface)' }}
          />
        ))}
        {active == null && last && (
          <text
            x={x(n - 1)}
            y={y(last.value) - 10}
            textAnchor="end"
            fontSize="11"
            fontWeight="600"
            className="fill-ink dark:fill-ink-dark"
          >
            {formatNumber(last.value)}
          </text>
        )}

        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotW}
          height={plotH + MARGIN.bottom}
          fill="transparent"
          tabIndex={0}
          aria-label={`${ariaLabel}. Use left and right arrow keys to read each point.`}
          onPointerMove={handlePointer}
          onPointerEnter={handlePointer}
          onKeyDown={handleKey}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          className="outline-none focus-visible:stroke-brand-500"
          strokeWidth="2"
        />
      </svg>

      {activeDatum && (
        <ChartTooltip
          x={x(active)}
          y={Math.max(y(activeDatum.value) - 58, -8)}
          width={width}
          title={activeDatum.fullLabel || activeDatum.label}
          rows={[{ label: series.label, color: series.color, value: formatNumber(activeDatum.value) }]}
        />
      )}
    </div>
  )
}

export default LineChart

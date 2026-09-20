import { useState } from 'react'
import ChartTooltip from './ChartTooltip'
import { formatCompact, formatNumber, niceScale, useElementWidth } from './chartUtils'

const MARGIN = { top: 20, right: 8, bottom: 26, left: 34 }
const MAX_BAR = 24
const BAR_GAP = 2
const RADIUS = 4

/** Rounded at the data end, square at the baseline. */
function columnPath(x, y, w, h) {
  const r = Math.min(RADIUS, h, w / 2)
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, Math.max(max - 1, 1))}…` : text
}

/**
 * Column chart for one or more series.
 * `data`: [{ label, fullLabel?, values: number[] }] - `series`: [{ label, color }] (same order as values).
 */
function ColumnChart({ data, series, height = 220, ariaLabel }) {
  const [ref, width] = useElementWidth()
  const [active, setActive] = useState(null)

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 40)
  const plotH = height - MARGIN.top - MARGIN.bottom
  const max = Math.max(0, ...data.flatMap((d) => d.values))
  const { top, ticks } = niceScale(max)
  const slot = plotW / Math.max(data.length, 1)
  const k = series.length
  const barW = Math.max(Math.min(MAX_BAR, (slot * 0.7 - BAR_GAP * (k - 1)) / k), 2)
  const groupW = k * barW + BAR_GAP * (k - 1)
  const y = (v) => MARGIN.top + plotH - (v / top) * plotH
  const maxChars = Math.max(Math.floor(slot / 6.5), 3)

  // Label only the extreme of a single-series chart; everything else lives in the tooltip and table view.
  const peakIndex =
    k === 1 && max > 0 ? data.findIndex((d) => d.values[0] === max) : -1

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

        {data.map((d, i) => {
          const slotX = MARGIN.left + i * slot
          const groupX = slotX + (slot - groupW) / 2
          const isActive = active === i
          const dimmed = active != null && !isActive
          return (
            <g key={d.label + i}>
              {isActive && (
                <rect
                  x={slotX}
                  y={MARGIN.top}
                  width={slot}
                  height={plotH}
                  rx="6"
                  style={{ fill: 'var(--chart-grid)', opacity: 0.6 }}
                />
              )}
              {d.values.map((v, s) => {
                const h = (v / top) * plotH
                if (h <= 0) return null
                return (
                  <path
                    key={series[s].label}
                    d={columnPath(groupX + s * (barW + BAR_GAP), y(v), barW, h)}
                    style={{
                      fill: series[s].color,
                      opacity: dimmed ? 0.45 : 1,
                      transition: 'opacity 120ms',
                    }}
                  />
                )
              })}
              {i === peakIndex && (
                <text
                  x={slotX + slot / 2}
                  y={y(max) - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  className="fill-ink dark:fill-ink-dark"
                >
                  {formatNumber(max)}
                </text>
              )}
              <text
                x={slotX + slot / 2}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                style={{ fill: 'var(--chart-muted)' }}
              >
                {truncate(d.label, maxChars)}
              </text>
              <rect
                x={slotX}
                y={MARGIN.top}
                width={slot}
                height={plotH + MARGIN.bottom}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.fullLabel || d.label}: ${series.map((s, idx) => `${d.values[idx]} ${s.label}`).join(', ')}`}
                onPointerEnter={() => setActive(i)}
                onPointerMove={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="outline-none focus-visible:stroke-brand-500"
                strokeWidth="2"
              />
            </g>
          )
        })}
      </svg>

      {activeDatum && (
        <ChartTooltip
          x={MARGIN.left + active * slot + slot / 2}
          y={Math.max(y(Math.max(...activeDatum.values)) - 64, -8)}
          width={width}
          title={activeDatum.fullLabel || activeDatum.label}
          rows={series.map((s, idx) => ({ label: s.label, color: s.color, value: formatNumber(activeDatum.values[idx]) }))}
        />
      )}
    </div>
  )
}

export default ColumnChart

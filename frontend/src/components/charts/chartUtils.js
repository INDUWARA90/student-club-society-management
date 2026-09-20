import { useEffect, useRef, useState } from 'react'

/** Clean axis scale: integer-friendly steps from [1, 2, 5, 10] x 10^n, at most `maxTicks` intervals. */
export function niceScale(max, maxTicks = 4) {
  if (!(max > 0)) return { top: maxTicks, ticks: Array.from({ length: maxTicks + 1 }, (_, i) => i) }
  const pow = 10 ** Math.floor(Math.log10(max / maxTicks))
  let step = pow
  for (const m of [1, 2, 5, 10]) {
    step = m * pow
    if (max / step <= maxTicks) break
  }
  const top = Math.ceil(max / step - 1e-9) * step
  const ticks = []
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { top, ticks }
}

export function formatCompact(value) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatNumber(value) {
  return new Intl.NumberFormat().format(value)
}

/** Totals items per calendar month (count by default, or the sum of `getValue`) for `before` months back through `after` ahead. */
export function monthlyCounts(items, getDate, { before = 5, after = 0, now = new Date(), getValue = () => 1 } = {}) {
  const buckets = []
  for (let offset = -before; offset <= after; offset += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      fullLabel: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      value: 0,
    })
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  items.forEach((item) => {
    const raw = getDate(item)
    if (!raw) return
    const d = new Date(raw)
    const bucket = byKey.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (bucket) bucket.value += getValue(item)
  })
  return buckets
}

/** Tracks an element's rendered width so SVG charts can lay out in real pixels. */
export function useElementWidth(initial = 480) {
  const ref = useRef(null)
  const [width, setWidth] = useState(initial)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setWidth(el.clientWidth || initial)
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || initial))
    observer.observe(el)
    return () => observer.disconnect()
  }, [initial])

  return [ref, width]
}

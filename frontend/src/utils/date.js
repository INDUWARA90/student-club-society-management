export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Builds a 6x7 grid of dates covering the given month, starting on Sunday. */
export function buildMonthGrid(monthDate) {
  const first = startOfMonth(monthDate)
  const gridStart = new Date(first)
  gridStart.setDate(first.getDate() - first.getDay())

  const days = []
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + i)
    days.push(day)
  }
  return days
}

export function formatMonthYear(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatDayNumber(date) {
  return date.getDate()
}

export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

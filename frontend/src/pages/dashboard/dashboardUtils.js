export function getClubCoverGradient(category = '') {
  const normalizedCategory = (category || '').toLowerCase()
  if (normalizedCategory.includes('tech') || normalizedCategory.includes('code') || normalizedCategory.includes('ai') || normalizedCategory.includes('cyber')) return 'from-blue-600 via-indigo-600 to-cyan-500'
  if (normalizedCategory.includes('art') || normalizedCategory.includes('cultur') || normalizedCategory.includes('photo') || normalizedCategory.includes('design')) return 'from-purple-600 via-fuchsia-600 to-pink-500'
  if (normalizedCategory.includes('sport') || normalizedCategory.includes('hik') || normalizedCategory.includes('adventur')) return 'from-emerald-600 via-teal-600 to-lime-500'
  if (normalizedCategory.includes('academ') || normalizedCategory.includes('debat') || normalizedCategory.includes('sci')) return 'from-amber-600 via-orange-600 to-yellow-500'
  return 'from-[#6366f1] via-[#7c5cfc] to-[#4f46e5]'
}

export function formatEventTime(startIso, endIso) {
  if (!startIso) return 'TBA'
  try {
    const start = new Date(startIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    if (!endIso) return start
    const end = new Date(endIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `${start} - ${end}`
  } catch {
    return 'TBA'
  }
}

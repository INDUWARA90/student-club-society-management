import { Check, Clock, MapPin, X } from 'lucide-react'
import React from 'react'
import { useNavigate } from 'react-router-dom'

function getCategoryGradient(category = '') {
  const cat = (category || '').toLowerCase()
  if (cat.includes('tech') || cat.includes('code') || cat.includes('ai') || cat.includes('hack')) {
    return 'from-blue-600 via-indigo-600 to-cyan-500'
  }
  if (cat.includes('art') || cat.includes('cultur') || cat.includes('photo') || cat.includes('design')) {
    return 'from-purple-600 via-fuchsia-600 to-pink-500'
  }
  if (cat.includes('sport') || cat.includes('hik') || cat.includes('adventur')) {
    return 'from-emerald-600 via-teal-600 to-lime-500'
  }
  if (cat.includes('academ') || cat.includes('debat') || cat.includes('sci')) {
    return 'from-amber-600 via-orange-600 to-yellow-500'
  }
  return 'from-[#6366f1] via-[#7c3aed] to-[#4f46e5]'
}

export default function EventCard({
  event,
  isGoing = false,
  onRsvpToggle,
  isFacultyAdvisor = false,
  onAdvisorReview,
  isSuperAdmin = false,
}) {
  const navigate = useNavigate()

  const dateObj = new Date(event.eventDate)
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day = dateObj.getDate()
  const locationStr = event.venueName
    ? `${event.venueName}${event.venueBuilding ? `, ${event.venueBuilding}` : ''}`
    : event.location || event.clubName || 'Campus venue'

  const gradient = getCategoryGradient(event.clubCategory || event.category || '')

  function handleCardClick() {
    navigate(`/events/${event.id}`)
  }

  function handleActionClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (onRsvpToggle) {
      onRsvpToggle(e, event)
    } else {
      navigate(`/events/${event.id}`)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg dark:border-slate-800/80 dark:bg-[#181b24] dark:hover:border-slate-700 cursor-pointer"
    >
      {/* Top Banner with Floating Date Badge */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {event.bannerB64 && event.bannerB64.startsWith('data:image') ? (
          <img
            src={event.bannerB64}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradient} p-4 text-white`}>
            <span className="text-2xl font-black uppercase tracking-wider opacity-30 select-none">
              {event.clubName || 'EVENT'}
            </span>
          </div>
        )}

        {/* Floating Date Badge (as shown in design mockup) */}
        <div className="absolute left-3.5 top-3.5 flex min-w-[44px] flex-col items-center justify-center rounded-xl bg-white/95 px-2.5 py-1.5 shadow-md backdrop-blur-xs dark:bg-[#12151e]/95 border border-slate-100/60 dark:border-slate-700/60">
          <span className="text-[10px] font-bold tracking-wider text-[#6366f1] uppercase dark:text-[#818cf8]">
            {month}
          </span>
          <span className="text-lg font-black leading-tight text-slate-900 dark:text-white">
            {day}
          </span>
        </div>

        {event.cancelled && (
          <span className="absolute right-3.5 top-3.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-xs">
            Cancelled
          </span>
        )}
        {!event.cancelled && event.approvalStatus === 'PENDING' && (
          <span className="absolute right-3.5 top-3.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white shadow-xs">
            Pending Sign-off
          </span>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-5 gap-3">
        <div>
          {/* Title */}
          <h3 className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-[#6366f1] dark:text-white dark:group-hover:text-[#818cf8] transition-colors line-clamp-1">
            {event.title}
          </h3>

          {/* Location row */}
          <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="truncate">{locationStr}</span>
          </div>
        </div>

        {/* Action Button: matches RSVP Now outline style from mockup */}
        <div className="pt-1">
          {isFacultyAdvisor && event.approvalStatus === 'PENDING' && !event.cancelled ? (
            <div
              className="flex items-center gap-2"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <button
                type="button"
                onClick={(e) => onAdvisorReview && onAdvisorReview(e, event.id, true)}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.99] flex items-center justify-center gap-1 shadow-xs"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Approve</span>
              </button>
              <button
                type="button"
                onClick={(e) => onAdvisorReview && onAdvisorReview(e, event.id, false)}
                className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-100 active:scale-[0.99] flex items-center justify-center gap-1 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reject</span>
              </button>
            </div>
          ) : isSuperAdmin ? (
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full rounded-2xl border-2 border-[#6366f1] bg-[#6366f1]/10 py-2.5 text-xs sm:text-sm font-semibold text-[#6366f1] transition-all hover:bg-[#6366f1] hover:text-white flex items-center justify-center gap-1.5 active:scale-[0.99] dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white shadow-xs"
            >
              <span>Manage Event</span>
            </button>
          ) : isFacultyAdvisor ? (
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 transition-all hover:bg-slate-100 flex items-center justify-center gap-1.5 active:scale-[0.99] dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 shadow-xs"
            >
              <span>View Event</span>
            </button>
          ) : isGoing ? (
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 py-2.5 text-xs sm:text-sm font-semibold text-emerald-600 transition-all hover:bg-emerald-100 flex items-center justify-center gap-1.5 active:scale-[0.99] dark:bg-emerald-950/30 dark:border-emerald-600 dark:text-emerald-400"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>RSVP Confirmed</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleActionClick}
              className="w-full rounded-2xl border-2 border-[#6366f1] bg-white py-2.5 text-xs sm:text-sm font-semibold text-[#6366f1] transition-all hover:bg-[#6366f1] hover:text-white flex items-center justify-center gap-1.5 active:scale-[0.99] dark:bg-transparent dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-600 dark:hover:text-white dark:hover:border-indigo-600 shadow-xs"
            >
              <span>RSVP Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

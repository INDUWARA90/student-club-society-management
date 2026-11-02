import { Clock } from 'lucide-react'

export default function EventStatusBadge({ event, isPast }) {
  if (event.cancelled) return <span className="rounded-full bg-rose-600/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md">Cancelled</span>
  if (event.approvalStatus === 'PENDING') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/95 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md"><Clock className="h-3 w-3" /> Pending Sign-off</span>
  if (event.approvalStatus === 'REJECTED') return <span className="rounded-full bg-rose-600/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md">Rejected</span>
  if (event.approvalStatus === 'APPROVED' || event.approvalStatus === 'NOT_REQUIRED') return isPast
    ? <span className="rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1 text-xs font-semibold text-slate-300 shadow-md backdrop-blur-md">Past Event</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md"><span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />Upcoming</span>
  return null
}

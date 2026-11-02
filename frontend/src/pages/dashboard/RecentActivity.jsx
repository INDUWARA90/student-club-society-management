function timeAgo(dateString) {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const seconds = Math.floor((new Date() - date) / 1000)
    if (seconds < 60) return 'Just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export default function RecentActivity({ activities }) {
  return <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800/80 dark:bg-[#181b24]">
    <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Activity</h2>
    {activities.length > 0 ? <div className="mt-4 space-y-4">{activities.map((activity) => <div key={activity.id} className="flex items-start gap-3 text-xs"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6366f1]" /><div className="min-w-0 flex-1"><div className="leading-snug text-slate-700 dark:text-slate-300">{activity.content}</div><p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{timeAgo(activity.createdAt)}</p></div></div>)}</div> : <p className="mt-4 py-4 text-center text-xs text-slate-400 dark:text-slate-500">No recent activity yet. When you join clubs, RSVP to events, or receive announcements, your activity will appear here.</p>}
  </div>
}

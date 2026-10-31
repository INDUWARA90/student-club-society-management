import { MessageSquare, Send, Trash2, Flag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'

function formatCommentDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function EventComments({ eventId, isPresident }) {
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [comments, setComments] = useState(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    api.get(`/events/${eventId}/comments`)
      .then((res) => setComments(res.data))
      .catch(() => setComments([]))
  }, [eventId])

  async function handlePost(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setPosting(true)
    try {
      const { data } = await api.post(`/events/${eventId}/comments`, { content: draft.trim() })
      setComments((prev) => [...(prev || []), data])
      setDraft('')
    } catch (e2) {
      showToast(e2.response?.data?.message || 'Something went wrong', 'error')
    } finally {
      setPosting(false)
    }
  }

  async function handleReport(commentId) {
    const reason = window.prompt('Why are you reporting this comment? The Club Admin will review it.')
    if (!reason || !reason.trim()) return
    try {
      await api.post(`/events/${eventId}/comments/${commentId}/report`, { reason: reason.trim() })
      showToast('Thanks — the Club Admin has been notified')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleDelete(commentId) {
    try {
      await api.delete(`/events/${eventId}/comments/${commentId}`)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      showToast('Comment deleted')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  const commentCount = comments?.length || 0

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-[#6366f1] dark:bg-indigo-950/40 dark:text-indigo-400">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Discussion & Questions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Leave a note, ask organisers a question, or coordinate with attendees.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {commentCount}
        </span>
      </div>

      {/* Input box */}
      <form onSubmit={handlePost} className="mt-5 flex gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366f1] to-purple-500 text-xs font-bold text-white shadow-xs">
          {(user?.name || user?.email || 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question or leave a note for other attendees..."
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none transition-all focus:border-[#6366f1] focus:ring-2 focus:ring-[#6366f1]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <Button type="submit" loading={posting} disabled={!draft.trim()} size="sm">
            <Send className="h-3.5 w-3.5" />
            <span>Post</span>
          </Button>
        </div>
      </form>

      {/* Empty State */}
      {comments?.length === 0 && (
        <div className="mt-6 py-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
            No comments yet — be the first to start the discussion!
          </p>
        </div>
      )}

      {/* Comments List */}
      <div className="mt-5 space-y-3">
        {comments?.map((c) => {
          const isAuthor = c.authorId === user?.id
          const canDelete = isAuthor || isPresident
          const authorInitial = (c.authorName || 'A')[0].toUpperCase()

          return (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800/60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {authorInitial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {c.authorName}
                    </span>
                    {isAuthor && (
                      <span className="rounded-md bg-indigo-50 px-1.5 py-0.2 text-[10px] font-semibold text-[#6366f1] dark:bg-indigo-950/60 dark:text-indigo-400">
                        You
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {formatCommentDate(c.createdAt)}
                  </span>
                </div>

                <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {c.content}
                </p>

                <div className="mt-2 flex items-center gap-3">
                  {!isAuthor && (
                    <button
                      type="button"
                      onClick={() => handleReport(c.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-amber-600 dark:hover:text-amber-400"
                    >
                      <Flag className="h-3 w-3" />
                      <span>Report</span>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default EventComments

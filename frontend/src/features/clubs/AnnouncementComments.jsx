import { useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'

function AnnouncementComments({ clubId, announcementId, isPresident }) {
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  async function toggleExpanded() {
    if (!expanded && comments === null) {
      const { data } = await api.get(`/clubs/${clubId}/announcements/${announcementId}/comments`)
      setComments(data)
    }
    setExpanded((prev) => !prev)
  }

  async function handlePost(e) {
    e.preventDefault()
    if (!draft.trim()) return
    setPosting(true)
    try {
      const { data } = await api.post(`/clubs/${clubId}/announcements/${announcementId}/comments`, {
        content: draft.trim(),
      })
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
      await api.post(
        `/clubs/${clubId}/announcements/${announcementId}/comments/${commentId}/report`,
        { reason: reason.trim() },
      )
      showToast('Thanks — the Club Admin has been told')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleDelete(commentId) {
    try {
      await api.delete(`/clubs/${clubId}/announcements/${announcementId}/comments/${commentId}`)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={toggleExpanded} className="text-xs text-brand-600 hover:underline">
        {expanded ? 'Hide comments' : `Comments${comments ? ` (${comments.length})` : ''}`}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border-l-2 border-border pl-3 dark:border-border-dark">
          {comments?.length === 0 && (
            <p className="text-xs text-ink-muted dark:text-ink-dark-muted">No comments yet.</p>
          )}
          {comments?.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2">
              <p className="text-xs text-ink dark:text-ink-dark">
                <span className="font-medium">{c.authorName}:</span> {c.content}
              </p>
              <div className="flex shrink-0 gap-2">
                {c.authorId !== user?.id && (
                  <button
                    type="button"
                    onClick={() => handleReport(c.id)}
                    className="text-xs text-ink-muted hover:underline dark:text-ink-dark-muted"
                  >
                    Report
                  </button>
                )}
                {(c.authorId === user?.id || isPresident) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-xs text-danger hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          <form onSubmit={handlePost} className="flex gap-2 pt-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-ink outline-none dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
            />
            <button
              type="submit"
              disabled={posting || !draft.trim()}
              className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
            >
              Reply
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default AnnouncementComments

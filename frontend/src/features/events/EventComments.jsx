import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'

function EventComments({ eventId, isPresident }) {
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [comments, setComments] = useState(null)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    api.get(`/events/${eventId}/comments`).then((res) => setComments(res.data)).catch(() => setComments([]))
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
      showToast('Thanks — the Club Admin has been told')
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  async function handleDelete(commentId) {
    try {
      await api.delete(`/events/${eventId}/comments/${commentId}`)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (e) {
      showToast(e.response?.data?.message || 'Something went wrong', 'error')
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">
        Discussion {comments && comments.length > 0 && `(${comments.length})`}
      </h2>

      <form onSubmit={handlePost} className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question or leave a note for other attendees..."
          className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark"
        />
        <Button type="submit" loading={posting} disabled={!draft.trim()}>
          Post
        </Button>
      </form>

      {comments?.length === 0 && (
        <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">No comments yet — be the first.</p>
      )}

      <div className="mt-3 space-y-2">
        {comments?.map((c) => (
          <Card key={c.id} interactive={false} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-ink dark:text-ink-dark">{c.content}</p>
              <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
                — {c.authorName} · {new Date(c.createdAt).toLocaleString()}
              </p>
            </div>
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
          </Card>
        ))}
      </div>
    </section>
  )
}

export default EventComments

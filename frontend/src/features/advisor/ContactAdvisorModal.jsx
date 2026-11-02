import {
  AlertCircle,
  Building2,
  GraduationCap,
  HelpCircle,
  Mail,
  MessageSquare,
  Send,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Modal from '../../components/ui/Modal'

export default function ContactAdvisorModal({
  isOpen,
  onClose,
  defaultClubId = '',
  clubs = [],
}) {
  const { showToast } = useToast()

  const [advisors, setAdvisors] = useState([])
  const [loadingAdvisors, setLoadingAdvisors] = useState(false)
  const [selectedAdvisorId, setSelectedAdvisorId] = useState('')
  const [selectedClubId, setSelectedClubId] = useState(defaultClubId || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) return

    if (defaultClubId) {
      setSelectedClubId(defaultClubId)
    }

    let isMounted = true
    async function fetchAdvisors() {
      setLoadingAdvisors(true)
      try {
        const res = await api.get('/advisors')
        if (isMounted) {
          setAdvisors(res.data || [])
        }
      } catch (err) {
        console.error('Failed to load faculty advisors:', err)
        if (isMounted) {
          setError('Could not load faculty advisors list. Please try again later.')
        }
      } finally {
        if (isMounted) {
          setLoadingAdvisors(false)
        }
      }
    }

    fetchAdvisors()
    return () => {
      isMounted = false
    }
  }, [isOpen, defaultClubId])

  if (!isOpen) return null

  function handleClose() {
    setError(null)
    setSubmitting(false)
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!subject.trim()) {
      setError('Please provide a subject for your message.')
      return
    }
    if (!message.trim()) {
      setError('Please enter a message for the advisor.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        advisorId: selectedAdvisorId ? selectedAdvisorId : null,
        clubId: selectedClubId ? selectedClubId : null,
        subject: subject.trim(),
        message: message.trim(),
      }

      const res = await api.post('/advisors/contact', payload)
      showToast(res.data?.message || 'Message sent successfully to Faculty Advisor!', 'success')
      setSubject('')
      setMessage('')
      setSelectedAdvisorId('')
      setSelectedClubId('')
      handleClose()
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to deliver message to advisor. Please try again.'
      setError(errMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} maxWidth="max-w-xl">
      <div className="space-y-5">
        {/* Header */}
        <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Contact Faculty Advisor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send an advisory inquiry or guidance request directly to faculty advisors
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Advisor Picker */}
          <div>
            <label
              htmlFor="advisor-select"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <User className="h-3.5 w-3.5 text-indigo-500" />
              Target Faculty Advisor
            </label>
            <select
              id="advisor-select"
              value={selectedAdvisorId}
              onChange={(e) => setSelectedAdvisorId(e.target.value)}
              disabled={loadingAdvisors || submitting}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">
                {loadingAdvisors
                  ? 'Loading advisors...'
                  : '⭐ All Active Faculty Advisors (General broadcast)'}
              </option>
              {advisors.map((adv) => (
                <option key={adv.id} value={adv.id}>
                  {adv.name} ({adv.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Leave set to &ldquo;All Active Faculty Advisors&rdquo; if you are unsure which advisor to direct this to.
            </p>
          </div>

          {/* Club Context Picker (Optional) */}
          {clubs && clubs.length > 0 && (
            <div>
              <label
                htmlFor="club-context-select"
                className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <Building2 className="h-3.5 w-3.5 text-indigo-500" />
                Related Club / Society (Optional)
              </label>
              <select
                id="club-context-select"
                value={selectedClubId}
                onChange={(e) => setSelectedClubId(e.target.value)}
                disabled={submitting}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">None / General Student Inquiry</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Subject */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="advisor-subject"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                Subject
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{subject.length}/200</span>
            </div>
            <input
              id="advisor-subject"
              type="text"
              maxLength={200}
              placeholder="e.g. Guidance on organizing an annual tech symposium / Budget proposal advice"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Message Body */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="advisor-message"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                Message
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400">{message.length}/5000</span>
            </div>
            <textarea
              id="advisor-message"
              rows={5}
              maxLength={5000}
              placeholder="Provide a clear description of your question, context, or request for guidance..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={submitting}
              required
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 resize-y"
            />
          </div>

          {/* Delivery Note */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div className="leading-relaxed">
                Your message will be delivered to the Faculty Advisor&rsquo;s in-app notification center and their official campus email with your contact details for direct response.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !subject.trim() || !message.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Send to Advisor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

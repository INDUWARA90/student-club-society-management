import { useState } from 'react'
import api from '../../api/axios'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function LogExpenseModal({ clubId, onClose, onLogged }) {
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim() || !amount || Number(amount) <= 0) {
      setError('Description and a positive amount are required')
      return
    }
    setSubmitting(true)
    try {
      const { data } = await api.post(`/clubs/${clubId}/expenses`, { description, amount: Number(amount) })
      onLogged?.(data)
      onClose()
    } catch (e2) {
      setError(e2.response?.data?.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Log an expense</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-description">Description</label>
            <input id="expense-description" className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-amount">Amount</label>
            <input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-fast hover:bg-surface-muted dark:border-border-dark dark:text-ink-dark dark:hover:bg-surface-dark"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Logging…' : 'Log expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LogExpenseModal

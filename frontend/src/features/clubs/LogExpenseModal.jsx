import { useState } from 'react'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function LogExpenseModal({ clubId, onClose, onLogged }) {
  const { showToast } = useToast()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
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
      const { data } = await api.post(`/clubs/${clubId}/expenses`, {
        description,
        amount: Number(amount),
        category: category.trim() || null,
        expenseDate: expenseDate || null,
      })
      showToast('Expense logged')
      onLogged?.(data)
      onClose()
    } catch (e2) {
      const message = e2.response?.data?.message || 'Something went wrong'
      setError(message)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Log an expense" onClose={onClose}>
        <form className="space-y-4" onSubmit={handleSubmit}>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-category">Category (optional)</label>
              <input id="expense-category" className={inputClass} placeholder="Food, Venue…" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-date">Date (optional)</label>
              <input id="expense-date" type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitting ? 'Logging…' : 'Log expense'}
            </Button>
          </div>
        </form>
    </Modal>
  )
}

export default LogExpenseModal

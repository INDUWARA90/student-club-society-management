import { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

const EXPENSE_CATEGORIES = [
  'Equipment & Gear',
  'Events & Trips',
  'Food & Refreshments',
  'Marketing',
  'Operations & Travel',
  'Hosting',
  'General',
  'Other',
]

const INCOME_CATEGORIES = [
  'Sponsorship',
  'Grant / University Allocation',
  'Ticket Sales / Registration',
  'Donation',
  'Merchandise',
  'Fundraiser',
  'Other Income',
]

function LogExpenseModal({ clubId, onClose, onLogged }) {
  const { showToast } = useToast()
  const [entryType, setEntryType] = useState('EXPENSE')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0])
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!clubId) return
    api.get(`/events?clubId=${clubId}`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.content || [])
        setEvents(list)
      })
      .catch(() => {})
  }, [clubId])

  function handleTypeChange(type) {
    setEntryType(type)
    setCategory(type === 'INCOME' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim() || !amount || Number(amount) <= 0) {
      setError('Description and a positive amount are required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data } = await api.post(`/clubs/${clubId}/expenses`, {
        description: description.trim(),
        amount: Number(amount),
        category: category.trim() || null,
        expenseDate: expenseDate || null,
        eventId: eventId || null,
        type: entryType,
      })
      showToast(entryType === 'INCOME' ? 'Income recorded successfully' : 'Expense recorded successfully')
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
    <Modal title={entryType === 'INCOME' ? 'Log Club Income' : 'Log Club Expense'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {/* Type toggle: Expense vs Income */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => handleTypeChange('EXPENSE')}
            className={`flex items-center justify-center rounded-lg py-2 text-xs font-semibold transition-all ${
              entryType === 'EXPENSE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Expense (-$)
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('INCOME')}
            className={`flex items-center justify-center rounded-lg py-2 text-xs font-semibold transition-all ${
              entryType === 'INCOME'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Income (+$$)
          </button>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-description">
            Description
          </label>
          <input
            id="expense-description"
            className={inputClass}
            placeholder={entryType === 'INCOME' ? 'e.g. Annual Tech Sponsor Grant' : 'e.g. Workshop Audio Equipment'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-amount">
              Amount ($)
            </label>
            <input
              id="expense-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="0.00"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-category">
              Category
            </label>
            <select
              id="expense-category"
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {(entryType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-date">
              Transaction Date
            </label>
            <input
              id="expense-date"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className={inputClass}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="expense-event">
              Linked Event (Optional)
            </label>
            <select
              id="expense-event"
              className={inputClass}
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">None (General Club)</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving…' : entryType === 'INCOME' ? 'Save Income' : 'Save Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default LogExpenseModal

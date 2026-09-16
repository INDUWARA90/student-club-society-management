import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useToast } from '../../components/ToastProvider'
import { fileToBase64 } from '../../utils/fileToBase64'
import { createClub, updateClub } from './clubsSlice'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function CreateClubModal({ club, onClose, onCreated }) {
  const dispatch = useDispatch()
  const { showToast } = useToast()
  const isEdit = Boolean(club)
  const [name, setName] = useState(club?.name || '')
  const [category, setCategory] = useState(club?.category || '')
  const [description, setDescription] = useState(club?.description || '')
  const [joinPolicy, setJoinPolicy] = useState(club?.joinPolicy || 'OPEN')
  const [logoB64, setLogoB64] = useState(club?.logoB64 || null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoB64(await fileToBase64(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !category.trim()) {
      setError('Name and category are required')
      return
    }
    setSubmitting(true)
    const payload = { name, category, description, joinPolicy, logoB64 }
    const result = isEdit
      ? await dispatch(updateClub({ clubId: club.id, payload }))
      : await dispatch(createClub(payload))
    setSubmitting(false)
    const action = isEdit ? updateClub : createClub
    if (action.fulfilled.match(result)) {
      const saved = result.payload
      showToast(isEdit ? 'Club updated' : saved.status === 'PENDING' ? 'Club proposal submitted for approval' : 'Club created')
      onCreated?.(saved)
      onClose()
    } else {
      setError(result.payload)
      showToast(result.payload, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">{isEdit ? 'Edit club' : 'Create a club'}</h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="club-name">Name</label>
            <input id="club-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="club-category">Category</label>
            <input
              id="club-category"
              className={inputClass}
              placeholder="Sports, Academic, Cultural, Tech..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="club-description">Description</label>
            <textarea
              id="club-description"
              className={inputClass}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="club-logo">Logo</label>
            <input id="club-logo" type="file" accept="image/*" onChange={handleLogoChange} className="block text-sm text-ink dark:text-ink-dark" />
            {logoB64 && <img src={logoB64} alt="Logo preview" className="mt-2 h-20 w-20 rounded-lg object-cover" />}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="club-join-policy">Join policy</label>
            <select id="club-join-policy" className={inputClass} value={joinPolicy} onChange={(e) => setJoinPolicy(e.target.value)}>
              <option value="OPEN">Open (auto-join)</option>
              <option value="APPROVAL_REQUIRED">Approval required</option>
            </select>
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
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create club'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateClubModal

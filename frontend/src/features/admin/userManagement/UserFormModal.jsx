import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import Button from '../../../components/ui/Button'
import Modal from '../../../components/ui/Modal'
import { ROLE_LABEL, inputClass, labelClass } from './constants'

function RoleSelect({ id, value, onChange, disabled }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {Object.entries(ROLE_LABEL).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
    </select>
  )
}

export default function UserFormModal({ user, isSelf, onClose, onSubmit }) {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState(user?.role || 'STUDENT')
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(user)
  const valid = name.trim() && email.trim() && (editing || password.length >= 8)

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    await onSubmit(editing ? { name, email, role } : { name, email, password, role })
    setSubmitting(false)
  }

  return (
    <Modal title={editing ? 'Edit user' : 'New user'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div><label className={labelClass} htmlFor="user-name">Name</label><input id="user-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><label className={labelClass} htmlFor="user-email">Email</label><input id="user-email" type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        {!editing && <div>
          <label className={labelClass} htmlFor="user-password">Temporary password</label>
          <div className="relative">
            <input id="user-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass} pr-10`} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="user-password-hint" />
            <button type="button" onClick={() => setShowPassword((previous) => !previous)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-fast hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark focus:outline-none" aria-label={showPassword ? 'Hide' : 'Show'} title={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p id="user-password-hint" className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">At least 8 characters. Share it with the user; they can change it from their profile.</p>
        </div>}
        <div>
          <label className={labelClass} htmlFor="user-role">Role</label>
          <RoleSelect id="user-role" value={role} onChange={setRole} disabled={isSelf} />
          {isSelf && <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">You can’t change your own role.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={submitting} disabled={!valid}>{editing ? 'Save changes' : 'Create user'}</Button></div>
      </form>
    </Modal>
  )
}

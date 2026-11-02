import { UserCheck, UserCog, UserX } from 'lucide-react'
import Badge from '../../../components/ui/Badge'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import { ROLE_LABEL, ROLE_TONE } from './constants'

function UserRow({ user, currentUser, isSuperAdmin, onEdit, onSetActive }) {
  const isSelf = user.id === currentUser?.id
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const deactivationDisabled = isSelf || (!isSuperAdmin && user.role !== 'STUDENT')
  const deactivationTitle = isSelf ? 'You cannot deactivate your own account' : !isSuperAdmin && user.role !== 'STUDENT' ? 'Presidents can only deactivate student accounts' : undefined
  return <li><Card interactive={false} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-start gap-3"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{initials}</span><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold text-ink dark:text-ink-dark">{user.name}</p>{isSuperAdmin && <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role] || user.role}</Badge>}<Badge tone={user.active ? 'success' : 'danger'}>{user.active ? 'Active' : 'Deactivated'}</Badge>{isSelf && <Badge tone="neutral">You</Badge>}</div>
      <p className="mt-1 truncate text-sm text-ink-muted dark:text-ink-dark-muted">{user.email}</p>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs"><div className="flex items-center gap-1.5"><dt className="text-ink-muted dark:text-ink-dark-muted">Email:</dt><dd className={user.emailVerified ? 'font-medium text-success' : 'font-medium text-warning'}>{user.emailVerified ? 'Verified' : 'Not verified'}</dd></div><div className="flex items-center gap-1.5"><dt className="text-ink-muted dark:text-ink-dark-muted">Joined:</dt><dd className="font-medium text-ink dark:text-ink-dark">{new Date(user.createdAt).toLocaleDateString()}</dd></div></dl>
    </div></div>
    <div className="flex shrink-0 items-center gap-2 sm:pl-4">{isSuperAdmin && <Button variant="secondary" size="sm" onClick={() => onEdit(user)} aria-label={`Edit ${user.name}`}><UserCog className="h-4 w-4" />Edit</Button>}{user.active ? <Button variant="dangerOutline" size="sm" disabled={deactivationDisabled} title={deactivationTitle} onClick={() => onSetActive(user, false)} aria-label={`Deactivate ${user.name}`}><UserX className="h-4 w-4" />Deactivate</Button> : <Button variant="success" size="sm" onClick={() => onSetActive(user, true)} aria-label={`Reactivate ${user.name}`}><UserCheck className="h-4 w-4" />Reactivate</Button>}</div>
  </Card></li>
}

export default function UserList({ users, ...props }) { return <ul className="mt-6 space-y-2" aria-label="Users">{users.map((user) => <UserRow key={user.id} user={user} {...props} />)}</ul> }

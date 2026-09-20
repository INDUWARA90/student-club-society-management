import { Plus, Search, UserCheck, UserCog, UserX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'

const PAGE_SIZE = 20

const ROLE_LABEL = {
  STUDENT: 'Student',
  FACULTY_ADVISOR: 'Faculty Advisor',
  SUPER_ADMIN: 'Super Admin',
}

const ROLE_TONE = { STUDENT: 'neutral', FACULTY_ADVISOR: 'info', SUPER_ADMIN: 'brand' }

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

const labelClass = 'mb-1 block text-sm font-medium text-ink dark:text-ink-dark'

function RoleSelect({ id, value, onChange, disabled }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {Object.entries(ROLE_LABEL).map(([role, label]) => (
        <option key={role} value={role}>
          {label}
        </option>
      ))}
    </select>
  )
}

function UserFormModal({ user, isSelf, onClose, onSubmit }) {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(user?.role || 'STUDENT')
  const [submitting, setSubmitting] = useState(false)
  const editing = Boolean(user)
  const valid = name.trim() && email.trim() && (editing || password.length >= 8)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    await onSubmit(editing ? { name, email, role } : { name, email, password, role })
    setSubmitting(false)
  }

  return (
    <Modal title={editing ? 'Edit user' : 'New user'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className={labelClass} htmlFor="user-name">
            Name
          </label>
          <input id="user-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} htmlFor="user-email">
            Email
          </label>
          <input
            id="user-email"
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {!editing && (
          <div>
            <label className={labelClass} htmlFor="user-password">
              Temporary password
            </label>
            <input
              id="user-password"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="user-password-hint"
            />
            <p id="user-password-hint" className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
              At least 8 characters. Share it with the user; they can change it from their profile.
            </p>
          </div>
        )}
        <div>
          <label className={labelClass} htmlFor="user-role">
            Role
          </label>
          <RoleSelect id="user-role" value={role} onChange={setRole} disabled={isSelf} />
          {isSelf && (
            <p className="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">You can’t change your own role.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={!valid}>
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function UserManagementPage() {
  const { showToast } = useToast()
  const currentUser = useSelector((state) => state.auth.user)
  const [users, setUsers] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    try {
      const params = { page, size: PAGE_SIZE }
      if (appliedQuery) params.q = appliedQuery
      if (roleFilter) params.role = roleFilter
      const res = await api.get('/admin/users', { params })
      setUsers(res.data)
      setTotal(Number(res.headers['x-total-count'] ?? res.data.length))
      setError(null)
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load users')
    }
  }, [page, appliedQuery, roleFilter])

  useEffect(() => {
    load()
  }, [load])

  function handleSearch(e) {
    e.preventDefault()
    setPage(0)
    setAppliedQuery(query.trim())
  }

  async function handleCreate(payload) {
    try {
      await api.post('/admin/users', payload)
      showToast('User created')
      setShowCreate(false)
      load()
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not create user', 'error')
    }
  }

  async function handleUpdate(payload) {
    try {
      await api.put(`/admin/users/${editing.id}`, payload)
      showToast('User updated')
      setEditing(null)
      load()
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not update user', 'error')
    }
  }

  async function handleSetActive(user, active) {
    if (!active && !window.confirm(`Deactivate ${user.name}? They will be signed out and unable to sign in until reactivated.`)) {
      return
    }
    try {
      await api.post(`/admin/users/${user.id}/${active ? 'activate' : 'deactivate'}`)
      showToast(active ? 'User reactivated' : 'User deactivated')
      load()
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not update user', 'error')
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader
        title="Manage users"
        description="Create accounts, assign roles and deactivate users. Every change is recorded in the audit log."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            New user
          </Button>
        }
      />

      <form onSubmit={handleSearch} role="search" className="mt-6 flex flex-wrap items-end gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <label htmlFor="user-search" className="sr-only">
            Search users by name or email
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
          <input
            id="user-search"
            className={`${inputClass} pl-9`}
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="user-role-filter" className="sr-only">
            Filter by role
          </label>
          <select
            id="user-role-filter"
            className={inputClass}
            value={roleFilter}
            onChange={(e) => {
              setPage(0)
              setRoleFilter(e.target.value)
            }}
          >
            <option value="">All roles</option>
            {Object.entries(ROLE_LABEL).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {error}
        </p>
      )}

      {!users && !error && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {users && users.length === 0 && <EmptyState icon={UserCog} title="No users found" description="Try a different search or role." />}

      {users && users.length > 0 && (
        <ul className="mt-6 space-y-2" aria-label="Users">
          {users.map((user) => {
            const isSelf = user.id === currentUser?.id
            return (
              <li key={user.id}>
                <Card interactive={false} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium text-ink dark:text-ink-dark">
                      <span className="truncate">{user.name}</span>
                      <Badge tone={ROLE_TONE[user.role]}>{ROLE_LABEL[user.role] || user.role}</Badge>
                      {!user.active && <Badge tone="danger">Deactivated</Badge>}
                      {isSelf && <Badge tone="neutral">You</Badge>}
                    </p>
                    <p className="truncate text-xs text-ink-muted dark:text-ink-dark-muted">
                      {user.email}
                      {!user.emailVerified && ' · email not verified'} · joined{' '}
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditing(user)} aria-label={`Edit ${user.name}`}>
                      <UserCog className="h-4 w-4" />
                      Edit
                    </Button>
                    {user.active ? (
                      <Button
                        variant="dangerOutline"
                        size="sm"
                        disabled={isSelf}
                        title={isSelf ? 'You cannot deactivate your own account' : undefined}
                        onClick={() => handleSetActive(user, false)}
                        aria-label={`Deactivate ${user.name}`}
                      >
                        <UserX className="h-4 w-4" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleSetActive(user, true)}
                        aria-label={`Reactivate ${user.name}`}
                      >
                        <UserCheck className="h-4 w-4" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {users && total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm text-ink-muted dark:text-ink-dark-muted">
          <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span aria-live="polite">
            Page {page + 1} of {pageCount} · {total} users
          </span>
          <Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </nav>
      )}

      {showCreate && <UserFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
      {editing && (
        <UserFormModal
          user={editing}
          isSelf={editing.id === currentUser?.id}
          onClose={() => setEditing(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  )
}

export default UserManagementPage

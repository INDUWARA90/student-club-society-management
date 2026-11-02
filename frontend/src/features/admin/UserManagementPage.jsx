import { Plus, UserCog } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import api from '../../api/axios'
import { useToast } from '../../components/ToastProvider'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import Skeleton from '../../components/ui/Skeleton'
import UserFilters from './userManagement/UserFilters'
import UserFormModal from './userManagement/UserFormModal'
import UserList from './userManagement/UserList'

const PAGE_SIZE = 20

function UserManagementPage() {
  const { showToast } = useToast()
  const currentUser = useSelector((state) => state.auth.user)
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN'
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
      const response = await api.get('/admin/users', { params })
      setUsers(response.data)
      setTotal(Number(response.headers['x-total-count'] ?? response.data.length))
      setError(null)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not load users')
    }
  }, [page, appliedQuery, roleFilter])

  useEffect(() => { load() }, [load])

  function handleSearch(event) {
    event.preventDefault()
    setPage(0)
    setAppliedQuery(query.trim())
  }

  async function handleCreate(payload) {
    try {
      await api.post('/admin/users', payload)
      showToast('User created')
      setShowCreate(false)
      load()
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Could not create user', 'error')
    }
  }

  async function handleUpdate(payload) {
    try {
      await api.put(`/admin/users/${editing.id}`, payload)
      showToast('User updated')
      setEditing(null)
      load()
    } catch (requestError) {
      showToast(requestError.response?.data?.message || 'Could not update user', 'error')
    }
  }

  async function handleSetActive(user, active) {
    if (!active && !window.confirm(`Deactivate ${user.name}? They will be signed out and unable to sign in until reactivated.`)) return
    try {
      setUsers((previous) => previous?.map((item) => (item.id === user.id ? { ...item, active } : item)))
      await api.post(`/admin/users/${user.id}/${active ? 'activate' : 'deactivate'}`)
      showToast(active ? 'User reactivated' : 'User deactivated')
      load()
    } catch (requestError) {
      load()
      showToast(requestError.response?.data?.message || 'Could not update user', 'error')
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const description = isSuperAdmin
    ? 'Create accounts, assign roles and deactivate users. Every change is recorded in the audit log.'
    : 'View and manage active/deactivated platform access for members of your club.'

  return <div className="mx-auto max-w-5xl p-4 md:p-8">
    <PageHeader title={isSuperAdmin ? 'Manage users' : 'Club Members Directory'} description={description} actions={isSuperAdmin ? <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" />New user</Button> : null} />
    <UserFilters isSuperAdmin={isSuperAdmin} query={query} roleFilter={roleFilter} onQueryChange={setQuery} onRoleChange={(role) => { setPage(0); setRoleFilter(role) }} onSubmit={handleSearch} />
    {error && <p role="alert" className="mt-6 text-sm text-danger">{error}</p>}
    {!users && !error && <div className="mt-6 space-y-2">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16" />)}</div>}
    {users?.length === 0 && <EmptyState icon={UserCog} title="No users found" description="Try a different search or role." />}
    {users?.length > 0 && <UserList users={users} currentUser={currentUser} isSuperAdmin={isSuperAdmin} onEdit={setEditing} onSetActive={handleSetActive} />}
    {users && total > PAGE_SIZE && <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm text-ink-muted dark:text-ink-dark-muted"><Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</Button><span aria-live="polite">Page {page + 1} of {pageCount} · {total} users</span><Button variant="secondary" size="sm" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button></nav>}
    {showCreate && <UserFormModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />}
    {editing && <UserFormModal user={editing} isSelf={editing.id === currentUser?.id} onClose={() => setEditing(null)} onSubmit={handleUpdate} />}
  </div>
}

export default UserManagementPage

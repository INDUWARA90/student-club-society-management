import { Search } from 'lucide-react'
import Button from '../../../components/ui/Button'
import { ROLE_LABEL, inputClass } from './constants'

export default function UserFilters({ isSuperAdmin, query, roleFilter, onQueryChange, onRoleChange, onSubmit }) {
  return <form onSubmit={onSubmit} role="search" className="mt-6 flex flex-wrap items-end gap-2">
    <div className="relative min-w-[14rem] flex-1">
      <label htmlFor="user-search" className="sr-only">Search users by name or email</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted dark:text-ink-dark-muted" />
      <input id="user-search" className={`${inputClass} pl-9`} placeholder="Search by name or email…" value={query} onChange={(event) => onQueryChange(event.target.value)} />
    </div>
    {isSuperAdmin && <div><label htmlFor="user-role-filter" className="sr-only">Filter by role</label><select id="user-role-filter" className={inputClass} value={roleFilter} onChange={(event) => onRoleChange(event.target.value)}><option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></div>}
    <Button type="submit" variant="secondary">Search</Button>
  </form>
}

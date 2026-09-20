import { configureStore } from '@reduxjs/toolkit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import authReducer, { logout, refreshCurrentUser } from './authSlice'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn() },
}))

const student = { id: 'u1', name: 'Sam', email: 'sam@example.com', role: 'STUDENT', emailVerified: true }

let api
beforeEach(async () => {
  api = (await import('../../api/axios')).default
  vi.clearAllMocks()
  localStorage.clear()
})

// The slice reads localStorage when the module loads, so seed the state directly instead.
function storeWith(user) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { token: 'tok', user, status: 'idle', error: null, registrationPending: false } },
  })
}

describe('refreshCurrentUser', () => {
  it('replaces the stored user when the server reports a new role', async () => {
    const store = storeWith(student)
    api.get.mockResolvedValue({ data: { ...student, role: 'FACULTY_ADVISOR' } })

    await store.dispatch(refreshCurrentUser())

    expect(api.get).toHaveBeenCalledWith('/auth/me')
    expect(store.getState().auth.user.role).toBe('FACULTY_ADVISOR')
    expect(JSON.parse(localStorage.getItem('user')).role).toBe('FACULTY_ADVISOR')
  })

  it('leaves the user alone when the request fails', async () => {
    const store = storeWith(student)
    api.get.mockRejectedValue({ response: { data: { message: 'boom' } } })

    await store.dispatch(refreshCurrentUser())

    expect(store.getState().auth.user).toEqual(student)
  })

  it('ignores a response that arrives after signing out', async () => {
    const store = storeWith(student)
    let resolve
    api.get.mockReturnValue(new Promise((r) => (resolve = r)))

    const pending = store.dispatch(refreshCurrentUser())
    store.dispatch(logout())
    resolve({ data: { ...student, role: 'SUPER_ADMIN' } })
    await pending

    expect(store.getState().auth.user).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('ignores a response for a different account', async () => {
    const store = storeWith(student)
    api.get.mockResolvedValue({ data: { id: 'someone-else', name: 'Other', role: 'SUPER_ADMIN' } })

    await store.dispatch(refreshCurrentUser())

    expect(store.getState().auth.user).toEqual(student)
  })
})

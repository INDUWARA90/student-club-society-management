import { configureStore } from '@reduxjs/toolkit'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuditLogPage from './AuditLogPage'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

const sampleLogs = [
  {
    id: 'log-1',
    actorName: 'Faculty Advisor',
    actorEmail: 'advisor@university.edu',
    actorRole: 'FACULTY_ADVISOR',
    action: 'REJECT_EVENT',
    targetType: 'EVENT',
    targetId: 'evt-001',
    details: 'ICTSCE 2 - Schedule conflict',
    createdAt: '2026-10-31T17:06:17Z',
  },
  {
    id: 'log-2',
    actorName: 'Faculty Advisor',
    actorEmail: 'advisor@university.edu',
    actorRole: 'FACULTY_ADVISOR',
    action: 'APPROVE_EVENT',
    targetType: 'EVENT',
    targetId: 'evt-002',
    details: 'Annual Art Show',
    createdAt: '2026-10-31T14:16:34Z',
  },
  {
    id: 'log-3',
    actorName: 'Dave Kim',
    actorEmail: 'dave@university.edu',
    actorRole: 'SUPER_ADMIN',
    action: 'DELETE_EVENT',
    targetType: 'EVENT',
    targetId: 'evt-003',
    details: 'Cancelled workshop',
    createdAt: '2026-10-31T11:37:49Z',
  },
  {
    id: 'log-4',
    actorName: 'Dave Kim',
    actorEmail: 'dave@university.edu',
    actorRole: 'SUPER_ADMIN',
    action: 'LOG_EXPENSE',
    targetType: 'EXPENSE',
    targetId: 'exp-001',
    details: '"refreshment" 10000 on 2026-10-31 [Food]',
    createdAt: '2026-10-31T07:47:04Z',
  },
  {
    id: 'log-5',
    actorName: 'Dave Kim',
    actorEmail: 'dave@university.edu',
    actorRole: 'SUPER_ADMIN',
    action: 'ACTIVATE_USER',
    targetType: 'USER',
    targetId: 'usr-001',
    details: 'bob@example.com',
    createdAt: '2026-10-29T18:38:34Z',
  },
]

function renderAuditLogPage(user = { id: 'admin-1', role: 'SUPER_ADMIN' }) {
  const store = configureStore({
    reducer: {
      auth: () => ({ user }),
      theme: () => ({ mode: 'light' }),
    },
  })

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <AuditLogPage />
      </MemoryRouter>
    </Provider>,
  )
}

describe('AuditLogPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header, KPI metrics cards, and log list from API', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleLogs })

    renderAuditLogPage()

    // Header
    expect(await screen.findByText('Security Audit Trail')).toBeInTheDocument()
    expect(screen.getByText('Platform Governance & Compliance')).toBeInTheDocument()

    // KPI Summary
    expect(screen.getByText('Total Operations')).toBeInTheDocument()
    expect(screen.getByText('Events & Societies')).toBeInTheDocument()
    expect(screen.getByText('User Governance')).toBeInTheDocument()
    expect(screen.getByText('Financial Ledger')).toBeInTheDocument()

    // Total Operations count should be 5
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1)

    // Verify presence of log items
    expect(screen.getByText('ICTSCE 2 - Schedule conflict')).toBeInTheDocument()
    expect(screen.getByText('Annual Art Show')).toBeInTheDocument()
    expect(screen.getByText('"refreshment" 10000 on 2026-10-31 [Food]')).toBeInTheDocument()
    expect(screen.getByText('bob@example.com')).toBeInTheDocument()

    // Verify actor roles badges
    expect(screen.getAllByText('Faculty Advisor').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Super Admin').length).toBeGreaterThanOrEqual(1)
  })

  it('filters log records when clicking category pills', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleLogs })

    renderAuditLogPage()

    expect(await screen.findByText('Security Audit Trail')).toBeInTheDocument()
    expect(screen.getByText('ICTSCE 2 - Schedule conflict')).toBeInTheDocument()

    // Click "Finances" category pill
    const financesPill = screen.getByRole('button', { name: /finances/i })
    await userEventSetup.click(financesPill)

    // Expense record should still be visible
    expect(screen.getByText('"refreshment" 10000 on 2026-10-31 [Food]')).toBeInTheDocument()

    // Event and User records should be filtered out
    expect(screen.queryByText('ICTSCE 2 - Schedule conflict')).not.toBeInTheDocument()
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument()
  })

  it('filters log records when typing in the search box', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleLogs })

    renderAuditLogPage()

    const searchInput = await screen.findByPlaceholderText(/search by actor, action, target or details/i)
    await userEventSetup.type(searchInput, 'conflict')

    // Only the conflict record should match
    expect(screen.getByText('ICTSCE 2 - Schedule conflict')).toBeInTheDocument()
    expect(screen.queryByText('Annual Art Show')).not.toBeInTheDocument()
    expect(screen.queryByText('"refreshment" 10000 on 2026-10-31 [Food]')).not.toBeInTheDocument()
  })

  it('allows exporting logs as CSV', async () => {
    const userEventSetup = userEvent.setup()
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleLogs })

    // Mock createObjectURL & revokeObjectURL
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url')
    const revokeObjectURLMock = vi.fn()
    window.URL.createObjectURL = createObjectURLMock
    window.URL.revokeObjectURL = revokeObjectURLMock

    renderAuditLogPage()

    const exportBtn = await screen.findByRole('button', { name: /export csv/i })
    expect(exportBtn).not.toBeDisabled()

    await userEventSetup.click(exportBtn)

    expect(createObjectURLMock).toHaveBeenCalled()
  })

  it('shows error state when API fails', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockRejectedValue({
      response: { data: { message: 'Network error or unauthorized access.' } },
    })

    renderAuditLogPage()

    expect(await screen.findByText('Network error or unauthorized access.')).toBeInTheDocument()
  })

  it('renders for Faculty Advisor without errors', async () => {
    const api = (await import('../../api/axios')).default
    api.get.mockResolvedValue({ data: sampleLogs })

    const advisorUser = {
      id: 'adv-1',
      name: 'Faculty Advisor',
      role: 'FACULTY_ADVISOR',
    }

    renderAuditLogPage(advisorUser)

    expect(await screen.findByText('Security Audit Trail')).toBeInTheDocument()
    expect(screen.getByText('ICTSCE 2 - Schedule conflict')).toBeInTheDocument()
  })

  it('shows access restricted view if a normal student visits audit log', async () => {
    const studentUser = {
      id: 'std-1',
      name: 'Student User',
      role: 'STUDENT',
    }

    renderAuditLogPage(studentUser)

    expect(await screen.findByText('Administrative & Advisor Access Required')).toBeInTheDocument()
    expect(
      screen.getByText(/restricted to University Administrators and Faculty Advisors/i),
    ).toBeInTheDocument()
  })
})

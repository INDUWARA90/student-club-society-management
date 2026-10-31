import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import BudgetFinancePage from './BudgetFinancePage'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

function renderWithProviders(ui, { initialState } = {}) {
  const store = configureStore({
    reducer: {
      auth: (state = { user: null }) => state,
    },
    preloadedState: initialState,
  })
  return render(
    <Provider store={store}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/budget?clubId=c1']}>
          <Routes>
            <Route path="/budget" element={ui} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </Provider>,
  )
}

describe('BudgetFinancePage', () => {
  it('restricts access for normal students and displays Club Position Members Only notice', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') return Promise.resolve({ data: [] })
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Tech Innovators' }],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 's1', name: 'Student Sam', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByRole('heading', { name: /club position members only/i })).toBeInTheDocument()
    expect(screen.getByText(/the budget & finance section is restricted to club position holders/i)).toBeInTheDocument()
    expect(screen.queryByText(/total allocated budget/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log expense \/ add/i })).not.toBeInTheDocument()
  })

  it('allows club position members (e.g. VP) to view Budget & Finance dashboard in read-only mode without president controls', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Tech Innovators', position: 'VP', status: 'APPROVED' }],
        })
      }
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Tech Innovators' }],
        })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 5000,
            totalExpenses: 3240,
            balance: 1760,
            expenses: [
              {
                id: 'e1',
                description: 'Studio Light Kit',
                amount: 850,
                category: 'Equipment',
                expenseDate: '2026-10-10',
                loggedByName: 'President Dave',
              },
            ],
            eventBudgets: [],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 'vp-1', name: 'VP Victor', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: /budget & finance/i })).toBeInTheDocument()
    expect(await screen.findByText(/total allocated budget/i)).toBeInTheDocument()
    expect(await screen.findByText('Studio Light Kit')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log expense \/ add/i })).not.toBeInTheDocument()
    expect(screen.queryByTitle(/delete expense/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /view receipts pack/i })).not.toBeInTheDocument()
    expect(await screen.findByText(/approval actions are restricted to the club president/i)).toBeInTheDocument()
  })

  it('allows Super Admin to view Budget & Finance dashboard in oversight mode without recording expenses', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/clubs') {
        return Promise.resolve({ data: [{ id: 'c1', name: 'Tech Innovators' }] })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 5000,
            totalExpenses: 3240,
            balance: 1760,
            expenses: [],
            eventBudgets: [],
          },
        })
      }
      if (url.includes('/members/pending')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 'sa-1', name: 'Super Admin', role: 'SUPER_ADMIN' } },
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: /budget & finance/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log expense \/ add/i })).not.toBeInTheDocument()
    expect(screen.getByText(/admin view only/i)).toBeInTheDocument()
  })

  it('renders Budget & Finance dashboard with 4 metric cards and allocation donut for president', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Tech Innovators', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 5000,
            totalExpenses: 3240,
            balance: 1760,
            expenses: [
              {
                id: 'e1',
                description: 'Studio Light Kit',
                amount: 850,
                category: 'Equipment',
                expenseDate: '2026-10-10',
                loggedByName: 'President Dave',
              },
            ],
            eventBudgets: [],
          },
        })
      }
      if (url.includes('/members/pending')) {
        return Promise.resolve({
          data: [
            { id: 'p1', userName: 'Bob Smith', joinedAt: '2026-10-15T00:00:00Z', position: 'MEMBER' },
          ],
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'President Dave', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByRole('heading', { level: 1, name: /budget & finance/i })).toBeInTheDocument()
    expect(await screen.findByText(/total allocated budget/i)).toBeInTheDocument()
    expect(await screen.findByText(/expense history/i)).toBeInTheDocument()
    expect(await screen.findByText('Studio Light Kit')).toBeInTheDocument()
    expect(await screen.findByText(/budget allocation/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /log expense \/ add/i })).toBeInTheDocument()
    expect(await screen.findByTitle(/delete expense/i)).toBeInTheDocument()
    expect(await screen.findByText('Bob Smith')).toBeInTheDocument()
  })

  it('renders income and expense entries with badges, event budgets, and CSV export button', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Tech Innovators', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 7500,
            totalExpenses: 2000,
            balance: 5500,
            expenses: [
              {
                id: 'tx-1',
                description: 'Annual Hackathon Grant',
                amount: 3000,
                category: 'Grant / University Allocation',
                type: 'INCOME',
                expenseDate: '2026-10-12',
                loggedByName: 'President Dave',
                eventTitle: 'Hackathon 2026',
              },
              {
                id: 'tx-2',
                description: 'Audio Visual Rental',
                amount: 800,
                category: 'Equipment & Gear',
                type: 'EXPENSE',
                expenseDate: '2026-10-14',
                loggedByName: 'President Dave',
                eventTitle: 'Hackathon 2026',
              },
            ],
            eventBudgets: [
              {
                eventId: 'ev-1',
                title: 'Hackathon 2026',
                budget: 1500,
                spent: 800,
                income: 3000,
                remaining: 700,
                net: 2200,
                completed: true,
              },
            ],
          },
        })
      }
      if (url.includes('/events')) {
        return Promise.resolve({
          data: [{ id: 'ev-1', title: 'Hackathon 2026' }],
        })
      }
      if (url.includes('/members/pending')) {
        return Promise.resolve({ data: [] })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'President Dave', role: 'STUDENT' } },
      },
    })

    // Check income and expense transactions
    expect(await screen.findByText('Annual Hackathon Grant')).toBeInTheDocument()
    expect(await screen.findByText('Audio Visual Rental')).toBeInTheDocument()
    expect(await screen.findByText(/\+\$3000\.00/i)).toBeInTheDocument()
    expect(await screen.findByText(/-\$800\.00/i)).toBeInTheDocument()

    // Check Event Budgets & Financial Performance section
    expect(await screen.findByText(/event budgets & financial performance/i)).toBeInTheDocument()
    expect(await screen.findAllByText('Hackathon 2026')).toHaveLength(3) // 2 in table, 1 in event budgets
    expect(await screen.findAllByText(/completed/i)).not.toHaveLength(0)
    expect(await screen.findByText(/retained in club balance/i)).toBeInTheDocument()

    // Check Export CSV button
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })

  it('allows a normal student member to view Budget dashboard when club president enabled showBudgetToMembers', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Tech Innovators', position: 'MEMBER', status: 'APPROVED' }],
        })
      }
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Tech Innovators', showBudgetToMembers: true }],
        })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 4500,
            totalExpenses: 2000,
            balance: 2500,
            expenses: [
              {
                id: 'e1',
                description: 'Member Workshop Kit',
                amount: 350,
                category: 'Equipment',
                expenseDate: '2026-10-12',
                loggedByName: 'President Dave',
              },
            ],
            eventBudgets: [],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 's-normal', name: 'Student Stan', role: 'STUDENT' } },
      },
    })

    // Normal student member sees public budget transparency mode banner and metrics
    expect(await screen.findByText(/public club budget — member transparency mode/i)).toBeInTheDocument()
    expect(await screen.findByText('Member Workshop Kit')).toBeInTheDocument()
    expect(await screen.findByText(/total allocated budget/i)).toBeInTheDocument()

    // Normal student cannot export CSV or log transactions
    expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /log expense \/ add/i })).not.toBeInTheDocument()
  })
  it('allows Club President to toggle student member budget visibility directly from Budget & Finance page', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({
          data: [{ clubId: 'c1', clubName: 'Tech Innovators', position: 'PRESIDENT', status: 'APPROVED' }],
        })
      }
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Tech Innovators', showBudgetToMembers: false }],
        })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 1000,
            totalExpenses: 500,
            balance: 500,
            expenses: [],
            eventBudgets: [],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })
    axios.patch.mockResolvedValue({ data: { id: 'c1', showBudgetToMembers: true } })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 'dave-1', name: 'President Dave', role: 'STUDENT' } },
      },
    })

    // President sees Student Member Budget Visibility section with "Hidden from Students"
    expect(await screen.findByText('Student Member Budget Visibility')).toBeInTheDocument()
    expect(await screen.findByText('Hidden from Students')).toBeInTheDocument()

    const toggleBtn = screen.getByRole('button', { name: /show for students/i })
    expect(toggleBtn).toBeInTheDocument()

    fireEvent.click(toggleBtn)

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/clubs/c1/budget-visibility', {
        showBudgetToMembers: true,
      })
      expect(screen.getByText('Visible to Students')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /hide for students/i })).toBeInTheDocument()
    })
  })

  it('allows Faculty Advisor to watch the budget in view-only mode, seeing the visibility status but without the toggle button', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/memberships/me') {
        return Promise.resolve({ data: [] })
      }
      if (url === '/clubs') {
        return Promise.resolve({
          data: [{ id: 'c1', name: 'Tech Innovators', showBudgetToMembers: false }],
        })
      }
      if (url.includes('/expenses/ledger')) {
        return Promise.resolve({
          data: {
            totalIncome: 50000,
            totalExpenses: 12000,
            balance: 38000,
            expenses: [
              {
                id: 'tx-1',
                description: 'Robotics Kit',
                amount: 12000,
                entryType: 'EXPENSE',
                category: 'Equipment',
                expenseDate: '2026-10-01',
                status: 'APPROVED',
              },
            ],
            eventBudgets: [],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<BudgetFinancePage />, {
      initialState: {
        auth: { user: { id: 'adv-1', name: 'Dr. Advisor', role: 'FACULTY_ADVISOR' } },
      },
    })

    // Faculty Advisor can watch all budget components
    expect(await screen.findByText('Student Member Budget Visibility')).toBeInTheDocument()
    expect(await screen.findByText('Hidden from Students')).toBeInTheDocument()
    expect(await screen.findByText('Advisor View Only')).toBeInTheDocument()
    expect(await screen.findByText(/only president can toggle visibility/i)).toBeInTheDocument()

    // Faculty Advisor cannot toggle visibility (no toggle button)
    expect(screen.queryByRole('button', { name: /show for students/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hide for students/i })).not.toBeInTheDocument()

    // Faculty Advisor can view ledger transactions
    expect(await screen.findByText('Robotics Kit')).toBeInTheDocument()
    // Faculty Advisor can export CSV
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeInTheDocument()
  })
});

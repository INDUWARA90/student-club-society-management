import { configureStore } from '@reduxjs/toolkit'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import UniversityStatsPage from './UniversityStatsPage'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
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
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>,
  )
}

describe('UniversityStatsPage', () => {
  it('restricts access for normal students', async () => {
    renderWithProviders(<UniversityStatsPage />, {
      initialState: {
        auth: { user: { id: 's1', name: 'Normal Student', role: 'STUDENT' } },
      },
    })

    expect(await screen.findByText(/restricted access/i)).toBeInTheDocument()
    expect(
      screen.getByText(/university budget and analytics are restricted to faculty advisors/i),
    ).toBeInTheDocument()
  })

  it('allows access for super admin and loads metrics', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/analytics/university') {
        return Promise.resolve({
          data: {
            totalClubs: 12,
            totalStudents: 450,
            totalEvents: 30,
            totalPaymentsCollected: 1200,
            averageEventAttendance: 45,
            activeMemberships: 320,
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<UniversityStatsPage />, {
      initialState: {
        auth: { user: { id: 'a1', name: 'Admin', role: 'SUPER_ADMIN' } },
      },
    })

    expect(await screen.findByText(/university-wide analytics/i)).toBeInTheDocument()
    expect(await screen.findByText('Published events')).toBeInTheDocument()
  })

  it('renders per-club payments separately for faculty advisor', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockImplementation((url) => {
      if (url === '/analytics/university') {
        return Promise.resolve({
          data: {
            totalClubs: 2,
            totalStudents: 100,
            totalEvents: 8,
            totalPaymentsCollected: 250,
            pendingClubProposals: 0,
            pendingEventApprovals: 0,
            clubPayments: [
              {
                clubId: 'c1',
                clubName: 'Robotics Society',
                clubCategory: 'Engineering',
                membershipPayments: 90,
                eventPayments: 60,
                totalCollected: 150,
                transactionCount: 5,
              },
              {
                clubId: 'c2',
                clubName: 'Drama Club',
                clubCategory: 'Arts',
                membershipPayments: 45,
                eventPayments: 35,
                totalCollected: 80,
                transactionCount: 3,
              },
            ],
          },
        })
      }
      return Promise.resolve({ data: [] })
    })

    renderWithProviders(<UniversityStatsPage />, {
      initialState: {
        auth: { user: { id: 'fa1', name: 'Advisor Smith', role: 'FACULTY_ADVISOR' } },
      },
    })

    expect(await screen.findByText('Payments Collected by Society')).toBeInTheDocument()
    expect(screen.getByText('Robotics Society')).toBeInTheDocument()
    expect(screen.getByText('Drama Club')).toBeInTheDocument()
    expect(screen.getByText('$150.00')).toBeInTheDocument()
    expect(screen.getByText('$80.00')).toBeInTheDocument()
    expect(screen.getByText('$90.00')).toBeInTheDocument()
    expect(screen.getByText('$45.00')).toBeInTheDocument()
  })
})

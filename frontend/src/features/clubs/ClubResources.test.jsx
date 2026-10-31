import { configureStore } from '@reduxjs/toolkit'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { describe, expect, it, vi } from 'vitest'
import ToastProvider from '../../components/ToastProvider'
import ClubResources from './ClubResources'

vi.mock('../../api/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const sampleResources = [
  {
    id: 'res-1',
    title: 'Hackathon Award Ceremony',
    fileName: 'award.jpg',
    contentType: 'image/jpeg',
    fileB64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    uploadedById: 'user-1',
    uploadedByName: 'Alice President',
    createdAt: '2026-10-15T10:00:00Z',
  },
  {
    id: 'res-2',
    title: 'Robotics Workshop Day 1',
    fileName: 'workshop.png',
    contentType: 'image/png',
    fileB64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    uploadedById: 'user-1',
    uploadedByName: 'Alice President',
    createdAt: '2026-10-16T12:00:00Z',
  },
  {
    id: 'res-3',
    title: 'Club Constitution 2026',
    fileName: 'constitution.pdf',
    contentType: 'application/pdf',
    fileB64: 'data:application/pdf;base64,JVBERi0xLjQK',
    uploadedById: 'user-2',
    uploadedByName: 'Bob Secretary',
    createdAt: '2026-10-10T09:00:00Z',
  },
]

function renderComponent(props = {}) {
  const store = configureStore({
    reducer: {
      auth: (state = { user: { id: 'user-1', role: 'STUDENT' } }) => state,
    },
  })

  return render(
    <Provider store={store}>
      <ToastProvider>
        <ClubResources clubId="club-1" isOfficer={true} isPresident={true} {...props} />
      </ToastProvider>
    </Provider>,
  )
}

describe('ClubResources Gallery', () => {
  it('renders Gallery header, filter tabs, and displays proper image previews', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockResolvedValueOnce({ data: sampleResources })

    renderComponent()

    expect(await screen.findByRole('heading', { level: 2, name: /club gallery & media/i })).toBeInTheDocument()

    // Tabs
    expect(screen.getByRole('button', { name: /all media \(3\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /photos \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /documents \(1\)/i })).toBeInTheDocument()

    // Proper Image previews
    const images = await screen.findAllByRole('img')
    expect(images.length).toBe(2)
    expect(images[0]).toHaveAttribute('src', 'data:image/jpeg;base64,/9j/4AAQSkZJRg==')
    expect(images[1]).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')

    // Image titles
    expect(screen.getByText('Hackathon Award Ceremony')).toBeInTheDocument()
    expect(screen.getByText('Robotics Workshop Day 1')).toBeInTheDocument()

    // Document card
    expect(screen.getByText('Club Constitution 2026')).toBeInTheDocument()
    expect(screen.getByText('PDF')).toBeInTheDocument()
  })

  it('filters gallery when clicking Photos and Documents tabs', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockResolvedValueOnce({ data: sampleResources })

    renderComponent()

    expect(await screen.findByText('Hackathon Award Ceremony')).toBeInTheDocument()

    // Switch to Photos
    fireEvent.click(screen.getByRole('button', { name: /photos \(2\)/i }))
    expect(screen.getByText('Hackathon Award Ceremony')).toBeInTheDocument()
    expect(screen.queryByText('Club Constitution 2026')).not.toBeInTheDocument()

    // Switch to Documents
    fireEvent.click(screen.getByRole('button', { name: /documents \(1\)/i }))
    expect(screen.getByText('Club Constitution 2026')).toBeInTheDocument()
    expect(screen.queryByText('Hackathon Award Ceremony')).not.toBeInTheDocument()
  })

  it('opens interactive lightbox modal when an image preview is clicked', async () => {
    const axios = (await import('../../api/axios')).default
    axios.get.mockResolvedValueOnce({ data: sampleResources })

    renderComponent()

    const firstImage = await screen.findByAltText('Hackathon Award Ceremony')
    fireEvent.click(firstImage)

    // Lightbox modal is open
    expect(screen.getByRole('dialog', { name: 'Hackathon Award Ceremony' })).toBeInTheDocument()
    expect(screen.getByText(/photo 1 of 2/i)).toBeInTheDocument()

    // Navigate to next photo using arrow button
    const nextBtn = screen.getByTitle(/next photo/i)
    fireEvent.click(nextBtn)
    expect(screen.getByRole('dialog', { name: 'Robotics Workshop Day 1' })).toBeInTheDocument()
    expect(screen.getByText(/photo 2 of 2/i)).toBeInTheDocument()

    // Close lightbox
    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog', { name: 'Robotics Workshop Day 1' })).not.toBeInTheDocument()
  })
})

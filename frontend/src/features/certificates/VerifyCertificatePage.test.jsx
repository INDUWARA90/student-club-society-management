import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api/axios'
import VerifyCertificatePage from './VerifyCertificatePage'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn() },
}))

function renderAt(code) {
  return render(
    <MemoryRouter initialEntries={[`/verify-certificate/${code}`]}>
      <Routes>
        <Route path="/verify-certificate/:code" element={<VerifyCertificatePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('VerifyCertificatePage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirms a genuine certificate with only the public details', async () => {
    api.get.mockResolvedValue({
      data: { valid: true, holderName: 'Ada Lovelace', clubName: 'Chess Club', issuedAt: '2026-01-15T10:00:00Z' },
    })

    renderAt('abc-123')

    expect(await screen.findByText(/genuine certificate/i)).toBeInTheDocument()
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText(/chess club/i)).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/certificates/verify/abc-123')
  })

  it('says so plainly when the code does not match anything', async () => {
    api.get.mockResolvedValue({ data: { valid: false } })

    renderAt('forged')

    expect(await screen.findByText(/certificate not found/i)).toBeInTheDocument()
    expect(screen.queryByText(/genuine certificate/i)).not.toBeInTheDocument()
  })

  it('reports a temporary problem instead of a false verdict', async () => {
    api.get.mockRejectedValue(new Error('network down'))

    renderAt('abc-123')

    expect(await screen.findByText(/could not check this certificate/i)).toBeInTheDocument()
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument()
  })

  it('encodes odd characters in the code', async () => {
    api.get.mockResolvedValue({ data: { valid: false } })

    renderAt('a%20b')

    await screen.findByText(/certificate not found/i)
    expect(api.get).toHaveBeenCalledWith('/certificates/verify/a%20b')
  })
})

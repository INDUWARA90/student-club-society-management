import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import Modal from './Modal'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && (
        <Modal title="Edit thing" onClose={() => setOpen(false)}>
          <input aria-label="First field" />
          <button>Save</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal accessibility', () => {
  it('moves focus into the dialog, keeps Tab inside it and returns focus to the opener on close', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open' })

    await user.click(opener)
    expect(screen.getByLabelText('First field')).toHaveFocus()

    // Tab order inside the dialog: field -> Save -> Close -> wraps back to the field
    await user.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('First field')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})

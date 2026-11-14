import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from './test/a11y'
import { WakeIndicator } from './WakeIndicator'

describe('WakeIndicator', () => {
  it('shows that the page is listening, with a way to turn it off', async () => {
    const off = vi.fn()
    const { container } = render(<WakeIndicator state="listening" onTurnOff={off} />)
    expect(screen.getByRole('status')).toHaveTextContent('Listening for “Hey Echo”')
    await userEvent.click(screen.getByRole('button', { name: 'Turn off “Hey Echo”' }))
    expect(off).toHaveBeenCalledOnce()
    await expectNoA11yViolations(container)
  })

  it.each(['off', 'unsupported', 'paused'] as const)('says nothing when %s', state => {
    render(<WakeIndicator state={state} onTurnOff={() => {}} />)
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('explains a refusal', () => {
    render(<WakeIndicator state="blocked" onTurnOff={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent(/refused the microphone/)
  })
})

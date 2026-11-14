import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { RangeSlider } from './RangeSlider'

// jsdom has no ResizeObserver, which the RangeSlider (Radix) uses to measure its handles.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })


const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Next January']

function Harness({ start = [2, 8] as [number, number] }) {
  const [value, setValue] = useState(start)
  return <RangeSlider labels={['Date A', 'Date B']} value={value} min={0} max={12} onChange={setValue} describe={i => `${MONTHS[i]} 2024`} />
}

const a = () => screen.getByRole('slider', { name: 'Date A' })
const b = () => screen.getByRole('slider', { name: 'Date B' })

describe('RangeSlider', () => {
  it('has two sliders, found by name, that read their value as a date', () => {
    render(<Harness />)
    expect(a()).toHaveAttribute('aria-valuetext', 'March 2024')
    expect(b()).toHaveAttribute('aria-valuetext', 'September 2024')
  })

  it('steps one with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    a().focus()
    await user.keyboard('{ArrowRight}')
    expect(a()).toHaveAttribute('aria-valuetext', 'April 2024')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(a()).toHaveAttribute('aria-valuetext', 'February 2024')
    expect(b()).toHaveAttribute('aria-valuetext', 'September 2024')
  })

  it('steps five with Page Up and Page Down, and goes to the ends with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness start={[1, 6]} />)
    b().focus()
    await user.keyboard('{PageUp}')
    expect(b()).toHaveAttribute('aria-valuenow', '11')
    await user.keyboard('{PageDown}')
    expect(b()).toHaveAttribute('aria-valuenow', '6')
    await user.keyboard('{Home}')
    expect(b()).toHaveAttribute('aria-valuenow', '2')
    await user.keyboard('{End}')
    expect(b()).toHaveAttribute('aria-valuenow', '12')
    a().focus()
    await user.keyboard('{End}')
    expect(a()).toHaveAttribute('aria-valuenow', '11')
    await user.keyboard('{Home}')
    expect(a()).toHaveAttribute('aria-valuenow', '0')
  })

  it('never lets the thumbs cross or meet', async () => {
    const user = userEvent.setup()
    render(<Harness start={[4, 6]} />)
    a().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{PageUp}')
    expect(a()).toHaveAttribute('aria-valuenow', '5')
    expect(b()).toHaveAttribute('aria-valuenow', '6')
    b().focus()
    await user.keyboard('{ArrowLeft}{PageDown}{Home}')
    expect(b()).toHaveAttribute('aria-valuenow', '6')
    expect(a()).toHaveAttribute('aria-valuenow', '5')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<Harness />)
    await expectNoA11yViolations(container)
  })
})

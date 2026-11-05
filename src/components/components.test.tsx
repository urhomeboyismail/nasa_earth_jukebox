import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerProvider, Button, Card, Notice, Slider, useAnnounce } from '.'

describe('Button', () => {
  it('is a button that does not submit forms by default, and passes accessibility checks', async () => {
    const onClick = vi.fn()
    const { container } = render(<Button onClick={onClick}>Play</Button>)
    const button = screen.getByRole('button', { name: 'Play' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).not.toHaveAttribute('aria-pressed')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    await expectNoA11yViolations(container)
  })

  it('works as a toggle with aria-pressed', async () => {
    function Toggle() {
      const [on, setOn] = useState(false)
      return <Button pressed={on} onClick={() => setOn(!on)}>Vibration</Button>
    }
    const { container } = render(<Toggle />)
    const button = screen.getByRole('button', { name: 'Vibration' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await expectNoA11yViolations(container)
  })

  it('is reachable and activated by keyboard', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Stop</Button>)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveFocus()
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Slider', () => {
  it('has a label, a value in words, and passes accessibility checks', async () => {
    const { container } = render(<Slider label="Date" min={0} max={3} value={2} onChange={() => {}} describe={v => `Date number ${v + 1}: warm`} />)
    const slider = screen.getByRole('slider', { name: 'Date' })
    expect(slider).toHaveAttribute('aria-valuetext', 'Date number 3: warm')
    expect(screen.getByText('Date number 3: warm')).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })

  it('can be focused with Tab and reports each change as a number', async () => {
    const onChange = vi.fn()
    render(<Slider label="Volume" min={0} max={10} value={5} onChange={onChange} />)
    await userEvent.tab()
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveFocus()
    // jsdom does not move a range input on arrow keys, so send the change a browser would.
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } })
    expect(onChange).toHaveBeenCalledWith(6)
  })

  it('shows the plain number when no description is given', () => {
    render(<Slider label="Volume" min={0} max={10} value={5} onChange={() => {}} />)
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '5')
  })
})

describe('Announcer', () => {
  function Button2({ text }: { text: string }) {
    const announce = useAnnounce()
    return <button type="button" onClick={() => announce(text)}>Say it</button>
  }

  it('puts a message in one polite live region and passes accessibility checks', async () => {
    const { container } = render(<AnnouncerProvider><Button2 text="March 2024: warm" /></AnnouncerProvider>)
    await userEvent.click(screen.getByRole('button'))
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('March 2024: warm')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1)
    await expectNoA11yViolations(container)
  })

  it('changes the text when the same message is announced twice, so it is spoken again', async () => {
    render(<AnnouncerProvider><Button2 text="Same" /></AnnouncerProvider>)
    await userEvent.click(screen.getByRole('button'))
    const first = screen.getByRole('status').textContent
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('status').textContent).not.toBe(first)
    expect(screen.getByRole('status').textContent?.trim()).toBe('Same')
  })

  describe('with busy messages (T93)', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    const text = () => screen.getByRole('status').textContent?.trim()
    function Sender() {
      const announce = useAnnounce()
      return (
        <>
          <button type="button" onClick={() => announce('busy 1', { busy: true })}>One</button>
          <button type="button" onClick={() => announce('busy 2', { busy: true })}>Two</button>
          <button type="button" onClick={() => announce('busy 3', { busy: true })}>Three</button>
          <button type="button" onClick={() => announce('plain')}>Plain</button>
        </>
      )
    }
    const press = (name: string) => act(() => { screen.getByRole('button', { name }).click() })
    const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

    it('speaks a busy message at once when nothing was said for 1.5 s, holds the next, and keeps only the newest', () => {
      render(<AnnouncerProvider><Sender /></AnnouncerProvider>)
      press('One')
      expect(text()).toBe('busy 1')
      wait(400)
      press('Two')
      wait(400)
      press('Three')
      expect(text()).toBe('busy 1')
      wait(699)
      expect(text()).toBe('busy 1')
      wait(1)
      expect(text()).toBe('busy 3') // at 1500 ms; "busy 2" was dropped
      wait(5000)
      expect(text()).toBe('busy 3')
    })

    it('speaks a message that is not busy at once, and the busy one that was waiting is dropped', () => {
      render(<AnnouncerProvider><Sender /></AnnouncerProvider>)
      press('One')
      wait(100)
      press('Two')
      press('Plain')
      expect(text()).toBe('plain')
      wait(5000)
      expect(text()).toBe('plain')
    })
  })

  it('does nothing outside a provider', async () => {
    render(<Button2 text="x" />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Card', () => {
  it('has a heading at the chosen level and passes accessibility checks', async () => {
    const { container } = render(<main><h1>Page</h1><Card title="Warm" headingLevel={2}><p>Plays G4.</p></Card><Card title="Detail" headingLevel={3}>x</Card></main>)
    expect(screen.getByRole('heading', { level: 2, name: 'Warm' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Detail' })).toBeInTheDocument()
    await expectNoA11yViolations(container)
  })
})

describe('Notice', () => {
  it('announces an error at once and says "Error" in words', async () => {
    const { container } = render(<Notice variant="error">The data could not be loaded.</Notice>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Error: The data could not be loaded.')
    await expectNoA11yViolations(container)
  })

  it('is a polite status by default', async () => {
    const { container } = render(<Notice>Now playing.</Notice>)
    expect(screen.getByRole('status')).toHaveTextContent('Now playing.')
    await expectNoA11yViolations(container)
  })
})

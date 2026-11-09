import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerProvider, Button, ButtonGroup, Card, Notice, Slider, useAnnounce } from '.'

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

describe('Material 3 Expressive variants (T116)', () => {
  it.each(['primary', 'filled', 'secondary', 'tonal', 'outlined', 'text', 'elevated'] as const)('draws a %s button that is still an accessible button', async variant => {
    const { container } = render(<Button variant={variant}>Play</Button>)
    const button = screen.getByRole('button', { name: 'Play' })
    expect(button).toHaveClass('ui-button', `ui-button--${variant === 'filled' ? 'primary' : variant}`)
    await expectNoA11yViolations(container)
  })

  it('keeps the original look when no new prop is given', () => {
    render(<Button>Play</Button>)
    const button = screen.getByRole('button', { name: 'Play' })
    expect(button.className).toBe('ui-button ui-button--secondary')
  })

  it('has three sizes, the smallest being the original 44 px one, and a square shape', () => {
    render(<>
      <Button size="s">Small</Button>
      <Button size="m">Medium</Button>
      <Button size="l" shape="square">Large</Button>
    </>)
    expect(screen.getByRole('button', { name: 'Small' })).not.toHaveClass('ui-button--m', 'ui-button--l')
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveClass('ui-button--m')
    expect(screen.getByRole('button', { name: 'Large' })).toHaveClass('ui-button--l', 'ui-button--square')
  })

  it('stays a toggle with a square shape', async () => {
    function Toggle() {
      const [on, setOn] = useState(false)
      return <Button shape="square" pressed={on} onClick={() => setOn(!on)}>Vibration</Button>
    }
    const { container } = render(<Toggle />)
    const button = screen.getByRole('button', { name: 'Vibration' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await expectNoA11yViolations(container)
  })

  it('joins buttons in a labelled group that is reached and used by keyboard', async () => {
    function Choice() {
      const [style, setStyle] = useState('full')
      return (
        <ButtonGroup label="Sound style">
          <Button pressed={style === 'full'} onClick={() => setStyle('full')}>Full</Button>
          <Button pressed={style === 'change'} onClick={() => setStyle('change')}>Change</Button>
        </ButtonGroup>
      )
    }
    const { container } = render(<Choice />)
    expect(screen.getByRole('group', { name: 'Sound style' })).toBeInTheDocument()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Full' })).toHaveFocus()
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Change' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'false')
    await expectNoA11yViolations(container)
  })

  it('draws a card as outlined, filled or elevated, with its heading intact', async () => {
    const { container } = render(<main><h1>Page</h1>
      <Card title="Outlined">a</Card>
      <Card title="Filled" variant="filled">b</Card>
      <Card title="Elevated" variant="elevated">c</Card>
    </main>)
    const section = (title: string) => screen.getByRole('heading', { name: title }).closest('section')
    expect(section('Outlined')?.className).toBe('ui-card')
    expect(section('Filled')).toHaveClass('ui-card--filled')
    expect(section('Elevated')).toHaveClass('ui-card--elevated')
    await expectNoA11yViolations(container)
  })

  it('tells the slider how far along the track the value is, without changing what it reports', () => {
    render(<Slider label="Date" min={10} max={20} value={15} onChange={() => {}} />)
    const slider = screen.getByRole('slider', { name: 'Date' })
    expect(slider.style.getPropertyValue('--pct')).toBe('50%')
    expect(slider).toHaveAttribute('aria-valuetext', '15')
  })

  it('has a slider with no range and no fill rather than a broken one', () => {
    render(<Slider label="Date" min={0} max={0} value={0} onChange={() => {}} />)
    expect(screen.getByRole('slider', { name: 'Date' }).style.getPropertyValue('--pct')).toBe('0%')
  })
})

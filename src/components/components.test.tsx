import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../test/a11y'
import { AnnouncerProvider, Button, ButtonGroup, Card, IconButton, LoadingIndicator, Notice, Slider, useAnnounce } from '.'

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

  it('announces a warning at once and says "Warning" in words', async () => {
    const { container } = render(<Notice variant="warning">No sound is reaching the microphone.</Notice>)
    expect(screen.getByRole('alert')).toHaveTextContent('Warning: No sound is reaching the microphone.')
    await expectNoA11yViolations(container)
  })

  it('can carry an action button', async () => {
    const onClick = vi.fn()
    const { container } = render(<Notice variant="error" action={{ label: 'Try again', onClick }}>The data could not be loaded.</Notice>)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    await expectNoA11yViolations(container)
  })
})

describe('Button styles', () => {
  it('keeps the original variant names and adds the Material 3 Expressive ones and sizes', async () => {
    const { container } = render(<>
      <Button variant="primary">Filled (old name)</Button>
      <Button>Outlined (old default)</Button>
      <Button variant="tonal" size="medium">Tonal</Button>
      <Button variant="text">Text</Button>
      <Button variant="elevated" size="large">Elevated</Button>
    </>)
    expect(screen.getByRole('button', { name: 'Filled (old name)' })).toHaveClass('ui-button', 'ui-button--primary')
    expect(screen.getByRole('button', { name: 'Outlined (old default)' })).toHaveClass('ui-button--secondary')
    expect(screen.getByRole('button', { name: 'Tonal' })).toHaveClass('ui-button--tonal', 'ui-button--medium')
    expect(screen.getByRole('button', { name: 'Elevated' })).toHaveClass('ui-button--elevated', 'ui-button--large')
    expect(screen.getByRole('button', { name: 'Text' }).className).not.toMatch(/--small/)
    await expectNoA11yViolations(container)
  })
})

describe('IconButton', () => {
  const icon = <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" /></svg>

  it('is named by its label and passes accessibility checks', async () => {
    const onClick = vi.fn()
    const { container } = render(<IconButton aria-label="Close voice guide" onClick={onClick}>{icon}</IconButton>)
    const button = screen.getByRole('button', { name: 'Close voice guide' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('ui-icon-button', 'ui-icon-button--standard')
    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    await expectNoA11yViolations(container)
  })

  it('works as a toggle that keeps one fixed label', async () => {
    function Mute() {
      const [muted, setMuted] = useState(false)
      return <IconButton aria-label="Mute microphone" variant="tonal" pressed={muted} onClick={() => setMuted(!muted)}>{icon}</IconButton>
    }
    const { container } = render(<Mute />)
    const button = screen.getByRole('button', { name: 'Mute microphone' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: 'Mute microphone' })).toHaveAttribute('aria-pressed', 'true')
    await expectNoA11yViolations(container)
  })
})

describe('ButtonGroup', () => {
  const speeds = [
    { value: 'slow', label: 'Slow' },
    { value: 'normal', label: 'Normal' },
    { value: 'fast', label: 'Fast' },
  ] as const

  function Speed({ disabled }: { disabled?: boolean }) {
    const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
    return <ButtonGroup type="connected" legend="Speed" options={speeds} value={speed} onChange={setSpeed} disabled={disabled} />
  }

  it('connected: is a radio group with its legend, and passes accessibility checks', async () => {
    const { container } = render(<Speed />)
    expect(screen.getByRole('group', { name: 'Speed' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
    await expectNoA11yViolations(container)
  })

  it('connected: a click or the arrow keys change the choice', async () => {
    render(<Speed />)
    await userEvent.click(screen.getByText('Fast'))
    expect(screen.getByRole('radio', { name: 'Fast' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Normal' })).not.toBeChecked()
    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Normal' })).toBeChecked()
  })

  it('connected: can be disabled as a whole', () => {
    render(<Speed disabled />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })

  it('connected: can start with nothing chosen and hide its legend visually', async () => {
    const onChange = vi.fn()
    const { container } = render(
      <ButtonGroup type="connected" legend="Which is warmer?" hideLegend value={null} onChange={onChange}
        options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />,
    )
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
    expect(screen.getByRole('group', { name: 'Which is warmer?' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
    await expectNoA11yViolations(container)
  })

  it('standard: groups buttons under a label', async () => {
    const { container } = render(<ButtonGroup label="Playback"><Button>Play</Button><Button>Stop</Button></ButtonGroup>)
    expect(screen.getByRole('group', { name: 'Playback' })).toContainElement(screen.getByRole('button', { name: 'Play' }))
    await expectNoA11yViolations(container)
  })
})

describe('Card variants', () => {
  it('is elevated by default and can be filled or outlined', () => {
    render(<><Card title="A">x</Card><Card title="B" variant="filled">x</Card><Card title="C" variant="outlined">x</Card></>)
    expect(screen.getByRole('heading', { name: 'A' }).closest('section')).toHaveClass('ui-card--elevated')
    expect(screen.getByRole('heading', { name: 'B' }).closest('section')).toHaveClass('ui-card--filled')
    expect(screen.getByRole('heading', { name: 'C' }).closest('section')).toHaveClass('ui-card--outlined')
  })
})

describe('Slider look', () => {
  it('tells the CSS how far along the handle is, and keeps one readable copy of the value', () => {
    const { container } = render(<Slider label="Date" min={0} max={4} value={1} onChange={() => {}} describe={() => 'April 2024: mild'} />)
    expect(container.querySelector<HTMLElement>('.ui-slider')!.style.getPropertyValue('--ui-fill')).toBe('0.25')
    expect(screen.getAllByText('April 2024: mild')).toHaveLength(1)
  })

  it('handles a slider with a single value', () => {
    const { container } = render(<Slider label="Date" min={0} max={0} value={0} onChange={() => {}} />)
    expect(container.querySelector<HTMLElement>('.ui-slider')!.style.getPropertyValue('--ui-fill')).toBe('0')
  })
})

describe('LoadingIndicator', () => {
  it('says what is loading in a polite status and passes accessibility checks', async () => {
    const { container } = render(<LoadingIndicator label="Analyzing the images…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Analyzing the images…')
    await expectNoA11yViolations(container)
  })

  it('can hide its words on screen but not from screen readers', () => {
    render(<LoadingIndicator hideLabel />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.getByText('Loading…')).toHaveClass('ui-visually-hidden')
  })
})

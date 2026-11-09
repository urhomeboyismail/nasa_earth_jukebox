import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishContext } from '../../assistant/context'
import { expectNoA11yViolations } from '../../test/a11y'
import { onPlayerCommand, type PlayerCommand } from '../player/controls'
import { DemoControl } from './DemoControl'
import { DEMO_STEPS } from './script'

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const caption = () => document.querySelector('.demo__caption')?.textContent
let commands: PlayerCommand[]
let off: () => void

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  window.location.hash = ''
  commands = []
  off = onPlayerCommand(command => commands.push(command))
})
afterEach(() => { off(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('DemoControl', () => {
  it('walks the pages with a caption, plays the dates and says it has finished', async () => {
    const user = userEvent.setup({ delay: null })
    render(<DemoControl />)
    const button = screen.getByRole('button', { name: 'Play the demo' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Stop the demo' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.location.hash).toBe('#home')
    expect(caption()).toBe(DEMO_STEPS[0].say)
    await tick(7000)
    expect(window.location.hash).toBe('#learn')
    await tick(7000)
    // On Listen it sends play until the player says it is playing, then waits for the end.
    expect(window.location.hash).toBe('#listen')
    await tick(1300)
    expect(commands.filter(command => command === 'play').length).toBeGreaterThanOrEqual(2)
    act(() => publishContext('player', { playing: true }))
    commands.length = 0
    await tick(2000)
    expect(commands).toEqual([])
    act(() => publishContext('player', { playing: false }, 'playback_finished:fixture'))
    await tick(0)
    expect(window.location.hash).toBe('#compare')
    await tick(7000)
    await tick(7000)
    await tick(4000)
    expect(caption()).toBe('The demo has finished.')
    expect(screen.getByRole('button', { name: 'Play the demo' })).toBeInTheDocument()
  })

  it('stops with the button, or Escape, and stops the sound', async () => {
    const user = userEvent.setup({ delay: null })
    render(<DemoControl />)
    await user.click(screen.getByRole('button', { name: 'Play the demo' }))
    await tick(7000)
    await user.click(screen.getByRole('button', { name: 'Stop the demo' }))
    await tick(0)
    expect(caption()).toBe('The demo was stopped.')
    expect(commands).toContain('stop')
    expect(window.location.hash).toBe('#learn')
    await tick(20000)
    expect(window.location.hash).toBe('#learn')

    await user.click(screen.getByRole('button', { name: 'Play the demo' }))
    await user.keyboard('{Escape}')
    await tick(0)
    expect(caption()).toBe('The demo was stopped.')
  })

  it('has no accessibility violations', async () => {
    const { container } = render(<DemoControl />)
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

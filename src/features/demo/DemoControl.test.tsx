import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishContext } from '../../assistant/context'
import { expectNoA11yViolations } from '../../test/a11y'
import { onPlayerCommand, type PlayerCommand } from '../player/controls'
import { onPredictRequest, reportPredictDone } from '../predict/bus'
import { DemoControl } from './DemoControl'
import * as speech from '../welcome/speak'
import * as welcome from '../welcome/storage'
import { DEMO_STEPS } from './script'

vi.mock('../welcome/speak', () => ({ speak: vi.fn(() => Promise.resolve()), hush: vi.fn() }))

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
afterEach(() => { off(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.mocked(speech.speak).mockClear(); vi.mocked(speech.hush).mockClear(); vi.restoreAllMocks() })

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
    // The question step: no player is mounted here to ask it, so the tour gives up on it after five seconds.
    expect(window.location.hash).toBe('#listen')
    await tick(5000)
    expect(window.location.hash).toBe('#about')
    await tick(7000)
    await tick(4000)
    expect(caption()).toBe('The demo has finished.')
    expect(screen.getByRole('button', { name: 'Play the demo' })).toBeInTheDocument()
  })

  it('waits for the question to be answered before it moves on (IX05)', async () => {
    const user = userEvent.setup({ delay: null })
    const stopListening = onPredictRequest(() => {})
    render(<DemoControl />)
    await user.click(screen.getByRole('button', { name: 'Play the demo' }))
    await tick(14000)
    act(() => publishContext('player', { playing: true }))
    act(() => publishContext('player', { playing: false }, 'playback_finished:fixture'))
    await tick(0)
    expect(window.location.hash).toBe('#listen')
    // A player has the question: the tour holds past the usual give-up time.
    await tick(30000)
    expect(window.location.hash).toBe('#listen')
    act(() => reportPredictDone())
    await tick(0)
    expect(window.location.hash).toBe('#about')
    stopListening()
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

  describe('Read the demo aloud', () => {
    it('is a labelled switch, off by default, and nothing is spoken while it is off', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = render(<DemoControl />)
      const toggle = screen.getByRole('checkbox', { name: 'Read the demo aloud' })
      expect(toggle).not.toBeChecked()
      await user.click(screen.getByRole('button', { name: 'Play the demo' }))
      await tick(7000)
      expect(speech.speak).not.toHaveBeenCalled()
      expect(caption()).toBe(DEMO_STEPS[1].say)
      vi.useRealTimers()
      await expectNoA11yViolations(container)
    })

    it('speaks each caption in order, pausing the music first, and only the play step sends play', async () => {
      const user = userEvent.setup({ delay: null })
      render(<DemoControl />)
      await user.click(screen.getByRole('checkbox', { name: 'Read the demo aloud' }))
      await user.click(screen.getByRole('button', { name: 'Play the demo' }))
      await tick(0)
      expect(speech.speak).toHaveBeenNthCalledWith(1, DEMO_STEPS[0].say)
      expect(commands[0]).toBe('pause')
      await tick(7000)
      expect(speech.speak).toHaveBeenNthCalledWith(2, DEMO_STEPS[1].say)
      await tick(7000)
      expect(window.location.hash).toBe('#listen')
      await tick(1300)
      expect(commands.filter(command => command === 'pause').length).toBe(3)
      expect(commands.indexOf('play')).toBeGreaterThan(commands.lastIndexOf('pause'))
      expect(commands.filter(command => command === 'play').length).toBeGreaterThanOrEqual(1)
      expect(commands.slice(0, commands.indexOf('play')).every(command => command === 'pause')).toBe(true)
    })

    it('has no accessibility violations with the switch on', async () => {
      const user = userEvent.setup({ delay: null })
      const { container } = render(<DemoControl />)
      await user.click(screen.getByRole('checkbox', { name: 'Read the demo aloud' }))
      vi.useRealTimers()
      await expectNoA11yViolations(container)
    })

    it('is not shown on the screen reader path', () => {
      vi.spyOn(welcome, 'readWelcome').mockReturnValue({ done: true, speech: false, path: 'screen-reader' })
      render(<DemoControl />)
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('hushes the voice when the demo is stopped', async () => {
      const user = userEvent.setup({ delay: null })
      render(<DemoControl />)
      await user.click(screen.getByRole('button', { name: 'Play the demo' }))
      await user.click(screen.getByRole('button', { name: 'Stop the demo' }))
      expect(speech.hush).toHaveBeenCalled()
    })
  })

  it('ignores Escape when another control has already handled it', async () => {
    const user = userEvent.setup({ delay: null })
    render(<DemoControl />)
    await user.click(screen.getByRole('button', { name: 'Play the demo' }))
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    event.preventDefault()
    act(() => { window.dispatchEvent(event) })
    await tick(0)
    expect(screen.getByRole('button', { name: 'Stop the demo' })).toBeInTheDocument()
    expect(caption()).not.toBe('The demo was stopped.')
  })
})

import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { subscribeContext, type ContextUpdate } from '../../assistant/context'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import { sendPlayerCommand } from './controls'
import PlayerPage from '.'

const visualization = fixture as Visualization

// What the fixture frames give: cold, mild, hot and missing data.
const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const

// A stand-in engine with the contract's behaviour and timers, so the player is tested against the interface
// and not against whichever engine is on main today.
const fake = vi.hoisted(() => {
  type Step = { category: string; atMs: number }
  const engine = {
    sequences: [] as Step[][],
    played: [] as string[],
    timers: [] as number[],
    steps: [] as Step[],
    onStep: (_i: number) => {},
    next: 0,
    startedAt: 0,
    elapsedAtPause: 0,
    state: 'idle' as 'idle' | 'playing' | 'paused',
    unlock: async () => {},
    setVolume: (_v: number) => {},
    playSequence(steps: Step[], onStep: (i: number) => void) {
      engine.sequences.push(steps)
      engine.steps = steps
      engine.onStep = onStep
      engine.next = 0
      engine.schedule(0)
    },
    schedule(from: number) {
      engine.timers.forEach(t => window.clearTimeout(t))
      engine.timers = []
      engine.startedAt = Date.now() - from
      for (let i = engine.next; i < engine.steps.length; i++) {
        engine.timers.push(window.setTimeout(() => {
          engine.next = i + 1
          engine.played.push(engine.steps[i].category)
          engine.onStep(i)
          if (engine.next === engine.steps.length) engine.state = 'idle'
        }, Math.max(0, engine.steps[i].atMs - from)))
      }
      engine.state = 'playing'
    },
    pause() {
      if (engine.state !== 'playing') return
      engine.timers.forEach(t => window.clearTimeout(t))
      engine.elapsedAtPause = Date.now() - engine.startedAt
      engine.state = 'paused'
    },
    resume() {
      if (engine.state !== 'paused') return
      engine.schedule(Math.min(engine.elapsedAtPause, engine.steps[engine.next]?.atMs ?? engine.elapsedAtPause))
    },
    stop() { engine.timers.forEach(t => window.clearTimeout(t)); engine.timers = []; engine.next = 0; engine.state = 'idle' },
    reset() { engine.sequences = []; engine.played = []; engine.stop() },
  }
  return engine
})
vi.mock('../../audio', () => ({ createSoundEngine: () => fake }))

const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll }))

const analysis = () => visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: CATEGORIES[i] }))

function setup() {
  // No delay between key presses, so userEvent never waits on the fake clock.
  return userEvent.setup({ delay: null })
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const dateText = () => screen.getByRole('slider', { name: 'Date' }).getAttribute('aria-valuetext')
/** What the polite live region says. (The sliders' value outputs are separate.) */
const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  // Testing Library only advances fake timers after an event when it sees a global `jest`; without this it waits forever.
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  fake.reset()
  analyzeAll.mockReset()
  analyzeAll.mockImplementation(async () => analysis())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function renderReady() {
  const user = setup()
  const view = render(<PlayerPage visualization={visualization} />)
  await tick(0)
  return { user, ...view }
}

describe('Player: viewing', () => {
  it('shows a loading state, with the controls disabled, until the analysis finishes', async () => {
    let finish!: (value: ReturnType<typeof analysis>) => void
    analyzeAll.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<PlayerPage visualization={visualization} />)
    expect(screen.getByText('Analyzing the images…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
    await act(async () => { finish(analysis()) })
    expect(screen.queryByText('Analyzing the images…')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled()
  })

  it('shows the image with its alt text, the date written out, the region, the note and the credit', async () => {
    await renderReady()
    expect(screen.getByRole('img', { name: visualization.frames[0].altText })).toBeInTheDocument()
    expect(screen.getByText('15 January 2024')).toBeInTheDocument()
    expect(screen.getByText('Region: Central ocean')).toBeInTheDocument()
    expect(screen.getByText(/Earth Jukebox team/)).toBeInTheDocument()
  })

  it('hides the region outline from assistive technology', async () => {
    const { container } = await renderReady()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('says so when the sounds cannot be prepared', async () => {
    analyzeAll.mockRejectedValue(new Error('worker crashed'))
    render(<PlayerPage visualization={visualization} />)
    await tick(0)
    expect(screen.getByRole('alert')).toHaveTextContent(/could not be prepared.*worker crashed/)
  })

  it('has no accessibility violations', async () => {
    const { container } = await renderReady()
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })
})

describe('Player: playing', () => {
  it('plays from the first date, moving the image and slider with each sound and announcing each date once', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(fake.sequences[0].map(s => s.category)).toEqual(['cold', 'mild', 'hot', 'insufficient'])
    expect(fake.sequences[0].map(s => s.atMs)).toEqual([0, 1000, 2000, 3000])
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(liveText()).toBe('January 2024: cold')
    expect(screen.getByText('15 January 2024')).toBeInTheDocument()

    await tick(1000)
    expect(liveText()).toBe('July 2024: mild')
    expect(dateText()).toBe('July 2024: mild')
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('2024-07-15'))

    await tick(1000)
    expect(liveText()).toBe('December 2024: hot')
    await tick(1000)
    expect(liveText()).toBe('March 2025: no data')
  })

  it('keeps the slider, the image and the sound on the same date throughout', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    for (let i = 0; i < 4; i++) {
      await tick(i === 0 ? 0 : 1000)
      expect(fake.played.at(-1)).toBe(CATEGORIES[i])
      expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue(String(i))
      expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining(visualization.frames[i].date))
    }
  })

  it('uses the chosen speed', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(fake.sequences[0].map(s => s.atMs)).toEqual([0, 500, 1000, 1500])
    expect(screen.getByRole('button', { name: 'Fast' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Slow' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('carries on from the current date at the new speed when the speed changes mid-play', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(1000)
    await user.click(screen.getByRole('button', { name: 'Slow' }))
    await tick(0)
    expect(fake.sequences.at(-1)!.map(s => s.atMs)).toEqual([0, 1600, 3200])
    expect(fake.sequences.at(-1)![0].category).toBe('mild')
  })

  it('finishes, says so, and plays again from the start', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(4500)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText(/That is the last date/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(fake.sequences.at(-1)!).toHaveLength(4)
    expect(screen.queryByText(/That is the last date/)).toBeNull()
  })
})

describe('Player: pause, stop, replay', () => {
  it('pauses and resumes from the same date', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(1000)
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await tick(5000)
    expect(dateText()).toBe('July 2024: mild')
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await tick(1000)
    expect(dateText()).toBe('December 2024: hot')
  })

  it('stops and goes back to the first date', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(2000)
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await tick(5000)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('replays the current date on its own and announces it again', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(1000)
    await user.click(screen.getByRole('button', { name: 'Replay this date' }))
    await tick(0)
    expect(fake.sequences.at(-1)).toEqual([{ category: 'mild', atMs: 0 }])
    expect(dateText()).toBe('July 2024: mild')
    await tick(5000)
    expect(fake.sequences).toHaveLength(2) // nothing carried on afterwards
  })
})

describe('Player: the date slider', () => {
  it('jumps to that date and carries on playing from it', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    await jumpTo(2)
    await tick(0)
    expect(fake.sequences.at(-1)!.map(s => s.category)).toEqual(['hot', 'insufficient'])
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(dateText()).toBe('December 2024: hot')
  })

  it('plays just that date when it is moved while paused, and Play continues from there', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await jumpTo(1)
    await tick(0)
    expect(fake.sequences.at(-1)).toEqual([{ category: 'mild', atMs: 0 }])
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('2024-07-15'))
    await tick(5000)
    expect(fake.sequences).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(fake.sequences.at(-1)![0].category).toBe('mild')
    expect(fake.sequences.at(-1)).toHaveLength(3)
  })

  it('never leaves the image on one date and the sound on another after a jump', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(1000)
    await jumpTo(3)
    await tick(0)
    expect(fake.played.at(-1)).toBe('insufficient')
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('2025-03-15'))
    await tick(5000)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('3')
  })
})

async function jumpTo(i: number) {
  const slider = screen.getByRole('slider', { name: 'Date' })
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.change(slider, { target: { value: String(i) } })
  await tick(0)
}

describe('Player: keyboard', () => {
  it('Space plays and pauses while focus is in the player', async () => {
    const { user } = await renderReady()
    screen.getByRole('slider', { name: 'Volume' }).focus()
    await user.keyboard(' ')
    await tick(0)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
  })

  it('arrow keys step through the dates', async () => {
    const { user } = await renderReady()
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard('{ArrowRight}')
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('1')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
  })

  it('does not take Space from a focused button, which should press it once', async () => {
    const { user } = await renderReady()
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard(' ')
    await tick(0)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(fake.sequences).toHaveLength(0)
  })

  it('leaves a text box alone', async () => {
    const { user } = await renderReady()
    const box = document.createElement('input')
    box.type = 'text'
    screen.getByRole('region', { name: 'Player' }).append(box)
    box.focus()
    await user.keyboard(' {ArrowRight}')
    await tick(0)
    expect(fake.sequences).toHaveLength(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
  })

  it('does not step past the first or last date', async () => {
    const { user } = await renderReady()
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard('{ArrowLeft}')
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
    await jumpTo(3)
    await user.keyboard('{ArrowRight}')
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('3')
  })
})

describe('Player: the voice guide', () => {
  it('publishes where the player is, and announces the end of a sequence once', async () => {
    const updates: ContextUpdate[] = []
    const unsubscribe = subscribeContext(update => updates.push(update))
    const { user, unmount } = await renderReady()
    expect(updates.at(-1)).toMatchObject({ key: 'player', data: { visualization: 'fixture', date: '2024-01-15', region: 'centre', category: 'cold', playing: false } })

    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(1000)
    expect(updates.at(-1)).toMatchObject({ data: { date: '2024-07-15', category: 'mild', playing: true } })

    await tick(4000)
    expect(updates.filter(u => u.announce === 'playback_finished:fixture')).toHaveLength(1)
    unmount()
    expect(updates.at(-1)).toMatchObject({ key: 'player', data: null })
    unsubscribe()
  })

  it('obeys playback commands', async () => {
    await renderReady()
    act(() => sendPlayerCommand('play'))
    await tick(0)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    act(() => sendPlayerCommand('pause'))
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument()
    act(() => sendPlayerCommand('next'))
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('1')
    act(() => sendPlayerCommand('previous'))
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
    act(() => sendPlayerCommand({ setDate: '2024-12-15' }))
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('2')
    act(() => sendPlayerCommand({ setDate: '1999-01-01' }))
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('2')
    act(() => sendPlayerCommand('replay'))
    await tick(0)
    expect(fake.sequences.at(-1)).toEqual([{ category: 'hot', atMs: 0 }])
    act(() => sendPlayerCommand('stop'))
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('0')
  })

  it('stops listening for commands, and goes quiet, when the page is left', async () => {
    const { unmount } = await renderReady()
    act(() => sendPlayerCommand('play'))
    await tick(0)
    unmount()
    fake.played.length = 0
    act(() => sendPlayerCommand('play'))
    await tick(5000)
    expect(fake.played).toEqual([])
  })
})

describe('Player: vibration', () => {
  function supportVibration(on: boolean) {
    const vibrate = vi.fn((_pattern: number | number[]) => true)
    Object.defineProperty(navigator, 'vibrate', { value: on ? vibrate : undefined, configurable: true })
    return vibrate
  }
  afterEach(() => { supportVibration(false); window.localStorage.clear() })

  it('shows no setting where the phone cannot vibrate', async () => {
    supportVibration(false)
    await renderReady()
    expect(screen.queryByRole('button', { name: 'Vibration' })).toBeNull()
  })

  it('is off by default and does not buzz when the page opens', async () => {
    const vibrate = supportVibration(true)
    await renderReady()
    expect(screen.getByRole('button', { name: 'Vibration' })).toHaveAttribute('aria-pressed', 'false')
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('buzzes at each new date, longer for warmer ones, once it is turned on', async () => {
    const vibrate = supportVibration(true)
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Vibration' }))
    expect(screen.getByRole('button', { name: 'Vibration' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    await tick(1000)
    await tick(1000)
    await tick(1000)
    const patterns = vibrate.mock.calls.map(call => call[0] as number[])
    // January is cold (the shortest pulse), July mild, December hot (the longest), then missing data (two taps).
    expect(patterns).toEqual([[30], [75], [120], [25, 60, 25]])
    expect(patterns[0][0]).toBeLessThan(patterns[1][0])
  })

  it('buzzes when one date is chosen on its own, and when it is replayed', async () => {
    const vibrate = supportVibration(true)
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Vibration' }))
    await jumpTo(2)
    expect(vibrate).toHaveBeenLastCalledWith([120])
    await user.click(screen.getByRole('button', { name: 'Replay this date' }))
    await tick(0)
    expect(vibrate).toHaveBeenCalledTimes(2)
  })

  it('stays quiet while it is turned off', async () => {
    const vibrate = supportVibration(true)
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(2500)
    expect(vibrate).not.toHaveBeenCalled()
  })
})

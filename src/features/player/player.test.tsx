import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { subscribeContext, type ContextUpdate } from '../../assistant/context'
import { variableWords, type Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import { elevationFor, panFor } from '../../audio/pan'
import { sendPlayerCommand } from './controls'
import { dispatch } from '../../interaction/registry'
import { listedShortcuts } from '../../interaction/shortcuts'
import PlayerPage from '.'
import { resetOnboarding, saveOnboardingDone } from '../onboarding/store'
import { AnnouncerProvider } from '../../components'

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
    setStyle: vi.fn((_style: string) => {}),
    setSpatial: vi.fn((_mode: string) => {}),
    renderToWav: vi.fn(async (_steps: unknown[]): Promise<Blob> => new Blob(['wav'])),
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
// AU-UI: the interface cues are recorded, not sounded.
const playCue = vi.hoisted(() => vi.fn((_cue: string) => 0))
vi.mock('../../audio/cues', async importOriginal => ({ ...(await importOriginal<typeof import('../../audio/cues')>()), playCue }))

const analyzeAll = vi.hoisted(() => vi.fn())
// IX03: the sound map reads a grid of each date, and its ensemble is a recording stand-in (as in Explorer.test.tsx).
const analyzeGrid = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll, analyzeGrid }))
const ensemble = vi.hoisted(() => ({
  hold: vi.fn(), playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'on' as const), start: vi.fn(async () => {}), setDetail: vi.fn(),
}))
vi.mock('../../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'on', start: ensemble.start }) }))
// Following a hot spot reads each date's picture; here from the files on disk (jsdom cannot decode an image).
vi.mock('../../analysis/video/input', async importOriginal => {
  const { readFileSync } = await import('node:fs')
  const { decodePng } = await import('../../analysis/png')
  return {
    ...(await importOriginal<typeof import('../../analysis/video/input')>()),
    defaultLoadPixels: async (url: string) => decodePng(readFileSync(`public/data/mur-sst-mauritius/${url}`)),
  }
})

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
  playCue.mockClear()
  analyzeAll.mockReset()
  analyzeAll.mockImplementation(async () => analysis())
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

async function renderReady() {
  const user = setup()
  const view = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await tick(0)
  return { user, ...view }
}

describe('Player: viewing', () => {
  it('shows a loading state, with the controls disabled, until the analysis finishes', async () => {
    let finish!: (value: ReturnType<typeof analysis>) => void
    analyzeAll.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    expect(screen.getByText('Analyzing the images…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
    await act(async () => { finish(analysis()) })
    expect(screen.queryByText('Analyzing the images…')).toBeNull()
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled()
  })

  it('shows the image with its alt text, the date written out, the region, the note and the credit', async () => {
    await renderReady()
    expect(screen.getByRole('img', { name: visualization.frames[0].altText })).toBeInTheDocument()
    expect(screen.getByText('January 2024')).toBeInTheDocument()
    expect(screen.getByText('Region: Central ocean')).toBeInTheDocument()
    expect(screen.getByText(/Earth Jukebox team/)).toBeInTheDocument()
  })

  it('puts Play and the date straight after the image, before the description and the questions (LY01)', async () => {
    await renderReady()
    const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    const image = screen.getByRole('img', { name: visualization.frames[0].altText })
    const play = screen.getByRole('button', { name: 'Play' })
    const date = screen.getByRole('slider', { name: 'Date' })
    const ask = screen.getByRole('button', { name: 'Ask' })
    expect(after(image, play)).toBe(true)
    expect(after(play, date)).toBe(true)
    expect(after(date, ask)).toBe(true)
  })

  it('describes the date on screen in words, below the picture, and follows the date', async () => {
    const { user } = await renderReady()
    const description = screen.getByRole('region', { name: 'Description' })
    expect(description).toHaveTextContent('January 2024.')
    expect(description).toHaveTextContent('First date.')
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard('{ArrowRight}')
    await tick(0)
    expect(screen.getByRole('region', { name: 'Description' })).toHaveTextContent('July 2024.')
    expect(screen.getByRole('region', { name: 'Description' })).toHaveTextContent('Up two steps from January (cold).')
  })

  it('says the day when the frames are days apart, and only the year when they are years apart', async () => {
    const withDates = (dates: string[]): Visualization => ({
      ...visualization,
      frames: visualization.frames.map((frame, i) => ({ ...frame, date: dates[i] })),
    })
    const daily = render(<PlayerPage visualization={withDates(['2024-05-01', '2024-05-02', '2024-05-03', '2024-05-04'])} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(screen.getByText('1 May 2024')).toBeInTheDocument()
    expect(dateText()).toBe('1 May 2024: cold')
    daily.unmount()
    render(<PlayerPage visualization={withDates(['2021-09-15', '2022-09-15', '2023-09-15', '2024-09-15'])} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(screen.getByText('2021')).toBeInTheDocument()
    expect(dateText()).toBe('2021: cold')
  })

  it('hides the region outline from assistive technology', async () => {
    const { container } = await renderReady()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('says so when the sounds cannot be prepared', async () => {
    analyzeAll.mockRejectedValue(new Error('worker crashed'))
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
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
    expect(screen.getByText('January 2024')).toBeInTheDocument()

    // The image and the slider follow every step, but the live region speaks at most once per 1.5 s: July waits for its turn.
    await tick(1000)
    expect(dateText()).toBe('July 2024: mild')
    expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringContaining('2024-07-15'))
    expect(liveText()).toBe('January 2024: cold')
    await tick(500)
    expect(liveText()).toBe('July 2024: mild')

    // December comes at 2000 ms and is replaced by March at 3000 ms before it was due: older messages are dropped, not queued.
    await tick(1500)
    expect(liveText()).toBe('March 2025: not enough data, so you hear the hiss')
  })

  it('says a date during playback only when its category differs from the last one said', async () => {
    analyzeAll.mockImplementation(async () => visualization.frames.map((frame, i) => ({
      frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: ['cold', 'cold', 'hot', 'hot'][i],
    })))
    const { user } = await renderReady()
    const seen: string[] = []
    const watcher = new MutationObserver(() => seen.push(liveText()))
    watcher.observe(document.querySelector('[aria-live="polite"]')!, { childList: true, characterData: true, subtree: true })
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(seen).toEqual(['January 2024: cold'])
    await tick(1000) // July: still cold, so nothing is said
    expect(dateText()).toBe('July 2024: cold')
    expect(seen).toHaveLength(1)
    await tick(1000) // December: hot
    expect(dateText()).toBe('December 2024: hot')
    await tick(1000) // March 2025: hot again, nothing new
    expect(dateText()).toBe('March 2025: hot')
    expect(seen).toEqual(['January 2024: cold', 'December 2024: hot'])
    watcher.disconnect()
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

describe('Player: Loop and the Mixer drawer (UI04)', () => {
  it('goes back to the first date after the last one and keeps playing, saying so', async () => {
    const { user } = await renderReady()
    const loop = screen.getByRole('button', { name: 'Loop' })
    expect(loop).toHaveAttribute('aria-pressed', 'false')
    await user.click(loop)
    expect(loop).toHaveAttribute('aria-pressed', 'true')
    expect(liveText()).toMatch(/^Loop on/)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(4500)
    expect(fake.sequences).toHaveLength(2)
    expect(fake.sequences[1][0].category).toBe('cold')
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.queryByText(/That is the last date/)).toBeNull()
    expect(dateText()).toMatch(/^January 2024/)
  })

  it('stops after the last date when Loop is off, as before, and says so when it is turned off', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Loop' }))
    await user.click(screen.getByRole('button', { name: 'Loop' }))
    expect(liveText()).toMatch(/^Loop off/)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(4500)
    expect(fake.sequences).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.getByText(/That is the last date/)).toBeInTheDocument()
  })

  it('has the first and last date at the ends of the slider, without a second copy of them in the page text', async () => {
    const { container } = await renderReady()
    const ends = [...container.querySelectorAll('.player__ends .ui-label')].map(node => node.getAttribute('data-text'))
    expect(ends).toHaveLength(2)
    expect(ends[0]).toBe('January 2024')
    expect(ends[1]).toBeTruthy()
    expect(screen.getAllByText('January 2024')).toHaveLength(1)
  })

  it('opens the mixer in a dialog named Mixer, closes it on Escape and gives focus back to the button', async () => {
    const { user } = await renderReady()
    const button = screen.getByRole('button', { name: 'Mixer' })
    await user.click(button)
    const dialog = screen.getByRole('dialog', { name: 'Mixer' })
    expect(within(dialog).getByRole('heading', { name: 'Mixer' })).toBeInTheDocument()
    expect(dialog.querySelector('.player__drawer')).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Mixer' })).toBeNull()
    expect(button).toHaveFocus()
  })

  it('has no accessibility violations with the drawer open', async () => {
    const { user, container } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Mixer' }))
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })
})

describe('Player: pause, stop, replay', () => {
  it('pauses and resumes from the same date', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(1000)
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    // Pausing always says the current date, even one second after the last update.
    expect(liveText()).toBe('Paused at July 2024: mild.')
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
    expect(liveText()).toBe('Stopped at December 2024: hot.')
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
    expect(fake.sequences.at(-1)).toEqual([expect.objectContaining({ category: 'mild', atMs: 0 })])
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
    expect(fake.sequences.at(-1)).toEqual([expect.objectContaining({ category: 'mild', atMs: 0 })])
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

  it('a step in time while the dates are not playing changes the date and says it, and does not play the chord of the date as well (IX06)', async () => {
    const { user } = await renderReady()
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard('{ArrowRight}')
    await tick(0)
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('1')
    // The slice (a few notes of the date's music) is the sound; it goes through the ensemble, not the sound engine's one-date chord.
    expect(fake.sequences).toHaveLength(0)
    expect(liveText()).toContain('July 2024')
    // At the end, a step that cannot move says so and changes nothing.
    await jumpTo(3)
    await user.keyboard('{ArrowRight}')
    await tick(0)
    expect(liveText()).toBe('Last date.')
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveValue('3')
  })

  it('Alt with Left, Right, Home and End steps through the dates (IX06)', async () => {
    const { user } = await renderReady()
    screen.getByRole('button', { name: 'Stop' }).focus()
    const date = () => screen.getByRole('slider', { name: 'Date' })
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}')
    await tick(0)
    expect(date()).toHaveValue('1')
    await user.keyboard('{Alt>}{End}{/Alt}')
    await tick(0)
    expect(date()).toHaveValue('3')
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await tick(0)
    expect(date()).toHaveValue('2')
    await user.keyboard('{Alt>}{Home}{/Alt}')
    await tick(0)
    expect(date()).toHaveValue('0')
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
    // The Ask panel on this page publishes the facts too (G06), so look at the player's own last update.
    expect(updates.filter(u => u.key === 'player').at(-1)).toMatchObject({ data: null })
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
    expect(fake.sequences.at(-1)).toEqual([expect.objectContaining({ category: 'hot', atMs: 0 })])
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

describe('Player: starting volume', () => {
  it('starts at the volume chosen in the welcome sound check, and at 80 percent otherwise', async () => {
    const first = await renderReady()
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('80')
    first.unmount()
    localStorage.setItem('earth-jukebox:welcome', JSON.stringify({ done: true, volume: 0.5 }))
    try {
      await renderReady()
      expect(screen.getByRole('slider', { name: 'Volume' })).toHaveValue('50')
    } finally {
      localStorage.removeItem('earth-jukebox:welcome')
    }
  })
})

describe('Player: sound', () => {
  it('gives every step the stereo pan of the region', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    const pan = panFor(visualization.regions[0])
    expect(fake.sequences[0]).toHaveLength(4)
    fake.sequences[0].forEach(step => expect(step).toMatchObject({ pan }))
  })

  it('gives the steps the chord, slide and bell of the date: a jump of two steps slides and rings', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    // cold → mild (two steps up): glide and bell. mild → hot: one step... the fixture's results have no shares, so no chord.
    expect(fake.sequences[0][0]).not.toHaveProperty('glide')
    expect(fake.sequences[0][1]).toMatchObject({ category: 'mild', glide: true, bell: true })
  })

  it('has the engine in the full style to begin with, and switches it with the Simple sound toggle', async () => {
    const { user } = await renderReady()
    expect(fake.setStyle).toHaveBeenLastCalledWith('full')
    const toggle = screen.getByRole('button', { name: 'Simple sound' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Just the main note, without the chord and slides.')).toBeInTheDocument()
    await user.click(toggle)
    expect(fake.setStyle).toHaveBeenLastCalledWith('simple')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await user.click(toggle)
    expect(fake.setStyle).toHaveBeenLastCalledWith('full')
  })

  it('puts the region in space: each step carries a height, north above and south below', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    const elevation = elevationFor(visualization.regions[0])
    fake.sequences[0].forEach(step => expect(step).toMatchObject({ elevation }))
  })

  it('has stereo sound to begin with, and switches to 3D with its toggle, which is remembered', async () => {
    window.localStorage.removeItem('earth-jukebox:spatial-mode')
    const { user } = await renderReady()
    expect(fake.setSpatial).toHaveBeenLastCalledWith('stereo')
    const toggle = screen.getByRole('button', { name: '3D sound (headphones)' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText(/Use headphones/)).toBeInTheDocument()
    await user.click(toggle)
    expect(fake.setSpatial).toHaveBeenLastCalledWith('3d')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('earth-jukebox:spatial-mode')).toBe('3d')
    await user.click(toggle)
    expect(fake.setSpatial).toHaveBeenLastCalledWith('stereo')
    window.localStorage.clear()
  })
})

describe('Player: download', () => {
  const createObjectURL = vi.fn(() => 'blob:wav')
  const revokeObjectURL = vi.fn()
  let clicked: HTMLAnchorElement[]
  beforeEach(() => {
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
    fake.renderToWav.mockReset()
    fake.renderToWav.mockImplementation(async () => new Blob(['wav']))
    clicked = []
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this) })
  })
  afterEach(() => vi.restoreAllMocks())

  const button = () => screen.getByRole('button', { name: /Download this soundscape|Preparing the audio/ })

  it('renders every date at the current speed and saves it under the visualization and region', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    await user.click(button())
    await tick(0)
    const steps = fake.renderToWav.mock.calls[0][0] as { atMs: number; pan: number }[]
    expect(steps.map(step => step.atMs)).toEqual([0, 500, 1000, 1500])
    expect(steps[0].pan).toBe(panFor(visualization.regions[0]))
    expect(clicked[0].download).toBe(`earth-jukebox-${visualization.id}-${visualization.regions[0].id}.wav`)
    expect(clicked[0].href).toBe('blob:wav')
    await tick(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:wav')
    expect(button()).toHaveTextContent('Download this soundscape (WAV)')
  })

  it('is disabled and says it is preparing while the audio renders', async () => {
    let finish!: (blob: Blob) => void
    fake.renderToWav.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { user } = await renderReady()
    await user.click(button())
    expect(button()).toBeDisabled()
    expect(button()).toHaveTextContent('Preparing the audio…')
    await act(async () => { finish(new Blob(['wav'])) })
    expect(button()).toBeEnabled()
  })

  it('shows an error when the audio cannot be rendered, and can be tried again', async () => {
    fake.renderToWav.mockRejectedValueOnce(new Error('That is too long to download (over 3 minutes).'))
    const { user } = await renderReady()
    await user.click(button())
    await tick(0)
    expect(screen.getByRole('alert')).toHaveTextContent('That is too long to download (over 3 minutes).')
    expect(clicked).toHaveLength(0)
    expect(button()).toBeEnabled()
    await user.click(button())
    await tick(0)
    expect(clicked).toHaveLength(1)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('cannot be pressed before the dates are analysed', () => {
    analyzeAll.mockImplementation(() => new Promise(() => {}))
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    expect(button()).toBeDisabled()
  })
})

describe('Player: test sound, both ways and the data table', () => {
  it('plays one plain note from "Test sound" and says so', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Test sound' }))
    await tick(0)
    expect(fake.sequences).toHaveLength(1)
    expect(fake.sequences[0]).toHaveLength(1)
    expect(liveText()).toBe('Test sound played.')
  })

  it('plays the date in the full sound, then the simple sound, then puts the chosen sound back', async () => {
    const { user } = await renderReady()
    fake.setStyle.mockClear()
    await user.click(screen.getByRole('button', { name: 'Hear this date both ways' }))
    await tick(0)
    expect(liveText()).toBe('Full sound, then simple sound.')
    expect(fake.setStyle).toHaveBeenLastCalledWith('full')
    await tick(2000)
    expect(fake.setStyle).toHaveBeenLastCalledWith('simple')
    expect(fake.sequences).toHaveLength(2)
    await tick(2000)
    expect(fake.setStyle).toHaveBeenLastCalledWith('full')
  })

  it('puts the chosen sound back when something else interrupts the two sounds', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Simple sound' }))
    fake.setStyle.mockClear()
    await user.click(screen.getByRole('button', { name: 'Hear this date both ways' }))
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Replay this date' }))
    await tick(0)
    expect(fake.setStyle).toHaveBeenLastCalledWith('simple')
  })

  it('shows a data table with one row per date and says missing data is not zero', async () => {
    const { user } = await renderReady()
    expect(screen.queryByRole('table')).toBeNull()
    await user.click(screen.getByText('Show data table'))
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent('It is not zero')
    expect(screen.getAllByRole('row')).toHaveLength(visualization.frames.length + 1)
    expect(screen.getByRole('row', { name: /Not enough data/ })).toBeInTheDocument()
  })
})

describe('Player: hear the legend (F39)', () => {
  const openLegend = async (user: Awaited<ReturnType<typeof renderReady>>['user']) => {
    await user.click(screen.getByText('Colour legend'))
    return screen.getByRole('button', { name: /^Hear the legend/ })
  }

  it('plays one step per category, coolest first, and announces each label as it sounds', async () => {
    const { user } = await renderReady()
    const labels = visualization.mapping.categories.map(category => category.label)
    await user.click(await openLegend(user))
    await tick(0)
    expect(fake.sequences).toHaveLength(1)
    expect(fake.sequences[0].map(step => step.category)).toEqual(visualization.mapping.categories.map(category => category.id))
    expect(liveText()).toBe(labels[0])
    await tick(1200)
    expect(liveText()).toBe(labels[1])
    await tick(1200 * (labels.length - 2))
    expect(liveText()).toBe(labels[labels.length - 1])
  })

  it('names the ends of the scale from the data set on the button', async () => {
    const { user } = await renderReady()
    expect((await openLegend(user))).toHaveAccessibleName('Hear the legend, coolest to warmest')
  })

  it('stops with Stop: it says where it stopped (T93), and no more labels are announced', async () => {
    const { user } = await renderReady()
    await user.click(await openLegend(user))
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await tick(0)
    const afterStop = liveText()
    expect(afterStop).toMatch(/^Stopped at /)
    await tick(5000)
    expect(liveText()).toBe(afterStop)
  })

  it('has no accessibility violations with the legend open', async () => {
    const { user, container } = await renderReady()
    await openLegend(user)
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })
})

describe('Player: what the sound hides (F33)', () => {
  // An earlier test chose the simple sound, and the choice is kept in localStorage.
  beforeEach(() => localStorage.clear())

  it('plays a change the coarse sound hides as one note twice, then as two notes, and puts the chosen sound back', async () => {
    analyzeAll.mockImplementation(async () =>
      visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: ['cold', 'cool', 'mild', 'hot'][i] })))
    const { user } = await renderReady()
    fake.setStyle.mockClear()
    await user.click(screen.getByRole('button', { name: 'What the sound hides' }))
    await tick(0)
    expect(liveText()).toMatch(/^One of three changes between neighbouring dates sound the same in a coarse sound with three notes\. For example .+: cold to cool\./)
    expect(fake.setStyle).toHaveBeenLastCalledWith('simple')
    expect(fake.sequences[0].map((step: { category: string }) => step.category)).toEqual(['cold', 'cold'])
    await tick(1600)
    expect(fake.sequences[1].map((step: { category: string }) => step.category)).toEqual(['cold', 'cool'])
    await tick(1600)
    expect(fake.setStyle).toHaveBeenLastCalledWith('full')
  })

  it('says so, and plays nothing, when every change is still heard', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'What the sound hides' }))
    await tick(0)
    expect(liveText()).toBe('Every one of the two changes between neighbouring dates is still heard in a coarse sound, so it hides nothing here.')
    expect(fake.sequences).toHaveLength(0)
  })
})

describe('Player: a link to one moment (F40)', () => {
  const open = (hash: string) => window.history.replaceState(null, '', hash)
  afterEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear() })

  it('opens on the date and sound style the link names, and does not save the style', async () => {
    open('#listen?date=2024-07-15&style=simple')
    await renderReady()
    expect(dateText()).toMatch(/^July 2024/)
    expect(screen.getByRole('button', { name: 'Simple sound' })).toHaveAttribute('aria-pressed', 'true')
    expect(fake.setStyle).toHaveBeenLastCalledWith('simple')
    expect(localStorage.getItem('earth-jukebox:sound-style')).toBeNull()
  })

  it('ignores what this data set cannot use and still applies the rest', async () => {
    open('#listen?date=1999-01-01&style=simple&cell=99,99x')
    await renderReady()
    expect(dateText()).toMatch(/^January 2024/)
    expect(screen.getByRole('button', { name: 'Simple sound' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('application')).toBeNull()
  })

  it('ignores a style that does not exist, and a style the data set has no baseline for', async () => {
    open('#listen?date=2024-12-15&style=loud')
    const first = await renderReady()
    expect(dateText()).toMatch(/^December 2024/)
    expect(screen.getByRole('button', { name: 'Simple sound' })).toHaveAttribute('aria-pressed', 'false')
    first.unmount()
    open('#listen?style=change')
    await renderReady()
    expect(screen.getByRole('button', { name: 'Simple sound' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets the listener choose a style afterwards: that is saved, and the link no longer decides', async () => {
    open('#listen?style=simple')
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Simple sound' }))
    expect(screen.getByRole('button', { name: 'Simple sound' })).toHaveAttribute('aria-pressed', 'false')
    expect(localStorage.getItem('earth-jukebox:sound-style')).toBe('full')
  })

  it('leaves the address alone until something changes, then keeps it in step without adding history entries', async () => {
    open('#listen?data=fixture')
    const before = window.history.length
    const { user } = await renderReady()
    expect(window.location.hash).toBe('#listen?data=fixture')
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard('{ArrowRight}')
    await tick(0)
    expect(window.location.hash).toBe('#listen?data=fixture&date=2024-07-15&style=full')
    expect(window.history.length).toBe(before)
  })

  it('applies a link opened while Listen is already showing, without a sound', async () => {
    await renderReady()
    fake.played.length = 0
    act(() => {
      open('#listen?date=2024-12-15&style=simple')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await tick(0)
    expect(dateText()).toMatch(/^December 2024/)
    expect(screen.getByRole('button', { name: 'Simple sound' })).toHaveAttribute('aria-pressed', 'true')
    expect(fake.played).toEqual([])
  })

  it('copies a whole link to this moment, even before the address has changed, and says so', async () => {
    open('#listen?data=fixture')
    const { user } = await renderReady()
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy link to this moment' }))
    await tick(0)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toMatch(/#listen\?data=fixture&date=2024-01-15&style=full$/)
    expect(liveText()).toBe('Link copied')
  })

  it('shows the link to copy by hand when the clipboard is not available', async () => {
    const { user, container } = await renderReady()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied') } }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy link to this moment' }))
    await tick(0)
    const field = screen.getByRole('textbox', { name: 'Copy this link' })
    expect(field).toHaveAttribute('readonly')
    expect((field as HTMLInputElement).value).toMatch(/date=2024-01-15/)
    expect(liveText()).toMatch(/could not be copied/)
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })
})

describe('Player: the keyboard shortcuts dialog (F41)', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
  const opener = () => screen.getByRole('button', { name: 'Keyboard shortcuts' })

  it('opens from its button, and is closed until then', async () => {
    const { user } = await renderReady()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(opener())
    expect(dialog()).toBeInTheDocument()
    expect(within(dialog()).getByRole('heading', { name: 'Keyboard shortcuts' })).toHaveFocus()
  })

  it('opens when the sound map asks for it (the question mark is a map key, IX01), and not from a question mark anywhere else', async () => {
    const { user } = await renderReady()
    screen.getByRole('button', { name: 'Stop' }).focus()
    await user.keyboard('?')
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => { dispatch({ type: 'openShortcuts' }) })
    expect(dialog()).toBeInTheDocument()
  })

  it('does not open from a question mark typed in a text box', async () => {
    const { user } = await renderReady()
    const box = screen.getByRole('textbox')
    await user.click(box)
    await user.keyboard('why?')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box).toHaveValue('why?')
  })

  it('lists the same keys as the list the input layer reads, one row each, in four tables', async () => {
    const { user } = await renderReady()
    await user.click(opener())
    const words = variableWords(visualization.variable)
    const tables = within(dialog()).getAllByRole('table')
    expect(tables).toHaveLength(4)
    const rows = tables.flatMap(table => within(table).getAllByRole('row').slice(1))
    const expected = listedShortcuts()
    expect(rows).toHaveLength(expected.length)
    for (const shortcut of expected) {
      const row = rows.find(candidate => within(candidate).getAllByRole('cell')[0].textContent === shortcut.keys && within(candidate).getAllByRole('cell')[1].textContent?.startsWith(shortcut.does(words)))
      expect(row, shortcut.id).toBeDefined()
    }
  })

  it('says which keys work only on the sound map, and names the four tables', async () => {
    const { user } = await renderReady()
    await user.click(opener())
    expect(dialog()).toHaveTextContent('work only while the sound map has focus')
    for (const name of [/Anywhere on Listen/, /On the sound map/, /Touch and mouse/, /Gamepad/]) expect(within(dialog()).getByRole('table', { name })).toBeInTheDocument()
  })

  it('closes with Escape and gives focus back to the button', async () => {
    const { user } = await renderReady()
    await user.click(opener())
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  it('closes with its Close button and gives focus back to what had it', async () => {
    const { user } = await renderReady()
    await user.click(opener())
    await user.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener()).toHaveFocus()
  })

  it('does not play or move the date while it is open', async () => {
    const { user } = await renderReady()
    await user.click(opener())
    await user.keyboard(' {ArrowRight}')
    await tick(0)
    expect(fake.sequences).toHaveLength(0)
    await user.keyboard('{Escape}')
    expect(dateText()).toMatch(/^January 2024/)
  })

  it('has no accessibility violations while open', async () => {
    const { user, container } = await renderReady()
    await user.click(opener())
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })
})

describe('Player: how often the live region changes (T93)', () => {
  // Twelve monthly dates; the category changes at every one, so every date is a candidate to be said.
  const twelve: Visualization = {
    ...visualization,
    frames: Array.from({ length: 12 }, (_, i) => ({
      ...visualization.frames[0], id: `m${i + 1}`, date: `2024-${String(i + 1).padStart(2, '0')}-15`, image: `/data/fixture/m${i + 1}.png`,
    })),
  }
  const CYCLE = ['cold', 'mild', 'hot', 'warm']
  const analysisTwelve = () => twelve.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: CYCLE[i % 4] }))

  /** Every change of the live region with the time it happened, on the fake clock. */
  function recordUpdates() {
    const updates: { at: number; text: string }[] = []
    const region = document.querySelector('[aria-live="polite"]')!
    const watcher = new MutationObserver(() => updates.push({ at: Date.now(), text: liveText() }))
    watcher.observe(region, { childList: true, characterData: true, subtree: true })
    return { updates, stop: () => watcher.disconnect() }
  }

  async function playTwelveAtFast() {
    analyzeAll.mockImplementation(async () => analysisTwelve())
    const user = setup()
    render(<PlayerPage visualization={twelve} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    const { updates, stop } = recordUpdates()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    return { user, updates, stop }
  }

  it('changes at most once per 1.5 s during a 12-date run at Fast, and says the last date', async () => {
    const { updates, stop } = await playTwelveAtFast()
    // In small steps, so React commits each update when it happens and the clock reads right.
    for (let t = 0; t < 12 * 500 - 100; t += 100) await tick(100)
    const during = [...updates]
    expect(during.length).toBeGreaterThanOrEqual(3)
    expect(during.length).toBeLessThanOrEqual(Math.ceil((11 * 500) / 1500) + 1)
    for (let i = 1; i < during.length; i++) expect(during[i].at - during[i - 1].at).toBeGreaterThanOrEqual(1500)
    // Every update is a real date line, never a stale or merged one.
    for (const update of during) expect(update.text).toMatch(/^[A-Z][a-z]+ 2024: (cold|mild|hot|warm)/)
    // The end-of-run line is not held back: the last date is always said, whatever was waiting.
    await tick(1000)
    expect(liveText()).toBe('Finished at December 2024: warm.')
    expect(updates.at(-1)!.text).toBe('Finished at December 2024: warm.')
    stop()
  })

  it('says the last date even when its category is the same as the one before', async () => {
    analyzeAll.mockImplementation(async () => twelve.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: i < 6 ? 'cold' : 'hot' })))
    const user = setup()
    render(<PlayerPage visualization={twelve} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Fast' }))
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    await tick(12 * 500 + 500)
    expect(liveText()).toBe('Finished at December 2024: hot.')
  })

  it('says only the date and label in concise detail', async () => {
    localStorage.setItem('earth-jukebox:detail', 'concise')
    try {
      analyzeAll.mockImplementation(async () => analysis())
      const { user } = await renderReady()
      await user.click(screen.getByRole('button', { name: 'Play' }))
      await tick(0)
      expect(liveText()).toBe('January 2024: cold')
      await tick(3000)
      await user.click(screen.getByRole('button', { name: 'Replay this date' }))
      await tick(0)
      expect(liveText()).toBe('March 2025: not enough data')
    } finally {
      localStorage.clear()
    }
  })
})

describe('Player: the first-minute game (IX11)', () => {
  beforeEach(() => {
    resetOnboarding()
    localStorage.clear()
    analyzeGrid.mockReset()
    analyzeGrid.mockImplementation(async (frame: { id: string }) => ({ frameId: frame.id, cols: 24, rows: 12, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells: Array.from({ length: 24 * 12 }, () => ({ value: 14, category: 'mild' })) }))
  })
  afterEach(() => { resetOnboarding(); localStorage.clear() })

  it('offers the game on a first visit, takes its first step from the arrow keys on the sound map, and has no accessibility violations', async () => {
    const { user, container } = await renderReady()
    const game = screen.getByRole('group', { name: 'First-minute game' })
    expect(within(game).getByText('Step 1 of 4')).toBeInTheDocument()
    expect(within(game).getByText('First, press Explore the map to turn on the sound map.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    expect(within(game).queryByText(/^First, press Explore the map/)).toBeNull()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(within(game).getByText('Step 2 of 4')).toBeInTheDocument()
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })

  it('hides on Skip and comes back from the restart button', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('group', { name: 'First-minute game' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Play the first-minute game' }))
    expect(screen.getByRole('group', { name: 'First-minute game' })).toBeInTheDocument()
  })

  it('is not offered on its own once it was done or skipped', async () => {
    saveOnboardingDone()
    await renderReady()
    expect(screen.queryByRole('group', { name: 'First-minute game' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Play the first-minute game' })).toBeInTheDocument()
  })
})

// F48: a data set with two or more regions lets the listener choose one. The choice is in the address, and no sound starts by itself.
describe('Player: region picker', () => {
  const twoRegions: Visualization = {
    ...visualization,
    regions: [...visualization.regions, { id: 'north', name: 'Northern ocean', description: 'A strip along the top.', points: [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }] }],
  }
  const lastRegionAnalysed = () => analyzeAll.mock.calls.at(-1)?.[1]?.id
  const renderTwo = async (hash = '#listen') => {
    window.location.hash = hash
    const user = setup()
    render(<PlayerPage visualization={twoRegions} />, { wrapper: AnnouncerProvider })
    await tick(0)
    return user
  }
  afterEach(() => { window.location.hash = '' })

  it('is not there when the data set has one region', async () => {
    await renderReady()
    expect(screen.queryByRole('combobox', { name: 'Region' })).toBeNull()
  })

  it('starts on the first region, and lists every region by name', async () => {
    await renderTwo()
    const picker = screen.getByRole('combobox', { name: 'Region' })
    expect(picker).toHaveValue('centre')
    expect(within(picker).getAllByRole('option').map(o => o.textContent)).toEqual(['Central ocean', 'Northern ocean'])
    expect(lastRegionAnalysed()).toBe('centre')
    expect(screen.getByText('Region: Central ocean')).toBeInTheDocument()
  })

  it('puts the choice in the address, reads that region, and plays nothing', async () => {
    const user = await renderTwo()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Region' }), 'north')
    await tick(0)
    expect(window.location.hash).toBe('#listen?region=north')
    expect(lastRegionAnalysed()).toBe('north')
    expect(screen.getByText('Region: Northern ocean')).toBeInTheDocument()
    expect(fake.sequences).toHaveLength(0)
    expect(liveText()).toBe('Region: Northern ocean.')
  })

  it('opens on the region a link names, and on the first when the link names one that does not exist', async () => {
    await renderTwo('#listen?region=north')
    expect(screen.getByRole('combobox', { name: 'Region' })).toHaveValue('north')
    expect(lastRegionAnalysed()).toBe('north')
    cleanup()
    await renderTwo('#listen?region=nowhere')
    expect(screen.getByRole('combobox', { name: 'Region' })).toHaveValue('centre')
    expect(lastRegionAnalysed()).toBe('centre')
  })

  it('has no accessibility violations with the picker shown', async () => {
    window.location.hash = '#listen'
    const { container } = render(<PlayerPage visualization={twoRegions} />, { wrapper: AnnouncerProvider })
    await tick(0)
    vi.useRealTimers() // axe waits on real timers
    await expectNoA11yViolations(container)
  })
})

describe('Player: interface cues (AU-UI)', () => {
  it('sounds start once when playback starts and stop once when it ends, not on every date', async () => {
    const { user } = await renderReady()
    expect(playCue).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(playCue.mock.calls.map(c => c[0])).toEqual(['start'])
    await tick(3000) // every date has been played; the run is not over yet
    expect(playCue.mock.calls.map(c => c[0])).toEqual(['start'])
    await tick(1500)
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(playCue.mock.calls.map(c => c[0])).toEqual(['start', 'stop'])
  })

  it('does not sound start again when the listener resumes, and not stop when they pause', async () => {
    const { user } = await renderReady()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await user.click(screen.getByRole('button', { name: 'Resume' }))
    await tick(0)
    expect(playCue.mock.calls.map(c => c[0])).toEqual(['start'])
  })

  it('sounds success when the link is copied', async () => {
    const { user } = await renderReady()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async (_text: string) => {}) }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy link to this moment' }))
    await tick(0)
    expect(playCue.mock.calls.map(c => c[0])).toEqual(['success'])
    expect(liveText()).toBe('Link copied')
  })
})

import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import { resetUndo } from '../../interaction/history'
import { expectNoA11yViolations } from '../../test/a11y'
import { resetMarksStore } from '../marks/store'
import PlayerPage from '../player'
import { EDGE_PATTERN, LOCK_PATTERN, MARK_PATTERN, patternFor } from './patterns'

// IX10 on the real player: the explorer's pulses are scheduled to the sound, follow the setting, and the no-vibration line shows only where needed.
const visualization = fixture as Visualization
const COLS = 24
const ROWS = 12

const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}), setStyle: vi.fn(), setSpatial: vi.fn(), setVolume: vi.fn(), playCategory: vi.fn(), playMissing: vi.fn(),
  playSequence: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn(), renderToWav: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))
const ensemble = vi.hoisted(() => ({
  hold: vi.fn(), playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'off' as const), start: vi.fn(async () => {}), setDetail: vi.fn(),
}))
vi.mock('../../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'off', start: ensemble.start }) }))
const analyzeAll = vi.hoisted(() => vi.fn())
const analyzeGrid = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll, analyzeGrid }))

const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const
const makeGrid = (frameId: string): FrameGrid => ({
  frameId, cols: COLS, rows: ROWS, area: { x0: 0, y0: 0, x1: 1, y1: 1 },
  cells: Array.from({ length: COLS * ROWS }, () => ({ value: 15, category: 'mild' })),
})
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

let vibrate: ReturnType<typeof vi.fn>
const support = (on: boolean) => {
  vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { value: on ? vibrate : undefined, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  Object.values(engine).forEach(fn => fn.mockClear())
  Object.values(ensemble).forEach(fn => fn.mockClear())
  resetUndo()
  localStorage.clear()
  resetMarksStore()
  analyzeAll.mockReset()
  analyzeAll.mockImplementation(async () => visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: CATEGORIES[i] })))
  analyzeGrid.mockReset()
  analyzeGrid.mockImplementation(async (frame: { id: string }) => makeGrid(frame.id))
})
afterEach(() => { cleanup(); support(false); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); resetMarksStore() })

async function exploring(withVibrationOn: boolean) {
  const user = userEvent.setup({ delay: null })
  const view = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await tick(0)
  if (withVibrationOn) await user.click(screen.getByRole('button', { name: 'Vibration' }))
  await user.click(screen.getByRole('button', { name: 'Explore the map' }))
  await tick(0)
  vibrate.mockClear()
  return { user, ...view }
}
const NOTE = 'Vibration is not available in this browser, for example on iPhone and iPad. The sound is the same.'

describe('Explorer pulses (IX10)', () => {
  it('sends a move pulse after the sound lead, not at the key press', async () => {
    support(true)
    const { user } = await exploring(true)
    await user.keyboard('{ArrowRight}')
    expect(vibrate).not.toHaveBeenCalled()
    await tick(30)
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(patternFor('mild', visualization.mapping))
  })

  it('gives the edge, the lock and the mark their own shapes', async () => {
    support(true)
    const { user } = await exploring(true)
    await user.keyboard('{Home}')
    await tick(100)
    vibrate.mockClear()
    await user.keyboard('{ArrowLeft}')
    await tick(30)
    expect(vibrate).toHaveBeenLastCalledWith(EDGE_PATTERN)
    await user.keyboard('l')
    await tick(30)
    expect(vibrate).toHaveBeenLastCalledWith(LOCK_PATTERN)
    await user.keyboard('l')
    await user.keyboard('m')
    await tick(30)
    expect(vibrate).toHaveBeenLastCalledWith(MARK_PATTERN)
  })

  it('sends nothing while the setting is off', async () => {
    support(true)
    const { user } = await exploring(false)
    await user.keyboard('{ArrowRight}')
    await user.keyboard('m')
    await tick(200)
    expect(vibrate).not.toHaveBeenCalled()
  })
})

describe('The no-vibration line (IX10)', () => {
  it('says why where the browser cannot vibrate, and shows no setting', async () => {
    support(false)
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(screen.getByText(NOTE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vibration' })).toBeNull()
  })

  it('is not shown where the browser can vibrate', async () => {
    support(true)
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(screen.queryByText(NOTE)).toBeNull()
    expect(screen.getByRole('button', { name: 'Vibration' })).toBeInTheDocument()
  })
})

describe('The vibration setting (IX10): accessibility', () => {
  beforeEach(() => { vi.useRealTimers() })

  it('has no violations with the setting shown or with the note', async () => {
    support(true)
    const shown = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await screen.findByRole('button', { name: 'Vibration' })
    await expectNoA11yViolations(shown.container)
    shown.unmount()
    support(false)
    const note = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await screen.findByText(NOTE)
    await expectNoA11yViolations(note.container)
  })
})

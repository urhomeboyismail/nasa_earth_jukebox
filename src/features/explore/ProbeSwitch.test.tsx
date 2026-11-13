import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import type { SoundEngine } from '../../audio'
import type { HeldTone } from '../../audio/ensemble/types'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import { expectNoA11yViolations } from '../../test/a11y'
import { ExplorerPanel, ExplorerSurface } from './Explorer'
import { useExplorer } from './useExplorer'

// The explorer with the continuous tone (SN09), on a 6 × 2 map rising from west to east with no data in the last column. The old engine and the
// ensemble both record what they are asked to play.
const COLS = 6
const ROWS = 2
function makeGrid(frameId: string): FrameGrid {
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
    const col = i % COLS
    return col === COLS - 1 ? { value: null, category: 'insufficient' as const } : { value: col * 6, category: 'mild' }
  })
  return { frameId, cols: COLS, rows: ROWS, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells }
}
const analyzeGrid = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeGrid }))

const ensemble = vi.hoisted(() => ({
  hold: vi.fn<(tone: HeldTone | null, atTime?: number) => void>(),
  playDropout: vi.fn(),
  playNotes: vi.fn(),
  now: vi.fn(() => 0),
  status: vi.fn(() => 'off' as const),
  start: vi.fn(async () => {}),
  setDetail: vi.fn(),
}))
vi.mock('../../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'off', start: ensemble.start }) }))

const engine = {
  unlock: vi.fn(async () => {}), playCategory: vi.fn(), playMissing: vi.fn(), playSequence: vi.fn(), stop: vi.fn(),
} as unknown as SoundEngine & { playCategory: ReturnType<typeof vi.fn>; playMissing: ReturnType<typeof vi.fn> }

const plain = fixture as Visualization
const sonified: Visualization = { ...plain, sonification: { preset: 'pentatonic' } }

function Harness({ visualization }: { visualization: Visualization }) {
  const explorer = useExplorer({ visualization, frame: visualization.frames[0], engine, vibrate: false, frames: visualization.frames })
  return (
    <>
      <button type="button" onClick={explorer.turnOn}>Explore the map</button>
      <div style={{ position: 'relative' }}><ExplorerSurface explorer={explorer} /></div>
      <ExplorerPanel visualization={visualization} explorer={explorer} />
    </>
  )
}

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const surface = () => screen.getByRole('application', { name: 'Explore the map by sound' })
const toneBox = () => screen.getByRole('checkbox', { name: /Continuous tone/ })
const slopeBox = () => screen.getByRole('checkbox', { name: /Slope cue/ })

async function exploring(visualization: Visualization) {
  const user = userEvent.setup({ delay: null })
  const view = render(<Harness visualization={visualization} />, { wrapper: AnnouncerProvider })
  await user.click(screen.getByRole('button', { name: 'Explore the map' }))
  await tick(0)
  return { user, ...view }
}

beforeEach(() => {
  // As Explorer.test.tsx: Testing Library waits through `jest` when it sees fake timers.
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  analyzeGrid.mockReset()
  analyzeGrid.mockImplementation(async (frame: { id: string }) => makeGrid(frame.id))
  for (const fn of [ensemble.hold, ensemble.playDropout, ensemble.playNotes, ensemble.start, engine.playCategory, engine.playMissing]) fn.mockClear()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear() })

describe('the continuous tone in the explorer', () => {
  it('is off for a data set without a sonification block, which keeps one note per cell and never holds a tone', async () => {
    const { user } = await exploring(plain)
    expect(toneBox()).not.toBeChecked()
    expect(slopeBox()).toBeDisabled()
    await user.keyboard('{ArrowRight}')
    await tick(200)
    expect(ensemble.playNotes).toHaveBeenCalled()
    expect(ensemble.hold).not.toHaveBeenCalled()
    // The first press starts the ensemble, which the one-note sound goes through; the old engine is not used for a move.
    expect(ensemble.start).toHaveBeenCalled()
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('is on for a data set with a sonification block: a key holds the tone instead of the note, and starts the sound', async () => {
    const { user } = await exploring(sonified)
    expect(toneBox()).toBeChecked()
    expect(slopeBox()).toBeChecked()
    ensemble.hold.mockClear()
    await user.keyboard('{ArrowRight}')
    expect(ensemble.start).toHaveBeenCalled()
    // Held at once, and again once the sound has started (the first press is the one that starts it).
    expect(ensemble.hold).toHaveBeenCalled()
    for (const [tone] of ensemble.hold.mock.calls) expect(tone).toMatchObject({ level: expect.any(Number), brightness: expect.any(Number) })
    await tick(300)
    expect(ensemble.hold.mock.calls.at(-1)?.[0]).toBeNull()
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('plays the dropout cue on a cell with no data', async () => {
    const { user } = await exploring(sonified)
    await user.keyboard('{End}')
    expect(ensemble.playDropout).toHaveBeenCalledTimes(1)
    expect(engine.playMissing).not.toHaveBeenCalled()
  })

  it('stops the tone on Escape, on pointer up and when the pointer leaves the map', async () => {
    const { user } = await exploring(sonified)
    await user.keyboard('{ArrowRight}')
    ensemble.hold.mockClear()
    await user.keyboard('{Escape}')
    expect(ensemble.hold).toHaveBeenCalledWith(null, expect.any(Number))

    vi.spyOn(surface(), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 200, right: 600, bottom: 200, x: 0, y: 0, toJSON: () => ({}) })
    await tick(100)
    fireEvent.pointerDown(surface(), { clientX: 50, clientY: 50, pointerId: 1 })
    expect(ensemble.hold.mock.calls.at(-1)?.[0]).not.toBeNull()
    fireEvent.pointerUp(surface(), { pointerId: 1 })
    expect(ensemble.hold.mock.calls.at(-1)?.[0]).toBeNull()

    await tick(100)
    fireEvent.pointerMove(surface(), { clientX: 250, clientY: 50, pointerType: 'mouse' })
    await tick(100)
    expect(ensemble.hold.mock.calls.at(-1)?.[0]).not.toBeNull()
    fireEvent.pointerLeave(surface())
    expect(ensemble.hold.mock.calls.at(-1)?.[0]).toBeNull()
  })

  it('remembers a choice, which wins over the data set\'s default', async () => {
    const { user, unmount } = await exploring(sonified)
    await user.click(toneBox())
    expect(toneBox()).not.toBeChecked()
    expect(slopeBox()).toBeDisabled()
    unmount()
    await exploring(sonified)
    expect(toneBox()).not.toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(ensemble.hold).not.toHaveBeenCalled()
  })

  it('is labelled, works by keyboard, and has no accessibility violations', async () => {
    const { user, container } = await exploring(sonified)
    toneBox().focus()
    await user.keyboard(' ')
    expect(toneBox()).not.toBeChecked()
    await user.keyboard(' ')
    expect(toneBox()).toBeChecked()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

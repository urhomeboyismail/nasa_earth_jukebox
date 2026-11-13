import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import { elevationForPoint, panForPoint } from '../../audio/pan'
import type { ActionType } from '../../interaction/actions'
import { noteForPosition, positionOfValue } from '../../interaction/notes'
import { resetUndo } from '../../interaction/history'
import { addActionHandler, dispatch } from '../../interaction/registry'
import { PRESETS } from '../../sonify/presets'
import type { Visualization } from '../../data'
import { describeCell, describePlace, describeSweep, explorerMessage, sweepEndMessage } from '../../describe'
import { expectNoA11yViolations } from '../../test/a11y'
import PlayerPage from '../player'
import { AnnouncerProvider } from '../../components'

const visualization = fixture as Visualization
const COLS = 24
const ROWS = 12

// The player is rendered for real, with a recording engine and a 24 × 12 map: cold in the west, hot in the east, the last two
// columns without data.
const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  setStyle: vi.fn(),
  setSpatial: vi.fn(),
  setVolume: vi.fn(),
  playCategory: vi.fn(),
  playMissing: vi.fn(),
  playSequence: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  renderToWav: vi.fn(),
}))
vi.mock('../../audio', () => ({ createSoundEngine: () => engine }))

// IX01: a move, the edge, lock and unlock and undo are notes of the ensemble, sounded at once. The ensemble is a recording stand-in.
const ensemble = vi.hoisted(() => ({
  hold: vi.fn(),
  playNotes: vi.fn(),
  playDropout: vi.fn(),
  now: vi.fn(() => 0),
  status: vi.fn(() => 'off' as const),
  start: vi.fn(async () => {}),
  setDetail: vi.fn(),
}))
vi.mock('../../audio/ensemble/useEnsemble', () => ({ useEnsemble: () => ({ ensemble, status: 'off', start: ensemble.start }) }))

const analyzeAll = vi.hoisted(() => vi.fn())
const analyzeGrid = vi.hoisted(() => vi.fn())
vi.mock('../../analysis', () => ({ analyzeAll, analyzeGrid }))

const CATEGORIES = ['cold', 'mild', 'hot', 'insufficient'] as const
const BY_COLUMN = ['cold', 'cool', 'mild', 'warm', 'hot']
const VALUE: Record<string, number> = { cold: 3, cool: 9, mild: 15, warm: 21, hot: 27 }

function makeGrid(frameId: string): FrameGrid {
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => {
    const col = i % COLS
    if (col >= COLS - 2) return { value: null, category: 'insufficient' as const }
    const category = BY_COLUMN[Math.floor((col * BY_COLUMN.length) / (COLS - 2))]
    return { value: VALUE[category], category }
  })
  return { frameId, cols: COLS, rows: ROWS, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells }
}
const cellOf = (grid: FrameGrid, col: number, row: number) => grid.cells[row * COLS + col]
/** The note a place makes: its value across the legend, in the data set's key (the fixture has no preset, so major). */
const noteOf = (col: number, row: number) => noteForPosition(positionOfValue(cellOf(grid, col, row).value!, visualization.colorScale), PRESETS.major)
/** What the ensemble was asked to play, one entry per playNotes call (the notes of that call). */
const played = () => ensemble.playNotes.mock.calls.map(([notes]) => notes as { midi: number; seconds: number; level: number; pan: number; elevation?: number }[])
/** Records the actions of one kind that the input layer dispatches. Returns the way to stop recording. */
const dispatchSpy = (type: ActionType, log: string[]) => addActionHandler(type, () => { log.push(type) })
/** Every sound the ensemble was asked for: notes and dropout cues. */
const soundsHeard = () => ensemble.playNotes.mock.calls.length + ensemble.playDropout.mock.calls.length
const grid = makeGrid('f')

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''
const surface = () => screen.getByRole('application', { name: 'Explore the map by sound' })
const dateSlider = () => screen.getByRole('slider', { name: 'Date' })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  Object.values(engine).forEach(fn => fn.mockClear())
  Object.values(ensemble).forEach(fn => fn.mockClear())
  resetUndo()
  analyzeAll.mockReset()
  analyzeAll.mockImplementation(async () =>
    visualization.frames.map((frame, i) => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: CATEGORIES[i] })))
  analyzeGrid.mockReset()
  analyzeGrid.mockImplementation(async (frame: { id: string }) => makeGrid(frame.id))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear() })

/** The player with the explorer turned on and the map read. The cursor starts in the middle: column 13, row 7. */
async function exploring() {
  const user = userEvent.setup({ delay: null })
  const view = render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
  await tick(0)
  await user.click(screen.getByRole('button', { name: 'Explore the map' }))
  await tick(0)
  return { user, ...view }
}
const START = { col: 12, row: 6 }
/** The first message after turning the explorer on starts with the date (the fixture's first frame). */
const first = (cell: string) => `January 2024. ${cell}`
/** Elevation of a row: the top row is the northernmost, so the highest. */
const heightOf = (row: number) => elevationForPoint((row + 0.5) / ROWS)

describe('Explorer: turning it on and off', () => {
  it('reads the map of the date on screen, shows a notice while it waits, and puts focus on the sound map', async () => {
    let finish!: (value: FrameGrid) => void
    analyzeGrid.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(screen.queryByRole('application')).toBeNull()
    const toggle = screen.getByRole('button', { name: 'Explore the map' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Reading the map…')).toBeInTheDocument()
    expect(analyzeGrid.mock.calls[0][0]).toBe(visualization.frames[0])
    expect(surface()).toHaveFocus()
    await act(async () => { finish(grid) })
    expect(screen.queryByText('Reading the map…')).toBeNull()
  })

  it('unlocks the audio in the click and pauses a running player', async () => {
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    engine.stop.mockClear()
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    expect(engine.unlock).toHaveBeenCalled()
    expect(engine.stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('describes the surface for a screen reader and gives a visible instruction line', async () => {
    await exploring()
    const element = surface()
    expect(element).toHaveAttribute('tabindex', '0')
    expect(element).toHaveAttribute('aria-roledescription', 'sound map')
    const instructions = document.getElementById(element.getAttribute('aria-describedby')!)!
    expect(instructions).toHaveTextContent(/Left arrow: Move one place west and play it/)
    expect(instructions).toHaveTextContent(/R: Play this place again/)
    expect(instructions).toHaveTextContent(/Direct touch: drag to hear each place/)
    expect(instructions).toBeVisible()
  })

  it('is laid over the map area only, when the data names one', async () => {
    const user = userEvent.setup({ delay: null })
    const withArea: Visualization = { ...visualization, mapArea: { x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.8 } }
    render(<PlayerPage visualization={withArea} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    expect(analyzeGrid.mock.calls[0][3]).toEqual({ x0: 0.1, y0: 0.2, x1: 0.9, y1: 0.8 })
    expect(surface().style).toMatchObject({ left: '10%', top: '20%' })
    expect(surface().style.width).toBe('80%')
  })

  it('stops its sound when it is turned off, and removes the sound map', async () => {
    const { user } = await exploring()
    engine.stop.mockClear()
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    expect(engine.stop).toHaveBeenCalled()
    expect(screen.queryByRole('application')).toBeNull()
    expect(screen.queryByRole('slider', { name: 'Column, west to east' })).toBeNull()
  })

  it('reloads the map when the date changes, and stops what was playing', async () => {
    await exploring()
    expect(analyzeGrid).toHaveBeenCalledTimes(1)
    fireEvent.change(dateSlider(), { target: { value: '1' } })
    await tick(0)
    expect(analyzeGrid).toHaveBeenCalledTimes(2)
    expect(analyzeGrid.mock.calls[1][0]).toBe(visualization.frames[1])
    expect(engine.stop).toHaveBeenCalled()
  })

  it('is handed back to the player when Play is pressed', async () => {
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    await tick(0)
    expect(screen.queryByRole('application')).toBeNull()
    expect(screen.getByRole('button', { name: 'Explore the map' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Explorer: the keyboard', () => {
  it('plays the next cell with a larger pan when the right arrow is pressed, and leaves the date alone', async () => {
    const { user } = await exploring()
    const before = dateSlider().getAttribute('aria-valuetext')
    await user.keyboard('{ArrowRight}')
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    expect(played()[0]).toEqual([{ midi: noteOf(START.col + 1, START.row), level: 0.5, seconds: 0.12, pan: panForPoint((START.col + 1.5) / COLS), elevation: heightOf(START.row) }])
    expect(engine.playCategory).not.toHaveBeenCalled()
    await tick(200)
    await user.keyboard('{ArrowRight}')
    expect(played()[1][0].pan).toBeGreaterThan(played()[0][0].pan)
    expect(dateSlider().getAttribute('aria-valuetext')).toBe(before)
    expect(dateSlider()).toHaveValue('0')
  })

  it('moves one cell with an arrow and four with Shift', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveValue(String(START.col - 1))
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(screen.getByRole('slider', { name: 'Row, north to south' })).toHaveValue(String(START.row + 4))
  })

  it('goes to the edges with Home, End, Page Up and Page Down, and stops there', async () => {
    const { user } = await exploring()
    const column = () => screen.getByRole('slider', { name: 'Column, west to east' })
    const row = () => screen.getByRole('slider', { name: 'Row, north to south' })
    await user.keyboard('{Home}')
    expect(column()).toHaveValue('0')
    await user.keyboard('{ArrowLeft}')
    expect(column()).toHaveValue('0')
    await user.keyboard('{End}')
    expect(column()).toHaveValue(String(COLS - 1))
    await user.keyboard('{PageUp}')
    expect(row()).toHaveValue('0')
    await user.keyboard('{PageDown}')
    expect(row()).toHaveValue(String(ROWS - 1))
  })

  it('plays the seeded dropout cue for a cell without data, and no note', async () => {
    const { user } = await exploring()
    await user.keyboard('{End}')
    expect(ensemble.playDropout).toHaveBeenCalledTimes(1)
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    expect(engine.playMissing).not.toHaveBeenCalled()
  })

  it('plays the cell again with R', async () => {
    const { user } = await exploring()
    await user.keyboard('r')
    await tick(200)
    await user.keyboard('r')
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(played()[1]).toEqual(played()[0])
  })

  it('plays the first move at once, then no more often than every 50 ms, and the latest cell wins', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    await tick(60)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(played()[1][0].pan).toBe(panForPoint((START.col + 3.5) / COLS))
    expect(played()[1][0].midi).toBe(noteOf(START.col + 3, START.row))
  })

  it('makes the first sound of a key press before any timer runs (the 50 ms answer)', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}')
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
  })

  it('plays the last of eight moves within 50 ms of the last press, and the first at once (the latency budget)', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}'.repeat(8))
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    await tick(49)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(played()[1][0].midi).toBe(noteOf(START.col + 8, START.row))
  })

  it('takes back the last moves with Ctrl+Z, one at a time, with a quiet note of the place it returns to', async () => {
    const { user } = await exploring()
    const column = () => screen.getByRole('slider', { name: 'Column, west to east' })
    await user.keyboard('{ArrowRight}')
    await tick(100)
    await user.keyboard('{ArrowRight}')
    expect(column()).toHaveValue(String(START.col + 2))
    ensemble.playNotes.mockClear()
    await user.keyboard('{Control>}z{/Control}')
    expect(column()).toHaveValue(String(START.col + 1))
    expect(played()).toEqual([[expect.objectContaining({ midi: noteOf(START.col + 1, START.row), level: 0.3, seconds: 0.12 })]])
    await user.keyboard('{Control>}z{/Control}')
    expect(column()).toHaveValue(String(START.col))
    expect(liveText()).toBe('')
  })

  it('does nothing for Ctrl+Z when nothing has been moved', async () => {
    const { user } = await exploring()
    await user.keyboard('{Control>}z{/Control}')
    expect(soundsHeard()).toBe(0)
  })

  it('stops the sound once for Escape, and leaves a locked place locked', async () => {
    const { user } = await exploring()
    await user.keyboard('l')
    engine.stop.mockClear()
    await user.keyboard('{Escape}')
    expect(engine.stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('says nothing when the cursor moves: a move is a sound, not a sentence', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}{ArrowDown}{Home}')
    await tick(2000)
    expect(liveText()).toBe('')
  })

  it('lets Space play and pause the dates, as it does everywhere on Listen', async () => {
    const { user } = await exploring()
    await user.keyboard(' ')
    await tick(0)
    expect(engine.playSequence).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('stops the sound on Escape and lets other keys through', async () => {
    const { user } = await exploring()
    engine.stop.mockClear()
    await user.keyboard('{Escape}')
    expect(engine.stop).toHaveBeenCalledTimes(1)
    await user.keyboard('{Tab}')
    expect(surface()).not.toHaveFocus()
  })
})

describe('Explorer: keys at the edges', () => {
  const column = () => screen.getByRole('slider', { name: 'Column, west to east' }) as HTMLInputElement
  const row = () => screen.getByRole('slider', { name: 'Row, north to south' }) as HTMLInputElement
  const sounds = () => soundsHeard()
  const place = () => [Number(column().value), Number(row().value)]

  it('lands on the edge when a Shift jump would go past it', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}{ArrowRight}{ArrowRight}')
    expect(column()).toHaveValue('2')
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(column()).toHaveValue('0')
    await user.keyboard('{PageDown}{ArrowUp}')
    expect(row()).toHaveValue(String(ROWS - 2))
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}')
    expect(row()).toHaveValue(String(ROWS - 1))
  })

  const corners = [
    { name: 'north-west', keys: '{Home}{PageUp}', col: 0, row: 0 },
    { name: 'north-east', keys: '{End}{PageUp}', col: COLS - 1, row: 0 },
    { name: 'south-west', keys: '{Home}{PageDown}', col: 0, row: ROWS - 1 },
    { name: 'south-east', keys: '{End}{PageDown}', col: COLS - 1, row: ROWS - 1 },
  ]
  it.each(corners)('goes to the right place with Home, End, Page Up and Page Down from the $name corner', async ({ keys, col, row: r }) => {
    const { user } = await exploring()
    await user.keyboard(keys)
    expect(place()).toEqual([col, r])
    const results = { '{Home}': [0, r], '{End}': [COLS - 1, r], '{PageUp}': [col, 0], '{PageDown}': [col, ROWS - 1] } as const
    for (const [key, expected] of Object.entries(results)) {
      await user.keyboard(keys) // back to the corner
      await user.keyboard(key)
      expect(place()).toEqual(expected)
    }
  })

  it.each([
    { key: '{ArrowLeft}', start: '{Home}' },
    { key: '{ArrowRight}', start: '{End}' },
    { key: '{ArrowUp}', start: '{PageUp}' },
    { key: '{ArrowDown}', start: '{PageDown}' },
    { key: '{Home}', start: '{Home}' },
    { key: '{End}', start: '{End}' },
    { key: '{PageUp}', start: '{PageUp}' },
    { key: '{PageDown}', start: '{PageDown}' },
  ])('plays the edge cue, two 60 ms notes an octave apart, and says nothing, when $key is pressed at the edge', async ({ key, start }) => {
    const { user } = await exploring()
    await user.keyboard(start)
    await tick(500)
    ensemble.playNotes.mockClear()
    ensemble.playDropout.mockClear()
    const at = place()
    const before = liveText()
    await user.keyboard(key)
    // At the east edge the cell has no data, and the cue then uses the middle of the range: still two notes.
    const calls = played()
    expect(calls).toHaveLength(2)
    const [first, second] = calls.map(call => call[0])
    expect(first.seconds).toBe(0.06)
    expect(second.seconds).toBe(0.06)
    expect(first.midi - second.midi).toBe(12)
    expect(ensemble.playNotes.mock.calls[1][1]).toBeGreaterThan(0)
    await tick(1000)
    expect(liveText()).toBe(before)
    expect(place()).toEqual(at)
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('plays the edge cue for each press at the edge, never moves, and never speaks', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}')
    await tick(500)
    ensemble.playNotes.mockClear()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(ensemble.playNotes).toHaveBeenCalledTimes(6)
    expect(column()).toHaveValue('0')
    await tick(1000)
    expect(liveText()).toBe('')
  })

  it('plays the cell, not the edge cue, when the move reached the edge', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}{ArrowRight}')
    await tick(130)
    ensemble.playNotes.mockClear()
    await user.keyboard('{ArrowLeft}')
    expect(played()).toEqual([[expect.objectContaining({ midi: noteOf(0, START.row), seconds: 0.12 })]])
  })

  it('still plays the cell again with R at an edge', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}')
    await tick(200)
    ensemble.playNotes.mockClear()
    await user.keyboard('r')
    expect(played()).toEqual([[expect.objectContaining({ midi: noteOf(0, START.row), seconds: 0.12 })]])
  })

  it('does nothing, and throws nothing, for keys pressed before the map has loaded', async () => {
    analyzeGrid.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    expect(surface()).toHaveFocus()
    await tick(1000)
    const sequences = engine.playSequence.mock.calls.length
    for (const key of ['{ArrowLeft}', '{ArrowDown}', '{Home}', '{End}', '{PageUp}', '{PageDown}', 'r', '{Enter}', '{Escape}']) {
      await user.keyboard(key)
    }
    await tick(1000)
    expect(sounds()).toBe(0)
    expect(engine.playSequence.mock.calls.length).toBe(sequences)
    expect(liveText()).toBe('')
  })

  it.each(['ctrlKey', 'altKey', 'metaKey'])('does not handle an arrow pressed with %s, so browser and player shortcuts still work', async modifier => {
    await exploring()
    const notStopped = fireEvent.keyDown(surface(), { key: 'ArrowRight', [modifier]: true })
    expect(notStopped).toBe(true)
    expect(sounds()).toBe(0)
    expect(column()).toHaveValue(String(START.col))
    await tick(1000)
    expect(liveText()).toBe('')
    // The same key without a modifier is handled and stopped.
    expect(fireEvent.keyDown(surface(), { key: 'ArrowRight' })).toBe(false)
  })

  it('puts the cursor back in the middle when a new date has fewer rows than the cursor needs', async () => {
    const small = (frameId: string): FrameGrid => ({ ...makeGrid(frameId), rows: 6, cells: makeGrid(frameId).cells.slice(0, COLS * 6) })
    const { user } = await exploring()
    await user.keyboard('{Home}{PageDown}{ArrowUp}')
    expect(row()).toHaveValue(String(ROWS - 2))
    analyzeGrid.mockImplementation(async (frame: { id: string }) => small(frame.id))
    fireEvent.change(dateSlider(), { target: { value: '1' } })
    await tick(0)
    expect(row()).toHaveValue('3')
    expect(row()).toHaveAttribute('max', '5')
    expect(column()).toHaveValue(String(START.col))
  })

  it('keeps the cursor when a new date has a grid the cursor still fits in', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}{PageDown}')
    fireEvent.change(dateSlider(), { target: { value: '1' } })
    await tick(0)
    expect(place()).toEqual([0, ROWS - 1])
  })
})

describe('Explorer: sweeps', () => {
  it('sweeps the row from west to east on Enter: 24 steps, rising pan, no tick', async () => {
    const { user } = await exploring()
    await user.keyboard('{Enter}')
    expect(engine.playSequence).toHaveBeenCalledTimes(1)
    const [steps, , options] = engine.playSequence.mock.calls[0]
    expect(steps).toHaveLength(COLS)
    expect(options).toEqual({ tick: false })
    expect(steps.map((s: { atMs: number }) => s.atMs)).toEqual(Array.from({ length: COLS }, (_, k) => k * 250))
    const pans = steps.map((s: { pan: number }) => s.pan)
    expect(pans).toEqual([...pans].sort((a, b) => a - b))
    expect(pans[0]).toBeLessThan(0)
    expect(pans[COLS - 1]).toBeGreaterThan(0)
    expect(steps[0].category).toBe('cold')
    expect(steps[COLS - 1].category).toBe('insufficient')
  })

  it('sweeps the column from north to south on Shift+Enter, all with the same pan', async () => {
    const { user } = await exploring()
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    const [steps] = engine.playSequence.mock.calls[0]
    expect(steps).toHaveLength(ROWS)
    // North to south, so the height falls from the top of the map to the bottom.
    expect(steps.map((s: { elevation: number }) => s.elevation)).toEqual(Array.from({ length: ROWS }, (_, row) => heightOf(row)))
    expect(new Set(steps.map((s: { pan: number }) => s.pan)).size).toBe(1)
  })

  it('moves the cursor with the sweep, then says what the row held', async () => {
    const { user } = await exploring()
    await user.keyboard('{Enter}')
    const [steps, onStep] = engine.playSequence.mock.calls[0]
    for (let k = 0; k < steps.length; k++) act(() => onStep(k))
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveValue(String(COLS - 1))
    expect(liveText()).toBe('')
    await tick(250)
    expect(liveText()).toBe(describeSweep(visualization, grid, { kind: 'row', index: START.row }))
  })

  it('ends a sweep when a key is pressed, so the late steps do not move the cursor', async () => {
    const { user } = await exploring()
    await user.keyboard('{Enter}')
    const [, onStep] = engine.playSequence.mock.calls[0]
    await user.keyboard('{Escape}')
    act(() => onStep(5))
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveValue(String(START.col))
  })

  it('has buttons for the same sweeps, and Stop', async () => {
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Sweep this row' }))
    expect(engine.playSequence.mock.calls[0][0]).toHaveLength(COLS)
    await user.click(screen.getByRole('button', { name: 'Sweep this column' }))
    expect(engine.playSequence.mock.calls[1][0]).toHaveLength(ROWS)
    engine.stop.mockClear()
    await user.click(within(screen.getByRole('group', { name: 'Sweep the map' })).getByRole('button', { name: 'Stop' }))
    expect(engine.stop).toHaveBeenCalled()
  })
})

describe('Explorer: sliders for phones and screen readers', () => {
  it('has a named slider for the column and one for the row, each described by the cell under the cursor', async () => {
    await exploring()
    const here = describeCell(visualization, grid, START.col, START.row)
    for (const name of ['Column, west to east', 'Row, north to south']) {
      const slider = screen.getByRole('slider', { name })
      expect(slider).toHaveAttribute('aria-valuetext', here)
    }
  })

  it('moves the same cursor and plays the cell when a slider is moved', async () => {
    await exploring()
    fireEvent.change(screen.getByRole('slider', { name: 'Column, west to east' }), { target: { value: '3' } })
    expect(played()[0]).toEqual([{ midi: noteOf(3, START.row), level: 0.5, seconds: 0.12, pan: panForPoint(3.5 / COLS), elevation: heightOf(START.row) }])
    expect(screen.getByRole('slider', { name: 'Row, north to south' })).toHaveAttribute('aria-valuetext', describeCell(visualization, grid, 3, START.row))
    // The slider is read by the screen reader itself, so the live region does not say it a second time.
    await tick(500)
    expect(liveText()).toBe('')
  })

  it('has 44 px sweep buttons that can wrap', async () => {
    await exploring()
    const group = screen.getByRole('group', { name: 'Sweep the map' })
    expect(group.querySelectorAll('button')).toHaveLength(3)
  })
})

/** jsdom has no layout, so the surface is given a size: 240 × 120 px, ten pixels to a cell. */
function sizedSurface() {
  vi.spyOn(surface(), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, x: 0, y: 0, toJSON: () => ({}) })
}
/** A finger put down on a cell and lifted again: the one way left to hear a cell in words (a move is a sound, IX01). */
function touchCell(col: number, row: number) {
  const at = { clientX: col * 10 + 5, clientY: row * 10 + 5, pointerId: 1 }
  fireEvent.pointerDown(surface(), at)
  fireEvent.pointerUp(surface(), at)
}

describe('Explorer: announcements', () => {
  it('says the cell once, when the finger is lifted, and not for the cells passed over', async () => {
    await exploring()
    sizedSurface()
    const at = (col: number) => ({ clientX: col * 10 + 5, clientY: START.row * 10 + 5, pointerId: 1 })
    fireEvent.pointerDown(surface(), at(START.col))
    fireEvent.pointerMove(surface(), at(START.col + 1))
    fireEvent.pointerMove(surface(), at(START.col + 2))
    await tick(1000)
    expect(liveText()).toBe('')
    fireEvent.pointerUp(surface(), at(START.col + 2))
    expect(liveText()).toBe(first(describeCell(visualization, grid, START.col + 2, START.row)))
  })

  it('puts the date in the first message only, and leaves it out of later ones', async () => {
    await exploring()
    sizedSurface()
    touchCell(START.col + 1, START.row)
    expect(liveText()).toBe(first(describeCell(visualization, grid, START.col + 1, START.row)))
    touchCell(START.col + 2, START.row)
    expect(liveText()).toBe(describeCell(visualization, grid, START.col + 2, START.row))
    expect(liveText()).not.toContain('January')
  })

  it('puts the date back in the first message after the date changes, and after turning the explorer off and on', async () => {
    const { user } = await exploring()
    sizedSurface()
    touchCell(START.col + 1, START.row)
    fireEvent.change(dateSlider(), { target: { value: '1' } })
    await tick(0)
    touchCell(START.col + 2, START.row)
    expect(liveText()).toBe(explorerMessage(describeCell(visualization, grid, START.col + 2, START.row), 'rich', 'July 2024'))
    touchCell(START.col + 3, START.row)
    expect(liveText()).not.toContain('July')
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    sizedSurface()
    touchCell(START.col + 1, START.row)
    expect(liveText()).toMatch(/^July 2024\. /)
  })

  it('says a cell without data in words', async () => {
    await exploring()
    sizedSurface()
    touchCell(COLS - 1, START.row)
    expect(liveText()).toMatch(/^January 2024\. Not enough data \(land, cloud or labels\)/)
  })
})

describe('Explorer: concise or rich announcements', () => {
  it('says the short form of the cell, and of the sliders, when the listener chose concise', async () => {
    localStorage.setItem('earth-jukebox:detail', 'concise')
    await exploring()
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveAttribute('aria-valuetext', describeCell(visualization, grid, START.col, START.row, { detail: 'concise' }))
    sizedSurface()
    touchCell(START.col + 1, START.row)
    expect(liveText()).toBe(first(describeCell(visualization, grid, START.col + 1, START.row, { detail: 'concise' })))
    expect(liveText()).not.toContain('column')
    expect(liveText().length).toBeLessThanOrEqual(60)
  })

  it('says the short form of the sweep too', async () => {
    localStorage.setItem('earth-jukebox:detail', 'concise')
    const { user } = await exploring()
    await user.keyboard('{Enter}')
    const [steps, onStep] = engine.playSequence.mock.calls[0]
    for (let k = 0; k < steps.length; k++) act(() => onStep(k))
    await tick(250)
    expect(liveText()).toBe(sweepEndMessage(describeSweep(visualization, grid, { kind: 'row', index: START.row }, { detail: 'concise' }), 'concise'))
    expect(liveText().length).toBeLessThanOrEqual(60)
  })
})

describe('Explorer: pointer and touch', () => {
  /** jsdom has no layout, so the surface is given a size: 240 × 120 px, ten pixels to a cell. */
  function sized() {
    vi.spyOn(surface(), 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 240, bottom: 120, width: 240, height: 120, x: 0, y: 0, toJSON: () => ({}) })
  }

  it('plays the cell under a touch or press, follows a drag, and says the cell once when it is lifted', async () => {
    await exploring()
    sized()
    fireEvent.pointerDown(surface(), { clientX: 5, clientY: 5, pointerId: 1 })
    expect(played().at(-1)).toEqual([{ midi: noteOf(0, 0), level: 0.5, seconds: 0.12, pan: panForPoint(0.5 / COLS), elevation: heightOf(0) }])
    await tick(200)
    fireEvent.pointerMove(surface(), { clientX: 175, clientY: 5, pointerId: 1 })
    expect(played().at(-1)).toEqual([{ midi: noteOf(17, 0), level: 0.5, seconds: 0.12, pan: panForPoint(17.5 / COLS), elevation: heightOf(0) }])
    expect(liveText()).toBe('')
    fireEvent.pointerUp(surface(), { clientX: 175, clientY: 5, pointerId: 1 })
    expect(liveText()).toBe(first(describeCell(visualization, grid, 17, 0)))
  })

  it('gives the last column and row for a pointer at the exact right and bottom edge, and the first for the top left', async () => {
    await exploring()
    sized()
    fireEvent.pointerDown(surface(), { clientX: 240, clientY: 120, pointerId: 1 })
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveValue(String(COLS - 1))
    expect(screen.getByRole('slider', { name: 'Row, north to south' })).toHaveValue(String(ROWS - 1))
    fireEvent.pointerUp(surface(), { clientX: 240, clientY: 120, pointerId: 1 })
    await tick(200)
    fireEvent.pointerDown(surface(), { clientX: 0, clientY: 0, pointerId: 1 })
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveValue('0')
    expect(screen.getByRole('slider', { name: 'Row, north to south' })).toHaveValue('0')
  })

  it('ignores a pointer that moves without being pressed', async () => {
    await exploring()
    sized()
    fireEvent.pointerMove(surface(), { clientX: 50, clientY: 50, pointerId: 1 })
    expect(soundsHeard()).toBe(0)
  })

  it('does not play twice for movement inside the same cell', async () => {
    await exploring()
    sized()
    fireEvent.pointerDown(surface(), { clientX: 5, clientY: 5, pointerId: 1 })
    await tick(200)
    fireEvent.pointerMove(surface(), { clientX: 8, clientY: 8, pointerId: 1 })
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
  })

  it('asks a question on a long press and on a right click, and stops on a two-finger tap (IX01)', async () => {
    await exploring()
    sized()
    const asked: string[] = []
    const off = [dispatchSpy('query', asked), dispatchSpy('stopSpeech', asked)]
    fireEvent.pointerDown(surface(), { clientX: 5, clientY: 5, pointerId: 1 })
    await tick(500)
    fireEvent.pointerUp(surface(), { pointerId: 1 })
    expect(asked).toEqual(['query'])
    fireEvent.contextMenu(surface())
    expect(asked).toEqual(['query', 'query'])
    fireEvent.pointerDown(surface(), { clientX: 5, clientY: 5, pointerId: 1 })
    fireEvent.pointerDown(surface(), { clientX: 55, clientY: 5, pointerId: 2 })
    await tick(100)
    fireEvent.pointerUp(surface(), { pointerId: 1 })
    fireEvent.pointerUp(surface(), { pointerId: 2 })
    expect(asked).toEqual(['query', 'query', 'stopSpeech'])
    off.forEach(stop => stop())
  })
})

describe("Explorer: What's here? (IX02)", () => {
  /** Level 1: what the place shows. Level 2: where it is. */
  const level1 = (col: number, row: number) => describeCell(visualization, grid, col, row)
  const level2 = (col: number, row: number) => {
    const place = describePlace(grid, col, row)
    return `${place.charAt(0).toUpperCase()}${place.slice(1)}.`
  }
  const shown = () => document.querySelector('.explorer__here')?.textContent ?? null
  const brief = () => screen.getByRole('radio', { name: 'Brief' })
  const full = () => screen.getByRole('radio', { name: 'Full' })

  it('says and shows what is here on I, and where it is on a second I within 4 s, with no sound', async () => {
    const { user } = await exploring()
    expect(shown()).toBeNull()
    const sounds = soundsHeard()
    await user.keyboard('i')
    expect(liveText()).toBe(level1(START.col, START.row))
    expect(shown()).toBe(level1(START.col, START.row))
    await tick(3000)
    await user.keyboard('i')
    expect(liveText()).toBe(level2(START.col, START.row))
    expect(shown()).toBe(level2(START.col, START.row))
    expect(soundsHeard()).toBe(sounds)
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('starts again at level 1 after 4 s', async () => {
    const { user } = await exploring()
    await user.keyboard('i')
    await tick(4000)
    await user.keyboard('i')
    expect(liveText()).toBe(level1(START.col, START.row))
  })

  it('answers for the place the cursor is on now, and arrow moves still say nothing', async () => {
    const { user } = await exploring()
    await user.keyboard('i')
    await user.keyboard('{ArrowRight}')
    await tick(2000)
    expect(liveText()).toBe(level1(START.col, START.row))
    await tick(4000)
    await user.keyboard('i')
    expect(liveText()).toBe(level1(START.col + 1, START.row))
  })

  it('forgets the question on Escape, so the next I starts again at level 1', async () => {
    const { user } = await exploring()
    await user.keyboard('i')
    await user.keyboard('{Escape}')
    await user.keyboard('i')
    expect(liveText()).toBe(level1(START.col, START.row))
    expect(shown()).toBe(level1(START.col, START.row))
  })

  it('does nothing with the explorer off', async () => {
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    act(() => { dispatch({ type: 'query' }) })
    expect(liveText()).toBe('')
    expect(soundsHeard()).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    await user.keyboard('i')
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    const said = liveText()
    act(() => { dispatch({ type: 'query' }) })
    expect(liveText()).toBe(said)
    expect(shown()).toBeNull()
  })

  it('answers gamepad X and the other ways of asking, all through the query action', async () => {
    await exploring()
    act(() => { dispatch({ type: 'query' }) })
    expect(liveText()).toBe(level1(START.col, START.row))
  })

  it('answers a long press on a cell, and lifting the finger does not say the cell over the answer', async () => {
    await exploring()
    sizedSurface()
    const at = { clientX: 3 * 10 + 5, clientY: 2 * 10 + 5, pointerId: 1 }
    fireEvent.pointerDown(surface(), at)
    await tick(500)
    expect(liveText()).toBe(level1(3, 2))
    fireEvent.pointerUp(surface(), at)
    expect(liveText()).toBe(level1(3, 2))
    // A plain press and lift after that says the cell again, as before (the map's first message of its own, so it starts with the date).
    await tick(4000)
    fireEvent.pointerDown(surface(), at)
    fireEvent.pointerUp(surface(), at)
    expect(liveText()).toBe(first(level1(3, 2)))
    fireEvent.contextMenu(surface())
    expect(liveText()).toBe(level1(3, 2))
    fireEvent.contextMenu(surface())
    expect(liveText()).toBe(level2(3, 2))
  })

  it('starts at level 2 with Full, and keeps the choice after a remount', async () => {
    const { user, unmount } = await exploring()
    expect(brief()).toBeChecked()
    await user.click(full())
    expect(localStorage.getItem('earth-jukebox:verbosity')).toBe('full')
    surface().focus()
    await user.keyboard('i')
    expect(liveText()).toBe(level2(START.col, START.row))
    unmount()
    const again = await exploring()
    expect(full()).toBeChecked()
    await again.user.keyboard('i')
    expect(liveText()).toBe(level2(START.col, START.row))
  })

  it('falls back to Brief when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { user } = await exploring()
    expect(brief()).toBeChecked()
    await user.keyboard('i')
    expect(liveText()).toBe(level1(START.col, START.row))
    vi.mocked(Storage.prototype.getItem).mockRestore()
  })

  it('lists I in the map instructions, and passes accessibility checks with the answer and the choice shown', async () => {
    const { user, container } = await exploring()
    expect(document.getElementById(surface().getAttribute('aria-describedby')!)).toHaveTextContent(/I: Ask what is here\./)
    await user.keyboard('i')
    expect(screen.getByRole('group', { name: "Words for What's here" })).toBeInTheDocument()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

describe('Explorer: failure and vibration', () => {
  it('shows an error if the map cannot be read, and the player still works', async () => {
    analyzeGrid.mockRejectedValue(new Error('The picture could not be loaded.'))
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    expect(screen.getByRole('alert')).toHaveTextContent('The picture could not be loaded.')
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(engine.playSequence).toHaveBeenCalled()
  })

  it('buzzes for each cell when vibration is on, and not when it is off', async () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { vibrate }))
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}')
    expect(vibrate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Vibration' }))
    await tick(200)
    await user.keyboard('{ArrowRight}')
    expect(vibrate).toHaveBeenCalledTimes(1)
  })
})

describe('Explorer: time travel (F23)', () => {
  it('locks the place with L as a sound, and plays the edge cue instead of moving until it is unlocked', async () => {
    const { user } = await exploring()
    await user.keyboard('l')
    // The lock is a sound: the note of the place and the fifth above it together, not a sentence.
    expect(played()).toHaveLength(1)
    expect(played()[0]).toHaveLength(2)
    expect(played()[0][1].midi).toBeGreaterThan(played()[0][0].midi)
    expect(played()[0][0].seconds).toBe(0.25)
    expect(liveText()).toBe('')
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'true')
    ensemble.playNotes.mockClear()
    await user.keyboard('{ArrowRight}')
    await tick(500)
    expect(played()).toHaveLength(2)
    expect(played().every(call => call[0].seconds === 0.06)).toBe(true)
    expect(liveText()).toBe('Locked on this place. Press L to unlock before moving.')
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveValue(String(START.col))
    ensemble.playNotes.mockClear()
    await user.keyboard('l')
    // Unlocked: the fifth, then the note.
    expect(played()).toHaveLength(2)
    expect(played()[0][0].midi).toBeGreaterThan(played()[1][0].midi)
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'false')
    ensemble.playNotes.mockClear()
    await user.keyboard('{ArrowRight}')
    expect(played()).toHaveLength(1)
    expect(played()[0][0].seconds).toBe(0.12)
  })

  it('unlocks with L and with the button, which works without a keyboard, and Escape no longer unlocks', async () => {
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Lock this place' }))
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'true')
    act(() => surface().focus())
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'true')
    await user.keyboard('l')
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Lock this place' }))
    await user.click(screen.getByRole('button', { name: 'Lock this place' }))
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('plays the locked place on the date the slider is moved to, not the whole map', async () => {
    const { user } = await exploring()
    await user.keyboard('l')
    engine.playCategory.mockClear()
    analyzeGrid.mockClear()
    await user.click(screen.getByRole('slider', { name: 'Date' }))
    fireEvent.change(dateSlider(), { target: { value: '2' } })
    await tick(0)
    expect(dateSlider()).toHaveValue('2')
    expect(analyzeGrid.mock.calls.some(call => call[0] === visualization.frames[2])).toBe(true)
    expect(engine.playCategory).toHaveBeenCalledTimes(1)
    expect(engine.playCategory.mock.calls[0][0]).toBe(cellOf(grid, START.col, START.row).category)
    expect(engine.playCategory.mock.calls[0][1]).toMatchObject({ pan: panForPoint((START.col + 0.5) / COLS), elevation: heightOf(START.row) })
    expect(engine.playSequence).not.toHaveBeenCalled()
  })

  it('plays the place across every date, one step per date, and says how it changed', async () => {
    const { user } = await exploring()
    await user.keyboard('l')
    expect(screen.getByRole('button', { name: 'Play this place across the dates' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Play this place across the dates' }))
    await tick(0)
    expect(engine.playSequence).toHaveBeenCalledTimes(1)
    const [steps, onStep] = engine.playSequence.mock.calls[0]
    expect(steps).toHaveLength(visualization.frames.length)
    expect(steps.map((step: { category: string }) => step.category)).toEqual(visualization.frames.map(() => cellOf(grid, START.col, START.row).category))
    expect(steps.every((step: { pan: number }) => step.pan === panForPoint((START.col + 0.5) / COLS))).toBe(true)
    // The date slider follows the sound, and the summary comes after the last date.
    act(() => onStep(2))
    expect(dateSlider()).toHaveValue('2')
    act(() => onStep(steps.length - 1))
    await tick(1000)
    expect(liveText()).toContain('centre, column 13, row 7.')
    expect(liveText()).toContain('steady')
  })

  it('cannot play across the dates until a place is locked, and unlocking stops a run', async () => {
    const { user } = await exploring()
    expect(screen.getByRole('button', { name: 'Play this place across the dates' })).toBeDisabled()
    await user.keyboard('l')
    await user.click(screen.getByRole('button', { name: 'Play this place across the dates' }))
    await tick(0)
    const onStep = engine.playSequence.mock.calls[0][1]
    act(() => surface().focus())
    await user.keyboard('l')
    act(() => onStep(3))
    await tick(1000)
    // Stopped: the run's summary is never said, and unlocking is a sound.
    expect(liveText()).toBe('')
  })

  it('has no accessibility violations while locked', async () => {
    const { container, user } = await exploring()
    await user.keyboard('l')
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

describe('Explorer: accessibility', () => {
  it('has no violations with the explorer on', async () => {
    const { container } = await exploring()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

describe('Explorer: opened by a link (F40)', () => {
  const open = (hash: string) => window.history.replaceState(null, '', hash)
  const column = () => (screen.getByRole('slider', { name: 'Column, west to east' }) as HTMLInputElement).value
  const row = () => (screen.getByRole('slider', { name: 'Row, north to south' }) as HTMLInputElement).value
  afterEach(() => { window.history.replaceState(null, '', '/') })

  it('opens the map on the cell the link names, and makes no sound', async () => {
    open('#listen?cell=5,3')
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(surface()).toBeInTheDocument()
    expect(column()).toBe('5')
    expect(row()).toBe('3')
    expect(engine.unlock).not.toHaveBeenCalled()
    expect(engine.playCategory).not.toHaveBeenCalled()
    expect(engine.playMissing).not.toHaveBeenCalled()
  })

  it('unlocks the audio on the first key press, and sounds the cell it lands on', async () => {
    open('#listen?cell=5,3')
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.keyboard('{ArrowRight}')
    await tick(300)
    expect(engine.unlock).toHaveBeenCalledTimes(1)
    expect(column()).toBe('6')
    // Column 6 of 22 readable columns is the second of five bands: "cool". It sounds as the note of that place.
    expect(played().flat().some(note => note.midi === noteOf(6, 3))).toBe(true)
    // Later presses do not unlock again.
    await user.keyboard('{ArrowRight}')
    await tick(300)
    expect(engine.unlock).toHaveBeenCalledTimes(1)
  })

  it('does not take Escape for the first press: that stops sound, it does not start it', async () => {
    open('#listen?cell=5,3')
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.keyboard('{Escape}')
    await tick(300)
    expect(engine.unlock).not.toHaveBeenCalled()
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('falls back to the middle of the map when the cell is not on it, and still opens', async () => {
    open('#listen?cell=99,99')
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(surface()).toBeInTheDocument()
    expect(column()).toBe(String(START.col))
    expect(row()).toBe(String(START.row))
  })

  it('opens on a cell from a link pasted while Listen is already showing', async () => {
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    expect(screen.queryByRole('application')).toBeNull()
    act(() => {
      open('#listen?cell=2,4')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await tick(0)
    expect(surface()).toBeInTheDocument()
    expect(column()).toBe('2')
    expect(row()).toBe('4')
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('puts the cell in the address once the map has been read, and takes it out when the map is closed', async () => {
    open('#listen')
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />, { wrapper: AnnouncerProvider })
    await tick(0)
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    await user.keyboard('{ArrowRight}')
    await tick(300)
    expect(window.location.hash).toContain(`cell=${START.col + 1}%2C${START.row}`)
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    expect(window.location.hash).not.toContain('cell=')
  })
})

describe('Explorer: low-vision map tools (VIS1)', () => {
  const magnifier = () => screen.getByRole('button', { name: 'Magnifier' })
  const outline = () => screen.getByRole('button', { name: 'High-contrast outline' })

  it('draws a crosshair that is hidden from screen readers and moves with the cursor', async () => {
    const { user } = await exploring()
    const across = screen.getByTestId('crosshair-row'), down = screen.getByTestId('crosshair-column')
    expect(across).toHaveAttribute('aria-hidden', 'true')
    expect(down).toHaveAttribute('aria-hidden', 'true')
    const before = { top: across.style.top, left: down.style.left }
    await user.keyboard('{ArrowRight}{ArrowDown}')
    await tick(300)
    expect(screen.getByTestId('crosshair-row').style.top).not.toBe(before.top)
    expect(screen.getByTestId('crosshair-column').style.left).not.toBe(before.left)
  })

  it('turns the magnifier on and off, and the lens is hidden from screen readers', async () => {
    const { user } = await exploring()
    expect(magnifier()).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('magnifier')).toBeNull()
    await user.click(magnifier())
    expect(magnifier()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('magnifier')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('magnifier').style.backgroundImage).toContain(visualization.frames[0].image.split('/').pop())
    await user.click(magnifier())
    expect(screen.queryByTestId('magnifier')).toBeNull()
  })

  it('moves the lens with the cursor cell', async () => {
    const { user } = await exploring()
    await user.click(magnifier())
    const at = () => screen.getByTestId('magnifier').style.getPropertyValue('--lens-at-x')
    const before = at()
    surface().focus()
    await user.keyboard('{ArrowRight}')
    await tick(300)
    expect(at()).not.toBe(before)
  })

  it('toggles the high-contrast outline class on the surface', async () => {
    const { user } = await exploring()
    expect(surface()).not.toHaveClass('explorer__surface--outline')
    await user.click(outline())
    expect(outline()).toHaveAttribute('aria-pressed', 'true')
    expect(surface()).toHaveClass('explorer__surface--outline')
    await user.click(outline())
    expect(surface()).not.toHaveClass('explorer__surface--outline')
  })

  it('remembers both choices after the page is opened again', async () => {
    const first = await exploring()
    await first.user.click(magnifier())
    await first.user.click(outline())
    expect(localStorage.getItem('earth-jukebox:magnifier')).toBe('on')
    expect(localStorage.getItem('earth-jukebox:map-outline')).toBe('on')
    first.unmount()
    await exploring()
    expect(magnifier()).toHaveAttribute('aria-pressed', 'true')
    expect(outline()).toHaveAttribute('aria-pressed', 'true')
  })

  it('still works for the visit when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    const { user } = await exploring()
    await user.click(magnifier())
    expect(magnifier()).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('magnifier')).toBeInTheDocument()
    await user.click(magnifier())
    expect(screen.queryByTestId('magnifier')).toBeNull()
    vi.restoreAllMocks()
  })

  it('reads the map and sounds the place the same with the tools on as off', async () => {
    async function run(toolsOn: boolean) {
      analyzeGrid.mockClear()
      ensemble.playNotes.mockClear()
      const { user, unmount } = await exploring()
      if (toolsOn) { await user.click(magnifier()); await user.click(outline()) }
      surface().focus()
      await user.keyboard('{ArrowRight}')
      await tick(300)
      const seen = { reads: analyzeGrid.mock.calls.map(call => call.slice(0, 4)), sounds: played().map(call => call[0].midi) }
      unmount()
      localStorage.clear()
      return seen
    }
    const off = await run(false)
    const on = await run(true)
    expect(off.sounds.length).toBeGreaterThan(0)
    expect(on).toEqual(off)
  })

  it('has no accessibility violations with both settings on', async () => {
    const { user, container } = await exploring()
    await user.click(magnifier())
    await user.click(outline())
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

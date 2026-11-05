import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import { elevationForPoint, panForPoint } from '../../audio/pan'
import type { Visualization } from '../../data'
import { describeCell, describeSweep, explorerMessage, sweepEndMessage } from '../../describe'
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
const grid = makeGrid('f')

const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const liveText = () => document.querySelector('[aria-live="polite"]')?.textContent?.trim() ?? ''
const surface = () => screen.getByRole('application', { name: 'Explore the map by sound' })
const dateSlider = () => screen.getByRole('slider', { name: 'Date' })

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  Object.values(engine).forEach(fn => fn.mockClear())
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
    expect(instructions).toHaveTextContent(/Arrow keys move over the map/)
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
    const next = cellOf(grid, START.col + 1, START.row)
    expect(engine.playCategory).toHaveBeenCalledTimes(1)
    const [category, options] = engine.playCategory.mock.calls[0]
    expect(category).toBe(next.category)
    expect(options).toEqual({ pan: panForPoint((START.col + 1.5) / COLS), elevation: heightOf(START.row), durationMs: 300 })
    await tick(200)
    await user.keyboard('{ArrowRight}')
    expect(engine.playCategory.mock.calls[1][1].pan).toBeGreaterThan(options.pan)
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

  it('plays the missing-data sound for a cell without data', async () => {
    const { user } = await exploring()
    await user.keyboard('{End}')
    expect(engine.playMissing).toHaveBeenCalledTimes(1)
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('plays the cell again with Space', async () => {
    const { user } = await exploring()
    await user.keyboard(' ')
    await tick(200)
    await user.keyboard(' ')
    expect(engine.playCategory).toHaveBeenCalledTimes(2)
    expect(engine.playCategory.mock.calls[1]).toEqual(engine.playCategory.mock.calls[0])
  })

  it('does not play more often than every 120 ms, and the latest cell wins', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    expect(engine.playCategory).toHaveBeenCalledTimes(1)
    await tick(150)
    expect(engine.playCategory).toHaveBeenCalledTimes(2)
    expect(engine.playCategory.mock.calls[1][1].pan).toBe(panForPoint((START.col + 3.5) / COLS))
  })

  it('keeps the player shortcuts out: Space does not play the dates', async () => {
    const { user } = await exploring()
    await user.keyboard(' ')
    expect(engine.playSequence).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull()
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
  const sounds = () => engine.playCategory.mock.calls.length + engine.playMissing.mock.calls.length
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
    { key: '{ArrowLeft}', start: '{Home}', word: 'West' },
    { key: '{ArrowRight}', start: '{End}', word: 'East' },
    { key: '{ArrowUp}', start: '{PageUp}', word: 'North' },
    { key: '{ArrowDown}', start: '{PageDown}', word: 'South' },
    { key: '{Home}', start: '{Home}', word: 'West' },
    { key: '{End}', start: '{End}', word: 'East' },
    { key: '{PageUp}', start: '{PageUp}', word: 'North' },
    { key: '{PageDown}', start: '{PageDown}', word: 'South' },
  ])('says "$word edge." after 400 ms, and plays nothing, when $key is pressed at the edge', async ({ key, start, word }) => {
    const { user } = await exploring()
    await user.keyboard(start)
    await tick(500)
    const played = sounds()
    const before = liveText()
    await user.keyboard(key)
    expect(sounds()).toBe(played)
    await tick(399)
    expect(liveText()).toBe(before)
    await tick(1)
    expect(liveText()).toBe(`${word} edge.`)
    await tick(1000)
    expect(sounds()).toBe(played)
  })

  it('says the edge once for a held key, and does not play again', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}')
    await tick(500)
    const played = sounds()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    await tick(130)
    await user.keyboard('{ArrowLeft}')
    await tick(399)
    expect(liveText()).not.toBe('West edge.')
    await tick(1)
    expect(liveText()).toBe('West edge.')
    expect(sounds()).toBe(played)
    expect(column()).toHaveValue('0')
  })

  it('says the cell, not an edge, when the move reached the edge', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}{ArrowRight}')
    await tick(130)
    await user.keyboard('{ArrowLeft}')
    await tick(400)
    expect(liveText()).toBe(first(describeCell(visualization, grid, 0, START.row)))
  })

  it('still plays the cell again with Space at an edge', async () => {
    const { user } = await exploring()
    await user.keyboard('{Home}')
    await tick(200)
    await user.keyboard(' ')
    expect(engine.playCategory).toHaveBeenCalledTimes(2)
    await tick(400)
    expect(liveText()).toBe(first(describeCell(visualization, grid, 0, START.row)))
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
    for (const key of ['{ArrowLeft}', '{ArrowDown}', '{Home}', '{End}', '{PageUp}', '{PageDown}', ' ', '{Enter}', '{Escape}']) {
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
    expect(engine.playCategory).toHaveBeenCalledWith('cold', { pan: panForPoint(3.5 / COLS), elevation: heightOf(START.row), durationMs: 300 })
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

describe('Explorer: announcements', () => {
  it('says the cell 400 ms after the last move, and only the last one', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}')
    await tick(200)
    await user.keyboard('{ArrowRight}')
    await tick(399)
    expect(liveText()).toBe('')
    await tick(1)
    expect(liveText()).toBe(first(describeCell(visualization, grid, START.col + 2, START.row)))
  })

  it('puts the date in the first message only, and leaves it out of later moves', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}')
    await tick(400)
    expect(liveText()).toBe(first(describeCell(visualization, grid, START.col + 1, START.row)))
    await user.keyboard('{ArrowRight}')
    await tick(400)
    expect(liveText()).toBe(describeCell(visualization, grid, START.col + 2, START.row))
    expect(liveText()).not.toContain('January')
  })

  it('puts the date back in the first message after the date changes, and after turning the explorer off and on', async () => {
    const { user } = await exploring()
    await user.keyboard('{ArrowRight}')
    await tick(400)
    fireEvent.change(dateSlider(), { target: { value: '1' } })
    await tick(0)
    await user.click(surface())
    await user.keyboard('{ArrowRight}')
    await tick(400)
    expect(liveText()).toBe(explorerMessage(describeCell(visualization, grid, START.col + 2, START.row), 'rich', 'July 2024'))
    await user.keyboard('{ArrowRight}')
    await tick(400)
    expect(liveText()).not.toContain('July')
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await user.click(screen.getByRole('button', { name: 'Explore the map' }))
    await tick(0)
    await user.keyboard('{ArrowRight}')
    await tick(400)
    expect(liveText()).toMatch(/^July 2024\. /)
  })

  it('says a cell without data in words', async () => {
    const { user } = await exploring()
    await user.keyboard('{End}')
    await tick(400)
    expect(liveText()).toMatch(/^January 2024\. Not enough data \(land, cloud or labels\)/)
  })
})

describe('Explorer: concise or rich announcements', () => {
  it('says the short form of the cell, and of the sliders, when the listener chose concise', async () => {
    localStorage.setItem('earth-jukebox:detail', 'concise')
    const { user } = await exploring()
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveAttribute('aria-valuetext', describeCell(visualization, grid, START.col, START.row, { detail: 'concise' }))
    await user.keyboard('{ArrowRight}')
    await tick(400)
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
    expect(engine.playCategory).toHaveBeenLastCalledWith('cold', { pan: panForPoint(0.5 / COLS), elevation: heightOf(0), durationMs: 300 })
    await tick(200)
    fireEvent.pointerMove(surface(), { clientX: 175, clientY: 5, pointerId: 1 })
    expect(engine.playCategory).toHaveBeenLastCalledWith(cellOf(grid, 17, 0).category, { pan: panForPoint(17.5 / COLS), elevation: heightOf(0), durationMs: 300 })
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
    expect(engine.playCategory).not.toHaveBeenCalled()
  })

  it('does not play twice for movement inside the same cell', async () => {
    await exploring()
    sized()
    fireEvent.pointerDown(surface(), { clientX: 5, clientY: 5, pointerId: 1 })
    await tick(200)
    fireEvent.pointerMove(surface(), { clientX: 8, clientY: 8, pointerId: 1 })
    expect(engine.playCategory).toHaveBeenCalledTimes(1)
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
  it('locks the place with L, says where, and ignores the arrow keys until it is unlocked', async () => {
    const { user } = await exploring()
    await user.keyboard('l')
    expect(liveText()).toBe('Locked on centre, column 13, row 7. Move the date slider, or play across the dates. L or Escape unlocks.')
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'true')
    engine.playCategory.mockClear()
    await user.keyboard('{ArrowRight}')
    await tick(500)
    expect(engine.playCategory).not.toHaveBeenCalled()
    expect(liveText()).toBe('Locked on this place. Press L to unlock before moving.')
    await user.keyboard('l')
    expect(liveText()).toBe('Unlocked. The arrow keys move over the map again.')
    await user.keyboard('{ArrowRight}')
    expect(engine.playCategory).toHaveBeenCalledTimes(1)
  })

  it('unlocks with Escape and with the button, which works without a keyboard', async () => {
    const { user } = await exploring()
    await user.click(screen.getByRole('button', { name: 'Lock this place' }))
    expect(screen.getByRole('button', { name: 'Lock this place' })).toHaveAttribute('aria-pressed', 'true')
    act(() => surface().focus())
    await user.keyboard('{Escape}')
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
    expect(liveText()).toBe('Unlocked. The arrow keys move over the map again.')
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
    // Column 6 of 22 readable columns is the second of five bands: "cool".
    expect(engine.playCategory).toHaveBeenCalledWith('cool', expect.anything())
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

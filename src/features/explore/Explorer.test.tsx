import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import { panForPoint } from '../../audio/pan'
import type { Visualization } from '../../data'
import { describeCell, describeSweep } from '../../describe'
import { expectNoA11yViolations } from '../../test/a11y'
import PlayerPage from '../player'

const visualization = fixture as Visualization
const COLS = 24
const ROWS = 12

// The player is rendered for real, with a recording engine and a 24 × 12 map: cold in the west, hot in the east, the last two
// columns without data.
const engine = vi.hoisted(() => ({
  unlock: vi.fn(async () => {}),
  setStyle: vi.fn(),
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
  const view = render(<PlayerPage visualization={visualization} />)
  await tick(0)
  await user.click(screen.getByRole('button', { name: 'Explore the map' }))
  await tick(0)
  return { user, ...view }
}
const START = { col: 12, row: 6 }

describe('Explorer: turning it on and off', () => {
  it('reads the map of the date on screen, shows a notice while it waits, and puts focus on the sound map', async () => {
    let finish!: (value: FrameGrid) => void
    analyzeGrid.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup({ delay: null })
    render(<PlayerPage visualization={visualization} />)
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
    render(<PlayerPage visualization={visualization} />)
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
    render(<PlayerPage visualization={withArea} />)
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
    expect(options).toEqual({ pan: panForPoint((START.col + 1.5) / COLS), durationMs: 300 })
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
    expect(engine.playCategory).toHaveBeenCalledWith('cold', { pan: panForPoint(3.5 / COLS), durationMs: 300 })
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
    expect(liveText()).toBe(describeCell(visualization, grid, START.col + 2, START.row))
  })

  it('says a cell without data in words', async () => {
    const { user } = await exploring()
    await user.keyboard('{End}')
    await tick(400)
    expect(liveText()).toMatch(/^No data/)
  })
})

describe('Explorer: concise or rich announcements', () => {
  it('says the short form of the cell, and of the sliders, when the listener chose concise', async () => {
    localStorage.setItem('earth-jukebox:detail', 'concise')
    const { user } = await exploring()
    expect(screen.getByRole('slider', { name: 'Column, west to east' })).toHaveAttribute('aria-valuetext', describeCell(visualization, grid, START.col, START.row, { detail: 'concise' }))
    await user.keyboard('{ArrowRight}')
    await tick(400)
    expect(liveText()).toBe(describeCell(visualization, grid, START.col + 1, START.row, { detail: 'concise' }))
    expect(liveText()).not.toContain('column')
  })

  it('says the short form of the sweep too', async () => {
    localStorage.setItem('earth-jukebox:detail', 'concise')
    const { user } = await exploring()
    await user.keyboard('{Enter}')
    const [steps, onStep] = engine.playSequence.mock.calls[0]
    for (let k = 0; k < steps.length; k++) act(() => onStep(k))
    await tick(250)
    expect(liveText()).toBe(describeSweep(visualization, grid, { kind: 'row', index: START.row }, { detail: 'concise' }))
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
    expect(engine.playCategory).toHaveBeenLastCalledWith('cold', { pan: panForPoint(0.5 / COLS), durationMs: 300 })
    await tick(200)
    fireEvent.pointerMove(surface(), { clientX: 175, clientY: 5, pointerId: 1 })
    expect(engine.playCategory).toHaveBeenLastCalledWith(cellOf(grid, 17, 0).category, { pan: panForPoint(17.5 / COLS), durationMs: 300 })
    expect(liveText()).toBe('')
    fireEvent.pointerUp(surface(), { clientX: 175, clientY: 5, pointerId: 1 })
    expect(liveText()).toBe(describeCell(visualization, grid, 17, 0))
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
    render(<PlayerPage visualization={visualization} />)
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

describe('Explorer: accessibility', () => {
  it('has no violations with the explorer on', async () => {
    const { container } = await exploring()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

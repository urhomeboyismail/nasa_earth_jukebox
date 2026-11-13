import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { FrameGrid } from '../../analysis'
import type { FrameFeatures } from '../../analysis/features/types'
import { AnnouncerContext } from '../../components/announcerContext'
import { variableWords, type Visualization } from '../../data'
import { resetActionHandlers, dispatch } from '../../interaction/registry'
import { expectNoA11yViolations } from '../../test/a11y'
import { FindPanel } from './FindPanel'
import { FIND_KEY } from './store'
import { NEXT_TARGET_MS, useFindGame, type FindExplorer } from './useFindGame'

const visualization = fixture as Visualization
const words = variableWords(visualization.variable)
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const COLS = 24
const ROWS = 12

// The frame's targets: the highest value at column 18, row 3; the edge's middle at column 5, row 8; the largest hot spot at column 10, row 1.
const frameFeatures: Pick<FrameFeatures, 'grid' | 'edges' | 'hotspots'> = {
  grid: {
    cols: COLS, rows: ROWS,
    values: Float32Array.from({ length: COLS * ROWS }, (_, i) => (i === 3 * COLS + 18 ? 25 : 10)),
    position: Float32Array.from({ length: COLS * ROWS }, (_, i) => (i === 3 * COLS + 18 ? 0.9 : 0.4)),
  },
  edges: { density: 0.1, strongest: { level: 10, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false, points: [{ x: 0.1, y: 0.2, turn: 0, front: 1 }, { x: 5.5 / COLS, y: 8.5 / ROWS, turn: 0, front: 1 }, { x: 0.5, y: 0.9, turn: 0, front: 1 }] } },
  hotspots: [{ id: 'h1', band: 'high', centroid: { x: 10.5 / COLS, y: 1.5 / ROWS }, cells: 30, areaShare: 0.01, peak: 25, peakPosition: 0.9 }],
}
const mapGrid: FrameGrid = { frameId: 'f', cols: COLS, rows: ROWS, area: WHOLE, cells: Array.from({ length: COLS * ROWS }, () => ({ value: 12, category: 'mild' })) }

const ensemble = { playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 0), status: vi.fn(() => 'on' as const), start: vi.fn(async () => {}) }
const announce = vi.fn()

function Harness({ cursor, on = true }: { cursor: { col: number; row: number }; on?: boolean }) {
  const explorer: FindExplorer = { on, grid: on ? mapGrid : null, cursor, area: WHOLE, ensemble }
  const find = useFindGame({ visualization, frame: visualization.frames[0], explorer, read: async () => frameFeatures })
  return <FindPanel find={find} />
}

function rig(start = { col: 0, row: 11 }) {
  const view = render(<AnnouncerContext.Provider value={announce}><Harness cursor={start} /></AnnouncerContext.Provider>)
  const moveTo = (col: number, row: number, on = true) =>
    view.rerender(<AnnouncerContext.Provider value={announce}><Harness cursor={{ col, row }} on={on} /></AnnouncerContext.Provider>)
  return { ...view, moveTo }
}
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const line = () => document.querySelector('.find__line')?.textContent ?? ''
const startGame = async () => {
  await act(async () => { screen.getByRole('button', { name: 'Start the find game' }).click() })
  await tick(0)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  Object.values(ensemble).forEach(fn => fn.mockClear())
  announce.mockClear()
  resetActionHandlers()
})
afterEach(() => { vi.useRealTimers(); localStorage.clear() })

describe('the find game', () => {
  it('asks first for the highest place, and pulses at the cursor from the press', async () => {
    rig()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    await startGame()
    expect(line()).toBe(`Find the ${words.highest} place. Target 1 of 1. Time 0:00.`)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    expect(ensemble.playNotes.mock.calls[0][0][0]).toMatchObject({ level: 0.15, seconds: 0.08 })
  })

  it('pulses more often in 2 s when the cursor is closer', async () => {
    const { moveTo } = rig({ col: 0, row: 11 })
    await startGame()
    await tick(1200)
    ensemble.playNotes.mockClear()
    await tick(2000)
    const far = ensemble.playNotes.mock.calls.length
    moveTo(16, 3)
    await tick(1200)
    ensemble.playNotes.mockClear()
    await tick(2000)
    const near = ensemble.playNotes.mock.calls.length
    expect(far).toBeLessThanOrEqual(2)
    expect(near).toBeGreaterThan(far * 3)
  })

  it('ends the target within one cell, plays the success once, announces the score once, and keeps the best', async () => {
    const { moveTo, unmount } = rig()
    await startGame()
    moveTo(17, 4)
    await tick(0)
    const success = ensemble.playNotes.mock.calls.filter(([notes]) => notes[0].level === 0.5)
    expect(success).toHaveLength(2)
    expect(announce).toHaveBeenCalledTimes(1)
    expect(announce).toHaveBeenCalledWith(`Found the ${words.highest} place in 1 move and 0 seconds: 995 points.`)
    expect(line()).toBe(`Found the ${words.highest} place.`)
    await tick(NEXT_TARGET_MS)
    expect(line()).toBe('Game over: 995 points in 0:00.')
    expect(screen.getByText('Best at level 1: 995 points in 0:00.')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(FIND_KEY)!)).toEqual({ best: { [`${visualization.id}:1`]: { score: 995, seconds: 0 } } })
    await tick(5000)
    expect(announce).toHaveBeenCalledTimes(1)
    unmount()
    rig()
    expect(screen.getByText('Best at level 1: 995 points in 0:00.')).toBeInTheDocument()
  })

  it('counts moves and seconds in the score', async () => {
    const { moveTo } = rig()
    await startGame()
    moveTo(1, 11)
    await tick(2000)
    moveTo(10, 3)
    await tick(1000)
    moveTo(18, 3)
    await tick(0)
    // 3 moves and 3 seconds from the first move: 1000 − 15 − 30.
    expect(announce).toHaveBeenCalledWith(`Found the ${words.highest} place in 3 moves and 3 seconds: 955 points.`)
  })

  it('asks for the edge next at level 2', async () => {
    const { moveTo } = rig()
    await act(async () => { screen.getByRole('radio', { name: 'Level 2' }).click() })
    await startGame()
    moveTo(18, 3)
    await tick(NEXT_TARGET_MS)
    expect(line()).toBe(`Last target: 995 points. Find the ${words.edge}. Target 2 of 2. Time 0:00.`)
    moveTo(5, 8)
    await tick(0)
    expect(announce).toHaveBeenLastCalledWith(`Found the ${words.edge} in 1 move and 0 seconds: 995 points.`)
    await tick(NEXT_TARGET_MS)
    expect(line()).toBe('Game over: 1990 points in 0:00.')
  })

  it('starts and stops with F, and stops on Escape, with no more pulses', async () => {
    rig()
    await act(async () => { dispatch({ type: 'find', command: 'toggle' }) })
    await tick(0)
    expect(line()).toMatch(/^Find /)
    await act(async () => { dispatch({ type: 'find', command: 'toggle' }) })
    expect(line()).toBe('')
    await act(async () => { dispatch({ type: 'find', command: 'toggle' }) })
    await tick(0)
    await act(async () => { dispatch({ type: 'stopSpeech' }) })
    expect(line()).toBe('')
    ensemble.playNotes.mockClear()
    await tick(5000)
    expect(ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('ends with the sound map, and shows nothing while it is off', async () => {
    const { moveTo } = rig()
    await startGame()
    moveTo(0, 11, false)
    expect(screen.queryByRole('group', { name: 'Find game' })).toBeNull()
    ensemble.playNotes.mockClear()
    await tick(5000)
    expect(ensemble.playNotes).not.toHaveBeenCalled()
    moveTo(0, 11, true)
    expect(screen.getByRole('button', { name: 'Start the find game' })).toBeInTheDocument()
    expect(line()).toBe('')
  })

  it('passes accessibility checks while a game is on', async () => {
    const { container } = rig()
    await startGame()
    expect(screen.getByRole('button', { name: 'Stop the find game' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('radio', { name: 'Level 1' })).toBeDisabled()
    vi.useRealTimers()
    await expectNoA11yViolations(container)
  })
})

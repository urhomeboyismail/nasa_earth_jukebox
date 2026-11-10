import { describe, expect, it } from 'vitest'
import { edgeSummary } from './edges'
import { EDGE_STEP } from './types'

const COLS = 64
const ROWS = 32
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const PAIRS = (COLS - 1) * ROWS + COLS * (ROWS - 1)

const grid = (at: (col: number, row: number) => number) => {
  const position = new Float32Array(COLS * ROWS)
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) position[row * COLS + col] = at(col, row)
  return { cols: COLS, rows: ROWS, position }
}

describe('edgeSummary', () => {
  it('has no edges and no line in a uniform picture', () => {
    expect(edgeSummary(grid(() => 0.5), WHOLE, 0.5)).toEqual({ density: 0, strongest: null })
  })

  it('counts the neighbour pairs that differ by more than EDGE_STEP', () => {
    // A step down the middle: one column boundary, 32 rows.
    const { density } = edgeSummary(grid(col => (col < 32 ? 0.2 : 0.8)), WHOLE, 0.5)
    expect(density).toBeCloseTo(ROWS / PAIRS, 10)
  })

  it('counts a difference above EDGE_STEP and not one below it', () => {
    // Positions are Float32, so "exactly EDGE_STEP" cannot be built; test either side of it.
    expect(edgeSummary(grid(col => (col < 32 ? 0.5 : 0.5 + EDGE_STEP - 0.01)), WHOLE, 0.5).density).toBe(0)
    expect(edgeSummary(grid(col => (col < 32 ? 0.5 : 0.5 + EDGE_STEP + 0.01)), WHOLE, 0.5).density).toBeGreaterThan(0)
  })

  it('counts every pair in a checkerboard', () => {
    expect(edgeSummary(grid((col, row) => ((col + row) % 2 ? 0.1 : 0.9)), WHOLE, 0.5).density).toBe(1)
  })

  it('leaves out pairs where either cell cannot be read', () => {
    // Everything but the first column is unreadable: no pair has two readable cells except none at all.
    expect(edgeSummary(grid(col => (col === 0 ? 0.5 : NaN)), WHOLE, 0.5).density).toBe(0)
    // A step with a NaN column beside it: the pairs touching the NaN column are not counted.
    const { density } = edgeSummary(grid(col => (col === 32 ? NaN : col < 32 ? 0.2 : 0.8)), WHOLE, 0.5)
    expect(density).toBe(0)
  })

  it('traces the longest line where the picture crosses the median', () => {
    const { strongest } = edgeSummary(grid(col => (col < 32 ? 0.2 : 0.8)), WHOLE, 0.5)
    expect(strongest).not.toBeNull()
    expect(strongest!.closed).toBe(false)
    expect(strongest!.level).toBe(0.5)
    for (const p of strongest!.points) expect(p.x).toBeCloseTo(0.5, 1)
    const ys = strongest!.points.map(p => p.y)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.9)
  })

  it('has no line without a median', () => {
    expect(edgeSummary(grid(col => (col < 32 ? 0.2 : 0.8)), WHOLE, null).strongest).toBeNull()
  })

  it('puts the line in the map area, as fractions of the whole image', () => {
    const { strongest } = edgeSummary(grid(col => (col < 32 ? 0.2 : 0.8)), { x0: 0.5, y0: 0, x1: 1, y1: 1 }, 0.5)
    for (const p of strongest!.points) expect(p.x).toBeCloseTo(0.75, 1)
  })
})

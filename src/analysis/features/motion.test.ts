import { describe, expect, it } from 'vitest'
import { estimateMotion } from './motion'
import { MOTION_MIN_GAIN } from './types'

const COLS = 64
const ROWS = 32

/** A texture with no repeats, defined everywhere (also outside the grid), so a shifted copy matches exactly where it overlaps. */
const texture = (x: number, y: number) => ((Math.imul(x + 1000, 73856093) ^ Math.imul(y + 1000, 19349663)) >>> 0) % 1000 / 1000

/** The texture moved by (dx, dy) cells: the picture that was at (x − dx, y − dy) is now at (x, y). */
function moved(dx: number, dy: number) {
  const out = new Float32Array(COLS * ROWS)
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) out[y * COLS + x] = texture(x - dx, y - dy)
  return out
}

describe('estimateMotion', () => {
  const still = moved(0, 0)

  it('finds nothing in a picture that did not move', () => {
    expect(estimateMotion(still, moved(0, 0), COLS, ROWS)).toEqual({ dx: 0, dy: 0, speed: 0, direction: null, changedShare: 0 })
  })

  it('finds nothing in a uniform picture', () => {
    const flat = new Float32Array(COLS * ROWS).fill(0.5)
    expect(estimateMotion(flat, flat, COLS, ROWS)).toMatchObject({ speed: 0, direction: null, changedShare: 0 })
  })

  it.each([
    ['east', 2, 0, 0],
    ['west', -1, 0, Math.PI],
    ['south', 0, 1, -Math.PI / 2],
    ['north', 0, -2, Math.PI / 2],
    ['south-east', 1, 1, -Math.PI / 4],
  ])('measures a move %s, in cells, with north up', (_name, dx, dy, direction) => {
    const m = estimateMotion(still, moved(dx, dy), COLS, ROWS)
    expect(m.dx).toBeCloseTo(dx, 5)
    expect(m.dy).toBeCloseTo(dy, 5)
    expect(m.speed).toBeCloseTo(Math.hypot(dx, dy), 5)
    expect(m.direction).toBeCloseTo(direction, 5)
    expect(m.changedShare).toBeGreaterThan(0.5)
  })

  it('reports the share of blocks that moved', () => {
    // Only the west half moves.
    const now = still.slice()
    const east = moved(2, 0)
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS / 2; x++) now[y * COLS + x] = east[y * COLS + x]
    const m = estimateMotion(still, now, COLS, ROWS)
    expect(m.changedShare).toBeGreaterThan(0.3)
    expect(m.changedShare).toBeLessThan(0.7)
    expect(m.dx).toBeCloseTo(2, 5)
  })

  it('ignores a change smaller than MOTION_MIN_GAIN', () => {
    const now = still.slice()
    for (let i = 0; i < now.length; i++) now[i] += (MOTION_MIN_GAIN / 4) * (i % 2 ? 1 : -1)
    expect(estimateMotion(still, now, COLS, ROWS).speed).toBe(0)
  })

  it('does not read cells that cannot be read, and needs half a block', () => {
    const before = still.slice()
    const after = moved(2, 0)
    // Land over the whole east half in the later picture: those blocks have too few pairs and are left out.
    for (let y = 0; y < ROWS; y++) for (let x = COLS / 2; x < COLS; x++) after[y * COLS + x] = NaN
    const m = estimateMotion(before, after, COLS, ROWS)
    expect(m.dx).toBeCloseTo(2, 5)
    expect(m.changedShare).toBeGreaterThan(0.5) // of the blocks that could be read, not of all of them
    const nothing = new Float32Array(COLS * ROWS).fill(NaN)
    expect(estimateMotion(nothing, nothing, COLS, ROWS)).toMatchObject({ speed: 0, direction: null, changedShare: 0 })
  })

  it('gives the same answer every time', () => {
    const a = estimateMotion(still, moved(1, -1), COLS, ROWS)
    expect(estimateMotion(still, moved(1, -1), COLS, ROWS)).toEqual(a)
  })
})

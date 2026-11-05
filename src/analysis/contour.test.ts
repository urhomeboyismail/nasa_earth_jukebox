import { describe, expect, it } from 'vitest'
import { pickContours, traceContours, CONTOUR_POINTS } from './contour'
import type { Contour, ValueField } from './types'

/** A field from text rows: a digit is that value, `x` is NaN (cannot be read). */
const field = (...rows: string[]): ValueField => ({
  cols: rows[0].length,
  rows: rows.length,
  area: { x0: 0, y0: 0, x1: 1, y1: 1 },
  values: Float32Array.from(rows.join('').split('').map(ch => (ch === 'x' ? NaN : Number(ch)))),
})
const blank = (cols: number, rows: number) => Array.from({ length: rows }, () => '0'.repeat(cols))
const totalTurn = (c: Contour) => c.points.reduce((sum, p) => sum + p.turn, 0)
/** A point's position in vertex units, back from the 0 to 1 fractions. */
const inCells = (f: ValueField, p: { x: number; y: number }) => ({ gx: p.x * f.cols - 0.5, gy: p.y * f.rows - 0.5 })

describe('traceContours', () => {
  it('one raised cell gives one small closed loop, counter-clockwise on the map', () => {
    const rows = blank(5, 5)
    rows[2] = '00100'
    const f = field(...rows)
    const lines = traceContours(f, 0.5)
    expect(lines).toHaveLength(1)
    const [line] = lines
    expect(line.closed).toBe(true)
    expect(line.brokenEnds).toBe(0)
    expect(line.points).toHaveLength(CONTOUR_POINTS)
    for (const p of line.points) {
      const { gx, gy } = inCells(f, p)
      expect(Math.abs(gx - 2)).toBeLessThanOrEqual(0.5 + 1e-9)
      expect(Math.abs(gy - 2)).toBeLessThanOrEqual(0.5 + 1e-9)
    }
    expect(totalTurn(line)).toBeCloseTo(2 * Math.PI, 5)
  })

  it('a straight front gives one open line with no turn, keeping the warm side on its left', () => {
    const f = field(...Array.from({ length: 6 }, () => '111000'))
    const lines = traceContours(f, 0.5)
    expect(lines).toHaveLength(1)
    const [line] = lines
    expect(line.closed).toBe(false)
    expect(line.brokenEnds).toBe(0) // it ends at the edge of the map, not at a hole
    for (const p of line.points) {
      expect(Math.abs(p.turn)).toBeLessThan(1e-6)
      expect(p.x).toBeCloseTo((2.5 + 0.5) / 6, 6) // halfway between columns 2 and 3
      expect(p.front).toBeCloseTo(1, 6) // the value falls by 1 per cell
    }
    // The warm (west) side is on the left, so the line runs north.
    expect(line.points[0].y).toBeGreaterThan(line.points[CONTOUR_POINTS - 1].y)
  })

  it('an L-shaped front turns by a quarter circle in total, and not at the straight parts', () => {
    const f = field('000000000', '000000000', '000000000', '000001111', '000001111', '000001111', '000001111', '000001111', '000001111')
    const [line] = traceContours(f, 0.5)
    expect(line.closed).toBe(false)
    expect(totalTurn(line)).toBeCloseTo(Math.PI / 2, 1) // west, then south: a left turn
    expect(Math.max(...line.points.map(p => Math.abs(p.turn)))).toBeGreaterThan(Math.PI / 8)
    expect(line.points.filter(p => Math.abs(p.turn) < 1e-6).length).toBeGreaterThan(CONTOUR_POINTS / 2)
  })

  it('interpolates the crossing between the two values and does not snap to the grid', () => {
    const [line] = traceContours(field('044', '044', '044'), 1)
    for (const p of line.points) expect(p.x).toBeCloseTo((0.25 + 0.5) / 3, 6) // 1 is a quarter of the way from 0 to 4
    const [other] = traceContours(field('044', '044', '044'), 3)
    for (const p of other.points) expect(p.x).toBeCloseTo((0.75 + 0.5) / 3, 6)
  })

  it('counts a value exactly at the level as above', () => {
    expect(traceContours(field('50', '00'), 5)).toHaveLength(1)
    expect(traceContours(field('55', '55'), 5)).toHaveLength(0)
  })

  it('resolves a saddle by the average of the four corners, the same every run', () => {
    const f = field('10', '01')
    const centroids = (level: number) => traceContours(f, level).map(l => ({
      x: l.points.reduce((s, p) => s + p.x, 0) / l.points.length,
      y: l.points.reduce((s, p) => s + p.y, 0) / l.points.length,
    }))
    // Average 0.5. Below the level: the two warm corners stay apart, so each line hugs one of them (north-west and south-east).
    const split = centroids(0.6)
    expect(split).toHaveLength(2)
    for (const c of split) expect(Math.abs(c.x - c.y)).toBeLessThan(0.01)
    // At or above the level: the warm corners join, so the lines hug the two cool corners (north-east and south-west).
    const joined = centroids(0.4)
    expect(joined).toHaveLength(2)
    for (const c of joined) expect(Math.abs(c.x - c.y)).toBeGreaterThan(0.1)
    expect(JSON.stringify(traceContours(f, 0.6))).toBe(JSON.stringify(traceContours(f, 0.6)))
  })

  it('a NaN hole splits a line in two, each with one broken end, and no point lies inside the hole', () => {
    const f = field('1110000', '1110000', '1110000', '11x0000', '1110000', '1110000', '1110000')
    const lines = traceContours(f, 0.5)
    expect(lines).toHaveLength(2)
    expect(lines.map(l => l.brokenEnds)).toEqual([1, 1])
    for (const line of lines) {
      expect(line.closed).toBe(false)
      for (const p of line.points) {
        const { gx, gy } = inCells(f, p)
        for (let r = 0; r < f.rows - 1; r++) {
          for (let c = 0; c < f.cols - 1; c++) {
            const hole = [r * f.cols + c, r * f.cols + c + 1, (r + 1) * f.cols + c, (r + 1) * f.cols + c + 1].some(i => Number.isNaN(f.values[i]))
            if (hole) expect(gx > c + 1e-9 && gx < c + 1 - 1e-9 && gy > r + 1e-9 && gy < r + 1 - 1e-9).toBe(false)
          }
        }
      }
    }
  })

  it('a line that reaches the edge of the map is not broken, and one that meets a hole is', () => {
    const edge = traceContours(field('1100', '1100', '1100'), 0.5)
    expect(edge.map(l => l.brokenEnds)).toEqual([0])
    const hole = traceContours(field('11000', '11000', '11x00', '11000', '11000'), 0.5)
    expect(hole.map(l => l.brokenEnds)).toEqual([1, 1])
  })

  it('says which end is broken, so a sound can mark the right one', () => {
    const hole = traceContours(field('11000', '11000', '11x00', '11000', '11000'), 0.5)
    for (const line of hole) {
      const [first, last] = [line.points[0], line.points.at(-1)!]
      // The hole is in the middle row, so the end next to it is the one nearer the middle of the map.
      const brokenIsFirst = Math.abs(first.y - 0.5) < Math.abs(last.y - 0.5)
      expect([line.brokenStart, line.brokenEnd]).toEqual(brokenIsFirst ? [true, false] : [false, true])
      expect(Number(line.brokenStart) + Number(line.brokenEnd)).toBe(line.brokenEnds)
    }
    const edge = traceContours(field('1100', '1100', '1100'), 0.5)[0]
    expect([edge.brokenStart, edge.brokenEnd]).toEqual([false, false])
    const loop = traceContours(field('000', '010', '000'), 0.5)[0]
    expect([loop.closed, loop.brokenStart, loop.brokenEnd]).toEqual([true, false, false])
  })

  it('gives no line for a field that is all one side, and no line through NaN', () => {
    expect(traceContours(field('000', '000', '000'), 0.5)).toEqual([])
    expect(traceContours(field('xxx', 'xxx', 'xxx'), 0.5)).toEqual([])
  })

  it('maps points through the area into fractions of the whole image', () => {
    const f: ValueField = { ...field('044', '044', '044'), area: { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.7 } }
    const [line] = traceContours(f, 2)
    for (const p of line.points) expect(p.x).toBeCloseTo(0.2 + ((0.5 + 0.5) / 3) * 0.6, 6)
    expect(Math.min(...line.points.map(p => p.y))).toBeGreaterThanOrEqual(0.1)
    expect(Math.max(...line.points.map(p => p.y))).toBeLessThanOrEqual(0.7)
  })

  it('does not change its input, and is the same every run', () => {
    const f = field('0110', '1210', '0110', '0000')
    const before = Array.from(f.values)
    const a = JSON.stringify(traceContours(f, 1))
    expect(JSON.stringify(traceContours(f, 1))).toBe(a)
    expect(Array.from(f.values)).toEqual(before)
  })
})

describe('pickContours', () => {
  const rows = blank(12, 7)
  rows[1] = '000000000000'
  rows[2] = '011100000000'
  rows[3] = '011100001000'
  rows[4] = '011100000000'
  const f = field(...rows)

  it('keeps the longest line of each level', () => {
    const a = traceContours(f, 0.5)
    const b = traceContours(f, 0.5).map(c => ({ ...c, level: 2 }))
    expect(a).toHaveLength(2)
    const picked = pickContours([...a, ...b])
    expect(picked.map(c => c.level)).toEqual([0.5, 2])
    for (const c of picked) expect(Math.min(...c.points.map(p => p.x))).toBeLessThan(0.4) // the big blob, not the single raised cell
  })

  it('keeps perLevel lines, longest first, and the first found on a tie', () => {
    const lines = traceContours(f, 0.5)
    expect(pickContours(lines, 2)).toHaveLength(2)
    expect(pickContours(lines, 2)[0]).toBe(lines.find(l => l.points[0].x < 0.4))
    const twins = traceContours(field('01010', '00000', '00000'), 0.5)
    expect(twins.length).toBe(2)
    expect(pickContours(twins)[0]).toBe(twins[0])
  })

  it('returns nothing for nothing', () => {
    expect(pickContours([])).toEqual([])
  })
})

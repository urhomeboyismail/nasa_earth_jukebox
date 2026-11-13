import { describe, expect, it } from 'vitest'
import { anchorFor, flightPath, TOUR_ECHO_SIZE } from './flightPath'

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height })

describe('flightPath', () => {
  it('starts at the first point and ends at the last for two points', () => {
    const d = flightPath([{ x: 10, y: 20 }, { x: 110, y: 220 }])
    expect(d).toMatch(/^M10 20 C/)
    expect(d).toMatch(/110 220$/)
    expect(d.match(/C/g)).toHaveLength(1)
  })

  it('passes through the middle point for three points', () => {
    const d = flightPath([{ x: 0, y: 0 }, { x: 50, y: -40 }, { x: 100, y: 0 }])
    expect(d.match(/C/g)).toHaveLength(2)
    expect(d).toContain('50 -40 C')
    expect(d).toMatch(/100 0$/)
  })

  it('gives a bare move for one point and nothing for none', () => {
    expect(flightPath([{ x: 3, y: 4 }])).toBe('M3 4')
    expect(flightPath([])).toBe('')
  })
})

describe('anchorFor', () => {
  const viewport = { w: 1000, h: 700 }

  it('puts Echo on the left of a target at the right edge', () => {
    const place = anchorFor(box(900, 300, 90, 40), viewport)
    expect(place.side).toBe('left')
    expect(place.x).toBeLessThan(900)
  })

  it('puts Echo on the right of a target at the left edge', () => {
    const place = anchorFor(box(10, 300, 90, 40), viewport)
    expect(place.side).toBe('right')
    expect(place.x).toBeGreaterThan(100)
  })

  it('keeps Echo inside the viewport, even for a target at the corner or a tiny viewport', () => {
    const half = TOUR_ECHO_SIZE / 2
    for (const [target, size] of [[box(0, 0, 30, 30), viewport], [box(980, 690, 20, 10), viewport], [box(5, 5, 400, 40), { w: 120, h: 80 }]] as const) {
      const place = anchorFor(target, size)
      expect(place.x).toBeGreaterThanOrEqual(half)
      expect(place.x).toBeLessThanOrEqual(Math.max(half, size.w - half))
      expect(place.y).toBeGreaterThanOrEqual(half)
      expect(place.y).toBeLessThanOrEqual(Math.max(half, size.h - half))
    }
  })
})

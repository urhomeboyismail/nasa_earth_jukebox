import { describe, expect, it } from 'vitest'
import { FEATURE_COLS, FEATURE_ROWS, type Hotspot } from '../../analysis/features/types'
import { orderedHotspots, pickHotspot, stepHotspot } from './pick'

const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const spot = (id: string, x: number, y: number, cells: number): Hotspot => ({
  id, band: 'high', centroid: { x, y }, cells, areaShare: cells / (FEATURE_COLS * FEATURE_ROWS), peak: 1, peakPosition: 1,
})
// The extractor lists them in its own order; by area the order is h2 (40), h1 (20), h3 (20, after h1), h4 (5).
const frame = { hotspots: [spot('h1', 0.2, 0.5, 20), spot('h2', 0.6, 0.5, 40), spot('h3', 0.8, 0.2, 20), spot('h4', 0.4, 0.8, 5)] }

describe('orderedHotspots', () => {
  it('puts the largest first, and keeps the extractor order for equal sizes', () => {
    expect(orderedHotspots(frame).map(s => s.id)).toEqual(['h2', 'h1', 'h3', 'h4'])
  })
})

describe('pickHotspot', () => {
  it('chooses the largest when the cursor is on no spot', () => {
    expect(pickHotspot(frame, { x: 0.05, y: 0.05 }, WHOLE)?.id).toBe('h2')
    expect(pickHotspot(frame, null, WHOLE)?.id).toBe('h2')
  })

  it('chooses the spot under the cursor', () => {
    expect(pickHotspot(frame, { x: 0.2, y: 0.5 }, WHOLE)?.id).toBe('h1')
    // h4 covers 5 cells: about 1.3 cells round its centre, plus the half cell of the cursor.
    expect(pickHotspot(frame, { x: 0.4 + 1.5 / FEATURE_COLS, y: 0.8 }, WHOLE)?.id).toBe('h4')
    expect(pickHotspot(frame, { x: 0.4 + 3 / FEATURE_COLS, y: 0.8 }, WHOLE)?.id).toBe('h2')
  })

  it('reads the cursor against the map area, as the extractor does', () => {
    const area = { x0: 0.1, y0: 0, x1: 0.5, y1: 1 }
    const inArea = { hotspots: [spot('a', 0.3, 0.5, 10), spot('b', 0.45, 0.5, 30)] }
    expect(pickHotspot(inArea, { x: 0.3, y: 0.5 }, area)?.id).toBe('a')
  })

  it('gives null for a frame with no hot spot', () => {
    expect(pickHotspot({ hotspots: [] }, { x: 0.5, y: 0.5 }, WHOLE)).toBeNull()
  })
})

describe('stepHotspot', () => {
  it('goes to the next and previous spot by area, and wraps round', () => {
    expect(stepHotspot(frame, 'h2', 'next')?.id).toBe('h1')
    expect(stepHotspot(frame, 'h4', 'next')?.id).toBe('h2')
    expect(stepHotspot(frame, 'h2', 'previous')?.id).toBe('h4')
    expect(stepHotspot(frame, 'h3', 'previous')?.id).toBe('h1')
  })

  it('starts with the largest for next and the smallest for previous when nothing is followed', () => {
    expect(stepHotspot(frame, null, 'next')?.id).toBe('h2')
    expect(stepHotspot(frame, null, 'previous')?.id).toBe('h4')
    expect(stepHotspot(frame, 'gone', 'next')?.id).toBe('h2')
    expect(stepHotspot({ hotspots: [] }, 'h1', 'next')).toBeNull()
  })
})

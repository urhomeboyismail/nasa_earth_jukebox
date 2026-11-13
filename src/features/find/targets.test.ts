import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../../analysis/features'
import type { FrameFeatures } from '../../analysis/features/types'
import { decodePng } from '../../analysis/png'
import { baseInput } from '../../analysis/video/input'
import { visualizationSchema } from '../../data/schema'
import { cellOfFraction } from '../../interaction/notes'
import { distanceTo, levelTargets, targetsFor } from './targets'

const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const COLS = 24
const ROWS = 12

// SN02: six round patches on a flat sea; the four warm ones are the highest values on the map.
const DIR = 'public/data/synthetic-motion'
const motion = visualizationSchema.parse(JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')))
const drawn = (JSON.parse(readFileSync(`${DIR}/expected.json`, 'utf8')) as { frames: { hotspots: { band: string; centre: { x: number; y: number } }[] }[] }).frames[0].hotspots
const frame = motion.frames[0]
const features = extractFeatures(decodePng(readFileSync(`${DIR}/${frame.image}`)), baseInput(motion, frame.id, frame.date, 1))

/** A frame's shape with a hand-made grid, no edge line and no hot spots. */
function made(values: number[], cols: number, rows: number): Pick<FrameFeatures, 'grid' | 'edges' | 'hotspots'> {
  return {
    grid: { cols, rows, values: Float32Array.from(values), position: Float32Array.from(values.map(v => (Number.isNaN(v) ? NaN : v / 10))) },
    edges: { density: 0, strongest: null },
    hotspots: [],
  }
}

describe('targetsFor on the SN02 motion set', () => {
  const targets = targetsFor(features, COLS, ROWS, WHOLE)

  it('puts the highest place inside one of the warm patches', () => {
    const warm = drawn.filter(spot => spot.band === 'high').map(spot => cellOfFraction(spot.centre.x, spot.centre.y, WHOLE, COLS, ROWS))
    expect(targets.highest).not.toBeNull()
    expect(Math.min(...warm.map(cell => distanceTo(targets.highest!, cell)))).toBeLessThanOrEqual(1)
  })

  it('has no change layer here, so the spot is the largest hot spot', () => {
    expect(features.change).toBeNull()
    const largest = [...features.hotspots].sort((a, b) => b.cells - a.cells)[0]
    expect(targets.spot).toMatchObject(cellOfFraction(largest.centroid.x, largest.centroid.y, WHOLE, COLS, ROWS))
  })

  it('gives the same targets for the same frame', () => {
    expect(targetsFor(features, COLS, ROWS, WHOLE)).toEqual(targets)
  })
})

describe('targetsFor on a hand-made grid', () => {
  it('skips cells that cannot be read, and takes the first of equal highest values', () => {
    const grid = made([NaN, 3, 9, NaN, 9, 1], 3, 2)
    const { highest } = targetsFor(grid, 3, 2, WHOLE)
    expect(highest).toMatchObject({ kind: 'highest', col: 2, row: 0 })
    expect(highest?.position).toBeCloseTo(0.9, 5)
  })

  it('has no highest place when nothing can be read, and no edge or spot without them', () => {
    expect(targetsFor(made([NaN, NaN], 2, 1), 2, 1, WHOLE)).toEqual({ highest: null, edge: null, spot: null })
  })

  it('puts the edge at the middle point of the strongest line', () => {
    const grid = { ...made([1, 2], 2, 1), edges: { density: 0.5, strongest: { level: 1, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false, points: [0.1, 0.5, 0.9].map(x => ({ x, y: 0.5, turn: 0, front: 1 })) } } }
    expect(targetsFor(grid, 10, 10, WHOLE).edge).toEqual({ kind: 'edge', col: 5, row: 5, position: 0.5 })
  })

  it('maps a place through the map area, as the sound map does', () => {
    const area = { x0: 0.5, y0: 0, x1: 1, y1: 1 }
    const grid = made([0, 0, 0, 5], 4, 1)
    // The last of four feature columns over the east half is the sound map's last column.
    expect(targetsFor(grid, 8, 1, area).highest).toMatchObject({ col: 7, row: 0 })
  })
})

describe('levelTargets', () => {
  const all = { highest: { kind: 'highest' as const, col: 1, row: 1, position: 1 }, edge: { kind: 'edge' as const, col: 2, row: 2, position: 0.5 }, spot: { kind: 'spot' as const, col: 3, row: 3, position: 0.8 } }

  it('is the highest place, then the edge, then the spot', () => {
    expect(levelTargets(all, 1).map(t => t.kind)).toEqual(['highest'])
    expect(levelTargets(all, 2).map(t => t.kind)).toEqual(['highest', 'edge'])
    expect(levelTargets(all, 3).map(t => t.kind)).toEqual(['highest', 'edge', 'spot'])
  })

  it('leaves out a target the frame does not have', () => {
    expect(levelTargets({ ...all, edge: null }, 3).map(t => t.kind)).toEqual(['highest', 'spot'])
  })
})

describe('distanceTo', () => {
  it('is the larger of the two steps', () => {
    expect(distanceTo({ col: 0, row: 0 }, { col: 3, row: 1 })).toBe(3)
    expect(distanceTo({ col: 5, row: 5 }, { col: 4, row: 6 })).toBe(1)
  })
})

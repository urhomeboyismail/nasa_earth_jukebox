// The feature extractor (SN01) against the data sets whose answers are known exactly (SN02): the current that moves east by two cells a day, and the
// storm that travels a known path. The answers are in each data set's expected.json, computed by its generator from what it drew.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { visualizationSchema } from '../../data/schema'
import { decodePng } from '../png'
import { extractFeatures } from './extract'
import { FEATURE_COLS, type FrameFeatures } from './types'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data')
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }

type Expected = {
  frames: {
    date: string
    hotspots: { name: string; band: 'high' | 'low'; centre: { x: number; y: number } }[]
    motion?: { dx: number; dy: number; direction: number } | null
    validShare?: number
  }[]
}

function run(id: string) {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const expected = JSON.parse(readFileSync(`${dataDir}/${id}/expected.json`, 'utf8')) as Expected
  let previous: FrameFeatures | undefined
  const features = v.frames.map(frame => {
    const f = extractFeatures(decodePng(readFileSync(`${dataDir}/${id}/${frame.image}`)), {
      frameId: frame.id, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE,
    }, previous)
    previous = f
    return f
  })
  return { expected, features }
}

/** One cell across, as a share of the width: the most a cell centroid may be from the drawn centre. */
const ONE_CELL = 1 / FEATURE_COLS

describe('synthetic-motion', () => {
  const { expected, features } = run('synthetic-motion')

  it('has no motion on the first frame', () => {
    expect(features[0].motion).toBeNull()
  })

  it('finds two cells east, and nothing north or south, between every pair of frames', () => {
    for (let k = 1; k < features.length; k++) {
      const m = features[k].motion
      expect(m, `frame ${k}`).not.toBeNull()
      expect(Math.abs(m!.dx - 2), `dx at frame ${k}: ${m!.dx}`).toBeLessThanOrEqual(0.25)
      expect(Math.abs(m!.dy), `dy at frame ${k}: ${m!.dy}`).toBeLessThanOrEqual(0.25)
      expect(Math.abs(m!.direction ?? NaN), `direction at frame ${k}`).toBeLessThanOrEqual(0.1)
      expect(expected.frames[k].motion).toEqual({ dx: 2, dy: 0, direction: 0 })
    }
  })

  it('finds the six patches on every frame, where they are drawn, four high and two low', () => {
    features.forEach((f, k) => {
      expect(f.hotspots, `frame ${k}`).toHaveLength(6)
      expect(f.hotspots.filter(h => h.band === 'high')).toHaveLength(4)
      for (const drawn of expected.frames[k].hotspots) {
        const near = f.hotspots.filter(h => h.band === drawn.band).map(h => Math.hypot(h.centroid.x - drawn.centre.x, h.centroid.y - drawn.centre.y))
        expect(Math.min(...near), `frame ${k} ${drawn.name}`).toBeLessThanOrEqual(ONE_CELL)
      }
    })
  })

  it('keeps each patch\'s id from day to day, and uses six ids in all', () => {
    const ids = new Set(features.flatMap(f => f.hotspots.map(h => h.id)))
    expect(ids.size).toBe(6)
    // The patch drawn first keeps its id: match each frame's spots to the drawn names by nearest centre.
    const idOf = (k: number, name: string) => {
      const drawn = expected.frames[k].hotspots.find(h => h.name === name)!
      return features[k].hotspots.reduce((best, h) => (Math.hypot(h.centroid.x - drawn.centre.x, h.centroid.y - drawn.centre.y) < Math.hypot(best.centroid.x - drawn.centre.x, best.centroid.y - drawn.centre.y) ? h : best)).id
    }
    for (const name of expected.frames[0].hotspots.map(h => h.name)) {
      const first = idOf(0, name)
      for (let k = 1; k < features.length; k++) expect(idOf(k, name), `${name} at frame ${k}`).toBe(first)
    }
  })

  it('finds a flat sea outside the band: nothing there reads as an edge or a hot spot', () => {
    for (const f of features) expect(f.stats.validShare).toBe(1)
  })
})

describe('synthetic-storm', () => {
  const { expected, features } = run('synthetic-storm')
  const storm = (k: number) => features[k].hotspots.find(h => h.band === 'high')

  it('finds one high hot spot on frames 0 to 8, within a cell of the drawn centre', () => {
    for (let k = 0; k <= 8; k++) {
      expect(features[k].hotspots.filter(h => h.band === 'high'), `frame ${k}`).toHaveLength(1)
      const drawn = expected.frames[k].hotspots.find(h => h.name === 'storm')!.centre
      const spot = storm(k)!
      expect(Math.hypot(spot.centroid.x - drawn.x, spot.centroid.y - drawn.y), `frame ${k}`).toBeLessThanOrEqual(ONE_CELL)
    }
  })

  it('finds the cold patch on frames 5 to 7 only', () => {
    features.forEach((f, k) => {
      const low = f.hotspots.filter(h => h.band === 'low')
      if (k >= 5 && k <= 7) {
        expect(low, `frame ${k}`).toHaveLength(1)
        const drawn = expected.frames[k].hotspots.find(h => h.name === 'cold-patch')!.centre
        expect(Math.hypot(low[0].centroid.x - drawn.x, low[0].centroid.y - drawn.y)).toBeLessThanOrEqual(ONE_CELL)
      } else {
        expect(low, `frame ${k}`).toHaveLength(0)
      }
    })
  })

  it('keeps one id for the storm on frames 0 to 8, and gives the cold patch another', () => {
    const stormIds = new Set(Array.from({ length: 9 }, (_, k) => storm(k)!.id))
    expect(stormIds.size).toBe(1)
    const coldIds = new Set([5, 6, 7].map(k => features[k].hotspots.find(h => h.band === 'low')!.id))
    expect(coldIds.size).toBe(1)
    expect([...coldIds][0]).not.toBe([...stormIds][0])
  })

  it('reads the share of the map that can be read, as drawn, and has no median where nothing can be read', () => {
    features.forEach((f, k) => expect(f.stats.validShare).toBeCloseTo(expected.frames[k].validShare!, 6))
    const last = features[9]
    expect(last.stats.validShare).toBe(0)
    expect(last.stats.median).toBeNull()
    expect(last.hotspots).toEqual([])
    expect(last.confidence).toBe(0)
  })

  it('moves the storm south-east, to the east of where it was, on every step', () => {
    for (let k = 1; k <= 8; k++) {
      expect(storm(k)!.centroid.x).toBeGreaterThan(storm(k - 1)!.centroid.x)
      expect(storm(k)!.centroid.y).toBeGreaterThan(storm(k - 1)!.centroid.y)
    }
  })
})

// The synthetic motion and storm data sets (ticket SN02): made-up frames whose motion and hot spots are known exactly. expected.json holds the
// answers the generators computed from what they drew; these tests decode the real PNGs and check the values at the sample points against it,
// and that the pictures really are as drawn (the patches of the motion set move by exactly two grid cells a day).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { valueAtPixel } from '../analysis/analyze'
import { decodePng } from '../analysis/png'
import catalogJson from '../../public/data/index.json'
import { catalogSchema, visualizationSchema } from './schema'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')

/** How far a decoded value may be from the drawn one: the legend colours are rounded to whole bytes (about 0.07 °C a step for this legend). */
const LEGEND_ROUNDING = 0.1

type ExpectedFrame = {
  date: string
  valueAt: { x: number; y: number; value: number | null }[]
  hotspots: { name: string; band: 'high' | 'low'; centre: { x: number; y: number } }[]
  motion?: { dx: number; dy: number; direction: number } | null
  validShare?: number
}

function load(id: string) {
  const readJson = (name: string): unknown => JSON.parse(readFileSync(`${dataDir}/${id}/${name}`, 'utf8'))
  const v = visualizationSchema.parse(readJson('manifest.json'))
  const expected = readJson('expected.json') as { id: string; frames: ExpectedFrame[] }
  const pixels = v.frames.map(frame => decodePng(readFileSync(`${dataDir}/${id}/${frame.image}`)))
  return { v, expected, pixels }
}

describe.each([
  ['synthetic-motion', 12],
  ['synthetic-storm', 10],
])('%s', (id, frameCount) => {
  const { v, expected, pixels } = load(id)

  it('is labelled as made-up practice data, in the catalogue, the description, the source and every frame', () => {
    const entry = catalogSchema.parse(catalogJson).find(e => e.id === id)
    expect(entry?.title).toMatch(/made-up/i)
    expect(v.description).toMatch(/None of it is real data/)
    expect(v.source.credit).toMatch(/not NASA data/i)
    v.frames.forEach(frame => expect(frame.altText).toMatch(/made-up/i))
  })

  it('has the right frames, one a day in date order, 800 × 400, no baseline, video or sonification', () => {
    expect(v.frames).toHaveLength(frameCount)
    v.frames.forEach((frame, i) => {
      expect(frame.date).toBe(`2026-03-${String(i + 1).padStart(2, '0')}`)
      expect([pixels[i].width, pixels[i].height]).toEqual([800, 400])
      expect([frame.width, frame.height]).toEqual([800, 400])
    })
    expect(v).not.toHaveProperty('baseline')
    expect(v.video).toBeUndefined()
    expect(v.sonification).toBeUndefined()
    expect(v.legend).toBeUndefined()
    expect(v.mapArea).toBeUndefined()
    expect(v.comparisons).toEqual([])
    expect(expected.id).toBe(id)
    expect(expected.frames.map(f => f.date)).toEqual(v.frames.map(f => f.date))
  })

  it('has one region of 30 points', () => {
    expect(v.regions).toHaveLength(1)
    expect(v.regions[0].points).toHaveLength(30)
  })

  it('has the drawn value at every sample point, and nothing at a point that is land or missing', () => {
    expected.frames.forEach((frame, i) => {
      for (const point of frame.valueAt) {
        const { width, height } = pixels[i]
        const read = valueAtPixel(pixels[i], Math.min(width - 1, Math.floor(point.x * width)), Math.min(height - 1, Math.floor(point.y * height)), v.colorScale)
        if (point.value === null) expect(read, `${frame.date} (${point.x}, ${point.y})`).toBeNull()
        else {
          expect(read, `${frame.date} (${point.x}, ${point.y})`).not.toBeNull()
          expect(Math.abs(read! - point.value), `${frame.date} (${point.x}, ${point.y})`).toBeLessThanOrEqual(LEGEND_ROUNDING)
        }
      }
    })
  })

  it('has every hot spot in a category the drawing says: warm ones in the top category, cold ones in the bottom', () => {
    const categories = v.mapping.categories
    expected.frames.forEach((frame, i) => {
      for (const spot of frame.hotspots) {
        const { width, height } = pixels[i]
        const value = valueAtPixel(pixels[i], Math.floor(spot.centre.x * width), Math.floor(spot.centre.y * height), v.colorScale)!
        const category = categories.find(c => value >= c.range[0] && value < c.range[1])!
        expect(category.id, `${frame.date} ${spot.name}`).toBe(spot.band === 'high' ? categories[categories.length - 1].id : categories[0].id)
      }
    })
  })
})

describe('synthetic-motion: the patches move east by exactly two grid cells a day', () => {
  const { expected, pixels } = load('synthetic-motion')

  it('has no motion on the first frame and two cells east on every other', () => {
    expect(expected.frames[0].motion).toBeNull()
    for (const frame of expected.frames.slice(1)) expect(frame.motion).toEqual({ dx: 2, dy: 0, direction: 0 })
  })

  it('has six patches, four warm and two cold, on every day', () => {
    for (const frame of expected.frames) {
      expect(frame.hotspots).toHaveLength(6)
      expect(frame.hotspots.filter(h => h.band === 'high')).toHaveLength(4)
    }
  })

  it('draws each frame as the one before moved 25 pixels (two cells of a 64-column grid) east, pixel for pixel', () => {
    for (let k = 1; k < pixels.length; k++) {
      const { width, height } = pixels[k]
      const before = pixels[k - 1].data
      const now = pixels[k].data
      let differing = 0
      for (let y = 0; y < height; y++) {
        for (let x = 25; x < width; x++) {
          const a = (y * width + x) * 4
          const b = (y * width + x - 25) * 4
          if (now[a] !== before[b] || now[a + 1] !== before[b + 1] || now[a + 2] !== before[b + 2]) differing++
        }
      }
      expect(differing, `frame ${k}`).toBe(0)
    }
  })

  it('keeps every patch inside the picture', () => {
    for (const frame of expected.frames) for (const spot of frame.hotspots) expect(spot.centre.x).toBeLessThan(0.9)
  })
})

describe('synthetic-storm: a storm on a known path, a cold patch for three days, and a day with no data', () => {
  const { v, expected, pixels } = load('synthetic-storm')
  const by = (date: string) => expected.frames.find(f => f.date === date)!

  it('has the storm on frames 0 to 8, moving in a straight line from (0.25, 0.35) to (0.62, 0.55)', () => {
    const centres = expected.frames.slice(0, 9).map(f => f.hotspots.find(h => h.name === 'storm')!.centre)
    expect(centres[0]).toEqual({ x: 0.25, y: 0.35 })
    expect(centres[8]).toEqual({ x: 0.62, y: 0.55 })
    centres.forEach((c, k) => {
      expect(c.x).toBeCloseTo(0.25 + (0.62 - 0.25) * (k / 8), 3)
      expect(c.y).toBeCloseTo(0.35 + (0.55 - 0.35) * (k / 8), 3)
    })
    expect(by('2026-03-10').hotspots.find(h => h.name === 'storm')).toBeUndefined()
  })

  it('has the cold patch on frames 5 to 7 only, at (0.80, 0.70)', () => {
    expected.frames.forEach((frame, k) => {
      const cold = frame.hotspots.find(h => h.name === 'cold-patch')
      if (k >= 5 && k <= 7) expect(cold).toMatchObject({ band: 'low', centre: { x: 0.8, y: 0.7 } })
      else expect(cold).toBeUndefined()
    })
  })

  it('has one hot spot on the other days, and none on the day with no data', () => {
    expect(expected.frames.map(f => f.hotspots.length)).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 1, 0])
  })

  it('has land along the east edge of every picture, and nothing readable at all on the last day', () => {
    pixels.forEach((p, k) => {
      const east = valueAtPixel(p, 790, 200, v.colorScale)
      expect(east, `frame ${k}`).toBeNull()
    })
    const last = pixels[9]
    for (let y = 0; y < last.height; y += 7) for (let x = 0; x < last.width; x += 7) expect(valueAtPixel(last, x, y, v.colorScale)).toBeNull()
    expect(by('2026-03-10').validShare).toBe(0)
    for (const frame of expected.frames.slice(0, 9)) expect(frame.validShare!).toBeGreaterThan(v.mapping.minValidFraction)
  })
})

// Known answers (D04): every data set that has public/data/<id>/known-answers.json is read through its legend at NASA's points, and each value
// must match NASA's number within the legend's rounding. Runs in `npm run check-data`. The second half proves the check itself on a made-up
// scene whose values are known exactly (src/test/changeScene.ts).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../public/data/index.json'
import { decodePng } from '../analysis/png'
import { SCENE_SCALE, SCENE_SIZE, scene } from '../test/changeScene'
import { legendRounding } from './check'
import { allowedError, checkKnownAnswers, fitControl, knownAnswersSchema, pointOf, type KnownAnswers, type KnownCheck } from './knownAnswers'
import { catalogSchema, describeIssues, visualizationSchema } from './schema'

const files = import.meta.glob('../../public/data/*/known-answers.json', { eager: true, import: 'default' }) as Record<string, unknown>
const manifests = import.meta.glob('../../public/data/*/manifest.json', { eager: true, import: 'default' }) as Record<string, unknown>
const catalog = catalogSchema.parse(catalogJson)
const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const idOf = (path: string) => path.split('/').at(-2)!

describe('the known answers on disk', () => {
  it('belong only to data sets listed in index.json', () => {
    const listed = new Set(catalog.map(entry => entry.id))
    expect(Object.keys(files).map(idOf).filter(id => !listed.has(id))).toEqual([])
  })

  for (const { id } of catalog) {
    const raw = files[`../../public/data/${id}/known-answers.json`]
    if (raw === undefined) continue
    describe(id, () => {
      const parsed = knownAnswersSchema.safeParse(raw)

      it('is a valid known-answers file', () => {
        expect(parsed.success ? '' : describeIssues(parsed.error, 10)).toBe('')
      })

      it("reads NASA's number at every point, within the legend's rounding", () => {
        if (!parsed.success) return
        const v = visualizationSchema.parse(manifests[`../../public/data/${id}/manifest.json`])
        const failures = checkKnownAnswers(parsed.data, v, image => decodePng(readFileSync(`${dataDir}/${id}/${image}`)))
        if (failures.length) expect.fail(`\n${failures.join('\n')}`)
      })
    })
  }
})

// The made-up scene: 360 × 180, value 1 + 3 × row / 180 (rising southward), on a blue-to-red legend from 0 to 10. As a whole-world map,
// latitude L lands on row floor((90 − L) / 180 × 180), so the value there is known exactly.
const WORLD = { projection: 'equirectangular' as const, west: -180, east: 180, north: 90, south: -90 }
const source = { dataset: 'MADE-UP', variable: 'value', time: '2024-01-15T00:00:00Z', url: 'https://example.invalid/scene', retrievedOn: '2026-11-12' }
const known = (lat: number, value: number, more: Partial<KnownCheck> = {}): KnownCheck => ({ frameId: 'f1', lat, lon: 10, value, unit: '°C', decimals: 1, source: { ...source }, ...more })
const valueAtLat = (lat: number) => 1 + (3 * Math.floor(((90 - lat) / 180) * SCENE_SIZE.height)) / SCENE_SIZE.height
const passing = (): KnownAnswers => ({ id: 'scene', map: WORLD, checks: [60, 30, 0, -30, -60].map(lat => known(lat, valueAtLat(lat))) })
const sceneSet = { id: 'scene', colorScale: SCENE_SCALE, frames: [{ id: 'f1', date: '2024-01-15', image: 'frames/f1.png', width: 360, height: 180, altText: 'A made-up map.' }] }

describe('knownAnswersSchema', () => {
  const errors = (change: (file: any) => void) => {
    const file: any = structuredClone(passing())
    change(file)
    const result = knownAnswersSchema.safeParse(file)
    expect(result.success).toBe(false)
    return result.success ? '' : describeIssues(result.error, 10)
  }

  it('accepts a whole file, with or without a tolerance', () => {
    expect(knownAnswersSchema.safeParse(passing()).success).toBe(true)
    const withTolerance = passing()
    withTolerance.checks[0].tolerance = 0.1
    expect(knownAnswersSchema.safeParse(withTolerance).success).toBe(true)
  })

  it('rejects a check with no source, or a source with a field left out', () => {
    expect(errors(f => { delete f.checks[0].source })).toMatch(/^checks\.0\.source: /)
    expect(errors(f => { delete f.checks[2].source.url })).toMatch(/^checks\.2\.source\.url: /)
    expect(errors(f => { f.checks[1].source.retrievedOn = 'yesterday' })).toBe('checks.1.source.retrievedOn: must be a date written YYYY-MM-DD')
  })

  it('rejects fewer than 5 checks', () => {
    expect(errors(f => { f.checks = f.checks.slice(0, 4) })).toBe('checks: needs at least 5 checks, spread across the map')
  })

  it('rejects a map with both forms, an unknown projection and an extent the wrong way round', () => {
    expect(errors(f => { f.map.control = [{ lat: 0, lon: 0, x: 0.5, y: 0.5 }] })).toMatch(/^map: .*control/)
    const corners = [[90, -180, 0, 0], [90, 180, 1, 0], [-90, -180, 0, 1], [-90, 180, 1, 1]].map(([lat, lon, x, y]) => ({ lat, lon, x, y }))
    expect(errors(f => { f.map = { projection: 'other', west: -180, east: 180, north: 90, south: -90, control: corners } })).toMatch(/^map: .*(west|east|north|south)/)
    expect(errors(f => { f.map.projection = 'mercator' })).toMatch(/^map\.projection: needs "projection"/)
    expect(errors(f => { f.map.east = -180 })).toBe('map.east: must be east of west (-180)')
    expect(errors(f => { f.map.north = -90 })).toBe('map.north: must be north of south (-90)')
  })

  it('rejects control points that are too few or all on one line', () => {
    const line = [0, 1, 2, 3].map(i => ({ lat: i, lon: i, x: i / 4, y: i / 4 }))
    expect(errors(f => { f.map = { projection: 'other', control: line.slice(0, 3) } })).toBe('map.control: needs at least 4 control points')
    expect(errors(f => { f.map = { projection: 'other', control: line } })).toBe('map.control: cannot be fitted: the points must spread over the map, not lie on one line')
  })

  it('rejects a latitude or longitude off the globe, a fractional decimals and a misspelt field', () => {
    expect(errors(f => { f.checks[0].lat = 91 })).toBe('checks.0.lat: must be between -90 and 90')
    expect(errors(f => { f.checks[0].lon = -181 })).toBe('checks.0.lon: must be between -180 and 180')
    expect(errors(f => { f.checks[0].decimals = 1.5 })).toBe('checks.0.decimals: must be a whole number')
    expect(errors(f => { f.checks[0].vaule = 3 })).toMatch(/^checks\.0: .*vaule/)
  })
})

describe('pointOf', () => {
  it('puts the corners of the map on the corners of the image, and its centre in the middle', () => {
    const map = { projection: 'equirectangular' as const, west: 55, east: 65, north: -10, south: -22 }
    expect(pointOf({ lat: -10, lon: 55 }, map)).toEqual({ x: 0, y: 0 })
    expect(pointOf({ lat: -22, lon: 65 }, map)).toEqual({ x: 1, y: 1 })
    expect(pointOf({ lat: -16, lon: 60 }, map)).toEqual({ x: 0.5, y: 0.5 })
  })

  it('places the map inside mapArea when the data set has one', () => {
    expect(pointOf({ lat: 0, lon: 0 }, WORLD, { x0: 0, y0: 0, x1: 1, y1: 0.8 })).toEqual({ x: 0.5, y: 0.4 })
    expect(pointOf({ lat: -90, lon: 180 }, WORLD, { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 })).toEqual({ x: 0.9, y: 0.9 })
  })

  it('with control points, fits them: the corners of a plain grid give the same places as its extent', () => {
    const corners = [[90, -180, 0, 0], [90, 180, 1, 0], [-90, -180, 0, 1], [-90, 180, 1, 1]].map(([lat, lon, x, y]) => ({ lat, lon, x, y }))
    const map = { projection: 'other' as const, control: corners }
    for (const at of [{ lat: 0, lon: 0 }, { lat: 45, lon: -90 }, { lat: -30, lon: 120 }]) {
      const fitted = pointOf(at, map)
      const plain = pointOf(at, WORLD)
      expect(fitted.x).toBeCloseTo(plain.x, 9)
      expect(fitted.y).toBeCloseTo(plain.y, 9)
    }
    expect(fitControl(corners)).not.toBeNull()
  })
})

describe('allowedError', () => {
  it("is the legend's rounding when there is no tolerance, and the tolerance when it is larger", () => {
    const rounding = legendRounding(SCENE_SCALE.stops)
    expect(rounding).toBeCloseTo(10 / Math.hypot(255, 255), 9)
    expect(allowedError(SCENE_SCALE.stops, {})).toBe(rounding)
    expect(allowedError(SCENE_SCALE.stops, { tolerance: 0 })).toBe(rounding)
    expect(allowedError(SCENE_SCALE.stops, { tolerance: 0.001 })).toBe(rounding)
    expect(allowedError(SCENE_SCALE.stops, { tolerance: 0.5 })).toBe(0.5)
  })
})

describe('the check itself, on a made-up scene with known values', () => {
  const read = () => scene({ season: 0 })

  it('passes when every number is the one the picture shows', () => {
    expect(checkKnownAnswers(passing(), sceneSet, read)).toEqual([])
  })

  it('fails a number 3 units off, in one line that names the frame, the place, both numbers and the limit', () => {
    const file = passing()
    file.checks[2] = known(0, valueAtLat(0) + 3)
    expect(checkKnownAnswers(file, sceneSet, read)).toEqual([
      "scene f1 at 0, 10: NASA's number is 5.5 °C, the picture reads 2.51 °C (allowed 0.0277). Check the point and the legend.",
    ])
  })

  it('fails a point on land, a frame that is not in the data set, a point off the map and a file for another data set', () => {
    const file = passing()
    file.checks[0] = known(60, 1.5, { lon: 170 })
    file.checks[1] = known(30, 2, { frameId: 'f9' })
    file.checks[2] = known(0, 2.5, { lon: 10 })
    const offMap = { ...file, map: { ...WORLD, west: 0, east: 5 } }
    expect(checkKnownAnswers(file, sceneSet, () => scene({ season: 0, landFrom: 300 }))).toEqual([
      'scene f1 at 60, 170: cannot be read: the point is on land, cloud, a label or off the legend; move the point',
      'scene f9 at 30, 10: there is no frame "f9" in the data set',
    ])
    expect(checkKnownAnswers(offMap, sceneSet, read)[0]).toBe('scene f1 at 60, 170: the point is outside the map; check "map" and the latitude and longitude')
    expect(checkKnownAnswers({ ...file, id: 'other' }, sceneSet, read)).toEqual([
      'scene: known-answers.json says "id": "other"; it must be "scene", the data set it sits in',
    ])
  })

  it('decodes each picture once, however many checks it has', () => {
    let reads = 0
    checkKnownAnswers(passing(), sceneSet, () => { reads++; return read() })
    expect(reads).toBe(1)
  })
})

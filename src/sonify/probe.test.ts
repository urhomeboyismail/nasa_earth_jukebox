import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { FrameGrid } from '../analysis'
import { gridFromPixels } from '../analysis/analyze'
import { decodePng } from '../analysis/png'
import type { ColorScale } from '../data'
import { visualizationSchema } from '../data/schema'
import { PRESETS, pitchClasses } from './presets'
import { PROBE_LEVEL, PROBE_LOW_MIDI, PROBE_SPAN, probeTone, slopeAt } from './probe'

// A legend from 0 to 40, so a quarter of its range (a full slope) is 10.
const scale: ColorScale = { stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 40, rgb: [255, 0, 0] }], noData: [], maxColorDistance: 30 }

/** A grid from rows of values, `null` for a cell with no data. */
function gridOf(rows: (number | null)[][]): FrameGrid {
  const cells = rows.flat().map(value => ({ value, category: value === null ? ('insufficient' as const) : 'mild' }))
  return { frameId: 'f', cols: rows[0].length, rows: rows.length, area: { x0: 0, y0: 0, x1: 1, y1: 1 }, cells }
}

const major = PRESETS.major

describe('probeTone', () => {
  it('sounds a warm cell higher than a cool one', () => {
    const grid = gridOf([[5, 35]])
    expect(probeTone(scale, grid, 1, 0, major)!.midi).toBeGreaterThan(probeTone(scale, grid, 0, 0, major)!.midi)
  })

  it('gives null for a cell with no value', () => {
    expect(probeTone(scale, gridOf([[null, 10]]), 0, 0, major)).toBeNull()
  })

  it('keeps every note in the scale of the preset and inside the three octaves', () => {
    for (const preset of Object.values(PRESETS)) {
      const classes = pitchClasses(preset)
      for (let value = -10; value <= 50; value += 0.7) {
        const tone = probeTone(scale, gridOf([[value]]), 0, 0, preset)!
        expect(classes.has(tone.midi % 12), `${preset.id} ${value}`).toBe(true)
        expect(tone.midi).toBeGreaterThanOrEqual(PROBE_LOW_MIDI)
        expect(tone.midi).toBeLessThanOrEqual(PROBE_LOW_MIDI + PROBE_SPAN)
      }
    }
    expect(probeTone(scale, gridOf([[0]]), 0, 0, major)!.midi).toBe(PROBE_LOW_MIDI)
    expect(probeTone(scale, gridOf([[40]]), 0, 0, major)!.midi).toBe(PROBE_LOW_MIDI + PROBE_SPAN)
  })

  it('is brighter beside warmer cells and duller beside cooler ones', () => {
    const grid = gridOf([[10, 20, 30]])
    expect(probeTone(scale, gridOf([[10, 30]]), 0, 0, major)!.brightness).toBeGreaterThan(0.5)
    expect(probeTone(scale, gridOf([[10, 30]]), 1, 0, major)!.brightness).toBeLessThan(0.5)
    // Rising on one side and falling on the other evens out.
    expect(probeTone(scale, grid, 1, 0, major)!.brightness).toBe(0.5)
  })

  it('places the tone where the cell is: west left, north up', () => {
    const grid = gridOf([[1, 1], [1, 1]])
    const northWest = probeTone(scale, grid, 0, 0, major)!
    const southEast = probeTone(scale, grid, 1, 1, major)!
    expect(northWest.pan).toBeLessThan(0)
    expect(southEast.pan).toBeGreaterThan(0)
    expect(northWest.elevation).toBeGreaterThan(0)
    expect(southEast.elevation).toBeLessThan(0)
    expect(northWest.level).toBe(PROBE_LEVEL)
  })
})

describe('slopeAt', () => {
  it('is 0 on a flat field', () => {
    expect(slopeAt(scale, gridOf([[7, 7, 7], [7, 7, 7], [7, 7, 7]]), 1, 1)).toBe(0)
  })

  it('is positive towards the warm side of a step, and negative on the warm side looking back', () => {
    const step = gridOf([[10, 10, 30, 30]])
    expect(slopeAt(scale, step, 1, 0)).toBeGreaterThan(0)
    expect(slopeAt(scale, step, 2, 0)).toBeLessThan(0)
    expect(slopeAt(scale, step, 0, 0)).toBe(0)
  })

  it('is a full slope for a neighbour a quarter of the range higher, and no more for a bigger one', () => {
    expect(slopeAt(scale, gridOf([[0, 10]]), 0, 0)).toBe(1)
    expect(slopeAt(scale, gridOf([[0, 40]]), 0, 0)).toBe(1)
    expect(slopeAt(scale, gridOf([[0, 5]]), 0, 0)).toBe(0.5)
  })

  it('is 0 for a cell with no readable neighbour, and reads only the readable ones', () => {
    expect(slopeAt(scale, gridOf([[null, null, null], [null, 10, null], [null, null, null]]), 1, 1)).toBe(0)
    expect(slopeAt(scale, gridOf([[null, 10, 15]]), 1, 0)).toBe(0.5)
    expect(slopeAt(scale, gridOf([[10]]), 0, 0)).toBe(0)
  })

  it('is 0 for a cell with no value', () => {
    expect(slopeAt(scale, gridOf([[null, 30]]), 0, 0)).toBe(0)
  })
})

// The probe regression baseline. If this fails, the probe changed: rewrite it only for a change you meant, with
// `npx vitest run -u src/sonify/probe.test.ts`, and read the diff before you commit it.
// The fixture's frames are flat (one value over the whole map), so the Mauritius data set, which has gradients, is recorded too.
const GOLDEN_SETS = ['fixture', 'mur-sst-mauritius']
const round = (value: number) => Number(value.toFixed(4))
type Row = [number, number, number, number, number, number] | null

/** [midi, level, pan, elevation, brightness, slope] for every cell of a data set's first frame, on the explorer's own grid, row by row. */
function probeFirstFrame(id: string): { frameId: string; cols: number; rows: number; cells: Row[] } {
  const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const frame = v.frames[0]
  const grid = gridFromPixels(decodePng(readFileSync(`${dataDir}/${id}/${frame.image}`)), frame, v.colorScale, v.mapping, v.mapArea)
  const cells = grid.cells.map((_, i): Row => {
    const col = i % grid.cols
    const row = Math.floor(i / grid.cols)
    const tone = probeTone(v.colorScale, grid, col, row, major)
    return tone && [tone.midi, round(tone.level), round(tone.pan), round(tone.elevation ?? 0), round(tone.brightness), round(slopeAt(v.colorScale, grid, col, row))]
  })
  return { frameId: frame.id, cols: grid.cols, rows: grid.rows, cells }
}

describe('probe regression baseline', () => {
  const results = Object.fromEntries(GOLDEN_SETS.map(id => [id, probeFirstFrame(id)]))

  it('gives the committed tone and slope for every cell of the first frame of the fixture and the Mauritius data set', async () => {
    // One cell a line, so a change shows as a small diff.
    const sets = GOLDEN_SETS.map(id => {
      const { cells, ...head } = results[id]
      return `${JSON.stringify(id)}: ${JSON.stringify({ ...head, preset: major.id }).slice(0, -1)},\n"cells": [\n${cells.map(cell => JSON.stringify(cell)).join(',\n')}\n]}`
    })
    const text = `{"cell": "[midi, level, pan, elevation, brightness, slope] or null",\n${sets.join(',\n')}\n}\n`
    expect(JSON.parse(text).fixture.cells).toEqual(results.fixture.cells)
    await expect(text).toMatchFileSnapshot('__golden__/probe.json')
  })

  it('is flat on the flat fixture, and slopes both ways on the Mauritius data set', () => {
    expect(results.fixture.cells.every(cell => cell !== null && cell[5] === 0 && cell[4] === 0.5)).toBe(true)
    const slopes = results['mur-sst-mauritius'].cells.flatMap(cell => (cell ? [cell[5]] : []))
    expect(slopes.some(slope => slope > 0) && slopes.some(slope => slope < 0)).toBe(true)
  })
})

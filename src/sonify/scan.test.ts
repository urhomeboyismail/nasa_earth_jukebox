// Scan's plan (docs/PLAN.md §6.3, ticket SN08): hand-made grids for the rules, and the committed golden for two real data sets.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../analysis/features/extract'
import { FEATURE_COLS, FEATURE_ROWS, type FrameFeatures } from '../analysis/features/types'
import { decodePng } from '../analysis/png'
import { visualizationSchema } from '../data/schema'
import { panForPoint } from '../audio/pan'
import { pitchClasses, PRESETS } from './presets'
import { bandMidi, columnAt, scanPlan, SCAN_BANDS, SCAN_LOW_MIDI, SCAN_MIN_LEVEL, SCAN_MS_PER_COLUMN, SCAN_NOTE_SECONDS, SCAN_SPAN } from './scan'
import { features } from './testFeatures'

const preset = PRESETS.major

/** Features whose grid holds `at(row, column)` (0 to 1, or NaN for a cell that cannot be read). */
function gridFeatures(at: (row: number, column: number) => number): FrameFeatures {
  const position = new Float32Array(FEATURE_COLS * FEATURE_ROWS)
  for (let row = 0; row < FEATURE_ROWS; row++) for (let column = 0; column < FEATURE_COLS; column++) position[row * FEATURE_COLS + column] = at(row, column)
  return { ...features(), grid: { cols: FEATURE_COLS, rows: FEATURE_ROWS, values: position.slice(), position } }
}

describe('scanPlan', () => {
  it('has one column per grid column, 80 ms apart', () => {
    const plan = scanPlan(gridFeatures(() => 0.5), preset)
    expect(plan).toHaveLength(64)
    plan.forEach((column, i) => {
      expect(column.column).toBe(i)
      expect(column.atMs).toBe(i * SCAN_MS_PER_COLUMN)
    })
    expect(plan[63].atMs).toBe(5040)
  })

  it('follows a different gap when asked', () => {
    const plan = scanPlan(gridFeatures(() => 0.5), preset, 100)
    expect(plan[10].atMs).toBe(1000)
    expect(plan[10].notes[0].seconds).toBeCloseTo(0.15)
  })

  it('makes the north band the highest note and every band a different, rising note', () => {
    const midis = Array.from({ length: SCAN_BANDS }, (_, band) => bandMidi(band, preset))
    expect(midis[0]).toBe(Math.max(...midis))
    expect(midis[SCAN_BANDS - 1]).toBe(Math.min(...midis))
    for (let band = 1; band < SCAN_BANDS; band++) expect(midis[band]).toBeLessThan(midis[band - 1])
    const column = scanPlan(gridFeatures(() => 0.5), preset)[0]
    expect(column.notes.map(note => note.midi)).toEqual(midis)
  })

  it('keeps every note in the preset scale and between C3 and C5, for every preset', () => {
    for (const p of Object.values(PRESETS)) {
      const classes = pitchClasses(p)
      for (const column of scanPlan(gridFeatures((row, col) => (row + col) / 100), p)) {
        for (const note of column.notes) {
          expect(classes.has(note.midi % 12)).toBe(true)
          expect(note.midi).toBeGreaterThanOrEqual(SCAN_LOW_MIDI)
          expect(note.midi).toBeLessThanOrEqual(SCAN_LOW_MIDI + SCAN_SPAN)
        }
      }
    }
  })

  it('makes a warm patch louder and brighter in the rows it covers', () => {
    // A patch in the north-east: rows 0 to 7 (bands 0 and 1), columns 40 to 50.
    const plan = scanPlan(gridFeatures((row, column) => (row < 8 && column >= 40 && column <= 50 ? 1 : 0.1)), preset)
    const inside = plan[45].notes
    const outside = plan[10].notes
    expect(inside[0].level).toBeCloseTo(1)
    expect(inside[1].level).toBeCloseTo(1)
    expect(inside[0].brightness).toBe(1)
    for (let band = 2; band < SCAN_BANDS; band++) expect(inside[band].level).toBeLessThan(inside[0].level)
    expect(inside[0].level).toBeGreaterThan(outside[0].level)
    expect(inside[0].brightness).toBeGreaterThan(outside[0].brightness)
  })

  it('gives a value of 0 the minimum level and a value of 1 the full level', () => {
    const plan = scanPlan(gridFeatures((_, column) => (column < 32 ? 0 : 1)), preset)
    expect(plan[0].notes[0].level).toBeCloseTo(SCAN_MIN_LEVEL)
    expect(plan[0].notes[0].brightness).toBe(0)
    expect(plan[63].notes[0].level).toBeCloseTo(1)
  })

  it('takes the median of a band and skips a band with no readable cell', () => {
    // Band 0 is rows 0 to 3. In column 5 its cells are 0.1, 0.9, unreadable and 0.3: the readable ones have the median 0.3.
    const values = [0.1, 0.9, Number.NaN, 0.3]
    const plan = scanPlan(gridFeatures((row, column) => (row >= 4 ? 0.5 : column === 5 ? values[row] : Number.NaN)), preset)
    expect(plan[5].notes[0].brightness).toBeCloseTo(0.3)
    expect(plan[5].notes).toHaveLength(SCAN_BANDS)
    expect(plan[6].notes).toHaveLength(SCAN_BANDS - 1)
    expect(plan[6].notes.map(note => note.midi)).not.toContain(bandMidi(0, preset))
  })

  it('marks a column with nothing readable as a dropout with no notes, and no other', () => {
    const plan = scanPlan(gridFeatures((_, column) => (column === 20 || column === 21 ? Number.NaN : 0.5)), preset)
    expect(plan.filter(column => column.dropout).map(column => column.column)).toEqual([20, 21])
    expect(plan[20].notes).toEqual([])
    expect(plan[19].dropout).toBe(false)
  })

  it('is a dropout in every column when nothing is readable', () => {
    const plan = scanPlan(gridFeatures(() => Number.NaN), preset)
    expect(plan.every(column => column.dropout && column.notes.length === 0)).toBe(true)
  })

  it('pans from the west ear to the east ear through panForPoint', () => {
    const plan = scanPlan(gridFeatures(() => 0.5), preset)
    expect(plan[0].notes[0].pan).toBe(panForPoint(0.5 / 64))
    expect(plan[0].notes[0].pan).toBeLessThan(-0.95)
    expect(plan[63].notes[0].pan).toBeGreaterThan(0.95)
    const pans = plan.map(column => column.notes[0].pan)
    expect([...pans].sort((a, b) => a - b)).toEqual(pans)
  })

  it('puts the north band above and the south band below', () => {
    const notes = scanPlan(gridFeatures(() => 0.5), preset)[0].notes
    expect(notes[0].elevation).toBeGreaterThan(0.8)
    expect(notes[SCAN_BANDS - 1].elevation).toBeLessThan(-0.8)
  })

  it('lets each note ring a little past its column', () => {
    const note = scanPlan(gridFeatures(() => 0.5), preset)[0].notes[0]
    expect(note.seconds).toBe(SCAN_NOTE_SECONDS)
    expect(note.seconds).toBeGreaterThan(SCAN_MS_PER_COLUMN / 1000)
  })

  it('gives equal plans for equal features and preset', () => {
    const make = () => scanPlan(gridFeatures((row, column) => ((row * 7 + column * 3) % 11) / 10), preset)
    expect(make()).toEqual(make())
  })

  it('gives no columns for an empty grid', () => {
    expect(scanPlan(features(), preset)).toEqual([])
  })
})

describe('columnAt', () => {
  it('is the column the sweep has reached', () => {
    expect(columnAt(0, 64)).toBe(0)
    expect(columnAt(79, 64)).toBe(0)
    expect(columnAt(80, 64)).toBe(1)
    expect(columnAt(2500, 64)).toBe(31)
  })

  it('is null before the start and after the last column', () => {
    expect(columnAt(-1, 64)).toBeNull()
    expect(columnAt(64 * 80, 64)).toBeNull()
    expect(columnAt(Number.NaN, 64)).toBeNull()
  })
})

// The golden: the plan for the first frame of two data sets, read with the real extractor.
const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const round = (value: number) => Number(value.toFixed(4))

function firstFrame(id: string): FrameFeatures {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const frame = [...v.frames].sort((a, b) => a.date.localeCompare(b.date))[0]
  return extractFeatures(decodePng(readFileSync(`${dataDir}/${id}/${frame.image}`)), {
    frameId: `${id}/${frame.id}`, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE,
  })
}

describe('scan golden', () => {
  it('plans the first frame of the fixture and of synthetic-storm as the committed baseline says', async () => {
    const golden = Object.fromEntries(['fixture', 'synthetic-storm'].map(id => [
      id,
      scanPlan(firstFrame(id), preset).map(column => ({
        column: column.column,
        atMs: column.atMs,
        dropout: column.dropout,
        notes: column.notes.map(note => [note.midi, round(note.level), round(note.pan), round(note.elevation), round(note.brightness)]),
      })),
    ]))
    await expect(JSON.stringify(golden, null, 2) + '\n').toMatchFileSnapshot('__golden__/scan.json')
  })
})

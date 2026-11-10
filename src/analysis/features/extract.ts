// The feature extractor (docs/PLAN.md §6.3, SN01): one frame in, `FrameFeatures` out.
// Data mode: the colour bar decodes the values (through `readField`, so a cell here and a cell in the change maps never disagree).
// Picture mode: no colour bar, so the cell is its brightness. Pure and deterministic: no randomness, no clock, no model.

import type { MapArea } from '../../data'
import { valueAtPixel, type Pixels } from '../analyze'
import { changeField, stepFor, summarizeChange } from '../change'
import { MIN_LATTICE_SAMPLES, readField } from '../field'
import { median } from '../median'
import type { ValueField } from '../types'
import { edgeSummary } from './edges'
import { findHotspots, highestSerial, trackHotspots } from './hotspots'
import { estimateMotion } from './motion'
import {
  BRIGHTNESS_HIGH, BRIGHTNESS_LOW, FEATURE_COLS, FEATURE_ROWS, PICTURE_BANDS, STRICT_COLOUR_TOLERANCE,
  type Band, type ExtractInput, type FrameFeatures, type Motion, type Place,
} from './types'

/** Where in a cell, as fractions of its width and height, the 3 × 3 lattice of samples sits. The same lattice as `readField`'s (field.ts keeps it private; extract.test.ts checks the two agree). */
const LATTICE = [1 / 6, 1 / 2, 5 / 6]

/** The pixel a lattice sample falls on. */
function samplePixel(pixels: Pixels, area: MapArea, col: number, row: number, fx: number, fy: number) {
  const x = area.x0 + ((col + fx) / FEATURE_COLS) * (area.x1 - area.x0)
  const y = area.y0 + ((row + fy) / FEATURE_ROWS) * (area.y1 - area.y0)
  return { px: Math.floor(x * pixels.width), py: Math.floor(y * pixels.height) }
}

type Read = { values: Float32Array; position: Float32Array; confidence: number }

/** Data mode: the legend decodes each cell. `position` is the value as 0 to 1 across the legend. */
function readData(pixels: Pixels, input: ExtractInput): Read {
  const { colorScale, area } = input
  const tolerance = input.colourTolerance ?? 1
  const scale = { ...colorScale, maxColorDistance: colorScale.maxColorDistance * tolerance }
  const values = readField(pixels, scale, area, FEATURE_COLS, FEATURE_ROWS).values

  const first = colorScale.stops[0].value
  const span = colorScale.stops[colorScale.stops.length - 1].value - first
  const position = new Float32Array(values.length)
  for (let i = 0; i < values.length; i++) {
    position[i] = Number.isNaN(values[i]) ? NaN : positionOf(values[i], first, span)
  }

  // Confidence: of the samples the (possibly widened) legend reads, how many does the strict legend also read.
  const strictScale = { ...colorScale, maxColorDistance: colorScale.maxColorDistance * STRICT_COLOUR_TOLERANCE }
  // The answer for a pixel depends only on its colour, and a picture has few distinct colours, so each colour is looked up once
  // (a real legend has hundreds of stops, and `valueAtPixel` walks them all).
  const byColour = new Map<number, 0 | 1 | 2>() // 0 not read, 1 read, 2 read within the strict distance
  let readable = 0
  let strict = 0
  for (let row = 0; row < FEATURE_ROWS; row++) {
    for (let col = 0; col < FEATURE_COLS; col++) {
      for (const fy of LATTICE) {
        for (const fx of LATTICE) {
          const { px, py } = samplePixel(pixels, area, col, row, fx, fy)
          const i = (Math.min(pixels.height - 1, Math.max(0, py)) * pixels.width + Math.min(pixels.width - 1, Math.max(0, px))) * 4
          const { data } = pixels
          // Not fully opaque: never read. Otherwise the colour is the key.
          const key = data[i + 3] < 255 ? -1 : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
          let kind = key < 0 ? 0 : byColour.get(key)
          if (kind === undefined) {
            kind = valueAtPixel(pixels, px, py, scale) === null ? 0 : valueAtPixel(pixels, px, py, strictScale) === null ? 1 : 2
            byColour.set(key, kind)
          }
          if (kind === 0) continue
          readable++
          if (kind === 2) strict++
        }
      }
    }
  }
  return { values, position, confidence: readable ? Math.min(1, strict / readable) : 0 }
}

/** The value as 0 to 1 across the legend, clamped. A legend with no span puts everything in the middle. */
function positionOf(value: number, first: number, span: number): number {
  return span > 0 ? Math.min(1, Math.max(0, (value - first) / span)) : 0.5
}

/** Picture mode: a cell is the median brightness of its opaque samples. A sample that is not fully opaque cannot be read. */
function readPicture(pixels: Pixels, input: ExtractInput): Read {
  const { area } = input
  const { data } = pixels
  const values = new Float32Array(FEATURE_COLS * FEATURE_ROWS).fill(NaN)
  let opaque = 0
  for (let row = 0; row < FEATURE_ROWS; row++) {
    for (let col = 0; col < FEATURE_COLS; col++) {
      const brightness: number[] = []
      for (const fy of LATTICE) {
        for (const fx of LATTICE) {
          const { px, py } = samplePixel(pixels, area, col, row, fx, fy)
          const x = Math.min(pixels.width - 1, Math.max(0, px))
          const y = Math.min(pixels.height - 1, Math.max(0, py))
          const i = (y * pixels.width + x) * 4
          if (data[i + 3] < 255) continue
          brightness.push((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255)
        }
      }
      opaque += brightness.length
      if (brightness.length >= MIN_LATTICE_SAMPLES) values[row * FEATURE_COLS + col] = median(brightness)
    }
  }
  const samples = FEATURE_COLS * FEATURE_ROWS * LATTICE.length * LATTICE.length
  return { values, position: Float32Array.from(values), confidence: opaque / samples }
}

/** Linear interpolation between the closest ranks (the usual "type 7" percentile) of an ascending list. */
function percentile(sorted: number[], p: number): number {
  const rank = (sorted.length - 1) * p
  const low = Math.floor(rank)
  const high = Math.ceil(rank)
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low)
}

/** The cell centre of the first cell, in row-major order, that holds `value`, as fractions of the whole image. */
function placeOf(values: Float32Array, value: number, area: MapArea): Place {
  const cell = values.findIndex(v => v === value)
  const col = cell % FEATURE_COLS
  const row = (cell - col) / FEATURE_COLS
  return {
    value,
    x: area.x0 + ((col + 0.5) / FEATURE_COLS) * (area.x1 - area.x0),
    y: area.y0 + ((row + 0.5) / FEATURE_ROWS) * (area.y1 - area.y0),
  }
}

/**
 * Reads one frame. `previous` is the features of the frame before it in the same stream (omit it for the first frame): it gives the motion,
 * the hot-spot ids and the reference. A `previous` of the other mode is ignored, as its numbers mean something else.
 * Throws "The baseline image must be the same size as the frame." for a baseline picture of another size.
 */
export function extractFeatures(pixels: Pixels, input: ExtractInput, previous?: FrameFeatures): FrameFeatures {
  const { mapping, area, mode } = input
  const before = previous && previous.mode === mode && previous.grid.cols === FEATURE_COLS && previous.grid.rows === FEATURE_ROWS ? previous : undefined
  if (mode === 'data' && input.baseline?.pixels && (input.baseline.pixels.width !== pixels.width || input.baseline.pixels.height !== pixels.height)) {
    throw new Error('The baseline image must be the same size as the frame.')
  }

  // 1. The grid.
  const { values, position, confidence } = mode === 'data' ? readData(pixels, input) : readPicture(pixels, input)
  const cells = values.length
  // Picture mode ignores the legend.
  const stops = input.colorScale.stops
  const first = mode === 'data' ? stops[0].value : 0
  const span = mode === 'data' ? stops[stops.length - 1].value - first : 0

  // 2. Stats, over the readable cells.
  const readable: number[] = []
  for (const v of values) if (!Number.isNaN(v)) readable.push(v)
  const validShare = readable.length / cells
  const trusted = readable.length > 0 && validShare >= mapping.minValidFraction
  const sorted = trusted ? [...readable].sort((a, b) => a - b) : []
  const middle = trusted ? median(readable) : null
  const stats: FrameFeatures['stats'] = {
    validShare,
    median: middle,
    position: middle === null ? null : mode === 'data' ? positionOf(middle, first, span) : middle,
    iqr: trusted ? percentile(sorted, 0.75) - percentile(sorted, 0.25) : null,
    min: trusted ? placeOf(values, sorted[0], area) : null,
    max: trusted ? placeOf(values, sorted[sorted.length - 1], area) : null,
  }

  // 3. Histogram, and the band of each cell for the hot spots (data mode: the coolest and the warmest category; picture mode: the dark and the bright cells).
  const categoryIndex = new Map(mapping.categories.map((c, i) => [c.id, i]))
  const last = mapping.categories.length - 1
  const histogram = new Array<number>(mode === 'data' ? mapping.categories.length : PICTURE_BANDS).fill(0)
  const bandIndexOf = (cell: number) => mode === 'data'
    ? (categoryIndex.get(stepFor(values[cell], mapping.categories)) ?? 0)
    : Math.min(PICTURE_BANDS - 1, Math.floor(position[cell] * PICTURE_BANDS))
  for (let cell = 0; cell < cells; cell++) if (!Number.isNaN(values[cell])) histogram[bandIndexOf(cell)]++
  if (readable.length) for (let i = 0; i < histogram.length; i++) histogram[i] /= readable.length

  const bandOf = (cell: number): Band | null => {
    if (mode === 'data') {
      const index = bandIndexOf(cell)
      return index === last ? 'high' : index === 0 ? 'low' : null
    }
    return position[cell] >= BRIGHTNESS_HIGH ? 'high' : position[cell] <= BRIGHTNESS_LOW ? 'low' : null
  }

  // 4. Hot spots, followed from the previous frame.
  const grid = { cols: FEATURE_COLS, rows: FEATURE_ROWS, values, position }
  const serial = before ? Math.max(before.hotspotSerial ?? 0, highestSerial(before.hotspots)) : 0
  const hotspots = trackHotspots(before?.hotspots ?? [], findHotspots(grid, area, bandOf), { serial, aspect: pixels.height / pixels.width })

  // 5. Edges.
  // The cells are Float32, so the level is too: a cell exactly at the median must count as at the level, not just under it.
  const edges = edgeSummary(grid, area, stats.position === null ? null : Math.fround(stats.position))

  // 6. Motion: needs a previous frame with something readable in it.
  const motion: Motion | null = before && before.stats.validShare > 0
    ? estimateMotion(before.grid.position, position, FEATURE_COLS, FEATURE_ROWS)
    : null

  // 7. Change from the baseline. Only data mode has values to subtract, and the steps are the data set's own.
  let change: FrameFeatures['change'] = null
  const steps = mapping.changeSteps
  if (mode === 'data' && input.baseline && steps) {
    const scale = { ...input.colorScale, maxColorDistance: input.colorScale.maxColorDistance * (input.colourTolerance ?? 1) }
    const frameField: ValueField = { cols: FEATURE_COLS, rows: FEATURE_ROWS, area, values }
    const baselineField = input.baseline.pixels ? readField(input.baseline.pixels, scale, area, FEATURE_COLS, FEATURE_ROWS) : null
    const summary = summarizeChange(changeField(frameField, baselineField, input.baseline.noiseFloor), {
      minValidFraction: mapping.minValidFraction, changeSteps: steps, contourLevels: [],
    })
    const index = steps.findIndex(s => s.id === summary.step)
    const half = (steps.length - 1) / 2
    change = { ...summary, shift: index < 0 ? null : half === 0 ? 0 : (index - half) / half }
  }

  // 8. The reference: the first readable position of this run of frames.
  const reference = before?.reference ?? before?.stats.position ?? stats.position

  return {
    frameId: input.frameId,
    date: input.date,
    mode,
    grid: { cols: FEATURE_COLS, rows: FEATURE_ROWS, values, position },
    stats,
    histogram,
    hotspots,
    edges,
    motion,
    change,
    reference,
    confidence,
    hotspotSerial: Math.max(serial, highestSerial(hotspots)),
  }
}

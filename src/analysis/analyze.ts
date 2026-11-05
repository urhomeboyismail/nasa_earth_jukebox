// Pure frame analysis (docs/PLAN.md §5.2): read the region's pixels, turn each into a value on NASA's
// color scale, take the median, and name its category. No DOM, so it runs in a worker or a test.

import type { CategoryId, ColorScale, Frame, MapArea, Region, RGB, SoundMapping } from '../data'
import type { FrameAnalysis, FrameGrid, GridCell } from '.'
import { stepFor } from './change'
import { median } from './median'
import type { ChangeMapping } from './types'

/** The shape of `ImageData`: RGBA bytes, row by row. */
export type Pixels = { data: ArrayLike<number>; width: number; height: number }

/** How close to a `noData` color a pixel must be to be skipped (absorbs anti-aliasing and compression). */
export const NO_DATA_DISTANCE = 10

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Closest point on the scale's line through its stops, as a value and its distance from the pixel. */
// A color equally near two parts of the line (a legend that comes back on itself, such as red at both ends) goes to the part
// listed first in `stops`: a later part must be strictly nearer to win. The answer is the same every time.
function matchScale(rgb: RGB, stops: ColorScale['stops']): { value: number; distance: number } | null {
  let best: { value: number; distance: number } | null = null
  const consider = (value: number, d: number) => {
    if (!best || d < best.distance) best = { value, distance: d }
  }
  if (stops.length === 1) consider(stops[0].value, distance(rgb, stops[0].rgb))
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    const segment = [b.rgb[0] - a.rgb[0], b.rgb[1] - a.rgb[1], b.rgb[2] - a.rgb[2]]
    const lengthSquared = segment[0] ** 2 + segment[1] ** 2 + segment[2] ** 2
    const along = lengthSquared === 0
      ? 0
      : ((rgb[0] - a.rgb[0]) * segment[0] + (rgb[1] - a.rgb[1]) * segment[1] + (rgb[2] - a.rgb[2]) * segment[2]) / lengthSquared
    const t = Math.min(1, Math.max(0, along))
    const nearest: RGB = [a.rgb[0] + segment[0] * t, a.rgb[1] + segment[1] * t, a.rgb[2] + segment[2] * t]
    consider(a.value + (b.value - a.value) * t, distance(rgb, nearest))
  }
  return best
}

/** The category whose range holds `value`. A value on a shared edge goes to the warmer one; values outside every range go to the nearest end. */
function categoryFor(value: number, mapping: SoundMapping): string {
  const { categories } = mapping
  const found = categories.find(c => value >= c.range[0] && value < c.range[1])
  if (found) return found.id
  return (value < categories[0].range[0] ? categories[0] : categories[categories.length - 1]).id
}

/**
 * The value at one pixel of the image, or null when it cannot be read: not fully opaque (a soft edge or a hole), no-data
 * (grey land, cloud) or a color too far from the scale. Both `analyzePixels` and the grid read pixels through this, so a cell and a region never disagree.
 */
export function valueAtPixel(pixels: Pixels, px: number, py: number, colorScale: ColorScale): number | null {
  const { data, width, height } = pixels
  const x = Math.min(width - 1, Math.max(0, px))
  const y = Math.min(height - 1, Math.max(0, py))
  const i = (y * width + x) * 4
  if (data[i + 3] < 255) return null
  const rgb: RGB = [data[i], data[i + 1], data[i + 2]]
  if (colorScale.noData.some(c => distance(rgb, c) <= NO_DATA_DISTANCE)) return null
  const match = matchScale(rgb, colorScale.stops)
  if (!match || match.distance > colorScale.maxColorDistance) return null
  return match.value
}

/** Fraction of the values in each category, for every category (zero included). */
function sharesOf(values: number[], mapping: SoundMapping): Record<CategoryId, number> {
  const counts = Object.fromEntries(mapping.categories.map(c => [c.id, 0])) as Record<CategoryId, number>
  for (const value of values) counts[categoryFor(value, mapping)]++
  for (const id of Object.keys(counts)) counts[id] /= values.length
  return counts
}

/** What `analyzePixels` needs to add a change step (v2): the frame's normal as pixels (null for an anomaly product) and the steps. */
export type RegionChangeInput = { baseline: Pixels | null; noiseFloor: number; changeSteps: ChangeMapping['changeSteps'] }

export function analyzePixels(pixels: Pixels, frame: Frame, region: Region, colorScale: ColorScale, mapping: SoundMapping, change?: RegionChangeInput): FrameAnalysis {
  const { width, height } = pixels
  const values: number[] = []
  const changes: number[] = []

  for (const point of region.points) {
    const px = Math.floor(point.x * width)
    const py = Math.floor(point.y * height)
    const value = valueAtPixel(pixels, px, py, colorScale)
    if (value !== null) values.push(value)
    if (change && value !== null) {
      // A point counts towards the change only when the frame and its baseline can both be read there.
      const normal = change.baseline ? valueAtPixel(change.baseline, px, py, colorScale) : 0
      if (normal !== null) {
        const diff = value - normal
        changes.push(change.baseline && Math.abs(diff) < change.noiseFloor ? 0 : diff)
      }
    }
  }

  const sampled = region.points.length
  const valid = values.length
  const base = { frameId: frame.id, regionId: region.id, sampled, valid }
  const changed = change ? changeOf(changes, sampled, mapping.minValidFraction, change.changeSteps) : {}
  if (!valid || valid / sampled < mapping.minValidFraction) return { ...base, ...changed, category: 'insufficient' }

  const medianValue = median(values)
  return { ...base, ...changed, medianValue, category: categoryFor(medianValue, mapping), shares: sharesOf(values, mapping) }
}

function changeOf(changes: number[], sampled: number, minValidFraction: number, steps: ChangeMapping['changeSteps']) {
  if (!changes.length || changes.length / sampled < minValidFraction) return { changeStep: 'insufficient' as const }
  const medianChange = median(changes)
  return { changeStep: stepFor(medianChange, steps), medianChange }
}

export const GRID_COLS = 24
const MIN_ROWS = 6
const MAX_ROWS = 16
/** Where in a cell, as fractions of its width and height, the 3 × 3 lattice of samples sits. */
const LATTICE = [1 / 6, 1 / 2, 5 / 6]

const WHOLE_IMAGE: MapArea = { x0: 0, y0: 0, x1: 1, y1: 1 }

/** The grid's rows, kept near-square cells: 24 columns across the area, between 6 and 16 rows. */
export function gridRows(widthPx: number, heightPx: number, area: MapArea = WHOLE_IMAGE): number {
  const rows = Math.round((GRID_COLS * (area.y1 - area.y0) * heightPx) / ((area.x1 - area.x0) * widthPx))
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows))
}

/** The map as a grid of cells, row-major, row 0 at the top. A cell with too few readable samples has no value, never a low one. */
export function gridFromPixels(pixels: Pixels, frame: Frame, colorScale: ColorScale, mapping: SoundMapping, area: MapArea = WHOLE_IMAGE): FrameGrid {
  const { width, height } = pixels
  const cols = GRID_COLS
  const rows = gridRows(width, height, area)
  const cells: GridCell[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const values: number[] = []
      for (const fy of LATTICE) {
        for (const fx of LATTICE) {
          const x = area.x0 + ((col + fx) / cols) * (area.x1 - area.x0)
          const y = area.y0 + ((row + fy) / rows) * (area.y1 - area.y0)
          const value = valueAtPixel(pixels, Math.floor(x * width), Math.floor(y * height), colorScale)
          if (value !== null) values.push(value)
        }
      }
      if (!values.length || values.length / (LATTICE.length ** 2) < mapping.minValidFraction) {
        cells.push({ value: null, category: 'insufficient' })
      } else {
        const value = median(values)
        cells.push({ value, category: categoryFor(value, mapping) })
      }
    }
  }
  return { frameId: frame.id, cols, rows, area, cells }
}

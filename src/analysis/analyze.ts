// Pure frame analysis (docs/PLAN.md §5.2): read the region's pixels, turn each into a value on NASA's
// color scale, take the median, and name its category. No DOM, so it runs in a worker or a test.

import type { ColorScale, Frame, Region, RGB, SoundMapping } from '../data'
import type { FrameAnalysis } from '.'

/** The shape of `ImageData`: RGBA bytes, row by row. */
export type Pixels = { data: ArrayLike<number>; width: number; height: number }

/** How close to a `noData` color a pixel must be to be skipped (absorbs anti-aliasing and compression). */
export const NO_DATA_DISTANCE = 10

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** Closest point on the scale's line through its stops, as a value and its distance from the pixel. */
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** The category whose range holds `value`. A value on a shared edge goes to the warmer one; values outside every range go to the nearest end. */
function categoryFor(value: number, mapping: SoundMapping): string {
  const { categories } = mapping
  const found = categories.find(c => value >= c.range[0] && value < c.range[1])
  if (found) return found.id
  return (value < categories[0].range[0] ? categories[0] : categories[categories.length - 1]).id
}

export function analyzePixels(pixels: Pixels, frame: Frame, region: Region, colorScale: ColorScale, mapping: SoundMapping): FrameAnalysis {
  const { data, width, height } = pixels
  const values: number[] = []

  for (const point of region.points) {
    const x = Math.min(width - 1, Math.max(0, Math.floor(point.x * width)))
    const y = Math.min(height - 1, Math.max(0, Math.floor(point.y * height)))
    const i = (y * width + x) * 4
    if (data[i + 3] === 0) continue
    const rgb: RGB = [data[i], data[i + 1], data[i + 2]]
    if (colorScale.noData.some(c => distance(rgb, c) <= NO_DATA_DISTANCE)) continue
    const match = matchScale(rgb, colorScale.stops)
    if (!match || match.distance > colorScale.maxColorDistance) continue
    values.push(match.value)
  }

  const sampled = region.points.length
  const valid = values.length
  const base = { frameId: frame.id, regionId: region.id, sampled, valid }
  if (!valid || valid / sampled < mapping.minValidFraction) return { ...base, category: 'insufficient' }

  const medianValue = median(values)
  return { ...base, medianValue, category: categoryFor(medianValue, mapping) }
}

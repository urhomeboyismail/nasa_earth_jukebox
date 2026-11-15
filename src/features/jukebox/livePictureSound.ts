// G12: Echo's live pictures become music through the app's own pipeline: pixels → extractFeatures → toMusicFrame (the Listen page's rules).
// The browser knows only two kinds of legend: "data" (colours decode back to values through the stops) or "picture" (brightness).
// Nothing here names a collection: the server sends the legend, and the words below come from its kind and unit only.

import type { Pixels } from '../../analysis/analyze'
import { extractFeatures, type ExtractInput, type FrameFeatures } from '../../analysis/features'
import { readPixels } from '../../analysis/pixels'
import type { Category, ColorScale } from '../../data'
import { formatDate } from '../../dates'
import { presetFor, toMusicFrame, type MusicFrame } from '../../sonify'
import type { ImageLegend, LiveImage, LivePictures } from './mascotQuery'

/** One picture, and one frame of music, every STEP_MS while playing. Slow enough that nothing flashes. */
export const STEP_MS = 2000
const CATEGORIES = 5
/** The style the pictures play in. The same object every time, so the ensemble is made once. */
export const LIVE_PRESET = presetFor('major')
/** A picture that did not load is read as nothing at all: a dropout, the existing cue. */
const UNREADABLE: Pixels = { data: new Uint8ClampedArray(4), width: 1, height: 1 }
/** Picture mode ignores the colour bar, but the input type still needs one. */
const PLACEHOLDER_SCALE: ColorScale = { stops: [{ value: 0, rgb: [0, 0, 0] }, { value: 1, rgb: [255, 255, 255] }], noData: [], maxColorDistance: 40 }

/** Five equal bands over [low, high], coolest first. Only the ranges are read (the histogram and the hot spots). */
function categoriesOver(low: number, high: number, unit: string): Category[] {
  const width = (high - low) / CATEGORIES
  const round = (value: number) => Math.round(value * 10) / 10
  return Array.from({ length: CATEGORIES }, (_, i) => {
    const range: [number, number] = [low + i * width, i === CATEGORIES - 1 ? high : low + (i + 1) * width]
    return { id: `band-${i + 1}`, label: `${round(range[0])} to ${round(range[1])}${unit ? ` ${unit}` : ''}`, range, note: 'C4' }
  })
}

/** The parts of an ExtractInput that come from the legend. The area is the whole picture: the server crops it to the place asked for. */
export function visualizationInputFor(legend: ImageLegend): Omit<ExtractInput, 'frameId' | 'date'> {
  const data = legend.kind === 'data'
  const stops = data ? legend.stops : PLACEHOLDER_SCALE.stops
  return {
    mode: legend.kind,
    colorScale: data ? { stops, noData: [], maxColorDistance: 40 } : PLACEHOLDER_SCALE,
    mapping: {
      scale: 'linear',
      summary: 'median',
      // A coast is mostly land, and land is transparent.
      minValidFraction: 0.3,
      categories: categoriesOver(stops[0].value, stops[stops.length - 1].value, data ? legend.unit : ''),
      tick: { note: 'C5', durationMs: 100 },
      missingCue: { type: 'noise', durationMs: 300 },
    },
    area: { x0: 0, y0: 0, x1: 1, y1: 1 },
  }
}

export type LiveFrame = { frame: MusicFrame; loaded: boolean }

/**
 * One frame of music per picture, in order, each read with the frame before it (motion, hot-spot ids, melody smoothing). The pictures load
 * together; a picture that fails is a dropout frame and `loaded: false`. Pure apart from `load`, so the same pictures always give the same music.
 */
export async function musicFramesFor(images: LiveImage[], legend: ImageLegend, load: (url: string) => Promise<Pixels> = readPixels): Promise<LiveFrame[]> {
  const input = visualizationInputFor(legend)
  const pixels = await Promise.allSettled(images.map(image => load(image.url)))
  const out: LiveFrame[] = []
  let features: FrameFeatures | undefined
  let frame: MusicFrame | null = null
  images.forEach((image, i) => {
    const read = pixels[i]
    features = extractFeatures(read.status === 'fulfilled' ? read.value : UNREADABLE, { ...input, frameId: `live-${i + 1}`, date: image.date }, features)
    frame = toMusicFrame(features, LIVE_PRESET, frame)
    out.push({ frame, loaded: read.status === 'fulfilled' })
  })
  return out
}

const degrees = (value: number) => `${Math.round(value * 100) / 100}°`

/** The alt text, from a template only (ADR-0005): what kind of picture, its date, and its area. */
export function altFor(pictures: Pick<LivePictures, 'legend' | 'area'>, date: string): string {
  const { legend, area: [west, south, east, north] } = pictures
  const label = legend.kind === 'data' ? `Map of values in ${legend.unit}` : 'Satellite picture'
  return `${label} on ${formatDate(date)}, ${degrees(west)} to ${degrees(east)}, ${degrees(south)} to ${degrees(north)}.`
}

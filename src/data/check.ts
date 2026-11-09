// The checks behind `npm run check-data` (docs/archive/PRE-HACKATHON-TICKETS.md, T89). Pure: the files are read through a callback, so
// check.test.ts can feed it bad input. datasets.test.ts runs it on every data set in public/data/index.json. Each problem names
// the file and the field, so a person adding a real data set knows what to fix. Nothing in the app imports this file.

import { valueAtPixel } from '../analysis/analyze'
import { decodePng } from '../analysis/png'
import type { ColorScale, Visualization } from './types'

export type Problem = { file: string; field: string; message: string }

/** One problem as a line: `public/data/x/manifest.json: frames.1.width: ...`. */
export const describeProblem = ({ file, field, message }: Problem) => `${file}: ${field}: ${message}`

/** How far a legend stop's own colour may read from the stop's value. */
export const ROUND_TRIP_TOLERANCE = 0.01

/** A baseline image is read at no more than about this many pixels, spread evenly, so the check stays quick on large frames. */
const BASELINE_SAMPLES = 40_000

/**
 * How much the value can move for one step of colour: the largest change in value per unit of RGB distance along any legend segment.
 * Two pixels whose colours differ by one step can read as values this far apart, so a change smaller than this is legend rounding.
 */
export function legendRounding(stops: ColorScale['stops']): number {
  let worst = 0
  for (let i = 1; i < stops.length; i++) {
    const [a, b] = [stops[i - 1], stops[i]]
    const length = Math.hypot(b.rgb[0] - a.rgb[0], b.rgb[1] - a.rgb[1], b.rgb[2] - a.rgb[2])
    if (length > 0) worst = Math.max(worst, Math.abs(b.value - a.value) / length)
  }
  return worst
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Reads a PNG's header only: size, bit depth, colour type and interlacing. Returns a message when it is not a PNG we can read. */
function readHeader(bytes: Uint8Array): { width: number; height: number } | string {
  if (bytes.length < 29 || !SIGNATURE.every((b, i) => bytes[i] === b)) return 'is not a PNG file'
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const [depth, colorType, , , interlace] = bytes.subarray(24, 29)
  if (depth !== 8) return `is a ${depth}-bit PNG; only 8-bit PNGs can be read`
  if (colorType !== 2 && colorType !== 6) return `has PNG colour type ${colorType}; only RGB (2) and RGBA (6) can be read, so re-save it as a plain RGB PNG`
  if (interlace !== 0) return 'is an interlaced PNG; save it without interlacing'
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** Every string in the value that still contains TODO, with its field path. */
function todoFields(value: unknown, path: string[] = []): { field: string; text: string }[] {
  if (typeof value === 'string') return value.includes('TODO') ? [{ field: path.join('.'), text: value }] : []
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, inner]) => todoFields(inner, [...path, key]))
  return []
}

/** The problems with a catalog entry (a row of public/data/index.json) that a schema cannot see. */
export function checkCatalogEntry(entry: unknown): Problem[] {
  return todoFields(entry).map(({ field, text }) => ({
    file: 'public/data/index.json',
    field,
    message: `still contains TODO ("${text}"); replace it with the real text`,
  }))
}

/**
 * The checks a schema cannot make: the image files, the order of the frames, the legend against the analysis, the categories
 * against the legend and any TODO left behind. `readImage` returns the bytes of a frame's `image` path (relative to the data set)
 * and throws when the file is not there.
 */
export function checkDataset(v: Visualization, readImage: (image: string) => Uint8Array): Problem[] {
  const file = `public/data/${v.id}/manifest.json`
  const problems: Problem[] = []
  const problem = (field: string, message: string) => problems.push({ file, field, message })

  v.frames.forEach((frame, i) => {
    let bytes: Uint8Array
    try {
      bytes = readImage(frame.image)
    } catch {
      problem(`frames.${i}.image`, `there is no file "${frame.image}" in public/data/${v.id}/`)
      return
    }
    const header = readHeader(bytes)
    if (typeof header === 'string') return problem(`frames.${i}.image`, `"${frame.image}" ${header}`)
    if (header.width !== frame.width) problem(`frames.${i}.width`, `is ${frame.width} but "${frame.image}" is ${header.width} pixels wide`)
    if (header.height !== frame.height) problem(`frames.${i}.height`, `is ${frame.height} but "${frame.image}" is ${header.height} pixels high`)
  })

  v.frames.forEach((frame, i) => {
    const before = v.frames[i - 1]
    if (!before) return
    if (frame.date === before.date) problem(`frames.${i}.date`, `${frame.date} is used twice (also by "${before.id}"); each date appears once`)
    else if (frame.date < before.date) problem(`frames.${i}.date`, `${frame.date} is earlier than ${before.date} in "${before.id}"; frames go in date order, oldest first`)
  })

  const { stops, noData } = v.colorScale
  stops.forEach((stop, i) => {
    const read = valueAtPixel({ data: [...stop.rgb, 255], width: 1, height: 1 }, 0, 0, v.colorScale)
    if (read === null) {
      problem(`colorScale.stops.${i}`, `the stop's own colour [${stop.rgb}] is read as missing data (too close to a noData colour, or further than maxColorDistance from the legend)`)
    } else if (Math.abs(read - stop.value) > ROUND_TRIP_TOLERANCE) {
      problem(`colorScale.stops.${i}.rgb`, `[${stop.rgb}] reads as ${read}, not the stop's value ${stop.value}; the legend and the analysis disagree`)
    }
  })

  noData.forEach((rgb, i) => {
    const onLine = valueAtPixel({ data: [...rgb, 255], width: 1, height: 1 }, 0, 0, { ...v.colorScale, noData: [] })
    if (onLine !== null) {
      problem(`colorScale.noData.${i}`, `[${rgb}] lies within maxColorDistance (${v.colorScale.maxColorDistance}) of the legend's colour line, at value ${Number(onLine.toFixed(2))}; land or labels a little off this colour would be read as a value`)
    }
  })

  const first = v.mapping.categories[0]
  const last = v.mapping.categories[v.mapping.categories.length - 1]
  if (first.range[0] > stops[0].value) {
    problem('mapping.categories.0.range', `starts at ${first.range[0]}, above the legend's lowest value ${stops[0].value}; the categories must cover the whole legend`)
  }
  if (last.range[1] < stops[stops.length - 1].value) {
    problem(`mapping.categories.${v.mapping.categories.length - 1}.range`, `ends at ${last.range[1]}, below the legend's highest value ${stops[stops.length - 1].value}; the categories must cover the whole legend`)
  }

  for (const { field, text } of todoFields(v)) problem(field, `still contains TODO ("${text}"); replace it with the real text from the source`)

  checkBaseline(v, readImage, problem)

  return problems
}

/** The v2 checks on the baseline (docs/PLAN.md §5.1): the legend, the noise floor and each frame's own normal. A baseline image of another size is rejected, never resampled. */
function checkBaseline(v: Visualization, readImage: (image: string) => Uint8Array, problem: (field: string, message: string) => void) {
  const base = v.baseline
  if (!base) return
  const { stops } = v.colorScale

  if (base.kind === 'anomaly-product') {
    if (!(stops[0].value < 0 && stops[stops.length - 1].value > 0)) {
      problem('colorScale.stops', `run from ${stops[0].value} to ${stops[stops.length - 1].value}, which does not span both signs; an anomaly product shows a change from normal, so its legend must go below and above 0. If the legend shows a temperature, use a climatology or a reference date`)
    }
    return
  }

  const rounding = legendRounding(stops)
  if (base.noiseFloor < 2 * rounding) {
    problem('baseline.noiseFloor', `is ${base.noiseFloor} but must be at least ${Number((2 * rounding).toPrecision(2))}, twice the legend's rounding (${Number(rounding.toPrecision(2))} ${v.variable.unit} per colour step); a smaller floor would turn legend rounding into change`)
  }
  if (base.kind !== 'climatology') return

  const area = v.mapArea ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
  v.frames.forEach((frame, i) => {
    const field = `frames.${i}.baselineImage`
    const name = frame.baselineImage
    if (!name) return // the schema reports a frame with no baselineImage
    let bytes: Uint8Array
    try {
      bytes = readImage(name)
    } catch {
      return problem(field, `there is no file "${name}" in public/data/${v.id}/`)
    }
    const header = readHeader(bytes)
    if (typeof header === 'string') return problem(field, `"${name}" ${header}`)
    if (header.width !== frame.width || header.height !== frame.height) {
      return problem(field, `"${name}" is ${header.width} x ${header.height} pixels but frame "${frame.id}" is ${frame.width} x ${frame.height}; a baseline must be exactly the same size as its frame (it is never resampled), so make it again at the frame's size`)
    }
    let pixels
    try {
      pixels = decodePng(bytes)
    } catch (error) {
      return problem(field, `"${name}" could not be read: ${error instanceof Error ? error.message : String(error)}`)
    }
    const [x0, x1] = [Math.floor(area.x0 * header.width), Math.ceil(area.x1 * header.width)]
    const [y0, y1] = [Math.floor(area.y0 * header.height), Math.ceil(area.y1 * header.height)]
    const stride = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / BASELINE_SAMPLES)))
    let sampled = 0
    let read = 0
    for (let y = y0; y < y1; y += stride) {
      for (let x = x0; x < x1; x += stride) {
        sampled++
        if (valueAtPixel(pixels, x, y, v.colorScale) !== null) read++
      }
    }
    const share = sampled ? read / sampled : 0
    if (share < v.mapping.minValidFraction) {
      problem(field, `only ${Math.round(share * 100)}% of the map area in "${name}" reads through the legend, but at least ${Math.round(v.mapping.minValidFraction * 100)}% is needed; it may use a different legend or a different map area from its frame`)
    }
  })
}

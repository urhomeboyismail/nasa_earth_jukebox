// Known answers (docs/tickets/D04-known-answer-check.md): points where NASA's own number is known, kept in public/data/<id>/known-answers.json,
// and the check that the frame's picture, read through the legend with the app's own valueAtPixel, gives that number within the legend's rounding.
// The numbers come from a person reading the NASA source, never from the picture or from memory, so every check names its source.

import { z } from 'zod'
import { valueAtPixel, type Pixels } from '../analysis/analyze'
import { legendRounding } from './check'
import type { ColorScale, MapArea, Visualization } from './types'

const nonEmpty = z.string().min(1, 'must not be empty')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date written YYYY-MM-DD')
const lat = z.number().min(-90, 'must be between -90 and 90').max(90, 'must be between -90 and 90')
const lon = z.number().min(-180, 'must be between -180 and 180').max(180, 'must be between -180 and 180')
const fraction = z.number().min(0, 'must be between 0 and 1').max(1, 'must be between 0 and 1')

/** An equirectangular map: its extent in degrees. */
const boundsMap = z
  .object({ projection: z.literal('equirectangular'), west: lon, east: lon, north: lat, south: lat })
  .strict()
  .superRefine((m, ctx) => {
    if (m.east <= m.west) ctx.addIssue({ code: 'custom', path: ['east'], message: `must be east of west (${m.west})` })
    if (m.north <= m.south) ctx.addIssue({ code: 'custom', path: ['north'], message: `must be north of south (${m.south})` })
  })

/** Any other map: at least 4 points whose place in the image (fractions of the whole image) is known, fitted bilinearly. */
const controlMap = z
  .object({
    projection: z.literal('other'),
    control: z.array(z.object({ lat, lon, x: fraction, y: fraction }).strict()).min(4, 'needs at least 4 control points'),
  })
  .strict()
  .superRefine((m, ctx) => {
    if (m.control.length >= 4 && !fitControl(m.control)) {
      ctx.addIssue({ code: 'custom', path: ['control'], message: 'cannot be fitted: the points must spread over the map, not lie on one line' })
    }
  })

const source = z
  .object({ dataset: nonEmpty, variable: nonEmpty, time: nonEmpty, url: nonEmpty, retrievedOn: isoDate })
  .strict()

const knownCheck = z
  .object({
    frameId: nonEmpty,
    lat,
    lon,
    /** NASA's number, in the data set's unit. */
    value: z.number(),
    unit: z.string(),
    /** How many decimals NASA's number has. */
    decimals: z.number().int('must be a whole number').min(0, 'must be 0 or more'),
    /** Extra allowed difference, same unit. Only with a reason; the default 0 leaves the legend's rounding as the limit. */
    tolerance: z.number().min(0, 'must be 0 or more').optional(),
    source,
  })
  .strict()

export const knownAnswersSchema = z
  .object({
    id: nonEmpty,
    map: z.discriminatedUnion('projection', [boundsMap, controlMap], { error: 'needs "projection": "equirectangular" (with west, east, north, south) or "other" (with control)' }),
    checks: z.array(knownCheck).min(5, 'needs at least 5 checks, spread across the map'),
  })
  .strict()

export type KnownAnswers = z.infer<typeof knownAnswersSchema>
export type KnownCheck = KnownAnswers['checks'][number]
export type KnownMap = KnownAnswers['map']
type ControlPoint = { lat: number; lon: number; x: number; y: number }

/** The largest honest difference: the legend's rounding (check.ts `legendRounding`) or the check's tolerance, whichever is larger. */
export function allowedError(stops: ColorScale['stops'], check: { tolerance?: number }): number {
  return Math.max(legendRounding(stops), check.tolerance ?? 0)
}

/** Least-squares fit of x and y as a + b·lon + c·lat + d·lon·lat. Null when the points do not pin the four terms down. */
export function fitControl(points: ControlPoint[]): { x: number[]; y: number[] } | null {
  const rows = points.map(p => [1, p.lon, p.lat, p.lon * p.lat])
  const solve = (target: number[]) => {
    // Normal equations (AᵀA) c = Aᵀt, by Gaussian elimination with partial pivoting.
    const m = [0, 1, 2, 3].map(i => [...[0, 1, 2, 3].map(j => rows.reduce((s, r) => s + r[i] * r[j], 0)), rows.reduce((s, r, k) => s + r[i] * target[k], 0)])
    const scale = Math.max(...m.map(r => Math.max(...r.slice(0, 4).map(Math.abs))))
    for (let col = 0; col < 4; col++) {
      const pivot = m.slice(col).reduce((best, r, k) => (Math.abs(r[col]) > Math.abs(m[best][col]) ? col + k : best), col)
      if (Math.abs(m[pivot][col]) <= 1e-12 * scale) return null
      ;[m[col], m[pivot]] = [m[pivot], m[col]]
      for (let r = 0; r < 4; r++) {
        if (r === col) continue
        const f = m[r][col] / m[col][col]
        for (let c = col; c < 5; c++) m[r][c] -= f * m[col][c]
      }
    }
    return m.map((r, i) => r[4] / r[i])
  }
  const x = solve(points.map(p => p.x))
  const y = solve(points.map(p => p.y))
  return x && y ? { x, y } : null
}

/**
 * Where a check sits in the image, as fractions 0 to 1 of the whole image. An equirectangular map covers `area` (the data set's `mapArea`,
 * or the whole image); control points already give places in the whole image. A point outside the map gives a value outside 0 to 1.
 */
export function pointOf(check: { lat: number; lon: number }, map: KnownMap, area: MapArea = { x0: 0, y0: 0, x1: 1, y1: 1 }): { x: number; y: number } {
  if (map.projection === 'equirectangular') {
    const fx = (check.lon - map.west) / (map.east - map.west)
    const fy = (map.north - check.lat) / (map.north - map.south)
    return { x: area.x0 + fx * (area.x1 - area.x0), y: area.y0 + fy * (area.y1 - area.y0) }
  }
  const fit = fitControl(map.control)
  if (!fit) return { x: NaN, y: NaN }
  const terms = [1, check.lon, check.lat, check.lon * check.lat]
  const at = (c: number[]) => c.reduce((s, ci, i) => s + ci * terms[i], 0)
  return { x: at(fit.x), y: at(fit.y) }
}

/**
 * Every check of a data set against its pictures, as one line per failure (empty when all pass). `readFrame` returns a frame image's pixels
 * (its path relative to the data set) and throws when the file is not there.
 */
export function checkKnownAnswers(
  file: KnownAnswers,
  v: Pick<Visualization, 'id' | 'frames' | 'colorScale' | 'mapArea'>,
  readFrame: (image: string) => Pixels,
): string[] {
  if (file.id !== v.id) return [`${v.id}: known-answers.json says "id": "${file.id}"; it must be "${v.id}", the data set it sits in`]
  const pictures = new Map<string, Pixels>()
  return file.checks.flatMap(check => {
    const at = `${v.id} ${check.frameId} at ${check.lat}, ${check.lon}`
    const frame = v.frames.find(f => f.id === check.frameId)
    if (!frame) return [`${at}: there is no frame "${check.frameId}" in the data set`]
    const { x, y } = pointOf(check, file.map, v.mapArea)
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return [`${at}: the point is outside the map; check "map" and the latitude and longitude`]
    let pixels = pictures.get(frame.image)
    if (!pixels) pictures.set(frame.image, (pixels = readFrame(frame.image)))
    const px = Math.min(pixels.width - 1, Math.floor(x * pixels.width))
    const py = Math.min(pixels.height - 1, Math.floor(y * pixels.height))
    const read = valueAtPixel(pixels, px, py, v.colorScale)
    if (read === null) return [`${at}: cannot be read: the point is on land, cloud, a label or off the legend; move the point`]
    const allowed = allowedError(v.colorScale.stops, check)
    if (Math.abs(read - check.value) <= allowed) return []
    const unit = check.unit ? ` ${check.unit}` : ''
    return [
      `${at}: NASA's number is ${check.value.toFixed(check.decimals)}${unit}, the picture reads ${Number(read.toFixed(check.decimals + 2))}${unit} `
        + `(allowed ${Number(allowed.toPrecision(3))}). Check the point and the legend.`,
    ]
  })
}

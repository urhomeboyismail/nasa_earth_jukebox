// Zod schemas for the content data (docs/PLAN.md §5.1). They must describe exactly the types in
// types.ts; schema.test.ts fails to compile if the two drift apart.

import { z } from 'zod'

const rgb = z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)])
const fraction = z.number().min(0).max(1)
const nonEmpty = z.string().min(1, 'must not be empty')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date written YYYY-MM-DD')

/** Category edges are written by hand or by a converter, so two numbers that differ only by rounding count as equal. */
const RANGE_EDGE_TOLERANCE = 1e-9

const colorScale = z.object({
  stops: z.array(z.object({ value: z.number(), rgb })).min(2, 'needs at least two stops'),
  noData: z.array(rgb),
  maxColorDistance: z.number().positive(),
})

const region = z.object({
  id: nonEmpty,
  name: nonEmpty,
  description: z.string(),
  points: z.array(z.object({ x: fraction, y: fraction })).min(1, 'needs at least one point'),
})

const frame = z.object({
  id: nonEmpty,
  date: isoDate,
  image: nonEmpty,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  altText: nonEmpty,
  note: z.string().optional(),
})

const category = z.object({
  id: nonEmpty,
  label: nonEmpty,
  range: z.tuple([z.number(), z.number()]),
  note: nonEmpty,
})

const mapping = z.object({
  scale: nonEmpty,
  summary: z.literal('median'),
  minValidFraction: fraction,
  categories: z.array(category).min(1, 'needs at least one category'),
  tick: z.object({ note: nonEmpty, durationMs: z.number().positive() }),
  missingCue: z.object({ type: z.literal('noise', { error: 'missing data must play the noise hiss, never a note' }), durationMs: z.number().positive() }),
})

const comparison = z.object({
  id: nonEmpty,
  regionId: nonEmpty,
  frameA: nonEmpty,
  frameB: nonEmpty,
  question: nonEmpty,
  answer: z.enum(['a', 'b', 'same']),
  explanation: nonEmpty,
})

const mapFraction = z.number().min(0, 'must be between 0 and 1').max(1, 'must be between 0 and 1')
const mapArea = z.object({ x0: mapFraction, y0: mapFraction, x1: mapFraction, y1: mapFraction })
const storyChapter = z.object({ id: nonEmpty, title: nonEmpty, text: nonEmpty, fromFrame: nonEmpty, toFrame: nonEmpty })

export const visualizationSchema = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    summary: z.string(),
    description: z.string(),
    variable: z.object({ name: nonEmpty, unit: z.string() }),
    source: z.object({
      name: nonEmpty,
      /** Empty for synthetic data, which has no web page. */
      url: z.string(),
      credit: nonEmpty,
      license: nonEmpty,
      retrievedOn: z.string(),
    }),
    colorScale,
    regions: z.array(region).min(1, 'needs at least one region'),
    frames: z.array(frame).min(1, 'needs at least one frame'),
    mapping,
    comparisons: z.array(comparison),
    mapArea: mapArea.optional(),
    story: z.array(storyChapter).optional(),
  })
  .superRefine((data, ctx) => {
    const problem = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

    data.colorScale.stops.forEach((stop, i, stops) => {
      if (i > 0 && stop.value <= stops[i - 1].value) {
        problem(['colorScale', 'stops', i, 'value'], `must be higher than the stop before it (${stops[i - 1].value}); stops go in order of value`)
      }
    })

    data.mapping.categories.forEach((c, i, categories) => {
      const [low, high] = c.range
      if (low >= high) problem(['mapping', 'categories', i, 'range'], `"${c.id}" must run from a lower to a higher value, not ${low} to ${high}`)
      const before = categories[i - 1]
      if (before && low < before.range[1]) {
        problem(['mapping', 'categories', i, 'range'], `"${c.id}" starts at ${low}, inside "${before.id}" (which ends at ${before.range[1]}); categories go coolest first without overlapping`)
      } else if (before && low > before.range[1] + RANGE_EDGE_TOLERANCE) {
        // categoryFor (src/analysis/analyze.ts) would send a value in the gap to the coolest or warmest category.
        problem(['mapping', 'categories', i, 'range'], `"${c.id}" starts at ${low} but "${before.id}" ends at ${before.range[1]}; each category starts where the one before it ends, with no gap`)
      }
    })

    const unique = (ids: string[], path: string, label: string) =>
      ids.forEach((id, i) => ids.indexOf(id) !== i && problem([path, i, 'id'], `${label} id "${id}" is used more than once`))
    unique(data.frames.map(f => f.id), 'frames', 'frame')
    unique(data.regions.map(r => r.id), 'regions', 'region')
    unique(data.mapping.categories.map(c => c.id), 'mapping.categories', 'category')
    unique(data.comparisons.map(c => c.id), 'comparisons', 'comparison')
    unique((data.story ?? []).map(c => c.id), 'story', 'chapter')

    if (data.mapArea) {
      const { x0, y0, x1, y1 } = data.mapArea
      if (x1 <= x0) problem(['mapArea', 'x1'], `must be greater than x0 (${x0}); the area runs from west to east`)
      if (y1 <= y0) problem(['mapArea', 'y1'], `must be greater than y0 (${y0}); the area runs from north to south`)
    }

    const frameIds = new Set(data.frames.map(f => f.id))
    const regionIds = new Set(data.regions.map(r => r.id))
    data.comparisons.forEach((c, i) => {
      if (!frameIds.has(c.frameA)) problem(['comparisons', i, 'frameA'], `there is no frame "${c.frameA}"`)
      if (!frameIds.has(c.frameB)) problem(['comparisons', i, 'frameB'], `there is no frame "${c.frameB}"`)
      if (!regionIds.has(c.regionId)) problem(['comparisons', i, 'regionId'], `there is no region "${c.regionId}"`)
      // Compare and the listening test analyse regions[0] only (until T98), so a comparison elsewhere would play the wrong place.
      else if (c.regionId !== data.regions[0].id) {
        problem(['comparisons', i, 'regionId'], `is "${c.regionId}" but must be "${data.regions[0].id}", the first region, because Compare and the listening test use the first region only`)
      }
    })

    const dateOf = new Map(data.frames.map(f => [f.id, f.date]))
    data.story?.forEach((chapter, i) => {
      if (!frameIds.has(chapter.fromFrame)) problem(['story', i, 'fromFrame'], `there is no frame "${chapter.fromFrame}"`)
      if (!frameIds.has(chapter.toFrame)) problem(['story', i, 'toFrame'], `there is no frame "${chapter.toFrame}"`)
      const [from, to] = [dateOf.get(chapter.fromFrame), dateOf.get(chapter.toFrame)]
      if (from && to && to < from) {
        problem(['story', i, 'toFrame'], `"${chapter.toFrame}" (${to}) is earlier than "${chapter.fromFrame}" (${from}); a chapter runs forward in time`)
      }
    })
  })

export const catalogSchema = z.array(z.object({ id: nonEmpty, title: nonEmpty, summary: z.string() }))

/** The first few problems as one readable line, each with the field it is about, e.g. "frames.0.width: ...". */
export function describeIssues(error: z.ZodError, limit = 3): string {
  const lines = error.issues.slice(0, limit).map(issue => {
    const field = issue.path.join('.')
    return field ? `${field}: ${issue.message}` : issue.message
  })
  const more = error.issues.length - limit
  return lines.join('; ') + (more > 0 ? `; and ${more} more` : '')
}

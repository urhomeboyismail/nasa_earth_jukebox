// Zod schemas for the content data (docs/PLAN.md §5.1). They must describe exactly the types in
// types.ts; schema.test.ts fails to compile if the two drift apart.

import { z } from 'zod'

const rgb = z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)])
const fraction = z.number().min(0).max(1)
const nonEmpty = z.string().min(1, 'must not be empty')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date written YYYY-MM-DD')

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
  missingCue: z.object({ type: z.enum(['noise', 'note']), durationMs: z.number().positive() }),
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
      if (i > 0 && low < categories[i - 1].range[1]) {
        problem(['mapping', 'categories', i, 'range'], `"${c.id}" starts at ${low}, inside "${categories[i - 1].id}" (which ends at ${categories[i - 1].range[1]}); categories go coolest first without overlapping`)
      }
    })

    const unique = (ids: string[], path: string, label: string) =>
      ids.forEach((id, i) => ids.indexOf(id) !== i && problem([path, i, 'id'], `${label} id "${id}" is used more than once`))
    unique(data.frames.map(f => f.id), 'frames', 'frame')
    unique(data.regions.map(r => r.id), 'regions', 'region')
    unique(data.mapping.categories.map(c => c.id), 'mapping.categories', 'category')
    unique(data.comparisons.map(c => c.id), 'comparisons', 'comparison')

    const frameIds = new Set(data.frames.map(f => f.id))
    const regionIds = new Set(data.regions.map(r => r.id))
    data.comparisons.forEach((c, i) => {
      if (!frameIds.has(c.frameA)) problem(['comparisons', i, 'frameA'], `there is no frame "${c.frameA}"`)
      if (!frameIds.has(c.frameB)) problem(['comparisons', i, 'frameB'], `there is no frame "${c.frameB}"`)
      if (!regionIds.has(c.regionId)) problem(['comparisons', i, 'regionId'], `there is no region "${c.regionId}"`)
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

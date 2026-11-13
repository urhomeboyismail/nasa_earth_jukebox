// Zod schemas for the content data (docs/PLAN.md §5.1). They must describe exactly the types in
// types.ts; schema.test.ts fails to compile if the two drift apart.

import { Note } from 'tonal'
import { z } from 'zod'
import { DETAIL_LEVELS, PRESET_IDS, VOICE_IDS } from './sonification'
import { dayNumber, videoFrameOf } from './video'

const rgb = z.tuple([z.number().min(0).max(255), z.number().min(0).max(255), z.number().min(0).max(255)])
const fraction = z.number().min(0).max(1)
const nonEmpty = z.string().min(1, 'must not be empty')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date written YYYY-MM-DD')

/** Category edges are written by hand or by a converter, so two numbers that differ only by rounding count as equal. */
const RANGE_EDGE_TOLERANCE = 1e-9

/** The v2 note limits, the same as BED_* and CONTOUR_* in src/audio/changeVoice.ts (data must not import audio). A manifest the schema accepts cannot make the engine throw. */
const BED_NOTES = ['C3', 'C4'] as const
const CONTOUR_NOTES = ['C3', 'C6'] as const

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
  baselineImage: nonEmpty.optional(),
})

const category = z.object({
  id: nonEmpty,
  label: nonEmpty,
  range: z.tuple([z.number(), z.number()]),
  note: nonEmpty,
})

const changeStep = z.object({
  id: nonEmpty,
  label: nonEmpty,
  range: z.tuple([z.number(), z.number()]),
  note: nonEmpty,
})

const contourLevel = z.object({ value: z.number(), note: nonEmpty })

const baseline = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('anomaly-product') }),
  z.object({ kind: z.literal('climatology'), label: nonEmpty, noiseFloor: z.number().positive('must be above 0') }),
  z.object({ kind: z.literal('reference-date'), frameId: nonEmpty, label: nonEmpty, noiseFloor: z.number().positive('must be above 0') }),
])

const mapping = z.object({
  scale: nonEmpty,
  summary: z.literal('median'),
  minValidFraction: fraction,
  categories: z.array(category).min(1, 'needs at least one category'),
  tick: z.object({ note: nonEmpty, durationMs: z.number().positive() }),
  missingCue: z.object({ type: z.literal('noise', { error: 'missing data must play the noise hiss, never a note' }), durationMs: z.number().positive() }),
  changeSteps: z.array(changeStep).min(2, 'needs at least two steps').optional(),
  contourLevels: z.array(contourLevel).min(1, 'needs at least one level').optional(),
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

// v3 (SN05). `video` and `sonification` are strict, so a typo inside them is reported instead of dropped.
const legend = z.enum(['data', 'picture'], { error: 'must be "data" or "picture"' })
const video = z
  .object({
    src: nonEmpty,
    fps: z.number().positive('must be above 0').max(60, 'must be 60 or less'),
    firstFrameDate: isoDate,
    frameStepDays: z.number().int('must be a whole number of days').min(1, 'must be 1 or more'),
  })
  .strict()
const sonification = z
  .object({
    preset: z.enum(PRESET_IDS, { error: `must be one of ${PRESET_IDS.join(', ')}` }),
    detail: z.enum(DETAIL_LEVELS, { error: `must be one of ${DETAIL_LEVELS.join(', ')}` }).optional(),
    voices: z.array(z.enum(VOICE_IDS, { error: `must be one of ${VOICE_IDS.join(', ')}` })).min(1, 'needs at least one voice; leave it out to use all seven').optional(),
  })
  .strict()

// JB04: Echo's look for this data set. Strict like `sonification`, so a misspelt field is reported.
const MASCOT_TRAILS = ['sparks', 'bubbles', 'ions', 'pulse'] as const
const mascot = z
  .object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a colour written #rrggbb, for example "#00ffcc"').optional(),
    trail: z.enum(MASCOT_TRAILS, { error: `must be one of ${MASCOT_TRAILS.join(', ')}` }).optional(),
  })
  .strict()

// Fusion (blueprint §3.2): the data sets this one may be heard together with in Compare, and why the pairing is honest. Strict, like `mascot`.
const pairsWith = z.array(z.object({ id: nonEmpty, note: nonEmpty }).strict())

export const visualizationSchema = z
  .object({
    id: nonEmpty,
    title: nonEmpty,
    summary: z.string(),
    description: z.string(),
    variable: z.object({
      name: nonEmpty,
      unit: z.string(),
      words: z.object({ higher: nonEmpty, lower: nonEmpty, highest: nonEmpty, lowest: nonEmpty, edge: nonEmpty, thing: z.string() }).partial().strict().optional(),
    }),
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
    baseline: baseline.optional(),
    legend: legend.optional(),
    video: video.optional(),
    sonification: sonification.optional(),
    mascot: mascot.optional(),
    pairsWith: pairsWith.optional(),
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

    checkChange(data, problem)
    checkV3(data, problem)
  })

type Issue = (path: (string | number)[], message: string) => void
type ChangeFields = {
  baseline?: z.infer<typeof baseline>
  frames: { id: string; baselineImage?: string }[]
  mapping: { changeSteps?: z.infer<typeof changeStep>[]; contourLevels?: z.infer<typeof contourLevel>[] }
}

/** The v2 rules (docs/PLAN.md §5.1, "Baseline rules"). All three of `baseline`, `changeSteps` and `contourLevels`, or none, and each part consistent. */
function checkChange(data: ChangeFields, problem: Issue) {
  const { baseline: base, mapping: map, frames } = data
  const given = [
    ['baseline', !!base],
    ['mapping.changeSteps', !!map.changeSteps],
    ['mapping.contourLevels', !!map.contourLevels],
  ] as const
  const missing = given.filter(([, present]) => !present).map(([name]) => name)
  if (missing.length > 0 && missing.length < given.length) {
    const present = given.filter(([, p]) => p).map(([name]) => name)
    problem(missing[0].split('.'), `${present.join(' and ')} ${present.length > 1 ? 'are' : 'is'} given, so ${missing.join(' and ')} must be too; the change style needs all three, or none`)
  }

  // Which frames carry a baselineImage must agree with the kind of baseline.
  const withImage = frames.map((f, i) => [f, i] as const).filter(([f]) => f.baselineImage)
  if (!base) {
    withImage.forEach(([, i]) => problem(['frames', i, 'baselineImage'], 'is given but the data set has no baseline; add a baseline or remove the image'))
  } else if (base.kind === 'climatology') {
    frames.forEach((f, i) => !f.baselineImage && problem(['frames', i, 'baselineImage'], `is missing; a climatology baseline needs each frame's own normal, here for "${f.id}"`))
  } else if (base.kind === 'reference-date') {
    if (!frames.some(f => f.id === base.frameId)) problem(['baseline', 'frameId'], `there is no frame "${base.frameId}"`)
    withImage.forEach(([, i]) => problem(['frames', i, 'baselineImage'], 'is given but a reference-date baseline is another frame; remove the image'))
  } else {
    withImage.forEach(([, i]) => problem(['frames', i, 'baselineImage'], 'is given but an anomaly product already is the change; remove the image'))
  }

  const midi = (note: string) => Note.midi(note) as number | null
  const [bedLow, bedHigh] = BED_NOTES.map(n => midi(n)!)
  const [contourLow, contourHigh] = CONTOUR_NOTES.map(n => midi(n)!)

  let previousNote = -Infinity
  map.changeSteps?.forEach((step, i, steps) => {
    const [low, high] = step.range
    if (low >= high) problem(['mapping', 'changeSteps', i, 'range'], `"${step.id}" must run from a lower to a higher change, not ${low} to ${high}`)
    const before = steps[i - 1]
    if (before && low < before.range[1]) {
      problem(['mapping', 'changeSteps', i, 'range'], `"${step.id}" starts at ${low}, inside "${before.id}" (which ends at ${before.range[1]}); steps go from most below normal up without overlapping`)
    } else if (before && low > before.range[1] + RANGE_EDGE_TOLERANCE) {
      problem(['mapping', 'changeSteps', i, 'range'], `"${step.id}" starts at ${low} but "${before.id}" ends at ${before.range[1]}; each step starts where the one before it ends, with no gap`)
    }
    if (steps.findIndex(s => s.id === step.id) !== i) problem(['mapping', 'changeSteps', i, 'id'], `step id "${step.id}" is used more than once`)
    const m = midi(step.note)
    if (m === null) problem(['mapping', 'changeSteps', i, 'note'], `"${step.note}" is not a note name such as C3`)
    else {
      if (m < bedLow || m > bedHigh) problem(['mapping', 'changeSteps', i, 'note'], `${step.note} must be between ${BED_NOTES[0]} and ${BED_NOTES[1]}, the register of the change bed`)
      if (m <= previousNote) problem(['mapping', 'changeSteps', i, 'note'], `${step.note} must sound higher than the step before it, because pitch means further above normal`)
      previousNote = m
    }
  })

  map.contourLevels?.forEach((level, i, levels) => {
    if (i > 0 && level.value <= levels[i - 1].value) problem(['mapping', 'contourLevels', i, 'value'], `must be higher than the level before it (${levels[i - 1].value}); levels go lowest first`)
    const m = midi(level.note)
    if (m === null) problem(['mapping', 'contourLevels', i, 'note'], `"${level.note}" is not a note name such as C5`)
    else if (m < contourLow || m > contourHigh) problem(['mapping', 'contourLevels', i, 'note'], `${level.note} must be between ${CONTOUR_NOTES[0]} and ${CONTOUR_NOTES[1]}`)
  })
}

/** The v3 rules (SN05): every frame's date on the video's grid, and no voice named twice. */
function checkV3(data: { frames: { date: string }[]; video?: z.infer<typeof video>; sonification?: z.infer<typeof sonification> }, problem: Issue) {
  data.sonification?.voices?.forEach((voice, i, voices) => {
    if (voices.indexOf(voice) !== i) problem(['sonification', 'voices', i], `"${voice}" is listed more than once; name each voice once`)
  })

  const spec = data.video
  // A step that is not a whole number of 1 or more is already reported on video.frameStepDays; there is no grid to check against.
  if (!spec || !Number.isInteger(spec.frameStepDays) || spec.frameStepDays < 1) return
  const first = dayNumber(spec.firstFrameDate)
  if (first === null) return problem(['video', 'firstFrameDate'], `${spec.firstFrameDate} is not a real date`)
  const apart = `${spec.frameStepDays} ${spec.frameStepDays === 1 ? 'day' : 'days'} apart`
  data.frames.forEach((frame, i) => {
    const day = dayNumber(frame.date)
    if (day === null || videoFrameOf(spec, frame.date) !== null) return
    if (day < first) problem(['frames', i, 'date'], `${frame.date} is before the video's first frame (${spec.firstFrameDate}); every dated frame must be in the video`)
    else problem(['frames', i, 'date'], `${frame.date} is not on the video's grid: the first video frame is ${spec.firstFrameDate} and frames are ${apart}`)
  })
}

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

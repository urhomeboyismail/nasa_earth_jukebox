import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import fixture from '../../public/data/fixture/manifest.json'
import globe from '../../public/data/synthetic-globe/manifest.json'
import synthetic from '../../public/data/synthetic-ocean/manifest.json'
import catalogJson from '../../public/data/index.json'
import { catalogSchema, describeIssues, visualizationSchema } from './schema'
import type { CatalogEntry, Visualization } from './types'

// If either of these stops compiling, schema.ts and types.ts have drifted apart (`npm run build` catches it).
expectTypeOf<z.infer<typeof visualizationSchema>>().toEqualTypeOf<Visualization>()
expectTypeOf<z.infer<typeof catalogSchema>>().toEqualTypeOf<CatalogEntry[]>()

const valid = () => structuredClone(fixture) as unknown as Visualization

/** Runs a change on a copy of the valid manifest and returns the error text the loader would show. */
function errorAfter(change: (v: any) => void): string {
  const v: any = valid()
  change(v)
  const result = visualizationSchema.safeParse(v)
  expect(result.success).toBe(false)
  return result.success ? '' : describeIssues(result.error, 10)
}

describe('visualizationSchema', () => {
  it('accepts the fixture manifest', () => {
    expect(visualizationSchema.safeParse(valid()).success).toBe(true)
  })

  it('names the field when a value has the wrong type', () => {
    expect(errorAfter(v => { v.frames[0].width = 'wide' })).toMatch(/^frames\.0\.width: /)
  })

  it('names the field when something is missing', () => {
    expect(errorAfter(v => { delete v.colorScale })).toMatch(/colorScale: /)
  })

  it('rejects color stops that are out of order', () => {
    expect(errorAfter(v => { v.colorScale.stops[2].value = 5 })).toBe(
      'colorScale.stops.2.value: must be higher than the stop before it (15); stops go in order of value',
    )
  })

  it('rejects overlapping category ranges', () => {
    expect(errorAfter(v => { v.mapping.categories[1].range = [4, 12] })).toMatch(
      /mapping\.categories\.1\.range: "cool" starts at 4, inside "cold" \(which ends at 6\)/,
    )
  })

  it('rejects a gap between category ranges, because a value in it would be sent to the coolest or warmest category', () => {
    expect(errorAfter(v => { v.mapping.categories[2].range = [14, 18] })).toBe(
      'mapping.categories.2.range: "mild" starts at 14 but "cool" ends at 12; each category starts where the one before it ends, with no gap',
    )
  })

  it('does not call a rounding difference in a category edge a gap', () => {
    const v: any = valid()
    v.mapping.categories[1].range = [6 + 1e-12, 12]
    expect(visualizationSchema.safeParse(v).success).toBe(true)
  })

  it('rejects categories that are not coolest first', () => {
    expect(errorAfter(v => v.mapping.categories.reverse())).toMatch(/mapping\.categories\.\d\.range: /)
  })

  it('rejects an empty or backwards category range', () => {
    expect(errorAfter(v => { v.mapping.categories[0].range = [6, 6] })).toMatch(/"cold" must run from a lower to a higher value/)
  })

  it('rejects a comparison that names a frame or region that does not exist', () => {
    expect(errorAfter(v => { v.comparisons[0].frameA = 'nope' })).toBe('comparisons.0.frameA: there is no frame "nope"')
    expect(errorAfter(v => { v.comparisons[0].frameB = 'nope' })).toBe('comparisons.0.frameB: there is no frame "nope"')
    expect(errorAfter(v => { v.comparisons[0].regionId = 'nope' })).toBe('comparisons.0.regionId: there is no region "nope"')
  })

  it('accepts a comparison in a region other than the first (F48)', () => {
    const v: any = valid()
    v.regions.push({ ...v.regions[0], id: 'second' })
    v.comparisons[0].regionId = 'second'
    expect(visualizationSchema.safeParse(v).success).toBe(true)
  })

  it('still rejects a comparison that names a region the data set does not have, when there are two', () => {
    expect(errorAfter(v => {
      v.regions.push({ ...v.regions[0], id: 'second' })
      v.comparisons[0].regionId = 'third'
    })).toBe('comparisons.0.regionId: there is no region "third"')
  })

  it('rejects region points outside the image', () => {
    expect(errorAfter(v => { v.regions[0].points[0].x = 1.2 })).toMatch(/^regions\.0\.points\.0\.x: /)
    expect(errorAfter(v => { v.regions[0].points[1].y = -0.1 })).toMatch(/^regions\.0\.points\.1\.y: /)
  })

  it('rejects ids used twice', () => {
    expect(errorAfter(v => { v.frames[1].id = v.frames[0].id })).toMatch(/frames\.1\.id: frame id ".*" is used more than once/)
  })

  it('rejects a date that is not YYYY-MM-DD, an unknown answer and a note that is too long a name', () => {
    expect(errorAfter(v => { v.frames[0].date = '15 January 2024' })).toMatch(/frames\.0\.date: must be a date/)
    expect(errorAfter(v => { v.comparisons[0].answer = 'maybe' })).toMatch(/^comparisons\.0\.answer: /)
  })

  it('rejects a missing-data cue that is a note: missing data is a hiss, never a low note', () => {
    expect(errorAfter(v => { v.mapping.missingCue.type = 'note' })).toMatch(/^mapping\.missingCue\.type: missing data must play the noise hiss, never a note/)
  })

  it('accepts the committed manifests, each with the noise cue', () => {
    for (const manifest of [fixture, synthetic, globe]) {
      const result = visualizationSchema.safeParse(manifest)
      expect(result.success ? '' : describeIssues(result.error, 10)).toBe('')
      expect(result.data?.mapping.missingCue.type).toBe('noise')
    }
  })

  it('rejects colors outside 0 to 255', () => {
    expect(errorAfter(v => { v.colorScale.stops[0].rgb = [0, 0, 300] })).toMatch(/^colorScale\.stops\.0\.rgb\.2: /)
  })

  it('summarises a long list of problems', () => {
    const text = errorAfter(v => { v.frames.forEach((f: any) => { f.width = 'x' }); v.frames.push({ ...v.frames[0], id: 'extra' }) })
    expect(text).toContain('frames.0.width')
  })
})

describe('the manifest template (scripts/templates/manifest.template.json)', () => {
  const template: unknown = JSON.parse(readFileSync(resolve(fileURLToPath(import.meta.url), '../../../scripts/templates/manifest.template.json'), 'utf8'))

  it('is a valid manifest, so it cannot go stale', () => {
    const result = visualizationSchema.safeParse(template)
    expect(result.success ? '' : describeIssues(result.error, 10)).toBe('')
  })

  it('has the five standard categories with C4 E4 G4 C5 E5 and the noise cue', () => {
    const v = visualizationSchema.parse(template)
    expect(v.mapping.categories.map(c => c.note)).toEqual(['C4', 'E4', 'G4', 'C5', 'E5'])
    expect(v.mapping.missingCue.type).toBe('noise')
    expect(v.frames).toHaveLength(1)
  })

  it('marks every field a person fills in with TODO', () => {
    const v = visualizationSchema.parse(template)
    for (const text of [v.title, v.summary, v.description, v.variable.name, v.source.name, v.source.url, v.source.credit, v.source.license, v.source.retrievedOn, v.regions[0].name, v.frames[0].altText]) {
      expect(text).toContain('TODO')
    }
  })
})

describe('describeIssues', () => {
  it('shows three problems and counts the rest', () => {
    const v: any = valid()
    v.frames.forEach((f: any) => { f.width = 'x'; f.height = 'y' })
    const result = visualizationSchema.safeParse(v)
    expect(result.success ? '' : describeIssues(result.error)).toMatch(/; and \d+ more$/)
  })
})

// Every file under public/data, found at build time, so a new dataset is checked without editing this test.
const manifests = import.meta.glob<unknown>('../../public/data/*/manifest.json', { eager: true, import: 'default' })
const files = Object.keys(import.meta.glob('../../public/data/**/*', { query: '?url' }))

describe('the datasets in public/data', () => {
  const catalog: CatalogEntry[] = catalogJson

  it('lists only valid catalog entries', () => {
    expect(catalogSchema.safeParse(catalog).success).toBe(true)
  })

  it('has a manifest for every catalog entry', () => {
    expect(catalog.length).toBeGreaterThan(0)
    for (const { id } of catalog) expect(manifests[`../../public/data/${id}/manifest.json`], id).toBeDefined()
  })

  for (const { id } of catalogJson) {
    it(`${id} validates and its images exist`, () => {
      const manifest = manifests[`../../public/data/${id}/manifest.json`] as Visualization
      const result = visualizationSchema.safeParse(manifest)
      expect(result.success ? '' : describeIssues(result.error)).toBe('')
      expect(manifest.id).toBe(id)
      for (const frame of manifest.frames) expect(files, frame.image).toContain(`../../public/data/${id}/${frame.image}`)
    })
  }
})

describe('visualizationSchema: map area and story', () => {
  const withBoth = (v: any) => {
    v.mapArea = { x0: 0, y0: 0, x1: 1, y1: 0.88 }
    v.story = [
      { id: 'start', title: 'The start', text: 'It begins.', fromFrame: v.frames[0].id, toFrame: v.frames[1].id },
      { id: 'later', title: 'Later', text: 'It changes.', fromFrame: v.frames[1].id, toFrame: v.frames[3].id },
    ]
  }

  it('accepts a map area and a story', () => {
    const v: any = valid()
    withBoth(v)
    expect(visualizationSchema.safeParse(v).success).toBe(true)
  })

  it('accepts a chapter that covers one date', () => {
    const v: any = valid()
    v.story = [{ id: 'one', title: 'One date', text: 'Just this.', fromFrame: v.frames[2].id, toFrame: v.frames[2].id }]
    expect(visualizationSchema.safeParse(v).success).toBe(true)
  })

  it('rejects a map area outside the picture', () => {
    expect(errorAfter(v => { v.mapArea = { x0: 0, y0: 0, x1: 1.2, y1: 1 } })).toBe('mapArea.x1: must be between 0 and 1')
    expect(errorAfter(v => { v.mapArea = { x0: -0.1, y0: 0, x1: 1, y1: 1 } })).toBe('mapArea.x0: must be between 0 and 1')
  })

  it('rejects a map area with no width or height, or running the wrong way', () => {
    expect(errorAfter(v => { v.mapArea = { x0: 0.5, y0: 0, x1: 0.5, y1: 1 } })).toBe(
      'mapArea.x1: must be greater than x0 (0.5); the area runs from west to east',
    )
    expect(errorAfter(v => { v.mapArea = { x0: 0, y0: 0.9, x1: 1, y1: 0.2 } })).toBe(
      'mapArea.y1: must be greater than y0 (0.9); the area runs from north to south',
    )
  })

  it('rejects a chapter that names a frame that is not there', () => {
    expect(errorAfter(v => { withBoth(v); v.story[1].toFrame = 'nope' })).toBe('story.1.toFrame: there is no frame "nope"')
    expect(errorAfter(v => { withBoth(v); v.story[0].fromFrame = 'gone' })).toBe('story.0.fromFrame: there is no frame "gone"')
  })

  it('rejects a chapter that runs backwards in time', () => {
    const message = errorAfter(v => { withBoth(v); v.story[1].fromFrame = v.frames[3].id; v.story[1].toFrame = v.frames[1].id })
    expect(message).toMatch(/^story\.1\.toFrame: ".*" \(2024-07-15\) is earlier than ".*" \(2025-03-15\); a chapter runs forward in time$/)
  })

  it('rejects two chapters with the same id, and a chapter with no text', () => {
    expect(errorAfter(v => { withBoth(v); v.story[1].id = 'start' })).toBe('story.1.id: chapter id "start" is used more than once')
    expect(errorAfter(v => { withBoth(v); v.story[0].text = '' })).toMatch(/^story\.0\.text: /)
  })
})

// ---- Baselines (v2, T111) ----

/** The five change steps, most below normal first. Finite outer edges, because JSON cannot hold Infinity. */
const steps = () => [
  { id: 'much-below', label: 'Much below normal', range: [-50, -1], note: 'C3' },
  { id: 'below', label: 'Below normal', range: [-1, -0.25], note: 'E3' },
  { id: 'normal', label: 'Near normal', range: [-0.25, 0.25], note: 'G3' },
  { id: 'above', label: 'Above normal', range: [0.25, 1], note: 'A3' },
  { id: 'much-above', label: 'Much above normal', range: [1, 50], note: 'C4' },
]
const levels = () => [{ value: 1, note: 'C5' }, { value: 2, note: 'G5' }]

/** The fixture with a complete baseline of the given kind: `baseline`, `changeSteps`, `contourLevels`, and the images that kind needs. */
function withChange(v: any, kind: 'climatology' | 'reference-date' | 'anomaly-product' = 'climatology') {
  v.mapping.changeSteps = steps()
  v.mapping.contourLevels = levels()
  if (kind === 'climatology') {
    v.baseline = { kind, label: 'the made-up normal for each month', noiseFloor: 0.2 }
    v.frames.forEach((f: any) => { f.baselineImage = `baselines/${f.date}.png` })
  } else if (kind === 'reference-date') {
    v.baseline = { kind, frameId: v.frames[0].id, label: 'January 2024', noiseFloor: 0.2 }
  } else {
    v.baseline = { kind }
  }
}

describe('baselines (v2)', () => {
  it('accepts every kind of baseline when the three fields come together', () => {
    for (const kind of ['climatology', 'reference-date', 'anomaly-product'] as const) {
      const v: any = valid()
      withChange(v, kind)
      expect(describeIssues((visualizationSchema.safeParse(v) as any).error ?? { issues: [] }), kind).toBe('')
    }
  })

  it('still accepts every manifest that has none of the new fields', () => {
    for (const manifest of [fixture, synthetic, globe]) expect(visualizationSchema.safeParse(manifest).success).toBe(true)
    expect(visualizationSchema.parse(fixture)).not.toHaveProperty('baseline')
  })

  it('wants baseline, changeSteps and contourLevels together, and says which is missing', () => {
    expect(errorAfter(v => { v.baseline = { kind: 'anomaly-product' } })).toBe(
      'mapping.changeSteps: baseline is given, so mapping.changeSteps and mapping.contourLevels must be too; the change style needs all three, or none',
    )
    expect(errorAfter(v => { v.mapping.changeSteps = steps() })).toBe(
      'baseline: mapping.changeSteps is given, so baseline and mapping.contourLevels must be too; the change style needs all three, or none',
    )
    expect(errorAfter(v => { v.mapping.contourLevels = levels(); v.baseline = { kind: 'anomaly-product' } })).toBe(
      'mapping.changeSteps: baseline and mapping.contourLevels are given, so mapping.changeSteps must be too; the change style needs all three, or none',
    )
  })

  it('rejects an unknown kind, and a baseline with no label or a noise floor of zero', () => {
    expect(errorAfter(v => { withChange(v); v.baseline.kind = 'average' })).toMatch(/^baseline/)
    expect(errorAfter(v => { withChange(v); v.baseline.label = '' })).toMatch(/^baseline\.label: /)
    expect(errorAfter(v => { withChange(v); v.baseline.noiseFloor = 0 })).toBe('baseline.noiseFloor: must be above 0')
  })

  it('needs a baselineImage on every frame for a climatology, and names the frame without one', () => {
    expect(errorAfter(v => { withChange(v); delete v.frames[2].baselineImage })).toBe(
      `frames.2.baselineImage: is missing; a climatology baseline needs each frame's own normal, here for "${valid().frames[2].id}"`,
    )
  })

  it('wants a reference-date to name a real frame, and no baselineImage on any frame', () => {
    expect(errorAfter(v => { withChange(v, 'reference-date'); v.baseline.frameId = 'nope' })).toBe('baseline.frameId: there is no frame "nope"')
    expect(errorAfter(v => { withChange(v, 'reference-date'); v.frames[1].baselineImage = 'x.png' })).toBe(
      'frames.1.baselineImage: is given but a reference-date baseline is another frame; remove the image',
    )
  })

  it('wants no baselineImage for an anomaly product, or for a data set with no baseline', () => {
    expect(errorAfter(v => { withChange(v, 'anomaly-product'); v.frames[0].baselineImage = 'x.png' })).toBe(
      'frames.0.baselineImage: is given but an anomaly product already is the change; remove the image',
    )
    expect(errorAfter(v => { v.frames[3].baselineImage = 'x.png' })).toBe(
      'frames.3.baselineImage: is given but the data set has no baseline; add a baseline or remove the image',
    )
  })

  it('needs change steps that run from most below normal up, with no gap and no overlap', () => {
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[2].range = [-0.5, 0.25] })).toBe(
      'mapping.changeSteps.2.range: "normal" starts at -0.5, inside "below" (which ends at -0.25); steps go from most below normal up without overlapping',
    )
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[3].range = [0.5, 1] })).toBe(
      'mapping.changeSteps.3.range: "above" starts at 0.5 but "normal" ends at 0.25; each step starts where the one before it ends, with no gap',
    )
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[1].range = [-0.25, -1] })).toMatch(/^mapping\.changeSteps\.1\.range: "below" must run from a lower to a higher change/)
  })

  it('needs change step ids that are different, and at least two steps', () => {
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[4].id = 'normal' })).toBe('mapping.changeSteps.4.id: step id "normal" is used more than once')
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps = [v.mapping.changeSteps[0]] })).toBe('mapping.changeSteps: needs at least two steps')
  })

  it('keeps change step notes in the bed register, C3 to C4, each higher than the one before', () => {
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[0].note = 'C2' })).toBe('mapping.changeSteps.0.note: C2 must be between C3 and C4, the register of the change bed')
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[4].note = 'D4' })).toBe('mapping.changeSteps.4.note: D4 must be between C3 and C4, the register of the change bed')
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[2].note = 'D3' })).toBe(
      'mapping.changeSteps.2.note: D3 must sound higher than the step before it, because pitch means further above normal',
    )
    expect(errorAfter(v => { withChange(v); v.mapping.changeSteps[1].note = 'loud' })).toBe('mapping.changeSteps.1.note: "loud" is not a note name such as C3')
  })

  it('keeps contour notes between C3 and C6, and the levels in rising order', () => {
    expect(errorAfter(v => { withChange(v); v.mapping.contourLevels[0].note = 'C7' })).toBe('mapping.contourLevels.0.note: C7 must be between C3 and C6')
    expect(errorAfter(v => { withChange(v); v.mapping.contourLevels[1].note = 'B2' })).toBe('mapping.contourLevels.1.note: B2 must be between C3 and C6')
    expect(errorAfter(v => { withChange(v); v.mapping.contourLevels[1].value = 1 })).toBe(
      'mapping.contourLevels.1.value: must be higher than the level before it (1); levels go lowest first',
    )
    expect(errorAfter(v => { withChange(v); v.mapping.contourLevels = [] })).toBe('mapping.contourLevels: needs at least one level')
  })
})

describe('v3 fields: legend, video and sonification (SN05)', () => {
  const video = (overrides = {}) => ({ src: 'video/fixture.mp4', fps: 12, firstFrameDate: '2024-01-15', frameStepDays: 1, ...overrides })
  const accepts = (change: (v: any) => void) => {
    const v: any = valid()
    change(v)
    const result = visualizationSchema.safeParse(v)
    expect(result.success ? '' : describeIssues(result.error, 10)).toBe('')
  }

  it('leaves every committed manifest exactly as it was: none of the three fields, so the defaults apply', () => {
    for (const manifest of [fixture, synthetic, globe]) {
      const parsed = visualizationSchema.parse(manifest)
      for (const field of ['legend', 'video', 'sonification']) expect(parsed).not.toHaveProperty(field)
    }
  })

  it('accepts a picture legend, a video on its grid and a full sonification', () => {
    accepts(v => {
      v.legend = 'picture'
      v.video = video()
      v.sonification = { preset: 'dorian', detail: 'calm', voices: ['melody', 'time'] }
    })
    accepts(v => { v.legend = 'data'; v.sonification = { preset: 'major' } })
    // The fixture's dates are 0, 182, 335 and 425 days after the first one, so a grid of 1 day holds them all.
    accepts(v => { v.video = video({ fps: 60 }) })
  })

  it('rejects an unknown legend and names the field', () => {
    expect(errorAfter(v => { v.legend = 'sepia' })).toBe('legend: must be "data" or "picture"')
  })

  it('rejects a frame date off the video grid, and names the frame', () => {
    expect(errorAfter(v => { v.video = video({ frameStepDays: 7 }) })).toBe(
      'frames.2.date: 2024-12-15 is not on the video\'s grid: the first video frame is 2024-01-15 and frames are 7 days apart; '
        + 'frames.3.date: 2025-03-15 is not on the video\'s grid: the first video frame is 2024-01-15 and frames are 7 days apart',
    )
  })

  it('rejects a video whose first frame comes after the first dated frame', () => {
    expect(errorAfter(v => { v.video = video({ firstFrameDate: '2024-02-01' }) })).toBe(
      "frames.0.date: 2024-01-15 is before the video's first frame (2024-02-01); every dated frame must be in the video",
    )
  })

  it('rejects a video with a bad date, rate or step, or a field it does not know', () => {
    expect(errorAfter(v => { v.video = video({ firstFrameDate: '2024-02-30' }) })).toBe('video.firstFrameDate: 2024-02-30 is not a real date')
    expect(errorAfter(v => { v.video = video({ fps: 0 }) })).toBe('video.fps: must be above 0')
    expect(errorAfter(v => { v.video = video({ fps: 61 }) })).toBe('video.fps: must be 60 or less')
    expect(errorAfter(v => { v.video = video({ frameStepDays: 0.5 }) })).toBe('video.frameStepDays: must be a whole number of days')
    expect(errorAfter(v => { v.video = video({ frameStepDays: 0 }) })).toBe('video.frameStepDays: must be 1 or more')
    expect(errorAfter(v => { v.video = video({ src: '' }) })).toBe('video.src: must not be empty')
    expect(errorAfter(v => { v.video = video({ frameStep: 1 }) })).toMatch(/^video: .*frameStep/)
  })

  it('rejects an unknown preset or detail, a duplicate or unknown voice, an empty voice list and a misspelt field', () => {
    expect(errorAfter(v => { v.sonification = { preset: 'jazz' } })).toBe('sonification.preset: must be one of major, dorian, pentatonic, cinematic, chiptune, lofi, bass, nature')
    expect(errorAfter(v => { v.sonification = { preset: 'major', detail: 'loud' } })).toBe('sonification.detail: must be one of calm, standard, full')
    expect(errorAfter(v => { v.sonification = { preset: 'major', voices: ['melody', 'bass', 'melody'] } })).toBe(
      'sonification.voices.2: "melody" is listed more than once; name each voice once',
    )
    expect(errorAfter(v => { v.sonification = { preset: 'major', voices: ['drums'] } })).toBe(
      'sonification.voices.0: must be one of melody, harmony, bass, hotspots, rhythm, motion, time',
    )
    expect(errorAfter(v => { v.sonification = { preset: 'major', voices: [] } })).toBe('sonification.voices: needs at least one voice; leave it out to use all seven')
    expect(errorAfter(v => { v.sonification = { preset: 'major', detial: 'calm' } })).toMatch(/^sonification: .*detial/)
  })
})

describe("Echo's look: the mascot field (JB04)", () => {
  const accepts = (change: (v: any) => void) => {
    const v: any = valid()
    change(v)
    const result = visualizationSchema.safeParse(v)
    expect(result.success ? '' : describeIssues(result.error, 10)).toBe('')
  }

  it('is optional, and the fixture has none', () => {
    expect(visualizationSchema.parse(fixture)).not.toHaveProperty('mascot')
  })

  it('accepts an accent, a trail, both or neither', () => {
    accepts(v => { v.mascot = { accent: '#00ffcc', trail: 'bubbles' } })
    accepts(v => { v.mascot = { accent: '#00F0FF' } })
    accepts(v => { v.mascot = { trail: 'pulse' } })
    accepts(v => { v.mascot = {} })
    for (const trail of ['sparks', 'bubbles', 'ions', 'pulse']) accepts(v => { v.mascot = { trail } })
  })

  it('rejects a colour that is not #rrggbb, and names the field', () => {
    const message = 'mascot.accent: must be a colour written #rrggbb, for example "#00ffcc"'
    expect(errorAfter(v => { v.mascot = { accent: 'teal' } })).toBe(message)
    expect(errorAfter(v => { v.mascot = { accent: '#0fc' } })).toBe(message)
    expect(errorAfter(v => { v.mascot = { accent: '00ffcc' } })).toBe(message)
  })

  it('rejects an unknown trail and a misspelt field', () => {
    expect(errorAfter(v => { v.mascot = { trail: 'forest' } })).toBe('mascot.trail: must be one of sparks, bubbles, ions, pulse')
    expect(errorAfter(v => { v.mascot = { acent: '#00ffcc' } })).toMatch(/^mascot: .*acent/)
  })
})

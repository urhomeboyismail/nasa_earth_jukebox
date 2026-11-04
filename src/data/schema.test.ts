import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import fixture from '../../public/data/fixture/manifest.json'
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

  it('rejects colors outside 0 to 255', () => {
    expect(errorAfter(v => { v.colorScale.stops[0].rgb = [0, 0, 300] })).toMatch(/^colorScale\.stops\.0\.rgb\.2: /)
  })

  it('summarises a long list of problems', () => {
    const text = errorAfter(v => { v.frames.forEach((f: any) => { f.width = 'x' }); v.frames.push({ ...v.frames[0], id: 'extra' }) })
    expect(text).toContain('frames.0.width')
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

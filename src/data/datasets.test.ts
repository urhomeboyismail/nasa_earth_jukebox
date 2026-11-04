import { Note } from 'tonal'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../public/data/index.json'
import { catalogSchema, describeIssues, visualizationSchema } from './schema'
import type { Visualization } from './types'

// Every data set listed in public/data/index.json, as it is on disk: the manifest, the images it names and, for the
// made-up ones, expected.json (the answers computed from the values the generator drew, never from the images).
const manifests = import.meta.glob('../../public/data/*/manifest.json', { eager: true, import: 'default' }) as Record<string, unknown>
const expectations = import.meta.glob('../../public/data/*/expected.json', { eager: true, import: 'default' }) as Record<string, Expected>
const images = Object.keys(import.meta.glob('../../public/data/*/frames/*.png'))

type Expected = { frames: { frameId: string; regionId: string; valid: number; medianValue: number | null; category: string }[] }

const catalog = catalogSchema.parse(catalogJson)
const manifestFor = (id: string) => manifests[`../../public/data/${id}/manifest.json`]
const expectedFor = (id: string) => expectations[`../../public/data/${id}/expected.json`]

describe('the data sets on disk', () => {
  it('lists each one in the catalog, and each catalog entry has a manifest', () => {
    const onDisk = Object.keys(manifests).map(path => path.split('/').at(-2)).sort()
    expect(catalog.map(entry => entry.id).sort()).toEqual(onDisk)
  })

  for (const { id } of catalog) {
    describe(id, () => {
      const parsed = visualizationSchema.safeParse(manifestFor(id))
      const v = parsed.success ? (parsed.data as Visualization) : null

      it('is a valid manifest', () => {
        expect(parsed.success ? '' : describeIssues(parsed.error, 10)).toBe('')
      })

      it('has an image on disk for every frame', () => {
        for (const frame of v!.frames) expect(images).toContain(`../../public/data/${id}/${frame.image}`)
      })

      it('uses notes that are far enough apart to tell apart, each higher than the last', () => {
        const midis = v!.mapping.categories.map(category => Note.midi(category.note)!)
        midis.forEach((midi, i) => i > 0 && expect(midi - midis[i - 1]).toBeGreaterThanOrEqual(3))
      })

      it('keeps every region point inside the map area', () => {
        const { x0, y0, x1, y1 } = v!.mapArea ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
        for (const region of v!.regions) {
          for (const point of region.points) {
            expect(point.x).toBeGreaterThanOrEqual(x0)
            expect(point.x).toBeLessThanOrEqual(x1)
            expect(point.y).toBeGreaterThanOrEqual(y0)
            expect(point.y).toBeLessThanOrEqual(y1)
          }
        }
      })

      const expected = expectedFor(id)
      if (expected) {
        it('has an expected answer for every frame and region it lists, with a value inside its category', () => {
          const frameIds = new Set(v!.frames.map(frame => frame.id))
          const regionIds = new Set(v!.regions.map(region => region.id))
          for (const entry of expected.frames) {
            expect(frameIds.has(entry.frameId)).toBe(true)
            expect(regionIds.has(entry.regionId)).toBe(true)
            if (entry.category === 'insufficient') {
              expect(entry.medianValue).toBeNull()
              continue
            }
            const category = v!.mapping.categories.find(c => c.id === entry.category)!
            expect(entry.medianValue!).toBeGreaterThanOrEqual(category.range[0])
            expect(entry.medianValue!).toBeLessThan(category.range[1])
          }
        })

        it('has comparison answers that agree with the expected categories', () => {
          const rank = (frameId: string, regionId: string) => {
            const entry = expected.frames.find(e => e.frameId === frameId && e.regionId === regionId)!
            expect(entry, `${frameId} in ${regionId}`).toBeDefined()
            return v!.mapping.categories.findIndex(c => c.id === entry.category)
          }
          for (const c of v!.comparisons) {
            const [a, b] = [rank(c.frameA, c.regionId), rank(c.frameB, c.regionId)]
            expect(a, c.id).toBeGreaterThanOrEqual(0)
            expect(b, c.id).toBeGreaterThanOrEqual(0)
            expect(c.answer, c.id).toBe(a === b ? 'same' : a > b ? 'a' : 'b')
          }
        })
      }
    })
  }
})

describe('the synthetic globe', () => {
  const globe = visualizationSchema.parse(manifestFor('synthetic-globe')) as Visualization
  const expected = expectedFor('synthetic-globe')

  it('is labelled as made-up practice data, in the catalog and in its first chapter', () => {
    expect(catalog.find(entry => entry.id === 'synthetic-globe')?.title).toMatch(/made-up/i)
    expect(globe.story![0].text).toMatch(/made-up/i)
  })

  it('has twelve monthly frames of 1200 by 600 pixels, with the legend bar left out of the map', () => {
    expect(globe.frames).toHaveLength(12)
    globe.frames.forEach(frame => expect([frame.width, frame.height]).toEqual([1200, 600]))
    expect(globe.mapArea).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.88 })
  })

  it('listens to the heatwave patch first, then the tropics, 30 points each', () => {
    expect(globe.regions.map(region => region.id)).toEqual(['north-east-patch', 'tropics'])
    globe.regions.forEach(region => expect(region.points).toHaveLength(30))
  })

  it('tells a four-chapter story that runs forward in time', () => {
    expect(globe.story!.map(chapter => chapter.title)).toEqual(['A normal spring', 'The patch warms', 'Cloud hides the sea', 'It fades, for now'])
  })

  it('has three comparisons in the patch: warmer later, cooler later, and about the same', () => {
    expect(globe.comparisons.map(c => c.answer).sort()).toEqual(['a', 'b', 'same'])
    globe.comparisons.forEach(c => expect(c.regionId).toBe('north-east-patch'))
  })

  it('has one frame where cloud hides most of the patch, which must not be read as cold', () => {
    const hidden = expected.frames.filter(e => e.regionId === 'north-east-patch' && e.category === 'insufficient')
    expect(hidden).toHaveLength(1)
    expect(hidden[0].valid).toBeLessThan(15)
  })

  it('has real variation: the patch spans at least three categories over the year, and the tropics stay hot', () => {
    const categories = (region: string) => new Set(expected.frames.filter(e => e.regionId === region && e.category !== 'insufficient').map(e => e.category))
    expect(categories('north-east-patch').size).toBeGreaterThanOrEqual(3)
    expect([...categories('tropics')]).toEqual(['hot'])
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Note } from 'tonal'
import { describe, expect, it } from 'vitest'
import catalogJson from '../../public/data/index.json'
import { accentWarning } from '../features/mascot/accent'
import { checkCatalogEntry, checkDataset, describeProblem } from './check'
import { catalogSchema, describeIssues, visualizationSchema } from './schema'
import type { Visualization } from './types'

// Every data set listed in public/data/index.json, as it is on disk: the manifest, the images it names and, for the
// made-up ones, expected.json (the answers computed from the values the generator drew, never from the images).
const manifests = import.meta.glob('../../public/data/*/manifest.json', { eager: true, import: 'default' }) as Record<string, unknown>
const expectations = import.meta.glob('../../public/data/*/expected.json', { eager: true, import: 'default' }) as Record<string, Expected>
const images = Object.keys(import.meta.glob('../../public/data/*/frames/*.png'))

type Expected = { frames: { frameId: string; regionId: string; valid: number; medianValue: number | null; category: string }[] }

const catalog = catalogSchema.parse(catalogJson)
const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const manifestFor = (id: string) => manifests[`../../public/data/${id}/manifest.json`]
const expectedFor = (id: string) => expectations[`../../public/data/${id}/expected.json`]

describe('the data sets on disk', () => {
  it('lists each one in the catalog, and each catalog entry has a manifest', () => {
    // stress-* and rehearsal-* folders are local, gitignored data (the T91 rehearsal). They need not
    // be listed, but a rehearsal set may be, so the T85 checklist (add it to index.json, then npm run check-data) works on it.
    const listed = new Set(catalog.map(entry => entry.id))
    const onDisk = Object.keys(manifests).map(path => path.split('/').at(-2)!).filter(id => listed.has(id) || !/^(stress|rehearsal)-/.test(id)).sort()
    expect(catalog.map(entry => entry.id).sort()).toEqual(onDisk)
  })

  for (const { id } of catalog) {
    describe(id, () => {
      const parsed = visualizationSchema.safeParse(manifestFor(id))
      const v = parsed.success ? (parsed.data as Visualization) : null

      it('pairs only with other data sets in the catalog (pairsWith)', () => {
        const listed = new Set(catalog.map(entry => entry.id))
        const bad = (v?.pairsWith ?? []).filter(pair => pair.id === id || !listed.has(pair.id)).map(pair => pair.id)
        expect(bad, 'pairsWith names itself or a data set that is not in index.json').toEqual([])
      })

      it('is a valid manifest', () => {
        expect(parsed.success ? '' : describeIssues(parsed.error, 10)).toBe('')
      })

      it('passes the data checks: image files and sizes, date order, legend round trip, categories, no TODO left', () => {
        const problems = [
          ...checkCatalogEntry(catalog.find(entry => entry.id === id)),
          ...checkDataset(v!, image => readFileSync(`${dataDir}/${id}/${image}`)),
        ]
        if (problems.length) expect.fail(`\n${problems.map(describeProblem).join('\n')}`)
      })

      it("gives Echo an accent it can show (JB04): a warning only, never a failure", () => {
        // A too-dark mascot.accent is not an error: Echo falls back to the legend's or the theme's colour. The warning says to pick another.
        const warning = accentWarning(v!)
        if (warning) console.warn(warning)
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

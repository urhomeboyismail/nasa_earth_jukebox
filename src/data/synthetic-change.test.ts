// The synthetic change data set (ticket T111): twelve made-up months, each with its own normal, and a warm patch that grows in the east from
// August to October. expected.json holds the answers the generator computed from the values it drew; these tests run the app's real analysis
// on the real PNGs and check it finds them. The point of the data set is the season test: February is the warmest date and has no patch, October
// is cooler but far above its own normal, so only a sound that follows the change gets the question right.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzePixels } from '../analysis/analyze'
import { hasChange } from '../analysis/available'
import { decodePng } from '../analysis/png'
import { scorePixels } from '../analysis/score'
import { judge } from '../features/compare/judge'
import catalogJson from '../../public/data/index.json'
import { catalogSchema, visualizationSchema } from './schema'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data/synthetic-change')
const readJson = (name: string): any => JSON.parse(readFileSync(`${dataDir}/${name}`, 'utf8'))

const v = visualizationSchema.parse(readJson('manifest.json'))
const expected = readJson('expected.json') as {
  frames: { frameId: string; regionId: string; valid: number; medianValue: number; category: string; normalValue: number; medianChange: number; changeStep: string }[]
  comparisons: { id: string; answer: string; changeAnswer: string; changeA: string; changeB: string }[]
}
const { baseline, mapping } = v
if (baseline?.kind !== 'climatology' || !mapping.changeSteps) throw new Error('synthetic-change must be a climatology data set with change steps')
const changeSteps = mapping.changeSteps
const noiseFloor = baseline.noiseFloor

const pixelsOf = (path: string) => decodePng(readFileSync(`${dataDir}/${path}`))
/** What the app reads for each frame and region, with the change (v2) and without it (v1, which must not notice the new fields). */
const analysis = (change: boolean) =>
  v.regions.map(region =>
    v.frames.map(frame =>
      analyzePixels(pixelsOf(frame.image), frame, region, v.colorScale, mapping, change ? { baseline: pixelsOf(frame.baselineImage!), noiseFloor, changeSteps } : undefined),
    ),
  )
const withChange = analysis(true)
const withoutChange = analysis(false)
const expectedFor = (frameId: string, regionId: string) => expected.frames.find(e => e.frameId === frameId && e.regionId === regionId)!

describe('the synthetic change data set', () => {
  it('is labelled as made-up practice data, in the catalog, the summary, the description and every frame', () => {
    const entry = catalogSchema.parse(catalogJson).find(e => e.id === 'synthetic-change')
    expect(entry?.title).toMatch(/made-up/i)
    expect(v.description).toMatch(/None of it is real data/)
    v.frames.forEach(frame => expect(frame.altText).toMatch(/made-up/i))
    expect(v.source).toMatchObject({ name: 'Synthetic test data', license: 'CC0' })
  })

  it('has twelve monthly frames, each with its own normal of the same size, and a change style to use', () => {
    expect(v.frames).toHaveLength(12)
    expect(v.frames.map(f => f.date.slice(5, 7))).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
    for (const frame of v.frames) {
      expect(frame.baselineImage, frame.id).toBe(`baselines/${frame.date}.png`)
      const [a, b] = [pixelsOf(frame.image), pixelsOf(frame.baselineImage!)]
      expect([b.width, b.height], frame.id).toEqual([a.width, a.height])
      expect([frame.width, frame.height]).toEqual([a.width, a.height])
    }
    expect(hasChange(v)).toBe(true)
    expect(mapping.changeSteps).toHaveLength(5)
    expect(mapping.contourLevels?.map(l => l.value)).toEqual([1, 2])
  })

  it('has two regions of 30 points, the patch first because Compare uses the first region only', () => {
    expect(v.regions.map(r => r.id)).toEqual(['east-patch', 'open-sea'])
    v.regions.forEach(region => expect(region.points).toHaveLength(30))
  })

  it('reads every sample point: nothing is hidden, so nothing is missing data', () => {
    for (const results of [...withChange, ...withoutChange]) results.forEach(r => expect(r.valid).toBe(30))
  })
})

describe('what the analysis finds in the real images', () => {
  it('gives the temperature category the generator drew, with or without the new fields (v1 is unchanged)', () => {
    v.regions.forEach((region, r) =>
      v.frames.forEach((frame, f) => {
        const want = expectedFor(frame.id, region.id)
        expect(withChange[r][f].category, `${frame.id} ${region.id}`).toBe(want.category)
        expect(withoutChange[r][f].category, `${frame.id} ${region.id} (v1)`).toBe(want.category)
        expect(withoutChange[r][f].medianValue).toBe(withChange[r][f].medianValue)
        expect(withoutChange[r][f]).not.toHaveProperty('changeStep')
      }),
    )
  })

  it('gives the change step and size the generator drew, within what 8-bit colours can show', () => {
    v.regions.forEach((region, r) =>
      v.frames.forEach((frame, f) => {
        const want = expectedFor(frame.id, region.id)
        expect(withChange[r][f].changeStep, `${frame.id} ${region.id}`).toBe(want.changeStep)
        expect(Math.abs(withChange[r][f].medianChange! - want.medianChange), `${frame.id} ${region.id}`).toBeLessThan(0.15)
      }),
    )
  })

  it('follows the patch and not the season: the open sea is "normal" all year, though its temperature moves through categories', () => {
    const sea = withChange[1]
    sea.forEach(result => expect(result.changeStep).toBe('normal'))
    expect(new Set(sea.map(r => r.category)).size).toBeGreaterThanOrEqual(2)
  })

  it('shows the patch only from August to October, growing, and normal again in November', () => {
    const steps = withChange[0].map(r => r.changeStep)
    expect(steps).toEqual(['normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'above', 'above', 'much-above', 'normal', 'normal'])
  })

  it('has a patch that is bigger than a tenth of the readable map in October, so the description can say so, and traces a closed +1 line round it', () => {
    const october = v.frames.find(f => f.id === '2024-10-15')!
    const score = scorePixels(pixelsOf(october.image), pixelsOf(october.baselineImage!), {
      frameId: october.id,
      colorScale: v.colorScale,
      mapping: { minValidFraction: mapping.minValidFraction, changeSteps, contourLevels: mapping.contourLevels! },
      area: v.mapArea!,
      noiseFloor,
    })
    expect(score.change.shareAbove[0]).toBeGreaterThan(0.1) // at least +1 degree
    expect(score.change.shareAbove[1]).toBe(0) // never +2
    expect(score.contours.map(c => c.level)).toEqual([1])
    expect(score.contours[0]).toMatchObject({ closed: true, brokenEnds: 0 })
  })
})

describe('the comparisons: the temperature answer and the change answer differ on purpose', () => {
  const resultsOf = (frameId: string) => withChange[0][v.frames.findIndex(f => f.id === frameId)]
  const byChange = (c: (typeof v.comparisons)[number]) => judge(resultsOf(c.frameA), resultsOf(c.frameB), mapping)
  const byTemperature = (c: (typeof v.comparisons)[number]) => judge({ ...resultsOf(c.frameA), changeStep: undefined }, { ...resultsOf(c.frameB), changeStep: undefined }, mapping)

  it('has comparisons only in the first region, as Compare needs', () => {
    expect(v.comparisons.length).toBeGreaterThanOrEqual(2)
    v.comparisons.forEach(c => expect(c.regionId).toBe('east-patch'))
  })

  it('has a manifest answer that is the temperature answer, and a change answer that the change judge reaches on the real images', () => {
    expect(v.comparisons.map(c => c.id)).toEqual(expected.comparisons.map(c => c.id))
    for (const c of v.comparisons) {
      const want = expected.comparisons.find(e => e.id === c.id)!
      expect(c.answer, `${c.id} (the answer in the manifest)`).toBe(want.answer)
      expect(byTemperature(c), `${c.id} by temperature`).toBe(want.answer)
      expect(byChange(c), `${c.id} by change`).toBe(want.changeAnswer)
    }
  })

  it('has at least two where the two answers differ: the test that the change style plays the change and not the season', () => {
    const differ = v.comparisons.filter(c => byTemperature(c) !== byChange(c))
    expect(differ.length).toBeGreaterThanOrEqual(2)
    // The clearest case: February is warmer (warm against mild), but October is far above its normal and February is not.
    const feb = v.comparisons.find(c => c.id === 'february-vs-october')!
    expect([byTemperature(feb), byChange(feb)]).toEqual(['a', 'b'])
  })

  it('keeps one comparison where they agree, so the change style is not just the opposite answer', () => {
    expect(v.comparisons.filter(c => byTemperature(c) === byChange(c)).length).toBeGreaterThanOrEqual(1)
  })
})

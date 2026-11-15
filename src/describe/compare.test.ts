import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import mur from '../../public/data/mur-sst-mauritius/manifest.json'
import type { FrameAnalysis } from '../analysis'
import type { Visualization } from '../data'
import { deltaBetween, describeDelta, littleChange } from './compare'

const fix = fixture as unknown as Visualization
const murViz = mur as unknown as Visualization
// Two regions, so the sentence can name the one that changed most.
const change: Visualization = { ...murViz, regions: [{ ...murViz.regions[0], id: 'east-patch', name: 'East patch' }, { ...murViz.regions[0], id: 'open-sea', name: 'Open sea' }] }

const result = (regionId: string, medianValue: number | undefined, category = 'mild'): FrameAnalysis => ({
  frameId: 'f', regionId, sampled: 9, valid: medianValue === undefined ? 0 : 9, category, ...(medianValue !== undefined && { medianValue }),
})

describe('littleChange', () => {
  it('uses the top of the near-normal step when the manifest has change steps', () => {
    expect(littleChange(change)).toBe(0.25)
  })
  it('falls back to 2% of the colour scale without them', () => {
    const values = fix.colorScale.stops.map(s => s.value)
    expect(littleChange(fix)).toBeCloseTo((Math.max(...values) - Math.min(...values)) * 0.02)
  })
})

describe('describeDelta on a data set with two regions', () => {
  const [east, open] = change.regions.map(r => r.id)
  const a = [result(east, 10), result(open, 10)]

  it('gives the signed overall change and the region that changed most, in the manifest\'s words', () => {
    const b = [result(east, 13), result(open, 11)]
    expect(describeDelta(change, a, b)).toBe(`Overall 2 °C warmer. The biggest change was in ${change.regions[0].name}, 3 °C warmer.`)
  })

  it('uses the lower word when the value fell, and ignores the order of the results', () => {
    const b = [result(open, 7.5), result(east, 9)]
    expect(describeDelta(change, a, b)).toBe(`Overall 1.8 °C cooler. The biggest change was in ${change.regions[1].name}, 2.5 °C cooler.`)
  })

  it('is one sentence when concise', () => {
    const b = [result(east, 13), result(open, 11)]
    expect(describeDelta(change, a, b, { detail: 'concise' })).toBe('Overall 2 °C warmer.')
  })

  it('says "Little change" when nothing moved by more than a near-normal step', () => {
    expect(describeDelta(change, a, [result(east, 10.1), result(open, 9.9)])).toMatch(/^Little change/)
  })

  it('names a place that moved even when the overall change is little', () => {
    const text = describeDelta(change, a, [result(east, 12), result(open, 8)])
    expect(text).toBe(`Little change overall. The biggest change was in ${change.regions[0].name}, 2 °C warmer.`)
  })

  it('skips a region that could not be read on either date', () => {
    const b = [result(east, 12), result(open, undefined, 'insufficient')]
    expect(deltaBetween(change, a, b).top?.region.id).toBe(east)
    expect(describeDelta(change, a, b)).toBe(`Overall 2 °C warmer. The biggest change was in ${change.regions[0].name}, 2 °C warmer.`)
  })

  it('says there is not enough data when no region could be read', () => {
    expect(describeDelta(change, a, [result(east, undefined, 'insufficient'), result(open, undefined, 'insufficient')])).toMatch(/^Not enough data/)
  })
})

describe('describeDelta on a data set with one region', () => {
  const only = fix.regions[0].id

  it('gives only the overall change', () => {
    expect(describeDelta(fix, [result(only, 4)], [result(only, 6.4)])).toBe('Overall 2.4 °C warmer.')
  })

  it('says "Little change" for equal dates', () => {
    expect(describeDelta(fix, [result(only, 4)], [result(only, 4)])).toBe('Little change overall.')
  })
})

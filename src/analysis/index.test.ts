import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { analyzeAll, analyzeFrame } from '.'

const visualization = fixture as Visualization
const region = visualization.regions[0]

describe('stub frame analysis', () => {
  it('gives the fixture categories that real pixel analysis will also give', async () => {
    const results = await analyzeAll(visualization.frames, region, visualization.colorScale, visualization.mapping)
    expect(results.map(result => result.category)).toEqual(['cold', 'mild', 'hot', 'insufficient'])
  })

  it('never reads missing data as a value', async () => {
    const missing = visualization.frames[3]
    const result = await analyzeFrame(missing, region, visualization.colorScale, visualization.mapping)
    expect(result).toMatchObject({ category: 'insufficient', valid: 0, sampled: region.points.length })
    expect(result.medianValue).toBeUndefined()
  })

  it('gives the same result for the same frame every time', async () => {
    const frame = visualization.frames[1]
    const first = await analyzeFrame(frame, region, visualization.colorScale, visualization.mapping)
    const second = await analyzeFrame(frame, region, visualization.colorScale, visualization.mapping)
    expect(second).toEqual(first)
  })
})

describe('fixture data', () => {
  it('is internally consistent', () => {
    const frameIds = new Set(visualization.frames.map(frame => frame.id))
    for (const comparison of visualization.comparisons) {
      expect(frameIds.has(comparison.frameA) && frameIds.has(comparison.frameB)).toBe(true)
      expect(visualization.regions.some(r => r.id === comparison.regionId)).toBe(true)
    }
    const values = visualization.colorScale.stops.map(stop => stop.value)
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })
})

import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { FrameAnalysis } from '../analysis'
import { gridFromPixels } from '../analysis/analyze'
import type { Visualization } from '../data'
import { describeCell, describeFrame, describeSequence, describeSweep } from '.'

const visualization = fixture as Visualization
const results: FrameAnalysis[] = visualization.frames.map((frame, i) => ({
  frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: visualization.mapping.categories[i].id,
}))

// A map of one solid colour, read the way the real grid is read. (analyzeGrid fetches the image, which a test cannot do.)
const solid = { width: 48, height: 24, data: new Uint8ClampedArray(48 * 24 * 4).fill(255) }
const grid = gridFromPixels(solid, visualization.frames[0], visualization.colorScale, visualization.mapping)

// Stubs until T69, which writes the real sentences. These tests pin the contract the explorer and pages build against.
describe('descriptions (stubs until T69)', () => {
  it('give a sentence for a date, a whole sequence, a cell and a sweep', () => {
    const texts = [
      describeFrame(visualization, results, 0),
      describeSequence(visualization, results),
      describeCell(visualization, grid, 3, 4),
      describeSweep(visualization, grid, { kind: 'row', index: 2 }),
      describeSweep(visualization, grid, { kind: 'column', index: 5 }),
    ]
    texts.forEach(text => {
      expect(typeof text).toBe('string')
      expect(text.trim().length).toBeGreaterThan(0)
    })
  })

  it('give the same words for the same input, every time', () => {
    expect(describeFrame(visualization, results, 1)).toBe(describeFrame(visualization, results, 1))
    expect(describeSequence(visualization, results)).toBe(describeSequence(visualization, results))
    expect(describeCell(visualization, grid, 0, 0)).toBe(describeCell(visualization, grid, 0, 0))
    expect(describeSweep(visualization, grid, { kind: 'row', index: 0 })).toBe(describeSweep(visualization, grid, { kind: 'row', index: 0 }))
  })
})

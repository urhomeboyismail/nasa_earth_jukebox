import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import { analyzeGrid, type FrameAnalysis } from '../analysis'
import type { Visualization } from '../data'
import { describeCell, describeFrame, describeSequence, describeSweep } from '.'

const visualization = fixture as Visualization
const results: FrameAnalysis[] = visualization.frames.map((frame, i) => ({
  frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: visualization.mapping.categories[i].id,
}))

// Stubs until T69, which writes the real sentences. These tests pin the contract the explorer and pages build against.
describe('descriptions (stubs until T69)', () => {
  it('give a sentence for a date, a whole sequence, a cell and a sweep', async () => {
    const grid = await analyzeGrid(visualization.frames[0], visualization.colorScale, visualization.mapping)
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

  it('give the same words for the same input, every time', async () => {
    const grid = await analyzeGrid(visualization.frames[0], visualization.colorScale, visualization.mapping)
    expect(describeFrame(visualization, results, 1)).toBe(describeFrame(visualization, results, 1))
    expect(describeSequence(visualization, results)).toBe(describeSequence(visualization, results))
    expect(describeCell(visualization, grid, 0, 0)).toBe(describeCell(visualization, grid, 0, 0))
    expect(describeSweep(visualization, grid, { kind: 'row', index: 0 })).toBe(describeSweep(visualization, grid, { kind: 'row', index: 0 }))
  })
})

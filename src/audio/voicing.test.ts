import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { FrameAnalysis } from '../analysis'
import type { Visualization } from '../data'
import { voicingFor } from './voicing'

const { mapping } = fixture as Visualization
const results: FrameAnalysis[] = ['cold', 'mild', 'hot', 'insufficient'].map((category, i) => ({
  frameId: `f${i}`, regionId: 'centre', sampled: 9, valid: category === 'insufficient' ? 0 : 9, category,
}))

// A stub until T68, which gives these results their meaning (chord, glide, bell).
describe('voicingFor (stub until T68)', () => {
  it('adds nothing to any date for now', () => {
    results.forEach((_, i) => expect(voicingFor(results, i, mapping)).toEqual({}))
  })

  it('gives the same answer every time', () => {
    expect(voicingFor(results, 2, mapping)).toEqual(voicingFor(results, 2, mapping))
  })
})

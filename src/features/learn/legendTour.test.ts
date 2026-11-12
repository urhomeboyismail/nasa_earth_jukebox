import { describe, expect, it } from 'vitest'
import type { SoundMapping } from '../../data'
import manifest from '../../../public/data/fixture/manifest.json'
import { LEGEND_GAP_MS, legendLabel, legendSteps } from './legendTour'

const mapping = manifest.mapping as unknown as SoundMapping

describe('legendTour', () => {
  it('spaces the sounds 1200 ms apart', () => expect(LEGEND_GAP_MS).toBe(1200))

  it('has one step per category, in order, spaced by the gap', () => {
    const steps = legendSteps(mapping)
    expect(steps.map(s => s.category)).toEqual(mapping.categories.map(c => c.id))
    expect(steps.map(s => s.atMs)).toEqual(mapping.categories.map((_, i) => i * LEGEND_GAP_MS))
  })

  it('gives the label of each category, and an empty string out of range', () => {
    mapping.categories.forEach((c, i) => expect(legendLabel(mapping, i)).toBe(c.label))
    expect(legendLabel(mapping, mapping.categories.length)).toBe('')
    expect(legendLabel(mapping, -1)).toBe('')
  })
})

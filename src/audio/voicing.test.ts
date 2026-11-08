import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { FrameAnalysis } from '../analysis'
import type { Visualization } from '../data'
import { voicingFor } from './voicing'

const { mapping } = fixture as Visualization // cold, cool, mild, warm, hot

/** One date. `shares` defaults to everything in the category itself. */
function date(category: string, shares?: Record<string, number>): FrameAnalysis {
  return {
    frameId: category, regionId: 'centre', sampled: 9, valid: category === 'insufficient' ? 0 : 9, category,
    ...(category === 'insufficient' ? {} : { shares: { cold: 0, cool: 0, mild: 0, warm: 0, hot: 0, ...(shares ?? { [category]: 1 }) } }),
  }
}

describe('pad', () => {
  it('is the one category that holds the values', () => {
    expect(voicingFor([date('warm')], 0, mapping).pad).toEqual(['warm'])
  })

  it('is every category with a share of at least 0.2, coolest first', () => {
    const results = [date('mild', { hot: 0.4, cold: 0.2, mild: 0.4, warm: 0.0 })]
    expect(voicingFor(results, 0, mapping).pad).toEqual(['cold', 'mild', 'hot'])
  })

  it('leaves out a category just under 0.2', () => {
    expect(voicingFor([date('mild', { mild: 0.81, cool: 0.19 })], 0, mapping).pad).toEqual(['mild'])
  })

  it('keeps the three biggest of four, still coolest first', () => {
    const results = [date('mild', { cold: 0.2, cool: 0.25, mild: 0.3, hot: 0.25 })]
    expect(voicingFor(results, 0, mapping).pad).toEqual(['cool', 'mild', 'hot'])
  })

  it('keeps the cooler one when two tie for the last place', () => {
    const results = [date('mild', { cold: 0.25, cool: 0.25, mild: 0.25, hot: 0.25 })]
    expect(voicingFor(results, 0, mapping).pad).toEqual(['cold', 'cool', 'mild'])
  })

  it('is left out when the date has no shares', () => {
    const { shares: _shares, ...bare } = date('mild')
    expect(voicingFor([bare], 0, mapping)).toEqual({})
  })
})

describe('glide', () => {
  it('is on when the category differs from the date before', () => {
    expect(voicingFor([date('cold'), date('cool')], 1, mapping).glide).toBe(true)
  })

  it('is off when the category is the same', () => {
    expect(voicingFor([date('cool'), date('cool')], 1, mapping).glide).toBeUndefined()
  })

  it('is off on the first date', () => {
    expect(voicingFor([date('cool')], 0, mapping).glide).toBeUndefined()
  })

  it('is off right after missing data, since there is no note to slide from', () => {
    const results = [date('cold'), date('insufficient'), date('hot')]
    expect(voicingFor(results, 2, mapping).glide).toBeUndefined()
    expect(voicingFor(results, 2, mapping).bell).toBeUndefined()
  })
})

describe('bell', () => {
  it('rings on a jump of two steps, up or down', () => {
    expect(voicingFor([date('cold'), date('mild')], 1, mapping).bell).toBe(true)
    expect(voicingFor([date('hot'), date('mild')], 1, mapping).bell).toBe(true)
    expect(voicingFor([date('cold'), date('hot')], 1, mapping)).toMatchObject({ glide: true, bell: true })
  })

  it('stays quiet on a move of one step', () => {
    expect(voicingFor([date('cold'), date('cool')], 1, mapping).bell).toBeUndefined()
  })
})

describe('missing data', () => {
  const results = [date('cold'), date('insufficient'), date('hot')]

  it('gets nothing', () => {
    expect(voicingFor(results, 1, mapping)).toEqual({})
  })

  it('still gets the chord on the next date, which has no earlier note to slide from', () => {
    expect(voicingFor(results, 2, mapping)).toEqual({ pad: ['hot'] })
  })

  it('gets nothing for a date that is not there', () => {
    expect(voicingFor(results, 7, mapping)).toEqual({})
  })
})

describe('determinism', () => {
  it('gives the same answer every time', () => {
    const results = [date('cold', { cold: 0.5, hot: 0.5 }), date('hot', { cold: 0.5, hot: 0.5 }), date('insufficient')]
    results.forEach((_, i) => expect(voicingFor(results, i, mapping)).toEqual(voicingFor(results, i, mapping)))
    expect(voicingFor(results, 1, mapping)).toEqual({ pad: ['cold', 'hot'], glide: true, bell: true })
  })
})

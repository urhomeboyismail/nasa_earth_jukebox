import { describe, expect, it } from 'vitest'
import { DROPOUT_SEED, DROPOUT_SPACING_S } from './constants'
import { dropoutTaps } from './dropout'

describe('dropoutTaps', () => {
  it('is exactly two taps, at 0 and DROPOUT_SPACING_S', () => {
    const taps = dropoutTaps(DROPOUT_SEED)
    expect(taps).toHaveLength(2)
    expect(taps.map(t => t.offsetS)).toEqual([0, DROPOUT_SPACING_S])
  })

  it('gives the same taps every time for the same seed', () => {
    expect(dropoutTaps(DROPOUT_SEED)).toEqual(dropoutTaps(DROPOUT_SEED))
    expect(JSON.stringify(dropoutTaps(7))).toBe(JSON.stringify(dropoutTaps(7)))
  })

  it('gives different taps for a different seed', () => {
    expect(dropoutTaps(DROPOUT_SEED + 1)).not.toEqual(dropoutTaps(DROPOUT_SEED))
  })

  it('uses notes from a fixed list that sound consonant together, at a level of 0.8 to 1', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const tap of dropoutTaps(seed)) {
        expect([60, 64, 67, 72]).toContain(tap.midi)
        expect(tap.level).toBeGreaterThanOrEqual(0.8)
        expect(tap.level).toBeLessThanOrEqual(1)
      }
    }
  })

  it('does not use the browser\'s random numbers', () => {
    const original = Math.random
    Math.random = () => { throw new Error('Math.random was called') }
    try {
      expect(() => dropoutTaps(DROPOUT_SEED)).not.toThrow()
    } finally {
      Math.random = original
    }
  })
})

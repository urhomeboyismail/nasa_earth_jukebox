import { describe, expect, it } from 'vitest'
import { REVERB, REVERB_SEED } from './constants'
import { mulberry32, reverbImpulse } from './seeded'

const RATE = 8000

describe('mulberry32', () => {
  it('gives the same numbers for the same seed, from 0 to 1', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const first = Array.from({ length: 100 }, () => a())
    expect(Array.from({ length: 100 }, () => b())).toEqual(first)
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('reverbImpulse', () => {
  it('is the same for the same seed and differs for another', () => {
    const [left, right] = reverbImpulse(REVERB_SEED, RATE, REVERB)
    const [againLeft, againRight] = reverbImpulse(REVERB_SEED, RATE, REVERB)
    expect(Array.from(againLeft)).toEqual(Array.from(left))
    expect(Array.from(againRight)).toEqual(Array.from(right))
    const [otherLeft] = reverbImpulse(REVERB_SEED + 1, RATE, REVERB)
    expect(Array.from(otherLeft)).not.toEqual(Array.from(left))
  })

  it('is stereo, as long as asked, with two different channels', () => {
    const [left, right] = reverbImpulse(REVERB_SEED, RATE, REVERB)
    expect(left).toHaveLength(Math.round(REVERB.seconds * RATE))
    expect(right).toHaveLength(left.length)
    expect(Array.from(right)).not.toEqual(Array.from(left))
  })

  it('falls by the decay asked over its length', () => {
    const [left] = reverbImpulse(REVERB_SEED, RATE, REVERB)
    const tenth = Math.floor(left.length / 10)
    const peak = (from: number) => Math.max(...Array.from(left.subarray(from, from + tenth), Math.abs))
    const fallDb = 20 * Math.log10(peak(0) / peak(left.length - tenth))
    // The last tenth sits about 54 dB (nine tenths of 60) under the first: noise peaks vary, so allow a margin.
    expect(fallDb).toBeGreaterThan(45)
    expect(fallDb).toBeLessThan(65)
  })
})

import { describe, expect, it } from 'vitest'
import { PULSE_FAST_MS, PULSE_SLOW_MS, pulseIntervalMs } from './pulse'

describe('pulseIntervalMs', () => {
  it.each([12, 13, 40, Infinity])('is 1200 ms at %d cells', distance => {
    expect(pulseIntervalMs(distance)).toBe(PULSE_SLOW_MS)
  })

  it.each([1, 0.5, 0])('is 120 ms at %d cells', distance => {
    expect(pulseIntervalMs(distance)).toBe(PULSE_FAST_MS)
  })

  it('is linear in between, and falls as the cursor gets closer', () => {
    expect(pulseIntervalMs(6.5)).toBe(660)
    const intervals = Array.from({ length: 13 }, (_, d) => pulseIntervalMs(12 - d))
    for (let i = 1; i < intervals.length; i++) expect(intervals[i], `${12 - i} cells`).toBeLessThan(intervals[i - 1] + 1)
    expect(new Set(intervals).size).toBe(12)
  })
})

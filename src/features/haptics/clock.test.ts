import { describe, expect, it } from 'vitest'
import { wallTimeOf, type AudioClock } from './clock'

describe('wallTimeOf', () => {
  it('with getOutputTimestamp, maps a context time 100 ms ahead to the performance time plus 100', () => {
    const clock: AudioClock = { currentTime: 5, getOutputTimestamp: () => ({ contextTime: 4.9, performanceTime: 2000 }) }
    expect(wallTimeOf(clock, 5, 9999)).toBeCloseTo(2100, 6)
    expect(wallTimeOf(clock, 4.9, 9999)).toBeCloseTo(2000, 6)
  })

  it('without it, adds the output latency to the time until the sound', () => {
    const clock: AudioClock = { currentTime: 10, outputLatency: 0.05, baseLatency: 0.01 }
    // 0.02 s lookahead + 0.05 s latency = 70 ms after "now".
    expect(wallTimeOf(clock, 10.02, 1000)).toBeCloseTo(1070, 6)
  })

  it('falls back to the base latency when there is no output latency, and counts a missing latency as 0', () => {
    expect(wallTimeOf({ currentTime: 0, baseLatency: 0.01 }, 0.02, 1000)).toBeCloseTo(1030, 6)
    expect(wallTimeOf({ currentTime: 0 }, 0.02, 1000)).toBeCloseTo(1020, 6)
  })

  it('uses the fallback while the browser has not filled the timestamp in yet', () => {
    const clock: AudioClock = { currentTime: 0, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }
    expect(wallTimeOf(clock, 0.5, 1000)).toBeCloseTo(1500, 6)
    expect(wallTimeOf({ currentTime: 0, getOutputTimestamp: () => ({}) }, 0.5, 1000)).toBeCloseTo(1500, 6)
  })

  it('gives the same time for the same inputs', () => {
    const clock: AudioClock = { currentTime: 3, outputLatency: 0.04 }
    expect(wallTimeOf(clock, 3.2, 500)).toBe(wallTimeOf(clock, 3.2, 500))
  })
})

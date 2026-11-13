import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { EDGE_PATTERN, LOCK_PATTERN, MARK_PATTERN, MISSING_PATTERN, magnitudeFor, patternFor, pulseOf } from './patterns'
import { VIBRATION_LAG_MS, pulseCue, schedulePulse } from './pulse'

const mapping = (fixture as Visualization).mapping
let vibrate: ReturnType<typeof vi.fn>
const support = (on: boolean) => {
  vibrate = vi.fn(() => true)
  Object.defineProperty(navigator, 'vibrate', { value: on ? vibrate : undefined, configurable: true })
}

beforeEach(() => { vi.useFakeTimers(); support(true) })
afterEach(() => { vi.useRealTimers(); support(false); Object.defineProperty(navigator, 'getGamepads', { value: undefined, configurable: true }) })

describe('the pulse table', () => {
  it('has a shape for each cue, and the move shapes follow the category rank', () => {
    expect(pulseOf({ kind: 'edge' }, mapping).pattern).toEqual(EDGE_PATTERN)
    expect(pulseOf({ kind: 'lock' }, mapping).pattern).toEqual(LOCK_PATTERN)
    expect(pulseOf({ kind: 'mark' }, mapping).pattern).toEqual(MARK_PATTERN)
    expect(pulseOf({ kind: 'move', category: 'insufficient' }, mapping).pattern).toEqual(MISSING_PATTERN)
    const first = mapping.categories[0].id
    const last = mapping.categories[mapping.categories.length - 1].id
    expect(pulseOf({ kind: 'move', category: first }, mapping).pattern).toEqual(patternFor(first, mapping))
    expect(magnitudeFor(last, mapping)).toBe(1)
    expect(magnitudeFor(first, mapping)).toBeLessThan(magnitudeFor(last, mapping))
  })
})

describe('schedulePulse', () => {
  it('fires at the wall time of the sound, minus the lag', () => {
    vi.setSystemTime(0)
    const now = performance.now()
    schedulePulse({ pattern: [40], magnitude: 0.5 }, now + 100, now)
    expect(vibrate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(99 - VIBRATION_LAG_MS)
    expect(vibrate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(vibrate).toHaveBeenCalledWith([40])
  })

  it('fires at once when the time has passed', () => {
    schedulePulse({ pattern: [40], magnitude: 0.5 }, 0, 10)
    expect(vibrate).toHaveBeenCalledWith([40])
  })

  it('does nothing without navigator.vibrate, and sends nothing for an empty pattern', () => {
    support(false)
    expect(() => schedulePulse({ pattern: [40], magnitude: 0.5 }, 0, 10)).not.toThrow()
    support(true)
    schedulePulse({ pattern: [], magnitude: 0.5 }, 0, 10)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('rumbles a pad with the same pattern at the same time', () => {
    const playEffect = vi.fn(async () => 'complete')
    Object.defineProperty(navigator, 'getGamepads', { value: () => [{ vibrationActuator: { playEffect } }], configurable: true })
    schedulePulse({ pattern: [120], magnitude: 0.8 }, 50, 0)
    expect(playEffect).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', { startDelay: 0, duration: 120, strongMagnitude: 0.8, weakMagnitude: 0.4 })
  })
})

describe('pulseCue', () => {
  it('lands the pulse on the audio clock: the sound is 20 ms after the clock, so is the pulse (with 40 ms of output latency, 60 ms)', () => {
    vi.setSystemTime(0)
    pulseCue({ kind: 'mark' }, mapping, { currentTime: 1, outputLatency: 0.04 })
    vi.advanceTimersByTime(59)
    expect(vibrate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(vibrate).toHaveBeenCalledWith(MARK_PATTERN)
  })

  it('uses getOutputTimestamp when the clock has it', () => {
    vi.setSystemTime(0)
    const now = performance.now()
    pulseCue({ kind: 'lock' }, mapping, { currentTime: 2, getOutputTimestamp: () => ({ contextTime: 2, performanceTime: now + 30 }) }, 2.1)
    vi.advanceTimersByTime(129)
    expect(vibrate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(vibrate).toHaveBeenCalledWith(LOCK_PATTERN)
  })
})

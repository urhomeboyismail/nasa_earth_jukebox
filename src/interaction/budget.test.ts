import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANSWER_BUDGET_MS, MOVE_GAP_MS, createGapGate } from './budget'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(10_000)
})
afterEach(() => vi.useRealTimers())

describe('the gap gate', () => {
  it('keeps the gap inside the 50 ms budget', () => {
    expect(MOVE_GAP_MS).toBeLessThanOrEqual(ANSWER_BUDGET_MS)
  })

  it('plays the first move at once, before any timer runs', () => {
    const played: string[] = []
    createGapGate().run(() => played.push('first'))
    expect(played).toEqual(['first'])
  })

  it('plays only the latest of ten moves within 20 ms, at the end of the gap', () => {
    const gate = createGapGate()
    const played: number[] = []
    for (let i = 0; i < 10; i++) {
      gate.run(() => played.push(i))
      vi.advanceTimersByTime(2)
    }
    expect(played).toEqual([0])
    vi.advanceTimersByTime(MOVE_GAP_MS)
    expect(played).toEqual([0, 9])
  })

  it('plays at once again after a pause', () => {
    const gate = createGapGate()
    const played: number[] = []
    gate.run(() => played.push(1))
    vi.advanceTimersByTime(MOVE_GAP_MS)
    gate.run(() => played.push(2))
    expect(played).toEqual([1, 2])
  })

  it('drops the one that is waiting when cancelled', () => {
    const gate = createGapGate()
    const played: number[] = []
    gate.run(() => played.push(1))
    gate.run(() => played.push(2))
    gate.cancel()
    vi.advanceTimersByTime(500)
    expect(played).toEqual([1])
  })
})

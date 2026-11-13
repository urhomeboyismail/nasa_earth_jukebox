import { describe, expect, it } from 'vitest'
import { clock, targetScore } from './score'

describe('targetScore', () => {
  it.each([
    [0, 0, 1000],
    [10, 5, 1000 - 50 - 50],
    [3, 2.4, 1000 - 15 - 24],
    [100, 60, 0],
    [0, 99.96, 0],
  ])('%d moves in %d s scores %d', (moves, seconds, score) => {
    expect(targetScore(moves, seconds)).toBe(score)
  })

  it('never goes below 0', () => {
    expect(targetScore(1000, 1000)).toBe(0)
  })
})

describe('clock', () => {
  it.each([[0, '0:00'], [9.9, '0:09'], [65, '1:05'], [-3, '0:00']])('shows %d s as %s', (seconds, text) => {
    expect(clock(seconds)).toBe(text)
  })
})

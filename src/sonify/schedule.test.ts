import { describe, expect, it } from 'vitest'
import type { MusicFrame } from './types'
import { RENDER_MAX_SECONDS, RENDER_STEP_SECONDS, buildSchedule, stepSecondsFor } from './schedule'

const frame = (frameId: string) => ({ frameId }) as MusicFrame

describe('stepSecondsFor', () => {
  it('gives one second a date for a short data set', () => {
    expect(stepSecondsFor(12)).toBe(1)
    expect(stepSecondsFor(170)).toBe(1)
  })

  it('shortens the step so a long data set stays under the limit', () => {
    expect(stepSecondsFor(400)).toBe(0.425)
    expect(stepSecondsFor(200)).toBe(0.85)
  })

  it('never makes a schedule longer than RENDER_MAX_SECONDS', () => {
    for (const count of [1, 2, 12, 169, 170, 171, 200, 400, 1000, 5000]) {
      expect(count * stepSecondsFor(count), `${count} dates`).toBeLessThanOrEqual(RENDER_MAX_SECONDS + 1e-9)
    }
  })

  it('falls back to the plain step for a count that is not a number of frames', () => {
    expect(stepSecondsFor(0)).toBe(RENDER_STEP_SECONDS)
    expect(stepSecondsFor(Number.NaN)).toBe(RENDER_STEP_SECONDS)
  })
})

describe('buildSchedule', () => {
  it('puts the frames at i × step, in the order given', () => {
    const schedule = buildSchedule([frame('a'), frame('b'), frame('c')], 0.5)
    expect(schedule.map(entry => entry.atSeconds)).toEqual([0, 0.5, 1])
    expect(schedule.map(entry => entry.frame.frameId)).toEqual(['a', 'b', 'c'])
  })

  it('is empty for no frames', () => {
    expect(buildSchedule([], 1)).toEqual([])
  })
})

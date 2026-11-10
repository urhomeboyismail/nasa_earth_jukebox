import { describe, expect, it } from 'vitest'
import playerSource from '../../features/player/usePlayer.ts?raw'
import { FRAME_RATE_CAP_HZ, LOW_CONFIDENCE, MIN_FRAME_GAP_S, SEQUENCE_STEP_MS, VIDEO_START_TIMEOUT_MS, videoIndexFor } from './clock'

describe('videoIndexFor', () => {
  it('is the media time times the frame rate: 1.0 s at 10 fps is frame 10', () => {
    expect(videoIndexFor(1, 10)).toBe(10)
    expect(videoIndexFor(0, 10)).toBe(0)
    expect(videoIndexFor(12.5, 4)).toBe(50)
  })

  it('rounds, so a time that is a little early still gets its own frame: 0.04 s at 25 fps is frame 1', () => {
    expect(videoIndexFor(0.04, 25)).toBe(1)
    expect(videoIndexFor(0.0999, 10)).toBe(1)
    expect(videoIndexFor(0.1001, 10)).toBe(1)
  })

  it('rounds half a frame up, and never goes below 0', () => {
    expect(videoIndexFor(0.05, 10)).toBe(1)
    expect(videoIndexFor(0.04, 10)).toBe(0)
    expect(videoIndexFor(-0.2, 10)).toBe(0)
    expect(Object.is(videoIndexFor(-0.0001, 10), -0)).toBe(false)
  })
})

describe('the constants', () => {
  it('cap the rate at 20 frames a second, a gap of 50 ms', () => {
    expect(FRAME_RATE_CAP_HZ).toBe(20)
    expect(MIN_FRAME_GAP_S).toBeCloseTo(0.05, 10)
  })

  it('give the video three seconds to start', () => {
    expect(VIDEO_START_TIMEOUT_MS).toBe(3000)
  })

  it('call a reading below 0.6 less exact', () => {
    expect(LOW_CONFIDENCE).toBe(0.6)
  })

  it('step the checked frames at the speeds of the player, which a test reads from its source rather than importing', () => {
    const match = /export const STEP_MS: Record<Speed, number> = \{ slow: (\d+), normal: (\d+), fast: (\d+) \}/.exec(playerSource)
    expect(match, 'STEP_MS was not found in usePlayer.ts').not.toBeNull()
    expect(SEQUENCE_STEP_MS).toEqual({ slow: Number(match![1]), normal: Number(match![2]), fast: Number(match![3]) })
  })
})

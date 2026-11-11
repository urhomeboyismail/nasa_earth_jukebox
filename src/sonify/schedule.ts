// When each frame of a data set sounds in a rendered file (docs/PLAN.md §6.3, ticket SN12). Pure: the same frames always give the same times,
// so the same data set always renders to the same length. The browser side is in src/features/playlist/.

import type { DetailLevel, MusicFrame } from './types'

export const RENDER_SAMPLE_RATE = 44100
/** Under the ensemble's 180-second limit, with room for the tail. */
export const RENDER_MAX_SECONDS = 170
/** One date a second at most. */
export const RENDER_STEP_SECONDS = 1
export const RENDER_TAIL_SECONDS = 1.5
export const RENDER_DETAIL: DetailLevel = 'full'

export type ScheduledMusic = { frame: MusicFrame; atSeconds: number }

/**
 * The seconds each date gets: one, or less when the data set has so many dates that one each would pass RENDER_MAX_SECONDS
 * (200 dates give 0.85 s). The rule is fixed, so a data set always gives the same length.
 */
export function stepSecondsFor(frameCount: number): number {
  if (!Number.isFinite(frameCount) || frameCount < 1) return RENDER_STEP_SECONDS
  return Math.min(RENDER_STEP_SECONDS, RENDER_MAX_SECONDS / frameCount)
}

/** One entry per frame, in the order given (date order), `stepSeconds` apart, starting at 0. */
export function buildSchedule(musicFrames: readonly MusicFrame[], stepSeconds: number): ScheduledMusic[] {
  return musicFrames.map((frame, i) => ({ frame, atSeconds: i * stepSeconds }))
}

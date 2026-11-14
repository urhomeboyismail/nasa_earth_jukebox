// The ear check (UI07): two questions, "Which is higher?" and "Left or right?", set a starting detail level and say whether the
// listener's left and right are swapped. This file is the scoring and the stored detail level. No JSX.

import { DETAIL_LEVELS, type DetailLevel } from '../../data'

export type HigherAnswer = 'first' | 'second' | 'unsure'
export type SideAnswer = 'left' | 'right' | 'unsure'

/** The two tones of "Which is higher?", in a fixed order so the check is the same every time: the second is higher. */
export const PITCH_TONES_HZ = [330, 495] as const
export const PITCH_TONE_SECONDS = 0.4
/** The tone of "Left or right?", panned fully left. */
export const SIDE_TONE_HZ = 440

/** `higher` is the tone the listener says is higher; `side` is where they say the left-panned tone came from. */
export function scoreEarCheck({ higher, side }: { higher: HigherAnswer; side: SideAnswer }): { detail: DetailLevel; swapEars: boolean } {
  // Wrong or unsure on either question: start gently. Full is never suggested; the listener picks it.
  if (higher !== 'second' || side === 'unsure') return { detail: 'calm', swapEars: false }
  return { detail: 'standard', swapEars: side === 'right' }
}

export const DETAIL_KEY = 'earth-jukebox:detail-level'

/** The stored text as a detail level, or null for anything else. Defined here so it is the same function on every render. */
export const parseDetail = (text: string): DetailLevel | null => DETAIL_LEVELS.find(level => level === text) ?? null

// The dropout cue (docs/PLAN.md §6.3, ticket SN04): what a date with no readable data sounds like. Two short taps, a rhythmic double that nothing else
// in the ensemble sounds like. Seeded, so the same seed always gives the same cue; there is no noise (a hiss would be random, and could be
// mistaken for a texture).

import { DROPOUT_SPACING_S } from './constants'
import { mulberry32 } from './seeded'

export type DropoutTap = { offsetS: number; midi: number; level: number }

/** The notes the cue may use: C4, E4, G4, C5, so any two of them sound consonant. */
const TAP_NOTES = [60, 64, 67, 72] as const

/** Exactly two taps, at 0 and DROPOUT_SPACING_S. The note comes from a fixed list and the level from 0.8 to 1. */
export function dropoutTaps(seed: number): DropoutTap[] {
  const next = mulberry32(seed)
  return [0, DROPOUT_SPACING_S].map(offsetS => ({
    offsetS,
    midi: TAP_NOTES[Math.floor(next() * TAP_NOTES.length)],
    level: Number((0.8 + 0.2 * next()).toFixed(4)),
  }))
}

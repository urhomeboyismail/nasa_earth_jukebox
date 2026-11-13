// The shapes of every pulse (ticket IX10), in one table: how long each buzz is, in milliseconds, with the pauses between. A pattern is
// [buzz, pause, buzz, ...] exactly as navigator.vibrate takes it. A category's pulse grows with its rank, so it can be learnt by feel.

import type { CategoryId, SoundMapping } from '../../data'

export const MIN_PULSE_MS = 30
export const MAX_PULSE_MS = 120
/** Missing data is two quick taps, so it feels different from every category. */
export const MISSING_PATTERN = [25, 60, 25]
/** The edge of the map, or a move that is refused: two short pulses. */
export const EDGE_PATTERN = [20, 40, 20]
/** Locking a place: one long pulse. */
export const LOCK_PATTERN = [120]
/** A mark: a double. */
export const MARK_PATTERN = [40, 60, 40]

/** How warm a category is, from 0 (the coolest) to 1 (the warmest). Null when the mapping does not have it. */
export function rankShare(category: CategoryId, mapping: SoundMapping): number | null {
  const rank = mapping.categories.findIndex(c => c.id === category)
  if (rank < 0) return null
  const last = mapping.categories.length - 1
  return last === 0 ? 0 : rank / last
}

/** The pattern for a category: the coolest gets the shortest pulse and the warmest the longest. */
export function patternFor(category: CategoryId | 'insufficient', mapping: SoundMapping): number[] {
  if (category === 'insufficient') return MISSING_PATTERN
  const share = rankShare(category, mapping)
  if (share === null) return []
  return [Math.round(MIN_PULSE_MS + share * (MAX_PULSE_MS - MIN_PULSE_MS))]
}

/** How hard a gamepad rumbles for a category, 0 to 1: the same rank the pulse's length follows. Missing data is a light tap. */
export function magnitudeFor(category: CategoryId | 'insufficient', mapping: SoundMapping): number {
  if (category === 'insufficient') return 0.2
  const share = rankShare(category, mapping)
  return share === null ? 0 : Math.round((0.25 + 0.75 * share) * 100) / 100
}

/** What a pulse is: the cue's shape, and how hard a pad rumbles for it. */
export type Cue =
  | { kind: 'move'; category: CategoryId | 'insufficient' }
  | { kind: 'edge' }
  | { kind: 'lock' }
  | { kind: 'mark' }

export type Pulse = { pattern: number[]; magnitude: number }

export function pulseOf(cue: Cue, mapping: SoundMapping): Pulse {
  switch (cue.kind) {
    case 'move': return { pattern: patternFor(cue.category, mapping), magnitude: magnitudeFor(cue.category, mapping) }
    case 'edge': return { pattern: EDGE_PATTERN, magnitude: 0.4 }
    case 'lock': return { pattern: LOCK_PATTERN, magnitude: 0.8 }
    case 'mark': return { pattern: MARK_PATTERN, magnitude: 0.6 }
  }
}

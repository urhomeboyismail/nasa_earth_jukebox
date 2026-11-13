// The find game's guide (ticket IX04): a soft note at the cursor, faster as it nears the target. It says how close, never which way. Pure.

export const PULSE_SLOW_MS = 1200
export const PULSE_FAST_MS = 120
/** At this many cells or more the pulse is slowest; at FOUND_WITHIN (1) or less, fastest. */
export const PULSE_FAR_CELLS = 12
export const PULSE_NEAR_CELLS = 1
export const PULSE_LEVEL = 0.15
export const PULSE_SECONDS = 0.08

/** The time to the next pulse for a cursor `distance` cells from the target: 1200 ms far away, 120 ms on it, linear in between. */
export function pulseIntervalMs(distance: number): number {
  if (distance >= PULSE_FAR_CELLS) return PULSE_SLOW_MS
  if (distance <= PULSE_NEAR_CELLS) return PULSE_FAST_MS
  const share = (distance - PULSE_NEAR_CELLS) / (PULSE_FAR_CELLS - PULSE_NEAR_CELLS)
  return Math.round(PULSE_FAST_MS + share * (PULSE_SLOW_MS - PULSE_FAST_MS))
}

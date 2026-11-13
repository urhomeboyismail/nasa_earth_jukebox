// A pulse that lands with its sound (ticket IX10). The caller checks the listener's vibration setting first; this does the timing.

import type { SoundMapping } from '../../data'
import { INTERACTIVE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import { wallTimeOf, type AudioClock } from './clock'
import { rumble } from './pad'
import { pulseOf, type Cue, type Pulse } from './patterns'

/**
 * Milliseconds the pulse is fired earlier than the sound's wall time, to cancel the phone's own motor delay. 0 until it is measured on a
 * device (H06 records the number).
 */
export const VIBRATION_LAG_MS = 0

const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function fire({ pattern, magnitude }: Pulse): void {
  if (pattern.length === 0) return
  if (canVibrate()) {
    try { navigator.vibrate(pattern) } catch { /* the sound is the same */ }
  }
  rumble(pattern, magnitude)
}

/** Fires the pulse at `wallMs` (performance.now() time), or at once if that time has passed. */
export function schedulePulse(pulse: Pulse, wallMs: number, nowMs: number = performance.now()): void {
  const delay = wallMs - VIBRATION_LAG_MS - nowMs
  if (delay <= 0) fire(pulse)
  else window.setTimeout(() => fire(pulse), delay)
}

/** A cue's pulse, timed to the sound the engine plays now (its lookahead after the clock's current time). */
export function pulseCue(cue: Cue, mapping: SoundMapping, clock: AudioClock, contextTime: number = clock.currentTime + INTERACTIVE_LOOKAHEAD_S): void {
  schedulePulse(pulseOf(cue, mapping), wallTimeOf(clock, contextTime))
}

// The sound beacon (ticket IX09): three short notes of a place, 300 ms apart, from where the place is. The first sounds at once (the answer budget, IX01); the
// other two wait on timers, so Escape can stop them with the rest of the sound. The pan says east or west and the height says north or south (3D mode, as
// everywhere else: the ensemble ignores the elevation in stereo).

import type { Ensemble } from '../../audio/ensemble/types'
import { elevationForPoint, panForPoint } from '../../audio/pan'

export const BEACON_PINGS = 3
export const BEACON_GAP_MS = 300
export const BEACON_SECONDS = 0.15
/** As loud as a followed spot's note (IX03); the ensemble's limiter keeps the peak under −1 dBFS. */
export const BEACON_LEVEL = 0.5

export type BeaconPlace = { midi: number; x: number; y: number }

/** Plays the beacon for a place given as fractions of the whole image. Returns a function that stops the pings still to come. */
export function playBeacon(ensemble: Pick<Ensemble, 'playNotes'>, place: BeaconPlace): () => void {
  const note = { midi: place.midi, pan: panForPoint(place.x), elevation: elevationForPoint(place.y), level: BEACON_LEVEL, seconds: BEACON_SECONDS }
  ensemble.playNotes([note])
  const timers = Array.from({ length: BEACON_PINGS - 1 }, (_, i) => window.setTimeout(() => ensemble.playNotes([note]), (i + 1) * BEACON_GAP_MS))
  return () => timers.forEach(timer => window.clearTimeout(timer))
}

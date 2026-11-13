// The sounds that answer a listener (docs/PLAN.md §6.3, ticket IX01). Each is played at once through SN04's `playNotes` (or `playDropout` for missing data), never
// through `apply`, which waits for a frame. Every note comes from notes.ts, so nothing leaves the data's key and range, and nothing is noise.

import { INTERACTIVE_LOOKAHEAD_S } from '../audio/ensemble/constants'
import type { Ensemble } from '../audio/ensemble/types'
import type { Preset } from '../sonify/types'
import { fifthAbove, markNote, noteForPosition, octaveBelow } from './notes'

export type FeedbackEnsemble = Pick<Ensemble, 'playNotes' | 'playDropout' | 'now'>

/** A place on the map as the sound needs it: its position across the legend (null = no data), its pan and, in 3D, its height. */
export type Place = { position: number | null; pan: number; elevation?: number }

export const MOVE_SECONDS = 0.12
export const MOVE_LEVEL = 0.5
export const EDGE_SECONDS = 0.06
export const EDGE_GAP_S = 0.08
export const LOCK_SECONDS = 0.25
export const UNLOCK_GAP_S = 0.12
export const MARK_SECONDS = 0.5
export const UNDO_LEVEL = 0.3
/** A place with no data has no note; the edge cue then uses the middle of the range. */
const MIDDLE = 0.5

export type Feedback = {
  move(place: Place): void
  edge(place: Place): void
  lock(place: Place): void
  unlock(place: Place): void
  mark(): void
  undo(place: Place): void
}

export function createFeedback(ensemble: FeedbackEnsemble, preset: Preset): Feedback {
  const noteOf = (place: Place) => noteForPosition(place.position ?? MIDDLE, preset)
  const spot = (place: Place) => ({ pan: place.pan, ...(place.elevation !== undefined && { elevation: place.elevation }) })
  /** A time `after` seconds from the default lead. */
  const later = (after: number) => ensemble.now() + INTERACTIVE_LOOKAHEAD_S + after

  return {
    move(place) {
      if (place.position === null) ensemble.playDropout()
      else ensemble.playNotes([{ midi: noteOf(place), level: MOVE_LEVEL, seconds: MOVE_SECONDS, ...spot(place) }])
    },
    edge(place) {
      const midi = noteOf(place)
      ensemble.playNotes([{ midi, level: MOVE_LEVEL, seconds: EDGE_SECONDS, ...spot(place) }])
      ensemble.playNotes([{ midi: octaveBelow(midi), level: MOVE_LEVEL, seconds: EDGE_SECONDS, ...spot(place) }], later(EDGE_GAP_S))
    },
    lock(place) {
      const midi = noteOf(place)
      ensemble.playNotes([
        { midi, level: MOVE_LEVEL, seconds: LOCK_SECONDS, ...spot(place) },
        { midi: fifthAbove(midi, preset), level: MOVE_LEVEL, seconds: LOCK_SECONDS, ...spot(place) },
      ])
    },
    unlock(place) {
      const midi = noteOf(place)
      ensemble.playNotes([{ midi: fifthAbove(midi, preset), level: MOVE_LEVEL, seconds: MOVE_SECONDS, ...spot(place) }])
      ensemble.playNotes([{ midi, level: MOVE_LEVEL, seconds: MOVE_SECONDS, ...spot(place) }], later(UNLOCK_GAP_S))
    },
    mark() {
      ensemble.playNotes([{ midi: markNote(preset), level: MOVE_LEVEL, pan: 0, seconds: MARK_SECONDS }])
    },
    undo(place) {
      if (place.position === null) ensemble.playDropout()
      else ensemble.playNotes([{ midi: noteOf(place), level: UNDO_LEVEL, seconds: MOVE_SECONDS, ...spot(place) }])
    },
  }
}

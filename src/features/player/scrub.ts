// Scrubbing time by ear (docs/PLAN.md §6.3, ticket IX06), the pure part: which date a step lands on, and the short slice of that date's music that sounds
// with it. The handlers are in useScrub.ts. Nothing here is random, so the same step always gives the same date and the same slice.

import type { NoteEvent } from '../../audio/ensemble/types'
import { notesOf } from '../../interaction/notes'
import type { MusicFrame } from '../../sonify'

/** How long each scrub step sounds. */
export const SLICE_SECONDS = 0.15
/** Holding a key steps this many times a second, so the slices are distinct sounds and not a smear. The dates still move on every key repeat. */
export const SCRUB_STEPS_PER_SECOND = 8
export const SLICE_MIN_GAP_MS = 1000 / SCRUB_STEPS_PER_SECOND

export type ScrubStep = { by: number } | { to: 'first' | 'last' }

/** The date a step lands on, kept inside the dates. `length` is the number of dates. */
export function scrubTarget(index: number, step: ScrubStep, length: number): number {
  const last = Math.max(0, length - 1)
  const target = 'by' in step ? index + step.by : step.to === 'first' ? 0 : last
  return Math.min(last, Math.max(0, target))
}

/** A step that cannot move says why, in words: it also makes no sound. */
export function endWords(index: number, target: number, length: number): string | null {
  if (target !== index) return null
  if (length < 2) return 'Only one date.'
  return index === 0 ? 'First date.' : index === length - 1 ? 'Last date.' : null
}

/** The slice of a date's music: every note of the frame (melody, chord, hot spots), SLICE_SECONDS long. Each call lets go by itself. */
export function sliceNotes(music: MusicFrame): NoteEvent[] {
  return notesOf(music, SLICE_SECONDS)
}

/** Whether enough time has passed since the last slice for another to sound. The first is always due. */
export function sliceDue(lastAtMs: number | null, nowMs: number): boolean {
  return lastAtMs === null || nowMs - lastAtMs >= SLICE_MIN_GAP_MS
}

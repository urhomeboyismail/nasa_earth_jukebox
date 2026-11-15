// Event cues (ticket SN17): a data set's manifest may list dated events (`events`). When playback reaches an event's date, Symphony plays one short
// cue placed left or right by where the event is, and announces what happened. Pure: the same events and dates always give the same cues and words.

import type { ManifestEvent } from '../data/types'
import { placeWord } from './fuse'

/** At most this many cues sound on one frame; the caption still names every event. */
export const MAX_EVENT_CUES = 2
/** Each cue note's level (0 to 1): well under the melody (0.8), and through the master bus, so the −1 dBFS ceiling holds. */
export const EVENT_CUE_LEVEL = 0.3
export const EVENT_CUE_SECONDS = 0.12
/** A second cue on the same frame starts this much later, so two events are heard as two. */
export const EVENT_CUE_GAP_S = 0.18
/** A short, bright ping: a fifth high above the music (G5 and C6). */
const CUE_MIDIS = [79, 84] as const

export type EventCue = { offsetS: number; notes: { midi: number; level: number; pan: number; seconds: number }[] }

/**
 * The events dated after `after` (not included) and up to `upTo` (included), in date order. None on the first frame (`after` null) and none when
 * the dates go backwards (a replay or a scrub back), so an event sounds when playback moves forward over its date.
 */
export function eventsBetween(events: readonly ManifestEvent[], after: string | null, upTo: string): ManifestEvent[] {
  if (after === null || after >= upTo) return []
  return events.filter(e => e.date > after && e.date <= upTo).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

/** One cue for each of the first MAX_EVENT_CUES events, panned by the event's place (centre when it has none). */
export function eventCues(events: readonly ManifestEvent[]): EventCue[] {
  return events.slice(0, MAX_EVENT_CUES).map((event, i) => ({
    offsetS: i * EVENT_CUE_GAP_S,
    notes: CUE_MIDIS.map(midi => ({ midi, level: EVENT_CUE_LEVEL, pan: event.place ? event.place.x * 2 - 1 : 0, seconds: EVENT_CUE_SECONDS })),
  }))
}

/** The words for the events reached on one frame: "Event: Hurricane Idalia forms, south-west." or "Events: A; B." */
export function eventSentence(events: readonly ManifestEvent[]): string {
  const one = (e: ManifestEvent) => `${e.label}${e.place ? `, ${placeWord(e.place)}` : ''}`
  return events.length === 1 ? `Event: ${one(events[0])}.` : `Events: ${events.map(one).join('; ')}.`
}

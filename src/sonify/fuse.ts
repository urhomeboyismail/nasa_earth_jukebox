// Fusion (docs/planning/UIUX-BLUEPRINT.md §3.2): two data sets heard as one piece of music. Every voice follows exactly one data set, so what is
// heard can always be traced back: deck A keeps the melody, the harmony, the motion and the clock; deck B plays the bass and the rhythm; the hot
// spots of both sound, A's on the left and B's on the right. The captions name the deck. Pure, like the rest of the ruleset.

import { VOICE_IDS } from '../data/sonification'
import { MAX_HOTSPOT_NOTES } from './ranges'
import type { FrameFeatures } from '../analysis/features/types'
import type { MusicFrame, VoiceId } from './types'

export type Deck = 'A' | 'B'

/** Which deck each voice follows. */
export const FUSION_ROLES: Record<VoiceId, Deck | 'both'> = {
  melody: 'A', harmony: 'A', bass: 'B', hotspots: 'both', rhythm: 'B', motion: 'A', time: 'A',
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const scaled = <T extends { level: number }>(voice: T | null, gain: number): T | null => (voice ? { ...voice, level: voice.level * gain } : null)
const said = (deck: Deck, text: string | undefined) => (text ? `${deck}: ${text}` : '')

/**
 * One frame of A and the latest frame of B (null until B has been read) as one MusicFrame. `mix` is the crossfader: 0 only A, 0.5 both at full
 * level, 1 only B.
 */
export function fuseFrames(a: MusicFrame, b: MusicFrame | null, mix = 0.5): MusicFrame {
  const gainA = clamp01(2 * (1 - mix))
  const gainB = b ? clamp01(2 * mix) : 0
  const spotsA = a.hotspots.map(spot => ({ ...spot, pan: (spot.pan - 1) / 2, level: spot.level * gainA }))
  const spotsB = (b?.hotspots ?? []).map(spot => ({ ...spot, id: `B:${spot.id}`, pan: (spot.pan + 1) / 2, level: spot.level * gainB }))
  // Taken in turn, so neither deck's hot spots crowd the other's out.
  const hotspots = Array.from({ length: Math.max(spotsA.length, spotsB.length) }, (_, i) => [spotsA[i], spotsB[i]]).flat().filter(spot => spot !== undefined).slice(0, MAX_HOTSPOT_NOTES)

  const missing = VOICE_IDS.filter(voice => {
    const role = FUSION_ROLES[voice]
    if (role === 'A') return a.missing.includes(voice)
    if (role === 'B') return !b || b.missing.includes(voice)
    return a.missing.includes(voice) && (!b || b.missing.includes(voice))
  })

  const caption = { ...a.caption }
  for (const voice of VOICE_IDS) {
    const role = FUSION_ROLES[voice]
    caption[voice] = role === 'A' ? said('A', a.caption[voice]) : role === 'B' ? said('B', b?.caption[voice]) : [said('A', a.caption[voice]), said('B', b?.caption[voice])].filter(Boolean).join(' ')
  }

  return {
    ...a,
    melody: scaled(a.melody, gainA),
    harmony: scaled(a.harmony, gainA),
    motion: scaled(a.motion, gainA),
    time: { ...a.time, level: a.time.level * gainA },
    bass: scaled(b?.bass ?? null, gainB),
    rhythm: scaled(b?.rhythm ?? null, gainB),
    hotspots,
    missing,
    caption,
    summary: [said('A', a.summary), said('B', b?.summary)].filter(Boolean).join(' '),
  }
}


// Shared moments (ticket UI09): when both decks are at an extreme on the same date and in the same place, the listener hears a short chord and
// reads one sentence. Pure and deterministic: the same two decks always give the same list.

/** A deck's extreme counts when its reading is within this share of its own range from the top or the bottom. */
export const EXTREME_SHARE = 0.1
/** "The same place" without regions: within one coarse block of the picture, as a fraction of the image width (the motion blocks are 1/8). */
export const SAME_PLACE = 1 / 8
/** The whole chord is this much quieter than the decks. */
export const CHORD_DB = -12
export const CHORD_SECONDS = 0.6
/** Moments closer than this are said as one line. */
export const MERGE_SECONDS = 2

/** One date of one deck: the reading (0 to 1 across the legend; null = cannot be read) and where it is, as fractions of the image. */
export type DeckSample = { date: string; value: number | null; at: { x: number; y: number } | null }

export type Aligned = {
  /** Index into the shared dates (both decks' samples are in the same order). */
  dateIndex: number
  date: string
  kind: 'together' | 'opposed'
  aHigh: boolean
  bHigh: boolean
  /** The ninth of the map where both extremes are, or '' when either deck has no place. */
  place: string
}

/** The reading of one frame as a sample: the median position, and the strongest hot spot (else the max or min cell) as the place. */
export function sampleOf(features: FrameFeatures): DeckSample {
  const value = features.stats.position
  const high = value !== null && value >= 0.5
  const spot = features.hotspots.find(h => h.band === (high ? 'high' : 'low')) ?? features.hotspots[0]
  const cell = high ? features.stats.max : features.stats.min
  const at = spot ? spot.centroid : cell ? { x: cell.x, y: cell.y } : null
  return { date: features.date, value, at }
}

const NINTHS = [['north-west', 'north', 'north-east'], ['west', 'centre', 'east'], ['south-west', 'south', 'south-east']]
const third = (v: number) => Math.min(2, Math.max(0, Math.floor(v * 3)))
/** The ninth of the map a place is in (north-west to south-east, centre). */
export function placeWord(at: { x: number; y: number }): string {
  return NINTHS[third(at.y)][third(at.x)]
}

function extremes(samples: DeckSample[]): (boolean | null)[] {
  const values = samples.flatMap(s => (s.value === null ? [] : [s.value]))
  if (!values.length) return samples.map(() => null)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const margin = (hi - lo) * EXTREME_SHARE
  if (hi === lo) return samples.map(() => null)
  // true = high extreme, false = low extreme, null = in between or unreadable
  return samples.map(s => (s.value === null ? null : s.value >= hi - margin ? true : s.value <= lo + margin ? false : null))
}

/**
 * The dates where both decks are extreme at once. `a` and `b` are the same length and in the same date order (B read with `frameOn`).
 * Extreme: in the top or bottom EXTREME_SHARE of that deck's own range over these dates. Aligned: within SAME_PLACE of each other, or on
 * the same date when either deck has no place. `together` when both are high or both low, `opposed` otherwise.
 */
export function alignedExtremes(a: DeckSample[], b: DeckSample[], sameWithin = SAME_PLACE): Aligned[] {
  const ea = extremes(a)
  const eb = extremes(b)
  const found: Aligned[] = []
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const aHigh = ea[i]
    const bHigh = eb[i]
    if (aHigh === null || bHigh === null) continue
    const pa = a[i].at
    const pb = b[i].at
    if (pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) > sameWithin) continue
    found.push({ dateIndex: i, date: a[i].date, kind: aHigh === bHigh ? 'together' : 'opposed', aHigh, bHigh, place: pa && pb ? placeWord({ x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }) : '' })
  }
  return found
}

/**
 * The chord's notes: a major triad on the key's root when the extremes point the same way, with a minor second added when they oppose.
 * The notes together are CHORD_DB below the decks, and follows the crossfader's middle: full at 0.5, silent at either end (one deck alone has no moment).
 */
export function momentChord(kind: Aligned['kind'], tonic: number, mix = 0.5): { midi: number; level: number; pan: number; seconds: number }[] {
  const root = 60 + tonic
  const total = 10 ** (CHORD_DB / 20) * (1 - Math.abs(2 * mix - 1))
  const midis = kind === 'together' ? [root, root + 4, root + 7] : [root, root + 1, root + 4, root + 7]
  // The −12 dB is shared between the notes, so the whole chord is that loud and never nears the ceiling.
  return midis.map(midi => ({ midi, level: total / midis.length, pan: 0, seconds: CHORD_SECONDS }))
}

/** The sentence under the decks. `words` are each deck's variable name and its words for the highest and lowest. */
export function momentSentence(moment: Aligned, a: { name: string; highest: string; lowest: string }, b: { name: string; highest: string; lowest: string }): string {
  const at = moment.place ? `, ${moment.place}` : ''
  const wordA = moment.aHigh ? a.highest : a.lowest
  const wordB = moment.bHigh ? b.highest : b.lowest
  const lead = moment.kind === 'opposed' ? 'One high and one low' : moment.aHigh ? 'Both high together' : 'Both low together'
  return `${lead}${at}: A's ${a.name} (${wordA}) and B's ${b.name} (${wordB}).`
}

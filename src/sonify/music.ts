// The ruleset (docs/PLAN.md §6.3, ticket SN03): one frame's features in, one frame of music out. Pure and deterministic: every rule is a function of
// `features`, `preset` and `prev` only, so the live path, the offline render, the captions and the golden tests all use the same rules.
// A voice with no data is missing (silent, named in `missing`); a voice with nothing to do is quiet (null, not named).

import type { FrameFeatures } from '../analysis/features/types'
import { elevationForPoint, panForPoint } from '../audio/pan'
import { VOICE_IDS, type VoiceId } from '../data/sonification'
import { captionsFor, trendOf, type CaptionParts } from './captions'
import { chordOn, pitchClasses, snapToClasses, snapToScale } from './presets'
import {
  BASS_HIGH_MIDI, BASS_LOW_MIDI, BASS_SHIFT_SEMITONES, CHORD_ROOT_DEGREES, HARMONY_HIGH_MIDI, HARMONY_LOW_MIDI, HARMONY_MIN_SHARE, HOTSPOT_FULL_SHARE,
  HOTSPOT_LOW_MIDI, HOTSPOT_SPAN, LEVEL, MAX_HARMONY_NOTES, MAX_HOTSPOT_NOTES, MELODY_LOW_MIDI, MELODY_SMOOTHING, MELODY_SPAN, MIN_CHORD_GAP,
  MOTION_FULL_SPEED, RHYTHM_BUSY_DENSITY, RHYTHM_LOW_MIDI, RHYTHM_NOTES, RHYTHM_SPAN, RHYTHM_SPARSE_DENSITY, SEVENTH_SPREAD, TRIAD_NOTES,
} from './ranges'
import type { MusicFrame, Preset } from './types'

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Sorted ascending, each note once. */
const sortedUnique = (notes: number[]) => [...new Set(notes)].sort((a, b) => a - b)

function melodyFor(position: number | null, preset: Preset, prev: MusicFrame | null | undefined) {
  if (position === null) return { melody: null, smoothed: null }
  const before = prev?.state.melodyPosition ?? null
  const smoothed = before === null ? position : before + (position - before) * MELODY_SMOOTHING
  const midi = snapToScale(MELODY_LOW_MIDI + smoothed * MELODY_SPAN, preset, MELODY_LOW_MIDI, MELODY_LOW_MIDI + MELODY_SPAN)
  const glide = prev?.melody != null && prev.melody.midi !== midi
  return { melody: { midi, glide, level: LEVEL.melody }, smoothed }
}

/** The lowest note of pitch class `pitchClass` at or above `low`. */
const lowestAbove = (pitchClass: number, low: number) => low + ((((pitchClass - low) % 12) + 12) % 12)

/** True when no two notes of the sorted chord are closer than MIN_CHORD_GAP: no seconds, no cluster. */
export function isSpaced(midis: readonly number[]): boolean {
  return midis.every((note, i) => i === 0 || note - midis[i - 1] >= MIN_CHORD_GAP)
}

/** Every way to place each pitch class once inside [low, high], each sorted ascending. */
function placements(pitchClasses: readonly number[], low: number, high: number): number[][] {
  let voicings: number[][] = [[]]
  for (const pitchClass of pitchClasses) {
    const notes: number[] = []
    for (let note = lowestAbove(pitchClass, low); note <= high; note += 12) notes.push(note)
    voicings = voicings.flatMap(voicing => notes.map(note => [...voicing, note]))
  }
  return voicings.map(voicing => voicing.sort((a, b) => a - b))
}

/** How far the voices move from one chord to the next: notes paired in sorted order; when the sizes differ, each note to the other chord's nearest. */
function movement(from: readonly number[], to: readonly number[]): number {
  if (from.length === to.length) return to.reduce((sum, note, i) => sum + Math.abs(note - from[i]), 0)
  const nearest = (note: number, other: readonly number[]) => Math.min(...other.map(o => Math.abs(o - note)))
  return to.reduce((sum, note) => sum + nearest(note, from), 0) + from.reduce((sum, note) => sum + nearest(note, to), 0)
}

/** Negative when sorted chord `a` is lower than `b`: compared note by note from the bottom. */
function lowerFirst(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

/**
 * The chord `pitchClasses` (root first, from `chordOn`) as sorted MIDI notes inside [low, high], each pitch class once. Of the spaced voicings
 * (`isSpaced`; all of them if none is), the one that moves least from `prev`; a tie goes to the lower one. With no previous chord: root position
 * (the root lowest), as low as it fits.
 */
export function voiceChord(pitchClasses: readonly number[], low: number, high: number, prev: readonly number[] | null | undefined): number[] {
  const all = placements(pitchClasses, low, high)
  const spaced = all.filter(isSpaced)
  let pool = spaced.length ? spaced : all
  if (!prev?.length) {
    const rooted = pool.filter(voicing => voicing[0] % 12 === pitchClasses[0])
    if (rooted.length) pool = rooted
    return [...pool].sort(lowerFirst)[0] ?? []
  }
  return [...pool].sort((a, b) => movement(prev, a) - movement(prev, b) || lowerFirst(a, b))[0] ?? []
}

/** The share-weighted mean and standard deviation of the band numbers. */
function weightedBands(bands: { share: number; band: number }[]) {
  const total = bands.reduce((sum, b) => sum + b.share, 0)
  const mean = bands.reduce((sum, b) => sum + b.share * b.band, 0) / total
  const spread = Math.sqrt(bands.reduce((sum, b) => sum + b.share * (b.band - mean) ** 2, 0) / total)
  return { mean, spread }
}

/**
 * The chord, built in thirds from the preset's scale. The histogram's weighted mean band picks the root from CHORD_ROOT_DEGREES; a wide spread
 * of the bands that hold a tenth or more makes it a seventh, else a triad. The chord holds while its root and size do, and moves to the next by
 * the smallest step (voice leading).
 */
function harmonyFor(histogram: number[], preset: Preset, prev: MusicFrame | null | undefined) {
  const total = histogram.reduce((sum, share) => sum + share, 0)
  if (total <= 0) return { harmony: null, chordKey: '', rootClass: null }
  const bands = histogram.map((share, band) => ({ share, band }))
  const range = Math.max(1, histogram.length - 1)
  const roots = CHORD_ROOT_DEGREES[preset.scale]
  const along = weightedBands(bands).mean / range
  const root = roots[Math.min(roots.length - 1, Math.floor(along * roots.length))]
  const heard = bands.filter(b => b.share >= HARMONY_MIN_SHARE)
  const size = heard.length > 1 && weightedBands(heard).spread / range >= SEVENTH_SPREAD ? MAX_HARMONY_NOTES : TRIAD_NOTES
  const rootClass = chordOn(root, 1, preset)[0]
  const chordKey = `${root}:${size}`
  // The chord changes only when its root or its size does.
  if (chordKey === prev?.state.chordKey && prev.harmony) return { harmony: { midis: [...prev.harmony.midis], level: LEVEL.harmony }, chordKey, rootClass }
  const before = prev?.harmony?.midis
  let midis = voiceChord(chordOn(root, size, preset), HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI, before)
  // A seventh that cannot be spaced inside the range is played as its triad.
  if (!isSpaced(midis)) midis = voiceChord(chordOn(root, TRIAD_NOTES, preset), HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI, before)
  return { harmony: { midis, level: LEVEL.harmony }, chordKey, rootClass }
}

/** The bass rests on the chord's root (the tonic with no chord), and the data's shift moves it from there. */
function bassFor(features: FrameFeatures, preset: Preset, rootClass: number | null) {
  const { position } = features.stats
  if (position === null) return { bass: null, shift: null }
  const shift = features.change
    ? (features.change.shift ?? 0)
    : features.reference === null ? 0 : clamp((position - features.reference) * 2, -1, 1)
  const rest = lowestAbove(rootClass ?? preset.tonic, BASS_LOW_MIDI)
  const midi = snapToScale(rest + Math.round(shift * BASS_SHIFT_SEMITONES), preset, BASS_LOW_MIDI, BASS_HIGH_MIDI)
  return { bass: { midi, level: LEVEL.bassBase + LEVEL.bassRange * Math.abs(shift) }, shift }
}

function hotspotsFor(features: FrameFeatures, preset: Preset): MusicFrame['hotspots'] {
  return features.hotspots.slice(0, MAX_HOTSPOT_NOTES).map(spot => ({
    id: spot.id,
    band: spot.band,
    midi: snapToScale(HOTSPOT_LOW_MIDI + spot.peakPosition * HOTSPOT_SPAN, preset, HOTSPOT_LOW_MIDI, HOTSPOT_LOW_MIDI + HOTSPOT_SPAN),
    pan: panForPoint(spot.centroid.x),
    elevation: elevationForPoint(spot.centroid.y),
    level: Math.min(1, Math.sqrt(spot.areaShare / HOTSPOT_FULL_SHARE)),
  }))
}

/** An arpeggio of the chord's tones (the scale's, with no chord) along the strongest edge line: each point's x picks the note. */
function rhythmFor(features: FrameFeatures, preset: Preset, chord: readonly number[] | null): MusicFrame['rhythm'] {
  const line = features.edges.strongest
  if (!line || !line.points.length) return null
  const { density } = features.edges
  const perBeat = density < RHYTHM_SPARSE_DENSITY ? 1 : density >= RHYTHM_BUSY_DENSITY ? 4 : 2
  const tones = chord ? new Set(chord.map(midi => midi % 12)) : pitchClasses(preset)
  const last = line.points.length - 1
  const notes = Array.from({ length: RHYTHM_NOTES }, (_, i) => line.points[Math.round((i * last) / (RHYTHM_NOTES - 1))])
    .map(point => snapToClasses(RHYTHM_LOW_MIDI + point.x * RHYTHM_SPAN, tones, RHYTHM_LOW_MIDI, RHYTHM_LOW_MIDI + RHYTHM_SPAN))
  const meanX = line.points.reduce((sum, point) => sum + point.x, 0) / line.points.length
  return { midis: sortedUnique(notes), perBeat, pan: panForPoint(meanX), level: LEVEL.rhythm }
}

function motionFor(features: FrameFeatures): MusicFrame['motion'] {
  const { motion } = features
  if (!motion) return null
  const openness = Math.min(1, motion.speed / MOTION_FULL_SPEED)
  return { openness, sweep: clamp(motion.dx / MOTION_FULL_SPEED, -1, 1), level: LEVEL.motionBase + LEVEL.motionRange * openness }
}

function timeFor(features: FrameFeatures, preset: Preset, prev: MusicFrame | null | undefined): MusicFrame['time'] {
  let accent: MusicFrame['time']['accent'] = 'none'
  if (prev) {
    // Dates are YYYY-MM-DD, so the year and month are text slices; no Date object, no time zone.
    if (features.date.slice(0, 3) !== prev.date.slice(0, 3)) accent = 'decade'
    else if (features.date.slice(0, 4) !== prev.date.slice(0, 4)) accent = 'year'
    else if (features.date.slice(5, 7) !== prev.date.slice(5, 7)) accent = 'month'
  }
  return { accent, pulseBpm: preset.bpm, level: LEVEL.time }
}

/**
 * One frame of music from one frame's features. `prev` is the music frame before it in the same run (omit it for the first frame): it gives the
 * melody its smoothing and its glide, the chord its hold and its voice leading, and the time voice its accent.
 *
 * When the picture cannot be read (`stats.position` is null: too few readable cells) the frame is a dropout: only the time pulse sounds. The
 * hot spots, edges and motion of a picture that unreadable are not trusted either, so those voices are quiet too.
 */
export function toMusicFrame(features: FrameFeatures, preset: Preset, prev?: MusicFrame | null): MusicFrame {
  const { position } = features.stats
  const dropout = position === null

  const { melody, smoothed } = melodyFor(position, preset, prev)
  const { harmony, chordKey, rootClass } = dropout ? { harmony: null, chordKey: '', rootClass: null } : harmonyFor(features.histogram, preset, prev)
  const { bass, shift } = bassFor(features, preset, rootClass)
  const hotspots = dropout ? [] : hotspotsFor(features, preset)
  const rhythm = dropout ? null : rhythmFor(features, preset, harmony?.midis ?? null)
  const motion = dropout ? null : motionFor(features)
  const time = timeFor(features, preset, prev)

  const silent: Record<VoiceId, boolean> = { melody: melody === null, harmony: harmony === null, bass: bass === null, hotspots: false, rhythm: false, motion: false, time: false }
  const missing = VOICE_IDS.filter(id => silent[id])

  const first = features.hotspots[0]
  const parts: CaptionParts = {
    dropout,
    missing,
    melody: melody && position !== null ? { position: smoothed ?? position, trend: trendOf(smoothed, prev?.state.melodyPosition ?? null) } : null,
    harmony: harmony ? { notes: harmony.midis.length } : null,
    bass: bass && shift !== null ? { shift, trend: trendOf(shift, prev?.state.shift ?? null) } : null,
    hotspots: hotspots.length && first ? { count: hotspots.length, band: first.band, x: first.centroid.x, y: first.centroid.y } : null,
    rhythm: rhythm ? { perBeat: rhythm.perBeat } : null,
    motion: motion ? { openness: motion.openness, sweep: motion.sweep } : null,
    time,
  }
  const { caption, summary } = captionsFor(parts)

  return {
    frameId: features.frameId,
    date: features.date,
    melody, harmony, bass, hotspots, rhythm, motion, time,
    missing,
    dropout,
    caption,
    summary,
    state: { melodyPosition: smoothed, chordKey, shift },
  }
}

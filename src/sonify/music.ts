// The ruleset (docs/PLAN.md §6.3, ticket SN03): one frame's features in, one frame of music out. Pure and deterministic: every rule is a function of
// `features`, `preset` and `prev` only, so the live path, the offline render, the captions and the golden tests all use the same rules.
// A voice with no data is missing (silent, named in `missing`); a voice with nothing to do is quiet (null, not named).

import type { FrameFeatures } from '../analysis/features/types'
import { elevationForPoint, panForPoint } from '../audio/pan'
import { VOICE_IDS, type VoiceId } from '../data/sonification'
import { captionsFor, trendOf, type CaptionParts } from './captions'
import { SCALES, snapToScale } from './presets'
import {
  BASS_HIGH_MIDI, BASS_LOW_MIDI, BASS_SHIFT_SEMITONES, HARMONY_LOW_MIDI, HARMONY_MIN_SHARE, HOTSPOT_FULL_SHARE, HOTSPOT_LOW_MIDI,
  HOTSPOT_SPAN, LEVEL, MAX_HARMONY_NOTES, MAX_HOTSPOT_NOTES, MELODY_LOW_MIDI, MELODY_SMOOTHING, MELODY_SPAN, MOTION_FULL_SPEED, RHYTHM_BUSY_DENSITY,
  RHYTHM_LOW_MIDI, RHYTHM_NOTES, RHYTHM_SPAN, RHYTHM_SPARSE_DENSITY,
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

/** The note of scale degree `degree` inside the harmony range. */
function degreeMidi(degree: number, preset: Preset): number {
  const pitchClass = (preset.tonic + SCALES[preset.scale][degree]) % 12
  return HARMONY_LOW_MIDI + ((((pitchClass - HARMONY_LOW_MIDI) % 12) + 12) % 12)
}

function harmonyFor(histogram: number[], preset: Preset, prev: MusicFrame | null | undefined) {
  const total = histogram.reduce((sum, share) => sum + share, 0)
  if (total <= 0) return { harmony: null, chordKey: '' }
  const bands = histogram.map((share, band) => ({ share, band }))
  let heard = bands.filter(b => b.share >= HARMONY_MIN_SHARE)
  // With very many bands none may reach the minimum: the fullest one still sounds.
  if (!heard.length) heard = [bands.reduce((best, b) => (b.share > best.share ? b : best))]
  heard = heard.sort((a, b) => b.share - a.share || a.band - b.band).slice(0, MAX_HARMONY_NOTES)
  const degrees = SCALES[preset.scale].length - 1
  const midis = sortedUnique(heard.map(({ band }) => degreeMidi(histogram.length === 1 ? 0 : Math.round((band * degrees) / (histogram.length - 1)), preset)))
  const chordKey = midis.join(',')
  // The chord changes only when the mix does.
  const held = chordKey === prev?.state.chordKey && prev.harmony ? prev.harmony.midis : midis
  return { harmony: { midis: [...held], level: LEVEL.harmony }, chordKey }
}

function bassFor(features: FrameFeatures, preset: Preset) {
  const { position } = features.stats
  if (position === null) return { bass: null, shift: null }
  const shift = features.change
    ? (features.change.shift ?? 0)
    : features.reference === null ? 0 : clamp((position - features.reference) * 2, -1, 1)
  const midi = snapToScale(BASS_LOW_MIDI + preset.tonic + Math.round(shift * BASS_SHIFT_SEMITONES), preset, BASS_LOW_MIDI, BASS_HIGH_MIDI)
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

function rhythmFor(features: FrameFeatures, preset: Preset): MusicFrame['rhythm'] {
  const line = features.edges.strongest
  if (!line || !line.points.length) return null
  const { density } = features.edges
  const perBeat = density < RHYTHM_SPARSE_DENSITY ? 1 : density >= RHYTHM_BUSY_DENSITY ? 4 : 2
  const last = line.points.length - 1
  const notes = Array.from({ length: RHYTHM_NOTES }, (_, i) => line.points[Math.round((i * last) / (RHYTHM_NOTES - 1))])
    .map(point => snapToScale(RHYTHM_LOW_MIDI + point.x * RHYTHM_SPAN, preset, RHYTHM_LOW_MIDI, RHYTHM_LOW_MIDI + RHYTHM_SPAN))
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
 * melody its smoothing and its glide, the chord its hold and the time voice its accent.
 *
 * When the picture cannot be read (`stats.position` is null: too few readable cells) the frame is a dropout: only the time pulse sounds. The
 * hot spots, edges and motion of a picture that unreadable are not trusted either, so those voices are quiet too.
 */
export function toMusicFrame(features: FrameFeatures, preset: Preset, prev?: MusicFrame | null): MusicFrame {
  const { position } = features.stats
  const dropout = position === null

  const { melody, smoothed } = melodyFor(position, preset, prev)
  const { harmony, chordKey } = dropout ? { harmony: null, chordKey: '' } : harmonyFor(features.histogram, preset, prev)
  const { bass, shift } = bassFor(features, preset)
  const hotspots = dropout ? [] : hotspotsFor(features, preset)
  const rhythm = dropout ? null : rhythmFor(features, preset)
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

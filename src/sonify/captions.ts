// The words for the caption strip and for announcements (docs/PLAN.md §6.3, ticket SN03). Rules, no model. A caption says what a voice is doing in
// plain terms (high, middle, low; rising, falling, steady; a compass sector); it never names a variable, a unit or a place outside the map.
// A voice with no data says "not enough data"; a voice that is merely quiet has an empty caption.

import type { Band } from '../analysis/features/types'
import { VOICE_IDS, type VoiceId } from '../data/sonification'
import { TREND_STEP } from './ranges'

export type Trend = 'rising' | 'falling' | 'steady'

/** What the captions need to know about one frame. Built by `toMusicFrame`. */
export type CaptionParts = {
  dropout: boolean
  missing: readonly VoiceId[]
  melody: { position: number; trend: Trend | null } | null
  harmony: { notes: number } | null
  bass: { shift: number; trend: Trend | null } | null
  /** The largest hot spot, and how many sound. */
  hotspots: { count: number; band: Band; x: number; y: number } | null
  rhythm: { perBeat: 1 | 2 | 4 } | null
  motion: { openness: number; sweep: number } | null
  time: { accent: 'none' | 'month' | 'year' }
}

/** Thirds of the 0 to 1 range. */
export function levelWord(value: number): 'low' | 'middle' | 'high' {
  return value < 1 / 3 ? 'low' : value < 2 / 3 ? 'middle' : 'high'
}

/** Rising or falling when the change is at least TREND_STEP, else steady. No trend without an earlier value. */
export function trendOf(now: number | null, before: number | null): Trend | null {
  if (now === null || before === null) return null
  const change = now - before
  return change >= TREND_STEP ? 'rising' : change <= -TREND_STEP ? 'falling' : 'steady'
}

const ROWS = ['north', '', 'south'] as const
const COLUMNS = ['west', '', 'east'] as const

/** Where in the map a point is, as a 3 × 3 split of the image: 'north-west' … 'south-east', or 'centre'. x and y are 0 to 1 fractions of the image. */
export function sectorOf(x: number, y: number): string {
  const row = ROWS[Math.min(2, Math.max(0, Math.floor(y * 3)))]
  const column = COLUMNS[Math.min(2, Math.max(0, Math.floor(x * 3)))]
  return [row, column].filter(Boolean).join('-') || 'centre'
}

const NOT_ENOUGH = 'not enough data'
const LABELS: Record<VoiceId, string> = { melody: 'Melody', harmony: 'Harmony', bass: 'Bass', hotspots: 'Hot spots', rhythm: 'Rhythm', motion: 'Motion', time: 'Time' }

const withTrend = (word: string, trend: Trend | null) => (trend ? `${word}, ${trend}` : word)

const rhythmWord = (perBeat: 1 | 2 | 4) => (perBeat === 1 ? 'sparse' : perBeat === 4 ? 'busy' : 'steady')

const eastWest = (sweep: number) => (sweep > 0.1 ? 'east' : sweep < -0.1 ? 'west' : null)

export function captionsFor(parts: CaptionParts): { caption: Record<VoiceId, string>; summary: string } {
  const caption = Object.fromEntries(VOICE_IDS.map(id => [id, ''])) as Record<VoiceId, string>
  for (const id of parts.missing) caption[id] = `${LABELS[id]}: ${NOT_ENOUGH}`

  if (parts.melody) caption.melody = `Melody: ${withTrend(levelWord(parts.melody.position), parts.melody.trend)}`
  if (parts.harmony) {
    const { notes } = parts.harmony
    caption.harmony = `Harmony: ${notes <= 1 ? 'thin' : notes === 2 ? 'medium' : 'thick'} chord, ${notes} ${notes === 1 ? 'note' : 'notes'}`
  }
  if (parts.bass) caption.bass = `Bass: ${withTrend(levelWord((parts.bass.shift + 1) / 2), parts.bass.trend)}`
  if (parts.hotspots && parts.hotspots.count > 0) {
    const { count, band, x, y } = parts.hotspots
    caption.hotspots = `Hot spots: ${count}, the largest is a ${band} one in the ${sectorOf(x, y)}`
  }
  if (parts.rhythm) caption.rhythm = `Rhythm: ${rhythmWord(parts.rhythm.perBeat)}`
  if (parts.motion) {
    const side = eastWest(parts.motion.sweep)
    caption.motion = `Motion: ${parts.motion.openness === 0 ? 'still' : levelWord(parts.motion.openness)}${side ? `, towards the ${side}` : ''}`
  }
  const accent = parts.time.accent === 'year' ? ', new year' : parts.time.accent === 'month' ? ', new month' : ''
  caption.time = `Time: steady pulse${accent}`

  if (parts.dropout) return { caption, summary: 'Not enough readable data on this date: only the time pulse sounds.' }

  const pieces: string[] = []
  if (parts.melody) pieces.push(`the overall level is ${withTrend(levelWord(parts.melody.position), parts.melody.trend).replace(', ', ' and ')}`)
  if (parts.hotspots && parts.hotspots.count > 0) {
    const { count, x, y } = parts.hotspots
    pieces.push(`${count} ${count === 1 ? 'hot spot' : 'hot spots'}, the largest in the ${sectorOf(x, y)}`)
  }
  if (parts.rhythm) pieces.push(`${rhythmWord(parts.rhythm.perBeat)} edges`)
  if (parts.motion) {
    const side = eastWest(parts.motion.sweep)
    pieces.push(parts.motion.openness === 0 ? 'the picture is still' : `movement${side ? ` towards the ${side}` : ''}`)
  }
  if (parts.time.accent !== 'none') pieces.push(`a new ${parts.time.accent}`)
  const text = pieces.length ? pieces.join('; ') : 'a quiet picture'
  return { caption, summary: `${text.charAt(0).toUpperCase()}${text.slice(1)}.` }
}

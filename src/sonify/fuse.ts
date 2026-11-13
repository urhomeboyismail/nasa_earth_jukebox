// Fusion (docs/planning/UIUX-BLUEPRINT.md §3.2): two data sets heard as one piece of music. Every voice follows exactly one data set, so what is
// heard can always be traced back: deck A keeps the melody, the harmony, the motion and the clock; deck B plays the bass and the rhythm; the hot
// spots of both sound, A's on the left and B's on the right. The captions name the deck. Pure, like the rest of the ruleset.

import { MAX_HOTSPOT_NOTES } from './ranges'
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

  const missing = (Object.keys(FUSION_ROLES) as VoiceId[]).filter(voice => {
    const role = FUSION_ROLES[voice]
    if (role === 'A') return a.missing.includes(voice)
    if (role === 'B') return !b || b.missing.includes(voice)
    return a.missing.includes(voice) && (!b || b.missing.includes(voice))
  })

  const caption = { ...a.caption }
  for (const voice of Object.keys(FUSION_ROLES) as VoiceId[]) {
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

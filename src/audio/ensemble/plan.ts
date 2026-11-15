// What sounds this frame (docs/PLAN.md §6.3, ticket SN04). Pure: one `MusicFrame` in, the list of voice actions out, with no Tone in it.
// `planFrame` is the only place that decides what sounds; voices.ts only sends its result to Tone. The golden test records it.

import { VOICE_IDS } from '../../data/sonification'
import { voicesFor } from '../../sonify/detail'
import type { DetailLevel, MusicFrame, TimeAccent, VoiceId } from '../../sonify/types'
import { MAX_HOTSPOT_VOICES } from './constants'

export type VoiceAction = {
  voice: VoiceId
  /** For 'hotspots', the slot 0 to MAX_HOTSPOT_VOICES − 1; otherwise 0. */
  slot: number
  /** false: the voice is silent for this frame (not allowed by the detail level, muted, not soloed, or missing or null in the frame). */
  sounding: boolean
  midis: number[]
  /** 0 to 1, the target after the mix (detail, mute and solo already applied). */
  level: number
  /** −1 to +1 */
  pan: number
  /** −1 to +1 */
  elevation: number
  glide: boolean
  /** 0 to 1 */
  brightness: number
  /** Hot spots: the spot's id, so a slot that keeps its spot slides to its new note. */
  id?: string
  /** Rhythm: notes a beat. */
  perBeat?: 1 | 2 | 4
  /** Time: the accent for the next click, and the tempo. */
  accent?: TimeAccent
  pulseBpm?: number
}

export type Mix = {
  solo: VoiceId | null
  muted: ReadonlySet<VoiceId>
  /** The preset's brightness, for the hot-spot voices. Default 0.5. */
  brightness?: number
}

/** The frequency of a MIDI note (A4 = 69 = 440 Hz). */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function silent(voice: VoiceId, slot = 0): VoiceAction {
  return { voice, slot, sounding: false, midis: [], level: 0, pan: 0, elevation: 0, glide: false, brightness: 0 }
}

/**
 * One action per voice slot, in VOICE_IDS order, with the hot-spot slots in place of the hot-spot voice. A voice sounds when the detail level
 * allows it, it is not muted, nothing else is soloed, and the frame has something for it. The detail level always applies: a solo only
 * narrows it further.
 */
export function planFrame(frame: MusicFrame, detail: DetailLevel, mix: Mix): VoiceAction[] {
  const byDetail = new Set(voicesFor(detail))
  const open = (voice: VoiceId) => byDetail.has(voice) && !mix.muted.has(voice) && (mix.solo === null || mix.solo === voice)
  const actions: VoiceAction[] = []

  for (const voice of VOICE_IDS) {
    const base = silent(voice)
    const on = open(voice)
    switch (voice) {
      case 'melody': {
        const m = frame.melody
        actions.push(on && m ? { ...base, sounding: true, midis: [m.midi], level: clamp01(m.level), glide: m.glide } : base)
        break
      }
      case 'harmony': {
        const h = frame.harmony
        actions.push(on && h ? { ...base, sounding: true, midis: [...h.midis], level: clamp01(h.level) } : base)
        break
      }
      case 'bass': {
        const b = frame.bass
        actions.push(on && b ? { ...base, sounding: true, midis: [b.midi], level: clamp01(b.level) } : base)
        break
      }
      case 'hotspots': {
        for (let slot = 0; slot < MAX_HOTSPOT_VOICES; slot++) {
          const spot = frame.hotspots[slot]
          actions.push(on && spot
            ? { ...silent(voice, slot), sounding: true, id: spot.id, midis: [spot.midi], level: clamp01(spot.level), pan: spot.pan, elevation: spot.elevation, brightness: mix.brightness ?? 0.5 }
            : silent(voice, slot))
        }
        break
      }
      case 'rhythm': {
        const r = frame.rhythm
        actions.push(on && r ? { ...base, sounding: true, midis: [...r.midis], level: clamp01(r.level), pan: r.pan, perBeat: r.perBeat } : base)
        break
      }
      case 'motion': {
        const m = frame.motion
        actions.push(on && m ? { ...base, sounding: true, level: clamp01(m.level), pan: m.sweep, brightness: clamp01(m.openness) } : base)
        break
      }
      case 'time': {
        actions.push(on ? { ...base, sounding: true, level: clamp01(frame.time.level), accent: frame.time.accent, pulseBpm: frame.time.pulseBpm } : base)
        break
      }
    }
  }
  return actions
}

// The ruleset's types (docs/PLAN.md §6.3, ticket SN03). Types only: the ensemble (SN04), the captions (SN07) and the descriptions (SN10)
// import them without pulling in any code.

import type { Band } from '../analysis/features/types'
import type { DetailLevel, PresetId, VoiceId } from '../data/sonification'

export type { DetailLevel, PresetId, VoiceId }

export type ScaleName = 'major' | 'dorian' | 'minorPentatonic'

/** The oscillator each kit voice plays. Only the timbre: which data drives a voice never changes. */
export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth'
/** A recorded instrument a style can play (SN19): a few notes of the FluidR3_GM SoundFont each, in public/audio/instruments/<name>/. */
export type InstrumentName =
  | 'marimba' | 'vibraphone' | 'acoustic_grand_piano' | 'string_ensemble_1' | 'cello' | 'pizzicato_strings' | 'orchestral_harp' | 'flute'
  | 'acoustic_bass' | 'tubular_bells'
/** The pitched voices that can play a recorded instrument. The time pulse, the dropout taps, the motion pad and the explore tone are cues: they stay oscillators. */
export type InstrumentVoice = 'melody' | 'harmony' | 'bass' | 'rhythm' | 'hotspots'
/**
 * The waveforms are what each voice plays until the instruments have loaded, or if they cannot load: exactly the sound before SN19. `instruments`
 * names the recorded instrument a voice plays once they have; a voice it leaves out (or a kit without it) stays an oscillator. `rhythm` is the arpeggio.
 */
export type Kit = { melody: Waveform; bass: Waveform; rhythm: Waveform; instruments?: Partial<Record<InstrumentVoice, InstrumentName>> }

export type Preset = {
  id: PresetId
  label: string
  /** Says what kind of choice this is: artistic, the same for every frame, never data. Shown on Learn and About. */
  note: string
  /** Pitch class of the key: C = 0, D = 2, … B = 11. */
  tonic: number
  scale: ScaleName
  /** Beats a minute of the time pulse. 60 to 120. */
  bpm: number
  /** 0 to 1. How bright the hot-spot voices and the motion pad sound. */
  brightness: number
  /** The instruments. Absent: the default kit (triangle melody, bass and rhythm). */
  kit?: Kit
  /** One line on how the style sounds, shown and spoken when it is chosen. Styles only. */
  sound?: string
}

/** The time voice's accent: a new month, a new year, or a new decade (SN16: the year's first three digits change). */
export type TimeAccent = 'none' | 'month' | 'year' | 'decade'

export type MusicFrame = {
  frameId: string
  date: string
  /** The melody: null when silent. `glide` slides from the previous note. */
  melody: { midi: number; glide: boolean; level: number } | null
  /** Chord notes, 1 to 4, in the harmony range. Thin for a uniform picture, thick for a mixed one. */
  harmony: { midis: number[]; level: number } | null
  bass: { midi: number; level: number } | null
  /** At most MAX_HOTSPOT_NOTES, in the order of `features.hotspots`. `pan` −1 to +1, `elevation` −1 to +1 (height only in 3D). */
  hotspots: { id: string; band: Band; midi: number; pan: number; elevation: number; level: number }[]
  /** An arpeggio along the strongest edge, `perBeat` notes a beat. */
  rhythm: { midis: number[]; perBeat: 1 | 2 | 4; pan: number; level: number } | null
  /** `openness` 0 to 1 (opens the pad's filter), `sweep` −1 (west) to +1 (east). */
  motion: { openness: number; sweep: number; level: number } | null
  time: { accent: TimeAccent; pulseBpm: number; level: number }
  /** Voices with no data this frame. They are silent, and the caption says so. */
  missing: VoiceId[]
  /** True when the whole frame cannot be read: the ensemble plays the seeded dropout cue once, when it starts. */
  dropout: boolean
  /** One line per voice for the caption strip ('' when silent). */
  caption: Record<VoiceId, string>
  /** One sentence for the caption strip and for announcements. */
  summary: string
  /** Carried into the next call (smoothing, and "the chord changes only when the mix does"). Not for display. */
  state: { melodyPosition: number | null; chordKey: string; shift: number | null }
}

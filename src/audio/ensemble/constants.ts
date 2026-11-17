// Every number of the ensemble engine (docs/PLAN.md §6.3, ticket SN04), named, so a rule never carries a bare number.

import type { VoiceId } from '../../data/sonification'

/** The limiter's threshold: the peak stays at or below −1 dBFS. */
export const MASTER_LIMIT_DB = -1
/** As `src/audio/engine.ts` (copied, not imported: the old engine stays as it is). */
export const COMPRESSOR = { threshold: -18, ratio: 3, attack: 0.01, release: 0.25 }
export const VOLUME_RAMP_S = 0.05
/** Level, pan, filter, detail, mute, solo. */
export const PARAM_RAMP_S = 0.1
/** Melody portamento. */
export const GLIDE_S = 0.12
export const STOP_FADE_S = 0.05
export const PAUSE_FADE_S = 0.2
export const RESUME_FADE_S = 0.2
/** A note's release when a voice goes quiet. */
export const RELEASE_S = 0.1
/** Default `atTime` for apply() and hold(): now + 20 ms. */
export const INTERACTIVE_LOOKAHEAD_S = 0.02
/** For frames scheduled ahead by the caller. */
export const SCHEDULE_LOOKAHEAD_S = 0.1
/** At most 20 frames a second are sounded; a faster caller is held back. */
export const MIN_APPLY_GAP_S = 0.05
/** Slots in the hot-spot voice (SN03 MAX_HOTSPOT_NOTES). */
export const MAX_HOTSPOT_VOICES = 3
export const HARMONY_POLYPHONY = 4
/** Notes that playNotes can sound at once. */
export const SCAN_VOICES = 8
export const VOICE_GAIN_DB: Record<VoiceId, number> = {
  melody: -6, harmony: -14, bass: -10, hotspots: -12, rhythm: -16, motion: -20, time: -22,
}
export const DROPOUT_GAIN_DB = -14
export const DROPOUT_SEED = 20261109
/** The two taps. */
export const DROPOUT_SPACING_S = 0.12
/** As engine.ts: over three minutes is refused. */
export const MAX_RENDER_S = 180
export const RENDER_TAIL_S = 1.5
export const MOTION_FILTER_HZ = { low: 300, high: 3000 }
/** Driven by brightness (0 to 1). */
export const HOLD_FILTER_HZ = { low: 400, high: 3400 }

// Not in the ticket's list, but each is a number the voices need.
/**
 * The room (SN19): one convolver, fed by the melody, the harmony, the arpeggio and the hot spots; the bass and the cues stay dry. Not Freeverb, and not
 * Tone.Reverb: measured in Chrome, two renders of the same notes through a Freeverb differ (by up to 1e-4 through the melody), and Tone.Reverb's impulse is
 * random. This impulse is seeded noise (seeded.ts), so it is the same every time: stereo, 2.4 s, falling 60 dB, low-passed to sound warm. `wet` is the
 * send's level into the room; the dry sound goes straight to the bus.
 */
export const REVERB = { seconds: 2.4, decayDb: 60, damping: 0.35, wet: 0.2 }
export const REVERB_SEED = 20261118
/**
 * How a recorded instrument (SN19) starts and stops: a short fade in (also the legato where the melody would glide) and each voice's release, near its
 * synth's. The arpeggio and the scan rings longer than the synth's pluck, as a plucked string does.
 */
export const SAMPLER_ATTACK_S = 0.01
export const SAMPLER_RELEASE_S: Record<'melody' | 'harmony' | 'bass' | 'rhythm' | 'hotspots' | 'scan', number> = {
  melody: 0.6, harmony: 0.8, bass: 0.3, rhythm: 0.4, hotspots: 0.3, scan: 0.3,
}
/** Each recorded note lasts about 1.5 s. A note held longer is struck again after this, so a held value never falls silent. */
export const SAMPLE_RENEW_S = 1.2
/** renderOffline waits this long for the instruments to load, then renders with whatever has (the oscillators for the rest). */
export const INSTRUMENT_WAIT_S = 10
/**
 * The ceiling: the last stage before the master is a hard clip at this level (−1.003 dBFS). Tone.Limiter is a compressor, not a brick wall: measured on a loud
 * schedule it let the peak reach 0 dBFS. The limiter still does the work; the clip only catches what it lets through.
 */
export const CEILING_LINEAR = 0.891
export const CLIP_CURVE_POINTS = 2048
/** The melody's mallet-like shape, as the old engine's full style. */
export const MALLET_ENVELOPE = { attack: 0.005, decay: 0.35, sustain: 0.25, release: 0.6 }
/** The motion pad's note: C3 in the preset's key (the pitch class of the tonic is added). */
export const MOTION_PAD_MIDI = 48
/** A month or year accent on the time voice. */
export const ACCENT_DB = 3
export const CLICK_S = 0.05
/** The dropout taps sound this long. */
export const DROPOUT_TAP_S = 0.08
/** A rhythm note fills this share of the gap to the next. */
export const RHYTHM_NOTE_SHARE = 0.6

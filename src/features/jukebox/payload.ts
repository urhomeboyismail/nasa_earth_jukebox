// The sound parameters the Jukebox orchestrator returns (G08: POST /api/v1/jukebox/generate, the `audio` field), and the arithmetic
// that turns them into notes. A model wrote the payload, so it is checked again here before anything plays. No Tone in this file.

import { z } from 'zod'

/** More than the server ever sends. They stop a wrong payload from building thousands of voices or steps. */
export const MAX_TRACKS = 16
export const MAX_STEPS = 4096

const midiNote = z.number().int().min(0).max(127)

const trackSchema = z.object({
  instrument: z.string().min(1),
  /** The lowest and highest MIDI note, in that order. */
  pitch_range: z.tuple([midiNote, midiNote]).refine(([low, high]) => low <= high, 'pitch_range must be lowest note first'),
  /** Loudness over time, each value from 0 (silent) to 1 (full). One value is one step. */
  volume_curve: z.array(z.number().min(0).max(1)).min(1).max(MAX_STEPS),
})

export const audioPayloadSchema = z.object({
  base_bpm: z.number().min(20).max(300),
  tracks: z.array(trackSchema).min(1).max(MAX_TRACKS),
})

export type AudioTrack = z.infer<typeof trackSchema>
export type AudioPayload = z.infer<typeof audioPayloadSchema>

/** One step of a track: the note to play and how loud (0 to 1). */
export type Step = { frequency: number; gain: number }

/** The payload, or null when it is not one. Also takes the route's whole answer and reads its `audio` field. */
export function parseAudioPayload(value: unknown): AudioPayload | null {
  const inner = typeof value === 'object' && value !== null && 'audio' in value ? value.audio : value
  const result = audioPayloadSchema.safeParse(inner)
  return result.success ? result.data : null
}

/** A MIDI note number as a frequency in hertz. Note 69 is the A at 440 Hz. */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/**
 * One step for each value of the track's volume curve, or null for a rest (a value of 0).
 *
 * The payload has no pitch curve, so pitch follows volume: the track's quietest sounding value plays the lowest note of `pitch_range`, its
 * loudest plays the highest, and the values between land on the nearest whole note between them. A flat curve plays the middle note.
 */
export function trackSteps(track: AudioTrack): (Step | null)[] {
  const [low, high] = track.pitch_range
  const sounding = track.volume_curve.filter(gain => gain > 0)
  const quietest = Math.min(...sounding)
  const spread = Math.max(...sounding) - quietest
  return track.volume_curve.map(gain => {
    if (gain === 0) return null
    const position = spread === 0 ? 0.5 : (gain - quietest) / spread
    return { frequency: midiToFrequency(Math.round(low + position * (high - low))), gain }
  })
}

/** How long one step lasts, in seconds: an eighth note at the payload's tempo. */
export function stepSeconds(payload: AudioPayload): number {
  return 30 / payload.base_bpm
}

/** How long the whole payload plays, in seconds: its longest track. */
export function totalSeconds(payload: AudioPayload): number {
  return Math.max(...payload.tracks.map(track => track.volume_curve.length)) * stepSeconds(payload)
}

// ---- The vision half: time-coded descriptions (G10) ----

/** More than the server ever sends. */
export const MAX_DESCRIPTIONS = 64

const descriptionSchema = z.object({
  timestamp_sec: z.number().min(0).max(3600),
  alt_text: z.string().min(1).max(1000),
  intensity_level: z.enum(['low', 'medium', 'high']),
})

export const visionPayloadSchema = z.object({
  descriptions: z.array(descriptionSchema).max(MAX_DESCRIPTIONS),
})

export type VisionDescription = z.infer<typeof descriptionSchema>
export type VisionPayload = z.infer<typeof visionPayloadSchema>

/** The vision payload, or null when it is not one. Also takes the route's whole answer and reads its `vision` field. */
export function parseVisionPayload(value: unknown): VisionPayload | null {
  const inner = typeof value === 'object' && value !== null && 'vision' in value ? value.vision : value
  const result = visionPayloadSchema.safeParse(inner)
  return result.success ? result.data : null
}

/** A description and the time it is shown on the track, in seconds from the start. */
export type Caption = VisionDescription & { at: number }

/**
 * Each description with its time on the track, in time order. If the latest `timestamp_sec` is later than the track's last step, every
 * time is scaled by the same factor so the latest lands on the last step; otherwise the times are used as they are.
 */
export function captionTimes(vision: VisionPayload, payload: AudioPayload): Caption[] {
  const sorted = [...vision.descriptions].sort((a, b) => a.timestamp_sec - b.timestamp_sec)
  if (!sorted.length) return []
  const lastStepAt = totalSeconds(payload) - stepSeconds(payload)
  const latest = sorted[sorted.length - 1].timestamp_sec
  const factor = latest > lastStepAt && latest > 0 ? lastStepAt / latest : 1
  return sorted.map(description => ({ ...description, at: description.timestamp_sec * factor }))
}

// ---- Timbres ----

export type Timbre = 'bass' | 'pad' | 'lead'

/** The voice for an instrument name, by the words in it. */
export function timbreOf(instrument: string): Timbre {
  const name = instrument.toLowerCase()
  if (name.includes('bass') || name.includes('drone')) return 'bass'
  if (name.includes('pad') || name.includes('ambient')) return 'pad'
  return 'lead'
}

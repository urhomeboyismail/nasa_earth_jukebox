// The ensemble's public types (docs/PLAN.md §6.3, ticket SN04). Types only.

import type { DetailLevel, MusicFrame, VoiceId } from '../../sonify/types'
import type { SpatialMode } from '../pan'

export type EnsembleStatus = 'off' | 'on' | 'paused' | 'suspended'

/** A continuous tone for interactive use (explore, SN09). midi is a whole or fractional note; pan and elevation −1 to +1; level and brightness 0 to 1. */
export type HeldTone = { midi: number; level: number; pan: number; elevation?: number; brightness: number }

/** One note of a scan column or a probe (SN08). `seconds` is how long it sounds. */
export type NoteEvent = { midi: number; level: number; pan: number; elevation?: number; brightness?: number; seconds: number }

export type ScheduledFrame = { frame: MusicFrame; atSeconds: number }

export type EnsembleOptions = { detail?: DetailLevel; volume?: number; spatial?: SpatialMode }

export type Ensemble = {
  /** Call from a click or key press only (WCAG 1.4.2). Starts the audio context and resumes it if the browser suspended it. */
  start(): Promise<void>
  /** Silences every voice with a short fade and stops the transport. The next start() begins again. */
  stop(): void
  /** Fades the master to silence over PAUSE_FADE_S, then pauses the transport. */
  pause(): void
  /** Fades back in from silence. Does not resume a context the browser suspended: that needs start(). */
  resume(): void
  /** One frame of music, for the voices the current detail level allows. `atTime` is an audio-clock time in seconds; default is now + INTERACTIVE_LOOKAHEAD_S. Never queues: each call sets the voices for its own time. */
  apply(frame: MusicFrame, atTime?: number): void
  /** A continuous tone for explore (SN09). A new midi glides from the last one over GLIDE_S (portamento). `null` releases it. Not a mixer voice: detail, solo and mute do not apply to it. */
  hold(tone: HeldTone | null, atTime?: number): void
  /** Sounds notes at once through the scan bank (SN08): up to SCAN_VOICES at a time, the rest are dropped. */
  playNotes(notes: NoteEvent[], atTime?: number): void
  /** The seeded dropout cue, once. `apply` calls it itself when a frame's `dropout` goes from false to true. */
  playDropout(atTime?: number): void
  /** Only this voice sounds, or `null` for all the voices the detail level allows. */
  solo(voice: VoiceId | null): void
  mute(voice: VoiceId, muted: boolean): void
  /** Calm, standard or full (SN03 `DETAIL_VOICES`). A voice outside the level fades out and is not triggered. */
  setDetail(level: DetailLevel): void
  /** 0 to 1 (clamped). Ramps over VOLUME_RAMP_S. */
  setVolume(zeroToOne: number): void
  status(): EnsembleStatus
  /** The audio clock in seconds (the raw context's currentTime), or 0 before start(). Scan and explore line the picture up with the sound through it. */
  now(): number
  onStatus(listener: (status: EnsembleStatus) => void): () => void
  /** Releases every voice, removes the listeners and disposes the nodes. Calls after this do nothing. */
  dispose(): void
  /** Renders the schedule through the same graph, faster than real time. Returns the left and right channels. Never plays. */
  renderOffline(schedule: ScheduledFrame[], options: { detail: DetailLevel; sampleRate?: number; tailSeconds?: number }): Promise<[Float32Array, Float32Array]>
}

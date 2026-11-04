// Sound engine contract (docs/PLAN.md §5.3).
// The engine itself is in engine.ts (Tone.js); sequences run on Tone.Transport.

import type { CategoryId } from '../data'
import type { SoundStyle } from './style'

export type { SoundStyle } from './style'

/**
 * One sound in a sequence. `pad`, `glide` and `bell` are the musical layer (docs/PLAN.md §5.7): a chord under the note,
 * a slide from the previous note, a bell for a big jump. The engine accepts them from T64 and gives them sound in T68.
 */
export type SequenceStep = {
  category: CategoryId | 'insufficient'
  atMs: number
  pan?: number
  pad?: CategoryId[]
  glide?: boolean
  bell?: boolean
}

export type SoundEngine = {
  /** Call from a click or key press: browsers only allow audio after a user gesture. */
  unlock(): Promise<void>
  playCategory(id: CategoryId, opts?: { pan?: number; durationMs?: number; pad?: CategoryId[] }): void
  playTick(): void
  playMissing(): void
  /**
   * Plays each step at its atMs and calls onStep(index) as it sounds. Replaces any sequence already playing.
   * A tick follows each sound unless `tick` is false (a sweep across a map is not a run of dates).
   */
  playSequence(steps: SequenceStep[], onStep: (index: number) => void, opts?: { tick?: boolean }): void
  /** "full" or "simple" (see style.ts). Can be set at any time, before or after unlock(). */
  setStyle(style: SoundStyle): void
  setVolume(zeroToOne: number): void
  pause(): void
  /** Continues a paused sequence from where it stopped. */
  resume(): void
  stop(): void
  isPlaying(): boolean
  /** Pauses while the voice guide listens or speaks. Does not resume on its own. */
  duck(): void
  unduck(): void
  /** Should-have (T08). */
  renderToWav(steps: SequenceStep[]): Promise<Blob>
}

export { createSoundEngine } from './engine'

// Sound engine contract (docs/PLAN.md §5.3).
// The engine itself is in engine.ts (Tone.js); sequences run on Tone.Transport.

import type { CategoryId } from '../data'

export type SequenceStep = { category: CategoryId | 'insufficient'; atMs: number; pan?: number }

export type SoundEngine = {
  /** Call from a click or key press: browsers only allow audio after a user gesture. */
  unlock(): Promise<void>
  playCategory(id: CategoryId, opts?: { pan?: number; durationMs?: number }): void
  playTick(): void
  playMissing(): void
  /** Plays each step at its atMs and calls onStep(index) as it sounds. Replaces any sequence already playing. */
  playSequence(steps: SequenceStep[], onStep: (index: number) => void): void
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

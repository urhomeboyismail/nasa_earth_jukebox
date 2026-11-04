// Sound engine contract (docs/PLAN.md §5.3).
// T00 stub: it makes no sound and logs each call, but its timing is real: playSequence fires onStep at
// each step's atMs, and pause, resume, stop and duck behave as the real engine will. Build the player
// against it. T03/T04 (team leader) replace it with Tone.js behind these same exports.

import type { CategoryId, SoundMapping } from '../data'

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

export function createSoundEngine(mapping: SoundMapping): SoundEngine {
  const log = (...args: unknown[]) => console.debug('[sound stub]', ...args)
  let unlocked = false
  let steps: SequenceStep[] = []
  let onStep: (index: number) => void = () => {}
  let timers: number[] = []
  let startedAt = 0
  let elapsedAtPause = 0
  let next = 0
  let state: 'idle' | 'playing' | 'paused' = 'idle'
  let volume = 1

  const clear = () => { timers.forEach(timer => window.clearTimeout(timer)); timers = [] }

  function schedule(fromMs: number) {
    clear()
    startedAt = performance.now() - fromMs
    for (let index = next; index < steps.length; index++) {
      timers.push(window.setTimeout(() => {
        next = index + 1
        const step = steps[index]
        log(step.category === 'insufficient' ? 'missing cue' : `category ${step.category}`, { index, pan: step.pan, volume })
        onStep(index)
        if (next === steps.length) state = 'idle'
      }, Math.max(0, steps[index].atMs - fromMs)))
    }
    state = 'playing'
  }

  function pause() {
    if (state !== 'playing') return
    clear()
    elapsedAtPause = performance.now() - startedAt
    state = 'paused'
  }

  const known = (id: CategoryId) => mapping.categories.some(category => category.id === id)

  return {
    async unlock() { unlocked = true; log('unlocked') },
    playCategory(id, opts) {
      if (!unlocked) return log('ignored: not unlocked')
      log(known(id) ? `category ${id}` : `unknown category ${id}`, opts)
    },
    playTick() { if (unlocked) log('tick') },
    playMissing() { if (unlocked) log('missing cue') },
    playSequence(nextSteps, listener) {
      if (!unlocked) return log('ignored: not unlocked')
      steps = [...nextSteps].sort((a, b) => a.atMs - b.atMs)
      onStep = listener
      next = 0
      schedule(0)
    },
    setVolume(zeroToOne) { volume = Math.min(1, Math.max(0, zeroToOne)) },
    pause,
    resume() {
      if (state !== 'paused') return
      // Continue at the next step that has not sounded, keeping the gaps between steps.
      schedule(Math.min(elapsedAtPause, steps[next]?.atMs ?? elapsedAtPause))
    },
    stop() { clear(); next = 0; state = 'idle' },
    isPlaying() { return state === 'playing' },
    duck() { pause() },
    unduck() { log('unducked') },
    renderToWav() { return Promise.reject(new Error('WAV export is not built yet (T08).')) },
  }
}

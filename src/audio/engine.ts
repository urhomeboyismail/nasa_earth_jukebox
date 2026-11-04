// The real sound engine (docs/PLAN.md §5.3), built on Tone.js. Tone is loaded on unlock(), which has to
// happen in a click or key press anyway, so it stays out of the first page load.
//
// Sequences still use timers, as the T00 stub did. T04 moves them onto Tone.Transport.

import { Note } from 'tonal'
import type { CategoryId, SoundMapping } from '../data'
import type { SequenceStep, SoundEngine } from '.'

type ToneModule = typeof import('tone')

/** Fade used for volume changes: long enough to avoid clicks, short enough to feel instant. */
const VOLUME_RAMP_S = 0.05
/** Fade used by stop() and duck(). Together with the node's own latency this stays well inside 50 ms. */
const CUT_RAMP_S = 0.02
const DEFAULT_NOTE_MS = 600

/** Checks every note in the mapping and that cooler categories are always lower. Throws a message naming the problem. */
export function validateMapping(mapping: SoundMapping) {
  let previous = 0
  for (const category of mapping.categories) {
    const frequency = Note.freq(category.note)
    if (frequency === null) throw new Error(`Category "${category.id}" has "${category.note}", which is not a note name.`)
    if (frequency <= previous) throw new Error(`Category "${category.id}" (${category.note}) must sound higher than the category before it.`)
    previous = frequency
  }
  for (const [label, note] of [['tick', mapping.tick.note]] as const) {
    if (Note.freq(note) === null) throw new Error(`The ${label} has "${note}", which is not a note name.`)
  }
}

export function createSoundEngine(mapping: SoundMapping): SoundEngine {
  validateMapping(mapping)

  let tone: ToneModule | null = null
  let unlocking: Promise<void> | null = null
  let unlocked = false
  let volume = 1

  // Audio graph, built on unlock:  voices → panner → cut → master → speakers.
  let categorySynth: InstanceType<ToneModule['Synth']>
  let tickSynth: InstanceType<ToneModule['Synth']>
  let missingNoise: InstanceType<ToneModule['NoiseSynth']> | null = null
  let missingSynth: InstanceType<ToneModule['Synth']> | null = null
  let panner: InstanceType<ToneModule['Panner']>
  let cut: InstanceType<ToneModule['Gain']>
  let master: InstanceType<ToneModule['Gain']>

  // Sequence state.
  let steps: SequenceStep[] = []
  let onStep: (index: number) => void = () => {}
  let timers: number[] = []
  let startedAt = 0
  let elapsedAtPause = 0
  let next = 0
  let state: 'idle' | 'playing' | 'paused' = 'idle'

  function build(t: ToneModule) {
    master = new t.Gain(volume).toDestination()
    cut = new t.Gain(1).connect(master)
    panner = new t.Panner(0).connect(cut)
    categorySynth = new t.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.4 },
      volume: -6,
    }).connect(panner)
    tickSynth = new t.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.04, sustain: 0, release: 0.02 },
      volume: -18,
    }).connect(panner)
    if (mapping.missingCue.type === 'note') {
      missingSynth = new t.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.2 },
        volume: -14,
      }).connect(panner)
    } else {
      const filter = new t.Filter({ type: 'bandpass', frequency: 900, Q: 1.2 }).connect(panner)
      missingNoise = new t.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.1 },
        volume: -10,
      }).connect(filter)
    }
  }

  function unlock(): Promise<void> {
    unlocking ??= (async () => {
      const t = await import('tone')
      await t.start()
      tone = t
      build(t)
      unlocked = true
    })()
    return unlocking
  }

  /** Brings the sound back after stop() or duck() cut it. Done before every new sound. */
  function open() {
    cut.gain.cancelScheduledValues(tone!.now())
    cut.gain.value = 1
  }

  function silence() {
    if (!unlocked) return
    cut.gain.rampTo(0, CUT_RAMP_S)
    categorySynth.triggerRelease()
    missingSynth?.triggerRelease()
  }

  function setPan(pan: number | undefined) {
    panner.pan.value = Math.min(1, Math.max(-1, pan ?? 0))
  }

  function playCategory(id: CategoryId, opts?: { pan?: number; durationMs?: number }) {
    if (!unlocked) return
    const category = mapping.categories.find(c => c.id === id)
    if (!category) return
    open()
    setPan(opts?.pan)
    categorySynth.triggerAttackRelease(category.note, (opts?.durationMs ?? DEFAULT_NOTE_MS) / 1000)
  }

  function playTick() {
    if (!unlocked) return
    open()
    setPan(0)
    tickSynth.triggerAttackRelease(mapping.tick.note, mapping.tick.durationMs / 1000)
  }

  function playMissing() {
    if (!unlocked) return
    open()
    setPan(0)
    const seconds = mapping.missingCue.durationMs / 1000
    if (missingSynth) missingSynth.triggerAttackRelease('B1', seconds)
    else missingNoise?.triggerAttackRelease(seconds)
  }

  const clear = () => { timers.forEach(timer => window.clearTimeout(timer)); timers = [] }

  function schedule(fromMs: number) {
    clear()
    startedAt = performance.now() - fromMs
    for (let index = next; index < steps.length; index++) {
      timers.push(window.setTimeout(() => {
        next = index + 1
        const step = steps[index]
        if (step.category === 'insufficient') playMissing()
        else playCategory(step.category, { pan: step.pan })
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

  return {
    unlock,
    playCategory,
    playTick,
    playMissing,
    playSequence(nextSteps, listener) {
      if (!unlocked) return
      steps = [...nextSteps].sort((a, b) => a.atMs - b.atMs)
      onStep = listener
      next = 0
      schedule(0)
    },
    setVolume(zeroToOne) {
      volume = Math.min(1, Math.max(0, Number.isFinite(zeroToOne) ? zeroToOne : 0))
      if (unlocked) master.gain.rampTo(volume, VOLUME_RAMP_S)
    },
    pause() {
      pause()
      categorySynth?.triggerRelease()
    },
    resume() {
      if (state !== 'paused') return
      // Continue at the next step that has not sounded, keeping the gaps between steps.
      schedule(Math.min(elapsedAtPause, steps[next]?.atMs ?? elapsedAtPause))
    },
    stop() {
      clear()
      next = 0
      state = 'idle'
      silence()
    },
    isPlaying() { return state === 'playing' },
    duck() {
      pause()
      silence()
    },
    unduck() {
      // Deliberately does not resume: the caller decides, with resume().
      if (unlocked) open()
    },
    renderToWav() { return Promise.reject(new Error('WAV export is not built yet (T08).')) },
  }
}

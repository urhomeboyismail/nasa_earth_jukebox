// The real sound engine (docs/PLAN.md §5.3), built on Tone.js. Tone is loaded on unlock(), which has to
// happen in a click or key press anyway, so it stays out of the first page load.
//
// Sequences run on Tone.Transport. Each step plays its category (or the missing cue) and then a tick, and
// calls onStep through Tone.Draw so the picture changes when the sound does. Speed is whatever spacing the
// caller gives the steps' atMs: it can differ on every play.

import { Note } from 'tonal'
import type { CategoryId, SoundMapping } from '../data'
import type { SequenceStep, SoundEngine } from '.'

type ToneModule = typeof import('tone')

/** Fade used for volume changes: long enough to avoid clicks, short enough to feel instant. */
const VOLUME_RAMP_S = 0.05
/** Fade used by stop() and duck(). Together with the node's own latency this stays well inside 50 ms. */
const CUT_RAMP_S = 0.02
const DEFAULT_NOTE_MS = 600
/** Audio is scheduled this far ahead of now, so the first step is not cut off. */
const START_DELAY_S = 0.05
/** Share of the gap to the next step that a note may fill, leaving room for the tick after it. */
const NOTE_SHARE_OF_GAP = 0.6

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
  let state: 'idle' | 'playing' | 'paused' = 'idle'
  /** Bumped on every play and stop, so a step scheduled by an old sequence never reports itself. */
  let sequenceId = 0

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

  /** `time` is an audio-clock time from the Transport; without it the sound is immediate. */
  function setPan(pan: number | undefined, time?: number) {
    const clamped = Math.min(1, Math.max(-1, pan ?? 0))
    if (time === undefined) panner.pan.value = clamped
    else panner.pan.setValueAtTime(clamped, time)
  }

  function playCategory(id: CategoryId, opts?: { pan?: number; durationMs?: number; pad?: CategoryId[] }, time?: number) {
    if (!unlocked) return
    const category = mapping.categories.find(c => c.id === id)
    if (!category) return
    open()
    setPan(opts?.pan, time)
    categorySynth.triggerAttackRelease(category.note, (opts?.durationMs ?? DEFAULT_NOTE_MS) / 1000, time)
  }

  function playTick(time?: number) {
    if (!unlocked) return
    open()
    setPan(0, time)
    tickSynth.triggerAttackRelease(mapping.tick.note, mapping.tick.durationMs / 1000, time)
  }

  function playMissing(time?: number) {
    if (!unlocked) return
    open()
    setPan(0, time)
    const seconds = mapping.missingCue.durationMs / 1000
    if (missingSynth) missingSynth.triggerAttackRelease('B1', seconds, time)
    else missingNoise?.triggerAttackRelease(seconds, time)
  }

  /** Forgets any sequence: stops the Transport, drops its scheduled steps and puts it back at 0. */
  function resetTransport() {
    const transport = tone!.getTransport()
    transport.stop()
    transport.cancel(0)
    transport.seconds = 0
  }

  function playSequence(nextSteps: SequenceStep[], onStep: (index: number) => void, opts?: { tick?: boolean }) {
    if (!unlocked) return
    const t = tone!
    const transport = t.getTransport()
    const draw = t.getDraw()
    const sorted = [...nextSteps].sort((a, b) => a.atMs - b.atMs)
    resetTransport()
    if (!sorted.length) {
      state = 'idle'
      return
    }
    const sequence = ++sequenceId

    sorted.forEach((step, index) => {
      const at = step.atMs / 1000
      const gap = index + 1 < sorted.length ? (sorted[index + 1].atMs - step.atMs) / 1000 : DEFAULT_NOTE_MS / 1000
      const noteSeconds = Math.min(DEFAULT_NOTE_MS / 1000, gap * NOTE_SHARE_OF_GAP)
      transport.schedule(time => {
        if (step.category === 'insufficient') playMissing(time)
        else playCategory(step.category, { pan: step.pan, durationMs: noteSeconds * 1000 }, time)
        if (opts?.tick !== false) playTick(time + noteSeconds)
        // Draw runs the callback when the sound is heard, not when it is scheduled.
        draw.schedule(() => {
          if (sequence === sequenceId) onStep(index)
        }, time)
      }, at)
    })

    // Marks the sequence finished once the last step has sounded.
    const last = sorted[sorted.length - 1].atMs / 1000
    transport.schedule(time => {
      draw.schedule(() => {
        if (sequence === sequenceId && state === 'playing') state = 'idle'
      }, time)
    }, last + DEFAULT_NOTE_MS / 1000)

    state = 'playing'
    transport.start(`+${START_DELAY_S}`)
  }

  function pause() {
    if (state !== 'playing') return
    tone!.getTransport().pause()
    state = 'paused'
  }

  return {
    unlock,
    playCategory,
    playTick,
    playMissing,
    playSequence,
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
      // Continues from the position where pause() stopped the Transport.
      state = 'playing'
      tone!.getTransport().start()
    },
    stop() {
      sequenceId++
      state = 'idle'
      if (unlocked) resetTransport()
      silence()
    },
    // The chord, slide and bell (T68) are not built yet: the style is accepted and the sound is the same in both.
    setStyle() {},
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

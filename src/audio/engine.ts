// The real sound engine (docs/PLAN.md §5.3), built on Tone.js. Tone is loaded on unlock(), which has to
// happen in a click or key press anyway, so it stays out of the first page load.
//
// Sequences run on Tone.Transport. Each step plays its category (or the missing cue) and then a tick, and
// calls onStep through Tone.Draw so the picture changes when the sound does. Speed is whatever spacing the
// caller gives the steps' atMs: it can differ on every play.
//
// The musical layer (docs/PLAN.md §5.7): in the "full" style a step can also sound a chord under the melody (pad), slide to
// its note (glide) and ring a bell above it (bell), all through a little reverb. The "simple" style turns those off and plays
// the melody as it always did. Live playback and WAV export share createVoices and scheduleSteps, so they sound the same.

import { Note } from 'tonal'
import type { CategoryId, SoundMapping } from '../data'
import type { SequenceStep, SoundEngine } from '.'
import { aimPanner, createPanner, type Panner, type SpatialMode } from './pan'
import type { SoundStyle } from './style'
import { encodeWav } from './wav'

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

/** The slide between two notes, in seconds, for a step with `glide`. */
const GLIDE_S = 0.12
/** The bell rings this long after the melody note starts, and sounds this long. */
const BELL_DELAY_S = 0.05
const BELL_SECONDS = 0.2
const BELL_NOTE = 'G5'
const REVERB = { roomSize: 0.6, wet: 0.2 }
/** The melody's softer, mallet-like shape in the full style; the simple style keeps the original shape. */
const MALLET_ENVELOPE = { attack: 0.005, decay: 0.35, sustain: 0.25, release: 0.6 }
const SIMPLE_ENVELOPE = { attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.4 }

/** WAV export: 44.1 kHz stereo, the last step plus a tail for the notes to die away, and no more than three minutes. */
const WAV_SAMPLE_RATE = 44100
const WAV_TAIL_S = 1.5
const WAV_MAX_S = 180

const LOWEST_PAD_NOTE = 'C3'

/** Checks every note in the mapping and that cooler categories are always lower. Throws a message naming the problem. */
export function validateMapping(mapping: SoundMapping) {
  let previous = 0
  for (const category of mapping.categories) {
    const frequency = Note.freq(category.note)
    if (frequency === null) throw new Error(`Category "${category.id}" has "${category.note}", which is not a note name.`)
    if (frequency <= previous) throw new Error(`Category "${category.id}" (${category.note}) must sound higher than the category before it.`)
    previous = frequency
    // The chord plays one octave below the note, and nothing may sound below C3 (docs/SOUND_MAPPINGS.md §6).
    if ((Note.midi(category.note) ?? 0) - 12 < Note.midi(LOWEST_PAD_NOTE)!) {
      throw new Error(`Category "${category.id}" (${category.note}) is too low: its chord note, an octave below, would sound under ${LOWEST_PAD_NOTE}.`)
    }
  }
  for (const [label, note] of [['tick', mapping.tick.note]] as const) {
    if (Note.freq(note) === null) throw new Error(`The ${label} has "${note}", which is not a note name.`)
  }
}

type Synth = InstanceType<ToneModule['Synth']>

/** Everything that makes sound: voices → panner → reverb → cut → master → speakers. */
type Voices = {
  style: SoundStyle
  melody: Synth
  tick: Synth
  missingNoise: InstanceType<ToneModule['NoiseSynth']> | null
  missingSynth: Synth | null
  pad: InstanceType<ToneModule['PolySynth']>
  bell: Synth
  reverb: InstanceType<ToneModule['Freeverb']>
  /** Every voice feeds this; it is joined to whichever panner is current, so the spatial mode can change while playing. */
  bus: InstanceType<ToneModule['Gain']>
  panner: Panner
  spatial: SpatialMode
  cut: InstanceType<ToneModule['Gain']>
  master: InstanceType<ToneModule['Gain']>
}

type NoteOptions = { pan?: number; elevation?: number; durationMs?: number; pad?: CategoryId[]; glide?: boolean; bell?: boolean }

/** Builds the voices on whatever audio context Tone is using now: the live one, or the offline one inside renderToWav. */
function createVoices(t: ToneModule, mapping: SoundMapping, style: SoundStyle, volume: number, spatial: SpatialMode): Voices {
  const full = style === 'full'
  const master = new t.Gain(volume).toDestination()
  const cut = new t.Gain(1).connect(master)
  // Not Tone.Reverb: it builds its impulse from random noise, which would break "same input, same output".
  const reverb = new t.Freeverb({ roomSize: REVERB.roomSize, wet: full ? REVERB.wet : 0 }).connect(cut)
  const panner = createPanner(t, spatial).connect(reverb)
  const bus = new t.Gain(1).connect(panner)
  const melody = new t.Synth({
    oscillator: { type: 'triangle' },
    envelope: full ? MALLET_ENVELOPE : SIMPLE_ENVELOPE,
    volume: -6,
  }).connect(bus)
  const tick = new t.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.005, decay: 0.04, sustain: 0, release: 0.02 },
    volume: -18,
  }).connect(bus)
  let missingSynth: Synth | null = null
  let missingNoise: Voices['missingNoise'] = null
  if (mapping.missingCue.type === 'note') {
    missingSynth = new t.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.2 },
      volume: -14,
    }).connect(bus)
  } else {
    const filter = new t.Filter({ type: 'bandpass', frequency: 900, Q: 1.2 }).connect(bus)
    missingNoise = new t.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.1 },
      volume: -10,
    }).connect(filter)
  }
  const bell = new t.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.1 },
    volume: -16,
  }).connect(bus)
  const pad = new t.PolySynth(t.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.3, release: 0.8 },
    volume: -18,
  }).connect(bus)
  return { style, melody, tick, missingNoise, missingSynth, pad, bell, reverb, bus, panner, spatial, cut, master }
}

/** Switches a built set of voices between the styles: the reverb and the melody's shape. The other layers check the style when they sound. */
function applyStyle(voices: Voices, style: SoundStyle) {
  voices.style = style
  voices.reverb.wet.value = style === 'full' ? REVERB.wet : 0
  voices.melody.set({ envelope: style === 'full' ? MALLET_ENVELOPE : SIMPLE_ENVELOPE })
}

/** Swaps the panner under live voices. The old one is disposed once it is out of the path. */
function applySpatial(t: ToneModule, voices: Voices, spatial: SpatialMode) {
  if (voices.spatial === spatial) return
  const old = voices.panner
  voices.bus.disconnect()
  voices.panner = createPanner(t, spatial).connect(voices.reverb)
  voices.bus.connect(voices.panner)
  voices.spatial = spatial
  old.dispose()
}

/** `time` is an audio-clock time from the Transport; without it the sound is immediate. */
function setPan(voices: Voices, pan: number | undefined, elevation: number | undefined, time?: number) {
  aimPanner(voices.panner, pan ?? 0, elevation ?? 0, time)
}

/** The chord's notes: each category's note one octave down. Unknown categories are left out. */
function padNotes(mapping: SoundMapping, ids: CategoryId[]): string[] {
  return ids.flatMap(id => {
    const category = mapping.categories.find(c => c.id === id)
    return category ? [Note.transpose(category.note, '-8P')] : []
  })
}

function sounding(voices: Voices, mapping: SoundMapping, id: CategoryId, opts: NoteOptions | undefined, time?: number) {
  const category = mapping.categories.find(c => c.id === id)
  if (!category) return
  const full = voices.style === 'full'
  const seconds = (opts?.durationMs ?? DEFAULT_NOTE_MS) / 1000
  setPan(voices, opts?.pan, opts?.elevation, time)
  voices.melody.portamento = full && opts?.glide ? GLIDE_S : 0
  voices.melody.triggerAttackRelease(category.note, seconds, time)
  if (!full) return
  const chord = opts?.pad ? padNotes(mapping, opts.pad) : []
  if (chord.length) voices.pad.triggerAttackRelease(chord, seconds, time)
  if (opts?.bell) voices.bell.triggerAttackRelease(BELL_NOTE, BELL_SECONDS, time === undefined ? `+${BELL_DELAY_S}` : time + BELL_DELAY_S)
}

function tickAt(voices: Voices, mapping: SoundMapping, time?: number) {
  setPan(voices, 0, 0, time)
  voices.tick.triggerAttackRelease(mapping.tick.note, mapping.tick.durationMs / 1000, time)
}

function missingAt(voices: Voices, mapping: SoundMapping, time?: number) {
  setPan(voices, 0, 0, time)
  const seconds = mapping.missingCue.durationMs / 1000
  if (voices.missingSynth) voices.missingSynth.triggerAttackRelease('B1', seconds, time)
  else voices.missingNoise?.triggerAttackRelease(seconds, time)
}

/**
 * Puts every step on the Transport of whatever context the voices were built in. `steps` must be sorted by time.
 * `before` runs first in each step (live playback uses it to reopen the sound after a stop); `onStep` runs with the step's index
 * and audio time.
 */
function scheduleSteps(
  t: ToneModule,
  voices: Voices,
  mapping: SoundMapping,
  steps: SequenceStep[],
  opts: { tick?: boolean; before?: () => void; onStep?: (index: number, time: number) => void },
) {
  const transport = t.getTransport()
  steps.forEach((step, index) => {
    const gap = index + 1 < steps.length ? (steps[index + 1].atMs - step.atMs) / 1000 : DEFAULT_NOTE_MS / 1000
    const noteSeconds = Math.min(DEFAULT_NOTE_MS / 1000, gap * NOTE_SHARE_OF_GAP)
    transport.schedule(time => {
      opts.before?.()
      if (step.category === 'insufficient') missingAt(voices, mapping, time)
      else sounding(voices, mapping, step.category, { ...step, durationMs: noteSeconds * 1000 }, time)
      if (opts.tick !== false) tickAt(voices, mapping, time + noteSeconds)
      opts.onStep?.(index, time)
    }, step.atMs / 1000)
  })
}

const byTime = (steps: SequenceStep[]) => [...steps].sort((a, b) => a.atMs - b.atMs)

export function createSoundEngine(mapping: SoundMapping): SoundEngine {
  validateMapping(mapping)

  let tone: ToneModule | null = null
  let unlocking: Promise<void> | null = null
  let unlocked = false
  let volume = 1
  let style: SoundStyle = 'full'
  let spatial: SpatialMode = 'stereo'
  let voices: Voices

  // Sequence state.
  let state: 'idle' | 'playing' | 'paused' = 'idle'
  /** Bumped on every play and stop, so a step scheduled by an old sequence never reports itself. */
  let sequenceId = 0

  function unlock(): Promise<void> {
    unlocking ??= (async () => {
      const t = await import('tone')
      await t.start()
      tone = t
      voices = createVoices(t, mapping, style, volume, spatial)
      unlocked = true
    })()
    return unlocking
  }

  /** Brings the sound back after stop() or duck() cut it. Done before every new sound. */
  function open() {
    voices.cut.gain.cancelScheduledValues(tone!.now())
    voices.cut.gain.value = 1
  }

  function releaseAll() {
    voices.melody.triggerRelease()
    voices.missingSynth?.triggerRelease()
    voices.bell.triggerRelease()
    voices.pad.releaseAll()
  }

  function silence() {
    if (!unlocked) return
    voices.cut.gain.rampTo(0, CUT_RAMP_S)
    releaseAll()
  }

  function playCategory(id: CategoryId, opts?: { pan?: number; elevation?: number; durationMs?: number; pad?: CategoryId[] }) {
    if (!unlocked) return
    open()
    sounding(voices, mapping, id, opts)
  }

  function playTick() {
    if (!unlocked) return
    open()
    tickAt(voices, mapping)
  }

  function playMissing() {
    if (!unlocked) return
    open()
    missingAt(voices, mapping)
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
    const sorted = byTime(nextSteps)
    resetTransport()
    if (!sorted.length) {
      state = 'idle'
      return
    }
    const sequence = ++sequenceId

    scheduleSteps(t, voices, mapping, sorted, {
      tick: opts?.tick,
      before: open,
      // Draw runs the callback when the sound is heard, not when it is scheduled.
      onStep: (index, time) => draw.schedule(() => {
        if (sequence === sequenceId) onStep(index)
      }, time),
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

  /** Renders the steps, in the current style, faster than real time and returns them as a 16-bit stereo WAV file. */
  async function renderToWav(nextSteps: SequenceStep[]): Promise<Blob> {
    const sorted = byTime(nextSteps)
    if (!sorted.length) throw new Error('There is nothing to download yet.')
    const seconds = sorted[sorted.length - 1].atMs / 1000 + WAV_TAIL_S
    if (seconds > WAV_MAX_S) throw new Error('That is too long to download (over 3 minutes).')
    const t = tone ?? (await import('tone'))
    // Full level whatever the listening volume is: the file is played back on the listener's own volume.
    const buffer = await t.Offline(() => {
      scheduleSteps(t, createVoices(t, mapping, style, 1, spatial), mapping, sorted, {})
      t.getTransport().start(0)
    }, seconds, 2, WAV_SAMPLE_RATE)
    return encodeWav([buffer.getChannelData(0), buffer.getChannelData(1)], WAV_SAMPLE_RATE)
  }

  return {
    unlock,
    playCategory,
    playTick,
    playMissing,
    playSequence,
    setVolume(zeroToOne) {
      volume = Math.min(1, Math.max(0, Number.isFinite(zeroToOne) ? zeroToOne : 0))
      if (unlocked) voices.master.gain.rampTo(volume, VOLUME_RAMP_S)
    },
    pause() {
      pause()
      if (unlocked) releaseAll()
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
    setStyle(next) {
      style = next
      if (unlocked) applyStyle(voices, next)
    },
    setSpatial(next) {
      spatial = next
      if (unlocked) applySpatial(tone!, voices, next)
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
    renderToWav,
  }
}

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
//
// The "change" style (docs/PLAN.md §6.2, T114) adds the change bed, the contour voice and a compressor and limiter before the
// speakers. Those nodes are built the first time the style is used, so "full" and "simple" make exactly the nodes they always made.

import { Note } from 'tonal'
import type { CategoryId, SoundMapping } from '../data'
import type { Contour } from '../analysis/types'
import type { SequenceStep, SoundEngine } from '.'
import {
  BED_HIGHEST, BED_LOWEST, bedFor, CONTOUR_HIGHEST, CONTOUR_LOWEST, contourEvents, END_HISS_MS, SAW_SHARE, stepIndexOf, type ChangeSounds,
} from './changeVoice'
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

/** The mapping the engine reads: the usual one, plus (for a data set with a baseline) a note for each change step and contour level. */
export type EngineMapping = SoundMapping & ChangeSounds

/** The change bed holds its note until just before the next step, with this much left for the release. */
const BED_GAP_S = 0.03
const BED_LEVEL_DB = -10
const BED_ENVELOPE = { attack: 0.05, decay: 0, sustain: 1, release: 0.3 }
/** A contour takes this long per image width (so a line half as long as the image takes half as long), and 2 to 8 s whatever its length. */
const TRACE_MS_PER_UNIT = 6000
/** Where a contour sounds when the mapping has no note for its level: +1 at C5, +2 at G5 (PLAN.md §6.2). */
const DEFAULT_CONTOUR_NOTES = { low: 'C5', high: 'G5' }
const COMPRESSOR = { threshold: -18, ratio: 3, attack: 0.01, release: 0.25 }
const LIMITER_DB = -1
const ACCENT_MS = 40
/** The contour tone is released this long after its last point. */
const TRACE_TAIL_S = 0.1

/** Checks every note in the mapping and that cooler categories are always lower. Throws a message naming the problem. */
export function validateMapping(mapping: EngineMapping) {
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
  validateChangeSounds(mapping)
}

/** The v2 notes, when the data set has them: each change step in C3 to C4 and higher than the step before, each contour level in C3 to C6. */
function validateChangeSounds(mapping: ChangeSounds) {
  const midi = (note: string) => Note.midi(note)
  let previous = -Infinity
  for (const step of mapping.changeSteps ?? []) {
    const m = midi(step.note)
    if (m === null) throw new Error(`Change step "${step.id}" has "${step.note}", which is not a note name.`)
    if (m < midi(BED_LOWEST)! || m > midi(BED_HIGHEST)!) throw new Error(`Change step "${step.id}" (${step.note}) must be between ${BED_LOWEST} and ${BED_HIGHEST}.`)
    if (m <= previous) throw new Error(`Change step "${step.id}" (${step.note}) must sound higher than the step before it.`)
    previous = m
  }
  for (const level of mapping.contourLevels ?? []) {
    const m = midi(level.note)
    if (m === null) throw new Error(`Contour level ${level.value} has "${level.note}", which is not a note name.`)
    if (m < midi(CONTOUR_LOWEST)! || m > midi(CONTOUR_HIGHEST)!) throw new Error(`Contour level ${level.value} (${level.note}) must be between ${CONTOUR_LOWEST} and ${CONTOUR_HIGHEST}.`)
  }
}

type Synth = InstanceType<ToneModule['Synth']>

/** What only the "change" style uses. Built the first time it is needed. */
type ChangeVoices = {
  bedSine: Synth
  bedSaw: Synth
  bedFilter: InstanceType<ToneModule['Filter']>
  bedLevel: InstanceType<ToneModule['Gain']>
  contour: Synth
  contourFilter: InstanceType<ToneModule['Filter']>
  accent: Synth
  compressor: InstanceType<ToneModule['Compressor']>
  limiter: InstanceType<ToneModule['Limiter']>
}

/** Everything that makes sound: voices → panner → reverb → cut → master → speakers (in "change": cut → compressor → limiter → master). */
export type Voices = {
  style: SoundStyle
  change?: ChangeVoices
  melody: Synth
  tick: Synth
  missingNoise: InstanceType<ToneModule['NoiseSynth']>
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
export function createVoices(t: ToneModule, style: SoundStyle, volume: number, spatial: SpatialMode): Voices {
  // "change" keeps the full style's mallet, chord, slide, bell and reverb for a step that has no change step, so a data set without a baseline sounds as it does.
  const full = style !== 'simple'
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
  const missingFilter = new t.Filter({ type: 'bandpass', frequency: 900, Q: 1.2 }).connect(bus)
  const missingNoise = new t.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.3, release: 0.1 },
    volume: -10,
  }).connect(missingFilter)
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
  const voices: Voices = { style, melody, tick, missingNoise, pad, bell, reverb, bus, panner, spatial, cut, master }
  if (style === 'change') ensureChangeVoices(t, voices)
  return voices
}

/** Builds the change bed, contour voice, accent and the master chain once, and puts the chain in the path. */
function ensureChangeVoices(t: ToneModule, voices: Voices): ChangeVoices {
  if (voices.change) return voices.change
  // The bed is centred, so it skips the panner, and it skips the reverb too: a held pure tone in a reverb is louder or quieter by pitch (the comb filters),
  // which would undo the loudness matched across steps by bedFor.
  const bedLevel = new t.Gain(1).connect(voices.cut)
  const bedFilter = new t.Filter({ type: 'lowpass', frequency: 1000, Q: 1, rolloff: -12 }).connect(bedLevel)
  const bedSine = new t.Synth({ oscillator: { type: 'sine' }, envelope: BED_ENVELOPE, volume: BED_LEVEL_DB }).connect(bedFilter)
  const bedSaw = new t.Synth({ oscillator: { type: 'sawtooth' }, envelope: BED_ENVELOPE, volume: BED_LEVEL_DB + 20 * Math.log10(SAW_SHARE) }).connect(bedFilter)
  const contourFilter = new t.Filter({ type: 'lowpass', frequency: 1000, Q: 1, rolloff: -12 }).connect(voices.bus)
  const contour = new t.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.08, decay: 0, sustain: 1, release: 0.25 }, volume: -12 }).connect(contourFilter)
  const accent = new t.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.03, sustain: 0, release: 0.02 }, volume: -14 }).connect(voices.bus)
  const compressor = new t.Compressor(COMPRESSOR)
  const limiter = new t.Limiter(LIMITER_DB)
  compressor.connect(limiter)
  voices.change = { bedSine, bedSaw, bedFilter, bedLevel, contour, contourFilter, accent, compressor, limiter }
  routeMaster(voices, true)
  return voices.change
}

/** The sound reaches the speakers through the compressor and limiter in the "change" style, and directly in the others. */
function routeMaster(voices: Voices, through: boolean) {
  const chain = voices.change
  if (!chain) return
  voices.cut.disconnect()
  chain.limiter.disconnect()
  if (through) {
    voices.cut.connect(chain.compressor)
    chain.limiter.connect(voices.master)
  } else {
    voices.cut.connect(voices.master)
  }
}

/** Switches a built set of voices between the styles: the reverb and the melody's shape. The other layers check the style when they sound. */
function applyStyle(t: ToneModule, voices: Voices, style: SoundStyle) {
  voices.style = style
  voices.reverb.wet.value = style !== 'simple' ? REVERB.wet : 0
  voices.melody.set({ envelope: style !== 'simple' ? MALLET_ENVELOPE : SIMPLE_ENVELOPE })
  if (style === 'change') ensureChangeVoices(t, voices)
  routeMaster(voices, style === 'change')
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
function padNotes(mapping: EngineMapping, ids: CategoryId[]): string[] {
  return ids.flatMap(id => {
    const category = mapping.categories.find(c => c.id === id)
    return category ? [Note.transpose(category.note, '-8P')] : []
  })
}

function sounding(voices: Voices, mapping: EngineMapping, id: CategoryId, opts: NoteOptions | undefined, time?: number) {
  const category = mapping.categories.find(c => c.id === id)
  if (!category) return
  const full = voices.style !== 'simple'
  const seconds = (opts?.durationMs ?? DEFAULT_NOTE_MS) / 1000
  setPan(voices, opts?.pan, opts?.elevation, time)
  voices.melody.portamento = full && opts?.glide ? GLIDE_S : 0
  voices.melody.triggerAttackRelease(category.note, seconds, time)
  if (!full) return
  const chord = opts?.pad ? padNotes(mapping, opts.pad) : []
  if (chord.length) voices.pad.triggerAttackRelease(chord, seconds, time)
  if (opts?.bell) voices.bell.triggerAttackRelease(BELL_NOTE, BELL_SECONDS, time === undefined ? `+${BELL_DELAY_S}` : time + BELL_DELAY_S)
}

function tickAt(voices: Voices, mapping: EngineMapping, time?: number) {
  setPan(voices, 0, 0, time)
  voices.tick.triggerAttackRelease(mapping.tick.note, mapping.tick.durationMs / 1000, time)
}

function missingAt(voices: Voices, mapping: EngineMapping, time?: number) {
  setPan(voices, 0, 0, time)
  const seconds = mapping.missingCue.durationMs / 1000
  voices.missingNoise.triggerAttackRelease(seconds, time)
}

/**
 * The change bed for one step (PLAN.md §6.2): its own note, dry and centred (see ensureChangeVoices), with a cutoff and level from `bedFor`. Returns false when the step
 * has no change step in this mapping, and the caller plays the category note instead.
 */
function bedAt(voices: Voices, mapping: EngineMapping, step: SequenceStep, seconds: number, time?: number): boolean {
  const steps = mapping.changeSteps
  const chain = voices.change
  if (!steps || !chain || !step.changeStep || step.changeStep === 'insufficient') return false
  const index = stepIndexOf(steps, step.changeStep)
  if (index === -1) return false
  const bed = bedFor(index, steps.length, step.medianChange, steps[index].range, steps[index].note)
  if (time === undefined) {
    chain.bedFilter.frequency.value = bed.cutoffHz
    chain.bedLevel.gain.value = 10 ** (bed.gainDb / 20)
  } else {
    chain.bedFilter.frequency.setValueAtTime(bed.cutoffHz, time)
    chain.bedLevel.gain.setValueAtTime(10 ** (bed.gainDb / 20), time)
  }
  chain.bedSine.triggerAttackRelease(bed.note, seconds, time)
  chain.bedSaw.triggerAttackRelease(bed.note, seconds, time)
  return true
}

/**
 * Puts every step on the Transport of whatever context the voices were built in. `steps` must be sorted by time.
 * `before` runs first in each step (live playback uses it to reopen the sound after a stop); `onStep` runs with the step's index
 * and audio time.
 */
function scheduleSteps(
  t: ToneModule,
  voices: Voices,
  mapping: EngineMapping,
  steps: SequenceStep[],
  opts: { tick?: boolean; before?: () => void; onStep?: (index: number, time: number) => void },
) {
  const transport = t.getTransport()
  steps.forEach((step, index) => {
    const gap = index + 1 < steps.length ? (steps[index + 1].atMs - step.atMs) / 1000 : DEFAULT_NOTE_MS / 1000
    const noteSeconds = Math.min(DEFAULT_NOTE_MS / 1000, gap * NOTE_SHARE_OF_GAP)
    const bedSeconds = index + 1 < steps.length ? Math.max(0.1, gap - BED_GAP_S) : DEFAULT_NOTE_MS / 1000
    const change = voices.style === 'change' && step.changeStep !== undefined
    // A date too short on data hisses; it never sounds like "normal".
    const hiss = step.category === 'insufficient' || (change && step.changeStep === 'insufficient')
    transport.schedule(time => {
      opts.before?.()
      if (hiss) missingAt(voices, mapping, time)
      else if (!(change && bedAt(voices, mapping, step, bedSeconds, time))) sounding(voices, mapping, step.category, { ...step, durationMs: noteSeconds * 1000 }, time)
      if (opts.tick !== false) tickAt(voices, mapping, time + noteSeconds)
      opts.onStep?.(index, time)
    }, step.atMs / 1000)
  })
}

/** Where a level's line sounds: the mapping's note for it, else the nearest level's, else C5 for +1 and G5 above. */
function contourNote(mapping: EngineMapping, level: number): string {
  const levels = mapping.contourLevels ?? []
  const nearest = levels.reduce<(typeof levels)[number] | undefined>((best, l) => (!best || Math.abs(l.value - level) < Math.abs(best.value - level) ? l : best), undefined)
  return nearest?.note ?? (level < 1.5 ? DEFAULT_CONTOUR_NOTES.low : DEFAULT_CONTOUR_NOTES.high)
}

/**
 * Puts the contour voice for one line on the Transport of whatever context the voices were built in (live, or the offline one in a
 * measurement). One held tone at the level's note; at each point the place, the brightness, and where they apply a click and a hiss.
 * `onPoint` runs with each point's index and audio time; `onEnd` runs once the tone is released.
 */
export function scheduleTrace(
  t: ToneModule,
  voices: Voices,
  mapping: EngineMapping,
  contour: Contour,
  opts: { before?: () => void; onPoint?: (index: number, time: number) => void; onEnd?: (time: number) => void },
) {
  const chain = ensureChangeVoices(t, voices)
  const note = contourNote(mapping, contour.level)
  const { durationMs, events } = contourEvents(contour, note, TRACE_MS_PER_UNIT)
  const transport = t.getTransport()
  for (const event of events) {
    transport.schedule(time => {
      opts.before?.()
      setPan(voices, event.pan, event.elevation, time)
      chain.contourFilter.frequency.setValueAtTime(event.cutoffHz, time)
      if (event.index === 0) chain.contour.triggerAttack(note, time)
      if (event.accent) chain.accent.triggerAttackRelease(mapping.tick.note, ACCENT_MS / 1000, time)
      if (event.hiss) voices.missingNoise.triggerAttackRelease(END_HISS_MS / 1000, time)
      opts.onPoint?.(event.index, time)
    }, event.atMs / 1000)
  }
  transport.schedule(time => {
    chain.contour.triggerRelease(time)
    opts.onEnd?.(time)
  }, durationMs / 1000 + TRACE_TAIL_S)
  return durationMs
}

const byTime = (steps: SequenceStep[]) => [...steps].sort((a, b) => a.atMs - b.atMs)

export function createSoundEngine(mapping: EngineMapping): SoundEngine {
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
      voices = createVoices(t, style, volume, spatial)
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
    voices.bell.triggerRelease()
    voices.pad.releaseAll()
    if (voices.change) {
      voices.change.bedSine.triggerRelease()
      voices.change.bedSaw.triggerRelease()
      voices.change.contour.triggerRelease()
    }
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

  /**
   * The contour voice along one line (PLAN.md §6.2). It runs on the Transport like a sequence, so stop() and pause() end it, and it replaces
   * whatever was playing. Only in the "change" style: anywhere else this does nothing.
   */
  function traceContour(contour: Contour, onPoint?: (index: number) => void) {
    if (!unlocked || style !== 'change' || !contour.points.length) return
    const t = tone!
    resetTransport()
    releaseAll()
    const sequence = ++sequenceId
    const draw = t.getDraw()
    scheduleTrace(t, voices, mapping, contour, {
      before: open,
      onPoint: (index, time) => draw.schedule(() => {
        if (sequence === sequenceId) onPoint?.(index)
      }, time),
      onEnd: time => draw.schedule(() => {
        if (sequence === sequenceId && state === 'playing') state = 'idle'
      }, time),
    })
    state = 'playing'
    t.getTransport().start(`+${START_DELAY_S}`)
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
      scheduleSteps(t, createVoices(t, style, 1, spatial), mapping, sorted, {})
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
      if (unlocked) applyStyle(tone!, voices, next)
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
    traceContour,
  }
}

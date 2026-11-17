// The ensemble's audio graph (docs/PLAN.md §6.3, ticket SN04), built the same way on the live context and inside Tone.Offline:
//
//   voice synths or samplers → (filter) → (panner) → voice gain ─┬→ room send → convolver ─┐   (melody, harmony, arpeggio, hot spots)
//                                                                └────────────────────────┴→ bus → compressor → limiter → clip → master gain → speakers
//
// A live context also taps the master into an analyser that goes nowhere else (src/audio/level.ts, UI08), so it changes nothing that is heard.
// The limiter does the work and the hard clip after it holds the peak at −1 dBFS whatever the voices do. No noise, no Tone.Reverb (its impulse is random),
// no Freeverb and no PolySynth (measured: their renders differ from run to run), and nothing that calls Math.random: the room's impulse is seeded.
//
// SN19: given decoded instruments, a voice whose kit names one plays it through a Tone.Sampler (sample playback renders the same every time). Without
// them every voice is the oscillator it always was. The cues (time pulse, dropout taps, motion pad, explore tone) are always oscillators.

import type { InstrumentName, InstrumentVoice, Kit, VoiceId, Waveform } from '../../sonify/types'
import { LEVEL_FFT_SIZE, LEVEL_SMOOTHING, setLevelSource } from '../level'
import { createPanner, type Panner, type SpatialMode } from '../pan'
import {
  CEILING_LINEAR, CLIP_CURVE_POINTS, COMPRESSOR, DROPOUT_GAIN_DB, GLIDE_S, HARMONY_POLYPHONY, HOLD_FILTER_HZ, MALLET_ENVELOPE, MASTER_LIMIT_DB, MAX_HOTSPOT_VOICES,
  MOTION_FILTER_HZ, REVERB, REVERB_SEED, SAMPLE_RENEW_S, SAMPLER_ATTACK_S, SAMPLER_RELEASE_S, SCAN_VOICES, VOICE_GAIN_DB,
} from './constants'
import type { InstrumentBuffers } from './instruments'
import { reverbImpulse } from './seeded'
import { oscillatorFor } from './timbre'

type ToneModule = typeof import('tone')
type Synth = InstanceType<ToneModule['Synth']>
type Sampler = InstanceType<ToneModule['Sampler']>
type Gain = InstanceType<ToneModule['Gain']>
type Filter = InstanceType<ToneModule['Filter']>

/**
 * A recorded instrument played as one voice, with the calls the player makes on a Synth (SN19). Striking a note lets go of the last one at the same
 * moment, so each voice still sounds one note at a time. A sampler cannot slide, so setNote is legato: the new note struck as the old one is released.
 */
export type SampledVoice = {
  sampler: Sampler
  volume: Sampler['volume']
  /** Set by the player as on a Synth; a sampler cannot glide, so it changes nothing. */
  portamento: number
  triggerAttack(hz: number, time: number, velocity?: number): void
  triggerRelease(time: number): void
  triggerAttackRelease(hz: number, seconds: number, time: number, velocity?: number): void
  setNote(hz: number, time: number): void
  /** A recorded note runs out: strikes the held note again if it was struck SAMPLE_RENEW_S or more before `time`. */
  renew(time: number): void
}
/** A pitched voice: its kit's oscillator, or its recorded instrument once loaded. */
export type Voice = Synth | SampledVoice

/** A synth, then optionally a filter and a panner, ending in a gain that sets the voice's level. */
type Chain = { synth: Synth; out: Gain; filter?: Filter; panner?: Panner }
/** As Chain, for a voice that may play a recorded instrument. */
type PitchedChain = { synth: Voice; out: Gain; filter?: Filter; panner?: Panner }

export type Graph = {
  master: Gain
  compressor: InstanceType<ToneModule['Compressor']>
  limiter: InstanceType<ToneModule['Limiter']>
  /** The hard clip at CEILING_LINEAR, between the limiter and the master. */
  clip: InstanceType<ToneModule['WaveShaper']>
  bus: Gain
  /** The read-only tap on the master (UI08); null on an offline render, which is never listened to live. */
  analyser: AnalyserNode | null
  /** The room: a convolver with a seeded impulse, into the bus. */
  reverb: InstanceType<ToneModule['Convolver']>
  /** The send into the room at REVERB.wet; the melody, the harmony, the arpeggio and the hot spots feed it. */
  roomSend: Gain
  melody: PitchedChain
  /** One plain Synth (or Sampler) for each chord note (a PolySynth is not repeatable offline). */
  harmony: { synths: Voice[]; out: Gain }
  bass: PitchedChain
  hotspots: Required<PitchedChain>[]
  rhythm: Required<Pick<PitchedChain, 'panner'>> & PitchedChain
  motion: Required<Chain>
  time: Chain
  /** The explore tone (SN09). */
  hold: Required<Chain>
  /** The scan bank (SN08): each note its own synth, filter and panner. */
  scan: { synth: Voice; filter: Filter; panner: Panner }[]
  dropout: Synth[]
  /** Disposes every node. */
  dispose(): void
}

export type GraphOptions = {
  /** The master gain to start at: 0 live (start() fades it in), 1 offline. */
  master: number
  spatial: SpatialMode
  /** The style's instruments; absent is the default kit. */
  kit?: Kit
  /** Added to the bass voice's level, −6 to +6 dB (the listener's Bass setting). */
  bassDb?: number
  /** SN14: FM oscillators for every pitched voice. The time pulse and the dropout taps stay plain, so they always sound the same. */
  fm?: boolean
  /** SN19: the decoded instruments. A voice whose kit names one of these plays it; absent, every voice is an oscillator, exactly as before. */
  instruments?: InstrumentBuffers
}

/** The kit of the presets that name none (major, dorian, pentatonic). Until its instruments load it is triangle oscillators, as before SN19. */
export const DEFAULT_KIT: Kit = {
  melody: 'triangle', bass: 'triangle', rhythm: 'triangle',
  instruments: { melody: 'marimba', harmony: 'string_ensemble_1', bass: 'acoustic_bass', rhythm: 'orchestral_harp', hotspots: 'tubular_bells' },
}

function sampledVoice(sampler: Sampler): SampledVoice {
  let held: { hz: number; at: number } | null = null
  const voice: SampledVoice = {
    sampler,
    volume: sampler.volume,
    portamento: 0,
    triggerAttack(hz, time, velocity = 1) {
      if (held) sampler.triggerRelease(held.hz, time)
      sampler.triggerAttack(hz, time, velocity)
      held = { hz, at: time }
    },
    triggerRelease(time) {
      if (held) sampler.triggerRelease(held.hz, time)
      held = null
    },
    triggerAttackRelease(hz, seconds, time, velocity = 1) {
      sampler.triggerAttackRelease(hz, seconds, time, velocity)
    },
    setNote(hz, time) {
      voice.triggerAttack(hz, time)
    },
    renew(time) {
      if (held && time - held.at >= SAMPLE_RENEW_S) voice.triggerAttack(held.hz, time)
    },
  }
  return voice
}

/** The analyser on the master's output, handed to src/audio/level.ts. Not on an offline render: that is never heard, and must not take the live graph's place. */
function tapMaster(t: ToneModule, master: Gain): AnalyserNode | null {
  const context = t.getContext().rawContext
  if ('startRendering' in context) return null
  const analyser = context.createAnalyser()
  analyser.fftSize = LEVEL_FFT_SIZE
  analyser.smoothingTimeConstant = LEVEL_SMOOTHING
  master.connect(analyser)
  setLevelSource(analyser)
  return analyser
}

export function buildGraph(t: ToneModule, options: GraphOptions): Graph {
  const nodes: { dispose(): unknown }[] = []
  const track = <T extends { dispose(): unknown }>(node: T): T => {
    nodes.push(node)
    return node
  }

  const master = track(new t.Gain(options.master).toDestination())
  const analyser = tapMaster(t, master)
  const clip = track(new t.WaveShaper(x => Math.max(-CEILING_LINEAR, Math.min(CEILING_LINEAR, x)), CLIP_CURVE_POINTS).connect(master))
  const limiter = track(new t.Limiter(MASTER_LIMIT_DB).connect(clip))
  const compressor = track(new t.Compressor(COMPRESSOR).connect(limiter))
  const bus = track(new t.Gain(1).connect(compressor))
  // The room: a convolver whose impulse is seeded, so it renders the same every time, fed through one send at REVERB.wet.
  const impulse = track(new t.ToneAudioBuffer().fromArray(reverbImpulse(REVERB_SEED, t.getContext().sampleRate, REVERB)))
  const reverb = track(new t.Convolver(impulse).connect(bus))
  const roomSend = track(new t.Gain(REVERB.wet).connect(reverb))

  const gain = (target: Parameters<Gain['connect']>[0]) => track(new t.Gain(0).connect(target))
  /** A voice's gain into the bus, and into the room too for the voices that sit in it. */
  const roomGain = () => gain(bus).connect(roomSend)
  const kit = options.kit ?? DEFAULT_KIT
  const synthFor = (voice: VoiceId, type: Waveform, envelope: object, extra: object = {}) =>
    track(new t.Synth({ oscillator: { type: oscillatorFor(type, options.fm === true && voice !== 'time') }, envelope, volume: VOICE_GAIN_DB[voice], ...extra }))
  const filterTo = (target: Gain | Panner, frequency: number) => track(new t.Filter({ type: 'lowpass', frequency, Q: 1, rolloff: -12 }).connect(target))
  const pannerTo = (target: Gain) => track(createPanner(t, options.spatial).connect(target))
  const PLUCK = { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 }

  /** The decoded notes of the instrument the kit names for this voice, if they have loaded. */
  const notesFor = (voice: InstrumentVoice) => {
    const name: InstrumentName | undefined = kit.instruments?.[voice]
    return name ? options.instruments?.get(name) : undefined
  }
  /** A pitched voice: the kit's recorded instrument if its notes are given, else the synth it always was. The synth's options are not used for a sampler. */
  const pitched = (voice: InstrumentVoice, release: number, target: Parameters<Gain['connect']>[0], synth: () => Synth, volumeDb = VOICE_GAIN_DB[voice]): Voice => {
    const notes = notesFor(voice)
    if (!notes) return synth().connect(target)
    return sampledVoice(track(new t.Sampler({ urls: notes, attack: SAMPLER_ATTACK_S, release, volume: volumeDb })).connect(target))
  }

  // Centred voices skip the panner.
  const melodyOut = roomGain()
  const melody: PitchedChain = { synth: pitched('melody', SAMPLER_RELEASE_S.melody, melodyOut, () => synthFor('melody', kit.melody, MALLET_ENVELOPE)), out: melodyOut }
  melody.synth.portamento = 0

  const harmonyOut = roomGain()
  const harmonySynths = Array.from({ length: HARMONY_POLYPHONY }, () =>
    pitched('harmony', SAMPLER_RELEASE_S.harmony, harmonyOut, () => synthFor('harmony', 'sine', { attack: 0.3, decay: 0, sustain: 1, release: 0.8 })))
  const harmony = { synths: harmonySynths, out: harmonyOut }

  const bassOut = gain(bus)
  const bassDb = VOICE_GAIN_DB.bass + (options.bassDb ?? 0)
  const bass: PitchedChain = {
    synth: pitched('bass', SAMPLER_RELEASE_S.bass, bassOut, () => synthFor('bass', kit.bass, { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3 }, { volume: bassDb }), bassDb),
    out: bassOut,
  }

  const hotspots = Array.from({ length: MAX_HOTSPOT_VOICES }, () => {
    const out = roomGain()
    const panner = pannerTo(out)
    const filter = filterTo(panner, HOLD_FILTER_HZ.low)
    const synth = pitched('hotspots', SAMPLER_RELEASE_S.hotspots, filter, () => synthFor('hotspots', 'triangle', { attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.3 }, { portamento: GLIDE_S }))
    return { synth, out, filter, panner }
  })

  const rhythmOut = roomGain()
  const rhythmPanner = pannerTo(rhythmOut)
  const rhythm = { synth: pitched('rhythm', SAMPLER_RELEASE_S.rhythm, rhythmPanner, () => synthFor('rhythm', kit.rhythm, PLUCK)), out: rhythmOut, panner: rhythmPanner }

  const motionOut = gain(bus)
  const motionPanner = pannerTo(motionOut)
  const motionFilter = filterTo(motionPanner, MOTION_FILTER_HZ.low)
  const motion = { synth: synthFor('motion', 'sawtooth', { attack: 0.4, decay: 0, sustain: 1, release: 0.6 }).connect(motionFilter), out: motionOut, filter: motionFilter, panner: motionPanner }

  const timeOut = gain(bus)
  const time: Chain = { synth: synthFor('time', 'sine', { attack: 0.002, decay: 0.04, sustain: 0, release: 0.02 }).connect(timeOut), out: timeOut }

  const holdOut = gain(bus)
  const holdPanner = pannerTo(holdOut)
  const holdFilter = filterTo(holdPanner, HOLD_FILTER_HZ.low)
  const hold = { synth: synthFor('melody', 'triangle', { attack: 0.02, decay: 0, sustain: 1, release: 0.15 }, { portamento: GLIDE_S }).connect(holdFilter), out: holdOut, filter: holdFilter, panner: holdPanner }

  const scan = Array.from({ length: SCAN_VOICES }, () => {
    const panner = pannerTo(bus)
    const filter = filterTo(panner, HOLD_FILTER_HZ.high)
    const synth = pitched('melody', SAMPLER_RELEASE_S.scan, filter, () => synthFor('melody', kit.melody, PLUCK))
    return { synth, filter, panner }
  })

  const dropout = [0, 1].map(() => track(new t.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.02 }, volume: DROPOUT_GAIN_DB }).connect(bus)))

  return {
    master, compressor, limiter, clip, bus, analyser, reverb, roomSend, melody, harmony, bass, hotspots, rhythm, motion, time, hold, scan, dropout,
    dispose() {
      if (analyser) {
        analyser.disconnect()
        setLevelSource(null)
      }
      for (const node of nodes) node.dispose()
    },
  }
}

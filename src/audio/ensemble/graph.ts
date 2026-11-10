// The ensemble's audio graph (docs/PLAN.md §6.3, ticket SN04), built the same way on the live context and inside Tone.Offline:
//
//   voice synths → (filter) → (panner) → voice gain ─┬→ space (melody, harmony only) ─┐
//                                                    └────────────────────────────────┴→ bus → compressor → limiter → clip → master gain → speakers
//
// The limiter does the work and the hard clip after it holds the peak at −1 dBFS whatever the voices do. No noise, no Tone.Reverb (its impulse is random),
// no Freeverb and no PolySynth (measured: their renders differ from run to run), and nothing that calls Math.random.

import type { VoiceId } from '../../sonify/types'
import { createPanner, type Panner, type SpatialMode } from '../pan'
import {
  CEILING_LINEAR, CLIP_CURVE_POINTS, COMPRESSOR, DROPOUT_GAIN_DB, GLIDE_S, HARMONY_POLYPHONY, HOLD_FILTER_HZ, MALLET_ENVELOPE, MASTER_LIMIT_DB, MAX_HOTSPOT_VOICES,
  MOTION_FILTER_HZ, SCAN_VOICES, SPACE, VOICE_GAIN_DB,
} from './constants'

type ToneModule = typeof import('tone')
type Synth = InstanceType<ToneModule['Synth']>
type Gain = InstanceType<ToneModule['Gain']>
type Filter = InstanceType<ToneModule['Filter']>

/** A synth, then optionally a filter and a panner, ending in a gain that sets the voice's level. */
type Chain = { synth: Synth; out: Gain; filter?: Filter; panner?: Panner }

export type Graph = {
  master: Gain
  compressor: InstanceType<ToneModule['Compressor']>
  limiter: InstanceType<ToneModule['Limiter']>
  /** The hard clip at CEILING_LINEAR, between the limiter and the master. */
  clip: InstanceType<ToneModule['WaveShaper']>
  bus: Gain
  /** The first of the two delay lines that make the room; the melody and the harmony feed it. */
  space: InstanceType<ToneModule['FeedbackDelay']>
  melody: Chain
  /** One plain Synth for each chord note (a PolySynth is not repeatable offline). */
  harmony: { synths: Synth[]; out: Gain }
  bass: Chain
  hotspots: Required<Chain>[]
  rhythm: Required<Pick<Chain, 'panner'>> & Chain
  motion: Required<Chain>
  time: Chain
  /** The explore tone (SN09). */
  hold: Required<Chain>
  /** The scan bank (SN08): each note its own synth, filter and panner. */
  scan: { synth: Synth; filter: Filter; panner: Panner }[]
  dropout: Synth[]
  /** Disposes every node. */
  dispose(): void
}

export type GraphOptions = {
  /** The master gain to start at: 0 live (start() fades it in), 1 offline. */
  master: number
  spatial: SpatialMode
}

export function buildGraph(t: ToneModule, options: GraphOptions): Graph {
  const nodes: { dispose(): unknown }[] = []
  const track = <T extends { dispose(): unknown }>(node: T): T => {
    nodes.push(node)
    return node
  }

  const master = track(new t.Gain(options.master).toDestination())
  const clip = track(new t.WaveShaper(x => Math.max(-CEILING_LINEAR, Math.min(CEILING_LINEAR, x)), CLIP_CURVE_POINTS).connect(master))
  const limiter = track(new t.Limiter(MASTER_LIMIT_DB).connect(clip))
  const compressor = track(new t.Compressor(COMPRESSOR).connect(limiter))
  const bus = track(new t.Gain(1).connect(compressor))
  // The room: two short delay lines in series, each mixed in at SPACE.wet. The melody and the harmony feed the first.
  const [firstLine, secondLine] = SPACE.lines
  const secondDelay = track(new t.FeedbackDelay({ ...secondLine, wet: SPACE.wet }).connect(bus))
  const space = track(new t.FeedbackDelay({ ...firstLine, wet: SPACE.wet }).connect(secondDelay))

  const gain = (target: Parameters<Gain['connect']>[0]) => track(new t.Gain(0).connect(target))
  const synthFor = (voice: VoiceId, type: 'triangle' | 'sine' | 'sawtooth', envelope: object, extra: object = {}) =>
    track(new t.Synth({ oscillator: { type }, envelope, volume: VOICE_GAIN_DB[voice], ...extra }))
  const filterTo = (target: Gain | Panner, frequency: number) => track(new t.Filter({ type: 'lowpass', frequency, Q: 1, rolloff: -12 }).connect(target))
  const pannerTo = (target: Gain) => track(createPanner(t, options.spatial).connect(target))
  const PLUCK = { attack: 0.005, decay: 0.12, sustain: 0, release: 0.08 }

  // Centred voices skip the panner.
  const melodyOut = gain(space)
  const melody: Chain = { synth: synthFor('melody', 'triangle', MALLET_ENVELOPE).connect(melodyOut), out: melodyOut }
  melody.synth.portamento = 0

  const harmonyOut = gain(space)
  const harmonySynths = Array.from({ length: HARMONY_POLYPHONY }, () =>
    synthFor('harmony', 'sine', { attack: 0.3, decay: 0, sustain: 1, release: 0.8 }).connect(harmonyOut))
  const harmony = { synths: harmonySynths, out: harmonyOut }

  const bassOut = gain(bus)
  const bass: Chain = { synth: synthFor('bass', 'triangle', { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3 }).connect(bassOut), out: bassOut }

  const hotspots = Array.from({ length: MAX_HOTSPOT_VOICES }, () => {
    const out = gain(bus)
    const panner = pannerTo(out)
    const filter = filterTo(panner, HOLD_FILTER_HZ.low)
    const synth = synthFor('hotspots', 'triangle', { attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.3 }, { portamento: GLIDE_S }).connect(filter)
    return { synth, out, filter, panner }
  })

  const rhythmOut = gain(bus)
  const rhythmPanner = pannerTo(rhythmOut)
  const rhythm = { synth: synthFor('rhythm', 'triangle', PLUCK).connect(rhythmPanner), out: rhythmOut, panner: rhythmPanner }

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
    const synth = synthFor('melody', 'triangle', PLUCK).connect(filter)
    return { synth, filter, panner }
  })

  const dropout = [0, 1].map(() => track(new t.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.02 }, volume: DROPOUT_GAIN_DB }).connect(bus)))

  return {
    master, compressor, limiter, clip, bus, space, melody, harmony, bass, hotspots, rhythm, motion, time, hold, scan, dropout,
    dispose() {
      for (const node of nodes) node.dispose()
    },
  }
}

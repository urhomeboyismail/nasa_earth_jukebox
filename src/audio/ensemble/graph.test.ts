import * as Tone from 'tone'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRESETS } from '../../sonify/presets'
import type { InstrumentName } from '../../sonify/types'
import {
  CEILING_LINEAR, COMPRESSOR, HARMONY_POLYPHONY, MASTER_LIMIT_DB, MAX_HOTSPOT_VOICES, REVERB, REVERB_SEED, SAMPLER_ATTACK_S, SAMPLER_RELEASE_S, SCAN_VOICES,
  VOICE_GAIN_DB,
} from './constants'
import { buildGraph, DEFAULT_KIT } from './graph'
import type { InstrumentBuffers } from './instruments'
import { hasLevelSource, setLevelSource } from '../level'
import { reverbImpulse } from './seeded'
import { calls, callsOn, MOCK_SAMPLE_RATE, nodes, raw, resetTone, type MockNode } from './toneMock'

vi.mock('tone', async () => (await import('./toneMock')).toneModule)

beforeEach(() => {
  resetTone()
  setLevelSource(null)
})

const only = (name: string) => nodes[name] ?? []
const connected = (from: MockNode, to: MockNode) => from.connectedTo.includes(to)

describe('buildGraph: the master chain', () => {
  it('ends bus → compressor → limiter at −1 dB → clip → master → speakers', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const [compressor] = only('Compressor')
    const [limiter] = only('Limiter')
    const [clip] = only('WaveShaper')
    expect(only('Compressor')).toHaveLength(1)
    expect(only('Limiter')).toHaveLength(1)
    expect(only('WaveShaper')).toHaveLength(1)
    expect(compressor.options).toEqual(COMPRESSOR)
    expect(limiter.options).toBe(MASTER_LIMIT_DB)
    expect(MASTER_LIMIT_DB).toBe(-1)
    expect(connected(g.bus as unknown as MockNode, compressor)).toBe(true)
    expect(connected(compressor, limiter)).toBe(true)
    expect(limiter.connectedTo).toEqual([clip])
    expect(clip.connectedTo).toEqual([g.master])
    expect((g.master as unknown as MockNode).toDestinationCalled).toBe(true)
    // Only the master reaches the speakers.
    expect(only('Gain').filter(n => n.toDestinationCalled)).toEqual([g.master])
  })

  it('clips hard at the ceiling, just under −1 dBFS, and leaves everything below it alone', () => {
    buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const [mapping] = only('WaveShaper')[0].options as [(x: number) => number, number]
    expect(CEILING_LINEAR).toBeLessThanOrEqual(10 ** (-1 / 20))
    expect(mapping(2)).toBe(CEILING_LINEAR)
    expect(mapping(-2)).toBe(-CEILING_LINEAR)
    expect(mapping(1)).toBe(CEILING_LINEAR)
    for (const x of [-0.8, -0.3, 0, 0.001, 0.5, 0.89]) expect(mapping(x)).toBe(x)
  })

  it('starts the master at the level it is given', () => {
    expect(buildGraph(Tone, { master: 0, spatial: 'stereo' }).master).toBe(only('Gain')[0])
    expect(only('Gain')[0].options).toBe(0)
    resetTone()
    buildGraph(Tone, { master: 1, spatial: 'stereo' })
    expect(only('Gain')[0].options).toBe(1)
  })
})

describe('buildGraph: the level tap (UI08)', () => {
  it('connects the master to an analyser as well, and the master still reaches the speakers', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const master = g.master as unknown as MockNode
    expect(raw.analysers).toHaveLength(1)
    expect(g.analyser).toBe(raw.analysers[0])
    expect(raw.analysers[0]).toMatchObject({ fftSize: 256, smoothingTimeConstant: 0.8 })
    expect(master.connectedTo).toEqual([raw.analysers[0]])
    expect(master.toDestinationCalled).toBe(true)
    expect(only('Gain').filter(n => n.toDestinationCalled)).toEqual([master])
  })

  it('takes nothing from the chain before the master: the analyser has no output', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const [clip] = only('WaveShaper')
    expect(clip.connectedTo).toEqual([g.master])
    expect(Object.keys(raw.analysers[0]).sort()).toEqual(['connected', 'disconnect', 'fftSize', 'smoothingTimeConstant'])
  })

  it('hands the analyser to the level reader, and takes it back on dispose', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    expect(hasLevelSource()).toBe(true)
    g.dispose()
    expect(hasLevelSource()).toBe(false)
    expect(raw.analysers[0].connected).toBe(false)
  })

  it('is not made for an offline render, so a render never replaces the live tap', () => {
    const live = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    Object.assign(raw, { startRendering: () => {} })
    try {
      const offline = buildGraph(Tone, { master: 1, spatial: 'stereo' })
      expect(offline.analyser).toBeNull()
      expect(raw.analysers).toHaveLength(1)
      offline.dispose()
      expect(hasLevelSource()).toBe(true)
    } finally {
      delete (raw as { startRendering?: unknown }).startRendering
    }
    live.dispose()
  })
})

describe('buildGraph: the voices', () => {
  it('makes every voice, with three hot-spot slots, a scan bank of eight and two dropout taps', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    expect(g.hotspots).toHaveLength(MAX_HOTSPOT_VOICES)
    expect(g.scan).toHaveLength(SCAN_VOICES)
    expect(g.dropout).toHaveLength(2)
    expect(g.harmony.synths).toHaveLength(HARMONY_POLYPHONY)
    expect((g.melody.synth as unknown as { portamento: number }).portamento).toBe(0)
  })

  it('gives each hot spot its own panner, so each has its own place', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    expect(new Set(g.hotspots.map(h => h.panner)).size).toBe(MAX_HOTSPOT_VOICES)
  })

  it('uses the 3D panner for the 3D mode', () => {
    buildGraph(Tone, { master: 0, spatial: '3d' })
    expect(only('Panner')).toHaveLength(0)
    expect(only('Panner3D').length).toBeGreaterThan(0)
  })

  // SN19 replaced the room's two delay lines with a convolver whose impulse is seeded, so this lists a Convolver and its impulse buffer, not two FeedbackDelays.
  it('makes no noise, no Reverb (its impulse is random) and no other random source: the room is a convolver with a seeded impulse', () => {
    buildGraph(Tone, { master: 0, spatial: 'stereo' })
    expect(Object.keys(nodes).sort()).toEqual(['Compressor', 'Convolver', 'Filter', 'Gain', 'Limiter', 'Panner', 'Synth', 'ToneAudioBuffer', 'WaveShaper'])
    expect(only('Convolver')).toHaveLength(1)
    const [impulse] = only('ToneAudioBuffer')
    expect(only('Convolver')[0].options).toBe(impulse)
    expect(callsOn(impulse, 'fromArray')[0].args[0]).toEqual(reverbImpulse(REVERB_SEED, MOCK_SAMPLE_RATE, REVERB))
    for (const synth of only('Synth')) {
      const options = synth.options as { oscillator: { type: string } }
      expect(['sine', 'triangle', 'sawtooth']).toContain(options.oscillator.type)
    }
  })

  // SN19: the room is one convolver send (it was two delay lines that only the melody and the harmony fed).
  it('sends the melody, the harmony, the arpeggio and the hot spots into the room as well as dry to the bus, and the bass and the cues only dry', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const node = (n: unknown) => n as MockNode
    const send = node(g.roomSend)
    expect(send.options).toBe(REVERB.wet)
    expect(send.connectedTo).toEqual([node(g.reverb)])
    expect(node(g.reverb).connectedTo).toEqual([node(g.bus)])
    for (const out of [g.melody.out, g.harmony.out, g.rhythm.out, ...g.hotspots.map(h => h.out)]) {
      expect(connected(node(out), send)).toBe(true)
      expect(connected(node(out), node(g.bus))).toBe(true)
    }
    for (const out of [g.bass.out, g.motion.out, g.time.out, g.hold.out]) {
      expect(connected(node(out), send)).toBe(false)
      expect(connected(node(out), node(g.bus))).toBe(true)
    }
  })
})

describe('buildGraph: the same graph, live and offline', () => {
  const counts = () => Object.fromEntries(Object.entries(nodes).map(([name, list]) => [name, list.length]))

  it('builds the same nodes every time it is built', () => {
    buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const first = counts()
    resetTone()
    buildGraph(Tone, { master: 1, spatial: 'stereo' })
    expect(counts()).toEqual(first)
  })

  it('disposes every node it made', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const made = Object.values(nodes).flat().length
    calls.length = 0
    g.dispose()
    expect(calls.filter(c => c.method === 'dispose')).toHaveLength(made)
  })
})

describe('buildGraph: a style\'s kit and the Bass setting', () => {
  type SynthOptions = { oscillator: { type: string }; volume: number }
  const synthOptions = (synth: unknown) => (synth as MockNode).options as SynthOptions

  it('plays the melody, bass and rhythm with the kit\'s waveforms, and the default kit is triangle', () => {
    const plain = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    expect(synthOptions(plain.melody.synth).oscillator.type).toBe('triangle')
    resetTone()
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', kit: { melody: 'square', bass: 'sawtooth', rhythm: 'sine' } })
    expect(synthOptions(g.melody.synth).oscillator.type).toBe('square')
    expect(synthOptions(g.bass.synth).oscillator.type).toBe('sawtooth')
    expect(synthOptions(g.rhythm.synth).oscillator.type).toBe('sine')
  })

  it('adds the Bass setting to the bass voice only', () => {
    const flat = synthOptions(buildGraph(Tone, { master: 0, spatial: 'stereo' }).bass.synth).volume
    resetTone()
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', bassDb: 4 })
    expect(synthOptions(g.bass.synth).volume).toBe(flat + 4)
  })
})


describe('buildGraph: the recorded instruments (SN19)', () => {
  /** Small fake buffers: a few notes for every instrument, as the loader would give them. */
  const fakeBuffers = (names: InstrumentName[]): InstrumentBuffers =>
    new Map(names.map(name => [name, { 48: new Float32Array(4), 60: new Float32Array(4), 72: new Float32Array(4) } as unknown as Record<number, AudioBuffer>]))
  const kitNames = (kit = DEFAULT_KIT) => Object.values(kit.instruments ?? {})
  const samplerOptions = (n: unknown) => (n as MockNode).options as { urls: unknown; attack: number; release: number; volume: number }

  it('plays each pitched voice through a sampler of its kit\'s instrument once the notes are given, and keeps the cues as oscillators', () => {
    const buffers = fakeBuffers(kitNames())
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', instruments: buffers })
    const voices = 1 + HARMONY_POLYPHONY + 1 + MAX_HOTSPOT_VOICES + 1 + SCAN_VOICES
    expect(only('Sampler')).toHaveLength(voices)
    // The motion pad, the time pulse, the explore tone and the two dropout taps.
    expect(only('Synth')).toHaveLength(5)
    expect(samplerOptions(only('Sampler')[0])).toEqual({ urls: buffers.get('marimba'), attack: SAMPLER_ATTACK_S, release: SAMPLER_RELEASE_S.melody, volume: VOICE_GAIN_DB.melody })
    expect(samplerOptions(g.harmony.synths.map(v => (v as { sampler: unknown }).sampler)[0]).urls).toBe(buffers.get('string_ensemble_1'))
    expect(samplerOptions((g.bass.synth as { sampler: unknown }).sampler).urls).toBe(buffers.get('acoustic_bass'))
    expect(samplerOptions((g.rhythm.synth as { sampler: unknown }).sampler).urls).toBe(buffers.get('orchestral_harp'))
    expect(samplerOptions((g.hotspots[0].synth as { sampler: unknown }).sampler).urls).toBe(buffers.get('tubular_bells'))
  })

  it('keeps the brightness filter after a hot spot\'s sampler, and adds the Bass setting to the bass sampler', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', bassDb: 4, instruments: fakeBuffers(kitNames()) })
    const sampler = (g.hotspots[0].synth as { sampler: unknown }).sampler as MockNode
    expect(sampler.connectedTo).toEqual([g.hotspots[0].filter])
    expect(samplerOptions((g.bass.synth as { sampler: unknown }).sampler).volume).toBe(VOICE_GAIN_DB.bass + 4)
  })

  it('plays each style\'s own instruments, and none for a kit that names none (8-bit, heavy bass)', () => {
    const cinematic = PRESETS.cinematic.kit!
    const buffers = fakeBuffers(kitNames(cinematic))
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', kit: cinematic, instruments: buffers })
    expect(samplerOptions((g.melody.synth as { sampler: unknown }).sampler).urls).toBe(buffers.get('flute'))
    expect(samplerOptions((g.bass.synth as { sampler: unknown }).sampler).urls).toBe(buffers.get('cello'))
    for (const id of ['chiptune', 'bass'] as const) {
      resetTone()
      buildGraph(Tone, { master: 0, spatial: 'stereo', kit: PRESETS[id].kit, instruments: fakeBuffers(kitNames()) })
      expect(only('Sampler'), id).toHaveLength(0)
    }
  })

  it('keeps the oscillator for a voice whose instrument has not loaded', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', instruments: fakeBuffers(['marimba']) })
    expect('sampler' in g.melody.synth).toBe(true)
    expect('sampler' in g.bass.synth).toBe(false)
    expect(only('Sampler')).toHaveLength(1 + SCAN_VOICES)
  })

  it('builds exactly the same nodes without instruments as with an empty set', () => {
    buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const without = calls.map(c => [c.node, c.method])
    resetTone()
    buildGraph(Tone, { master: 0, spatial: 'stereo', instruments: new Map() })
    expect(calls.map(c => [c.node, c.method])).toEqual(without)
  })

  it('puts the room and every sampler before the limiter and the hard clip, so the peak still holds at −1 dBFS', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', instruments: fakeBuffers(kitNames()) })
    const [clip] = only('WaveShaper')
    const intoMaster = Object.values(nodes).flat().filter(n => n.connectedTo.includes(g.master as unknown as MockNode))
    expect(intoMaster).toEqual([clip])
    expect((g.reverb as unknown as MockNode).connectedTo).toEqual([g.bus])
    for (const sampler of only('Sampler')) expect(sampler.connectedTo.some(n => n === (g.master as unknown as MockNode) || n === clip)).toBe(false)
  })

  it('disposes every sampler too', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo', instruments: fakeBuffers(kitNames()) })
    const made = Object.values(nodes).flat().length
    calls.length = 0
    g.dispose()
    expect(calls.filter(c => c.method === 'dispose')).toHaveLength(made)
  })
})

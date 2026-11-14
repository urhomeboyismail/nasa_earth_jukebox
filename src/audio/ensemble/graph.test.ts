import * as Tone from 'tone'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CEILING_LINEAR, COMPRESSOR, HARMONY_POLYPHONY, MASTER_LIMIT_DB, MAX_HOTSPOT_VOICES, SCAN_VOICES } from './constants'
import { buildGraph } from './graph'
import { hasLevelSource, setLevelSource } from '../level'
import { calls, nodes, raw, resetTone, type MockNode } from './toneMock'

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

  it('makes no noise, no Reverb (its impulse is random) and no other random source', () => {
    buildGraph(Tone, { master: 0, spatial: 'stereo' })
    expect(Object.keys(nodes).sort()).toEqual(['Compressor', 'FeedbackDelay', 'Filter', 'Gain', 'Limiter', 'Panner', 'Synth', 'WaveShaper'])
    expect(only('FeedbackDelay')).toHaveLength(2)
    for (const synth of only('Synth')) {
      const options = synth.options as { oscillator: { type: string } }
      expect(['sine', 'triangle', 'sawtooth']).toContain(options.oscillator.type)
    }
  })

  it('sends the melody and the harmony through the room (two delay lines in series), and the others dry', () => {
    const g = buildGraph(Tone, { master: 0, spatial: 'stereo' })
    const [second, first] = only('FeedbackDelay') // the second line is made first: the first connects to it
    expect(g.space).toBe(first)
    expect(first.connectedTo).toEqual([second])
    expect(second.connectedTo).toEqual([g.bus])
    expect(connected(g.melody.out as unknown as MockNode, first)).toBe(true)
    expect(connected(g.harmony.out as unknown as MockNode, first)).toBe(true)
    expect(connected(g.bass.out as unknown as MockNode, first)).toBe(false)
    expect(connected(g.bass.out as unknown as MockNode, g.bus as unknown as MockNode)).toBe(true)
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


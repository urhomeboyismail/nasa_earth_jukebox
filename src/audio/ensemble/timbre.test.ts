import * as Tone from 'tone'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toMusicFrame } from '../../sonify/music'
import { PRESETS } from '../../sonify/presets'
import { features, spot } from '../../sonify/testFeatures'
import { HOLD_FILTER_HZ, MOTION_FILTER_HZ } from './constants'
import { buildGraph } from './graph'
import { cutoff, DEFAULT_TIMBRE, oscillatorFor, resolveTimbre, type Timbre } from './timbre'
import { callsOn, resetTone, type MockNode } from './toneMock'
import { createPlayer } from './voices'

vi.mock('tone', async () => (await import('./toneMock')).toneModule)

const major = PRESETS.major
const frame = () => toMusicFrame(features({ hotspots: [spot('h1', 'high', 0.2, 0.3, 0.05), spot('h2', 'low', 0.8, 0.7, 0.02)] }), major, null)
const on = (node: unknown, method: string) => callsOn(node as MockNode, method)
const oscillator = (node: unknown) => ((node as MockNode).options as { oscillator: { type: string } }).oscillator.type

function play(timbre?: Timbre) {
  const graph = buildGraph(Tone, { master: 1, spatial: 'stereo', fm: timbre?.fm })
  const player = createPlayer({ t: Tone, graph, preset: major, timbre, clock: () => 0, canSound: () => true })
  const music = frame()
  player.apply(music, 1)
  return { graph, music }
}

beforeEach(resetTone)

describe('resolveTimbre (SN14)', () => {
  it('is the default, today\'s sound, without a spec or with an empty one', () => {
    expect(resolveTimbre()).toBe(DEFAULT_TIMBRE)
    expect(resolveTimbre({})).toEqual(DEFAULT_TIMBRE)
  })

  it('reads every field', () => {
    expect(resolveTimbre({ instrument: 'fm', filterHz: { low: 200, high: 5000 }, curve: 'exponential', panWidth: 0.25 }))
      .toEqual({ fm: true, filterHz: { low: 200, high: 5000 }, exponential: true, panWidth: 0.25 })
  })
})

describe('cutoff', () => {
  const range = { low: 250, high: 4000 }

  it('is a straight line by default, the formula the voices always used', () => {
    expect(cutoff(range, 0.5, false)).toBe(250 + (4000 - 250) * 0.5)
  })

  it('is low × (high / low)^brightness when exponential, so equal steps sound equal', () => {
    expect(cutoff(range, 0, true)).toBeCloseTo(250, 9)
    expect(cutoff(range, 0.5, true)).toBeCloseTo(1000, 9)
    expect(cutoff(range, 1, true)).toBeCloseTo(4000, 9)
  })

  it('clamps brightness to 0..1 and treats a non-number as 0', () => {
    expect(cutoff(range, 2, true)).toBeCloseTo(4000, 9)
    expect(cutoff(range, Number.NaN, false)).toBe(250)
  })
})

describe('the timbre in the graph and the voices', () => {
  it('without a timbre, builds and plays exactly as before', () => {
    const { graph, music } = play()
    expect(oscillator(graph.melody.synth)).toBe('triangle')
    const brightness = major.brightness // the hot-spot filter follows the preset's brightness
    expect(on(graph.hotspots[0].filter, 'frequency.rampTo')[0].args[0]).toBeCloseTo(HOLD_FILTER_HZ.low + (HOLD_FILTER_HZ.high - HOLD_FILTER_HZ.low) * brightness, 9)
    expect(on(graph.hotspots[0].panner, 'pan.setValueAtTime')[0].args[0]).toBe(music.hotspots[0].pan)
  })

  it('fm gives the pitched voices FM oscillators and leaves the time pulse plain', () => {
    const { graph } = play({ ...DEFAULT_TIMBRE, fm: true })
    expect(oscillator(graph.melody.synth)).toBe('fmtriangle')
    expect(oscillator(graph.motion.synth)).toBe('fmsawtooth')
    expect(oscillator(graph.time.synth)).toBe('sine')
    expect(oscillatorFor('sine', false)).toBe('sine')
  })

  it('moves the filters through the manifest\'s range on its curve', () => {
    const timbre = { ...DEFAULT_TIMBRE, filterHz: { low: 300, high: 4800 }, exponential: true }
    const { graph } = play(timbre)
    expect(on(graph.hotspots[0].filter, 'frequency.rampTo')[0].args[0]).toBeCloseTo(300 * 16 ** major.brightness, 9)
    expect(MOTION_FILTER_HZ).toEqual({ low: 300, high: 3000 }) // the defaults themselves are untouched
  })

  it('panWidth 0 keeps every voice in the centre; 0.5 halves the distance', () => {
    const centred = play({ ...DEFAULT_TIMBRE, panWidth: 0 })
    for (const i of [0, 1]) expect(on(centred.graph.hotspots[i].panner, 'pan.setValueAtTime')[0].args[0]).toBeCloseTo(0, 9)
    resetTone()
    const half = play({ ...DEFAULT_TIMBRE, panWidth: 0.5 })
    expect(on(half.graph.hotspots[1].panner, 'pan.setValueAtTime')[0].args[0]).toBeCloseTo(half.music.hotspots[1].pan / 2, 9)
  })
})

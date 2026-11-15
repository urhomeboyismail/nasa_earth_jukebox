import { readFileSync } from 'node:fs'
import * as Tone from 'tone'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calls, callsOf, nodes, resetTone, transport } from '../../audio/ensemble/toneMock'
import { cutoffFor, pitchFor } from './mapping'
import { trackSchema } from './schema'
import { CALLOUT_DUCK_DB, loadOceanSound } from './sound'

const PPQ = 192
// The ensemble's recording Tone, plus the two effects and the Transport fields the ocean sound uses.
vi.mock('tone', async () => {
  const mock = await import('../../audio/ensemble/toneMock')
  Object.assign(mock.transport, { PPQ: 192, ticks: 0, bpm: { value: 120 }, getTicksAtTime: (time: number) => time * 192 })
  return { ...mock.toneModule, Tremolo: mock.make('Tremolo', ['start'], ['frequency']), Chorus: mock.make('Chorus', ['start'], ['wet']) }
})
/** Typed as Tone's Transport; it is the mock's. */
const oceanTransport = Tone.getTransport()

const track = trackSchema.parse(JSON.parse(readFileSync('public/data/json_output/ecco2_gulf_stream.json', 'utf8')))
const lastArg = (node: string, method: string) => callsOf(node, method).at(-1)?.args[0]

beforeEach(() => {
  resetTone()
  oceanTransport.ticks = 0
  oceanTransport.bpm.value = 120
})

const build = () => loadOceanSound(track)

describe('the ocean sound', () => {
  it('ends in a limiter at -1 dBFS and makes no sound until play', async () => {
    await build()
    expect(nodes.Limiter[0].options).toBe(-1)
    expect(nodes.Limiter[0].toDestinationCalled).toBe(true)
    expect(callsOf('Synth', 'triggerAttack')).toHaveLength(0)
    expect(oceanTransport.state).not.toBe('started')
  })

  it('play starts the Transport at the video time, at 120 bpm × the rate, and ramps to that step', async () => {
    const sound = await build()
    sound.play(10, 2)
    const step = track.timeline[20].metrics!
    expect(oceanTransport.state).toBe('started')
    expect(oceanTransport.bpm.value).toBe(240)
    expect(oceanTransport.ticks).toBe(20 * PPQ)
    expect(sound.mediaTime()).toBe(10)
    expect(lastArg('Filter', 'frequency.rampTo')).toBeCloseTo(cutoffFor(step.sst_normalized, [250, 3500]))
    expect(lastArg('Synth', 'frequency.rampTo')).toBeCloseTo(pitchFor(step.sst_normalized, [82.41, 659.25]))
    expect(callsOf('Synth', 'triggerAttack')).toHaveLength(1)
  })

  it('each Transport quarter applies the step at its audio time', async () => {
    const sound = await build()
    sound.play(0, 1)
    const repeat = transport.events.find(e => e.kind === 'repeat')!
    calls.length = 0
    repeat.cb(3) // ticks 3 × PPQ: step 3 (1.5 s of video)
    const step = track.timeline[3].metrics!
    expect(callsOf('Filter', 'frequency.rampTo')[0].args).toEqual([cutoffFor(step.sst_normalized, [250, 3500]), 0.25, 3])
    expect(callsOf('Tremolo', 'frequency.rampTo')[0].args[0]).toBeCloseTo(0.5 + 5.5 * step.current_velocity_norm)
    expect(callsOf('Chorus', 'wet.rampTo')[0].args[0]).toBeCloseTo(0.1 + 0.8 * step.eddy_vorticity_norm)
  })

  it('explore pans and filters by the cell, is silent over land, and ducking lowers by about 9 dB', async () => {
    const sound = await build()
    sound.probe({ sst: 1, pan: -1 })
    expect(lastArg('Panner', 'pan.rampTo')).toBe(-1)
    expect(lastArg('Filter', 'frequency.rampTo')).toBeCloseTo(3500)
    expect(lastArg('Gain', 'gain.rampTo')).toBe(1)
    sound.duck(true)
    expect(lastArg('Gain', 'gain.rampTo')).toBeCloseTo(10 ** (CALLOUT_DUCK_DB / 20))
    sound.probe('silent')
    expect(lastArg('Gain', 'gain.rampTo')).toBe(0)
    sound.probe(null)
    expect(callsOf('Synth', 'triggerRelease')).toHaveLength(1)
  })

  it('pause, seek, rate and dispose follow the video', async () => {
    const sound = await build()
    sound.play(0, 1)
    sound.seek(5)
    expect(oceanTransport.ticks).toBe(10 * PPQ)
    sound.setRate(0.5)
    expect(oceanTransport.bpm.value).toBe(60)
    sound.pause()
    expect(oceanTransport.state).toBe('paused')
    expect(callsOf('Synth', 'triggerRelease')).toHaveLength(1)
    sound.dispose()
    expect(transport.events.some(e => e.kind === 'repeat')).toBe(false)
    expect(oceanTransport.bpm.value).toBe(120)
  })
})


import * as Tone from 'tone'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toMusicFrame } from '../../sonify/music'
import { PRESETS } from '../../sonify/presets'
import { change, features, line, spot, type FeatureOptions } from '../../sonify/testFeatures'
import type { MusicFrame } from '../../sonify/types'
import {
  DROPOUT_SPACING_S, GLIDE_S, HOLD_FILTER_HZ, INTERACTIVE_LOOKAHEAD_S, MIN_APPLY_GAP_S, MOTION_FILTER_HZ, MOTION_PAD_MIDI, PARAM_RAMP_S, SCAN_VOICES, VOICE_GAIN_DB,
} from './constants'
import { buildGraph } from './graph'
import { midiToHz } from './plan'
import { callsOn, raw, resetTone, transport, type MockNode } from './toneMock'
import { createPlayer } from './voices'

vi.mock('tone', async () => (await import('./toneMock')).toneModule)

const major = PRESETS.major
let canSound = true

beforeEach(() => {
  resetTone()
  canSound = true
})

function setup(preset = major) {
  const graph = buildGraph(Tone, { master: 1, spatial: 'stereo' })
  const player = createPlayer({ t: Tone, graph, preset, clock: () => raw.currentTime, canSound: () => canSound })
  return { graph, player, preset }
}
const music = (options?: FeatureOptions, prev?: MusicFrame) => toMusicFrame(features(options), major, prev)
const on = (node: unknown, method: string) => callsOn(node as MockNode, method)
const ofNode = (node: unknown) => node as MockNode & Record<string, unknown>
const portamento = (node: unknown) => (node as { portamento: number }).portamento

describe('the melody', () => {
  it('is struck at the frame\'s note, at the frame\'s time', () => {
    const { graph, player } = setup()
    const frame = music({ position: 0.3 })
    player.apply(frame, 5)
    expect(on(graph.melody.synth, 'triggerAttack').map(c => c.args)).toEqual([[midiToHz(frame.melody!.midi), 5]])
  })

  it('moves its level over PARAM_RAMP_S to the frame\'s level', () => {
    const { graph, player } = setup()
    player.apply(music({ position: 0.3 }), 5)
    expect(on(graph.melody.out, 'gain.rampTo').map(c => c.args)).toEqual([[0.8, PARAM_RAMP_S, 5]])
  })

  it('is not struck again for the same note', () => {
    const { graph, player } = setup()
    const frame = music({ position: 0.3 })
    player.apply(frame, 1)
    player.apply(frame, 2)
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(1)
  })

  it('slides to a new note with portamento when the frame says glide', () => {
    const { graph, player } = setup()
    const first = music({ position: 0.2 })
    player.apply(first, 1)
    const second = music({ position: 0.8 }, first)
    expect(second.melody!.glide).toBe(true)
    player.apply(second, 2)
    expect(portamento(graph.melody.synth)).toBe(GLIDE_S)
    expect(on(graph.melody.synth, 'setNote').map(c => c.args)).toEqual([[midiToHz(second.melody!.midi), 2]])
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(1)
  })

  it('is struck again, without portamento, when the note changes and the frame does not say glide', () => {
    const { graph, player } = setup()
    const first = music({ position: 0.2 })
    player.apply(first, 1)
    const jump: MusicFrame = { ...first, melody: { ...first.melody!, midi: first.melody!.midi + 7, glide: false } }
    player.apply(jump, 2)
    expect(portamento(graph.melody.synth)).toBe(0)
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(2)
    expect(on(graph.melody.synth, 'setNote')).toHaveLength(0)
  })

  it('is released when the frame has no melody', () => {
    const { graph, player } = setup()
    player.apply(music({ position: 0.3 }), 1)
    player.apply(music({ position: null }), 2)
    expect(on(graph.melody.synth, 'triggerRelease').map(c => c.args)).toEqual([[2]])
    expect(on(graph.melody.out, 'gain.rampTo').at(-1)!.args).toEqual([0, PARAM_RAMP_S, 2])
  })

  it('makes no sound for a missing melody to begin with', () => {
    const { graph, player } = setup()
    player.apply(music({ position: null }), 1)
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(0)
    expect(on(graph.melody.synth, 'triggerRelease')).toHaveLength(0)
  })
})

describe('the harmony', () => {
  const attacks = (graph: ReturnType<typeof setup>['graph']) => graph.harmony.synths.flatMap(synth => on(synth, 'triggerAttack'))
  const releases = (graph: ReturnType<typeof setup>['graph']) => graph.harmony.synths.flatMap(synth => on(synth, 'triggerRelease'))

  it('is struck as a chord, one synth for each note, and not struck again while its notes stay the same: only its level moves', () => {
    const { graph, player } = setup()
    const first = music({ histogram: [0.3, 0.7, 0] })
    player.apply(first, 1)
    player.apply(music({ histogram: [0.35, 0.65, 0] }, first), 2)
    expect(attacks(graph).map(c => c.args)).toEqual(first.harmony!.midis.map(m => [midiToHz(m), 1]))
    expect(on(graph.harmony.out, 'gain.rampTo')).toHaveLength(2)
  })

  it('strikes the new notes and lets go of the synths it no longer needs when the notes change', () => {
    const { graph, player } = setup()
    const first = music({ histogram: [0.3, 0.7, 0] })
    player.apply(first, 1)
    const second = music({ histogram: [0.2, 0.4, 0.4] }, first)
    expect(second.harmony!.midis.length).toBeGreaterThan(first.harmony!.midis.length)
    player.apply(second, 2)
    expect(attacks(graph).filter(c => c.args[1] === 2).map(c => c.args[0])).toEqual(second.harmony!.midis.map(midiToHz))
    // A chord that gets smaller releases the extra synths.
    const third = music({ histogram: [0, 1, 0] }, second)
    player.apply(third, 3)
    expect(releases(graph).filter(c => c.args[0] === 3)).toHaveLength(graph.harmony.synths.length - third.harmony!.midis.length)
  })

  it('never uses more synths than the chord has room for', () => {
    const { graph, player } = setup()
    player.apply(music({ histogram: [0.2, 0.2, 0.2, 0.2, 0.2] }), 1)
    expect(attacks(graph)).toHaveLength(4)
  })

  it('is released when the frame has no harmony', () => {
    const { graph, player } = setup()
    player.apply(music({}), 1)
    player.apply(music({ histogram: [0, 0, 0] }), 2)
    expect(releases(graph).filter(c => c.args[0] === 2)).toHaveLength(graph.harmony.synths.length)
    expect(on(graph.harmony.out, 'gain.rampTo').at(-1)!.args[0]).toBe(0)
  })
})

describe('the bass', () => {
  it('is struck at its note, and again only when the note changes', () => {
    const { graph, player } = setup()
    const first = music({ change: change(0) })
    player.apply(first, 1)
    player.apply(first, 2)
    expect(on(graph.bass.synth, 'triggerAttack')).toHaveLength(1)
    const up = music({ change: change(1) }, first)
    player.apply(up, 3)
    expect(on(graph.bass.synth, 'triggerAttack').map(c => c.args)).toEqual([[midiToHz(first.bass!.midi), 1], [midiToHz(up.bass!.midi), 3]])
  })

  it('is released and silent when its data is missing', () => {
    const { graph, player } = setup()
    player.apply(music({ change: change(0) }), 1)
    player.apply(music({ position: null }), 2)
    expect(on(graph.bass.synth, 'triggerRelease').map(c => c.args)).toEqual([[2]])
  })
})

describe('the hot spots', () => {
  const two = (x1 = 0.2, x2 = 0.8) => music({ hotspots: [spot('h1', 'high', x1, 0.3, 0.05), spot('h2', 'low', x2, 0.7, 0.02)] })

  it('give each spot its own slot, note and place', () => {
    const { graph, player } = setup()
    const frame = two()
    player.apply(frame, 1)
    for (const i of [0, 1]) {
      expect(on(graph.hotspots[i].synth, 'triggerAttack').map(c => c.args)).toEqual([[midiToHz(frame.hotspots[i].midi), 1]])
      expect(on(graph.hotspots[i].panner, 'pan.setValueAtTime').map(c => c.args)).toEqual([[frame.hotspots[i].pan, 1]])
    }
    expect(on(graph.hotspots[2].synth, 'triggerAttack')).toHaveLength(0)
  })

  it('open the filter with the preset\'s brightness', () => {
    const { graph, player, preset } = setup()
    player.apply(two(), 1)
    const expected = HOLD_FILTER_HZ.low + (HOLD_FILTER_HZ.high - HOLD_FILTER_HZ.low) * preset.brightness
    expect((on(graph.hotspots[0].filter, 'frequency.rampTo')[0].args[0] as number)).toBeCloseTo(expected, 6)
  })

  it('release a slot that has no spot any more', () => {
    const { graph, player } = setup()
    const frame = two()
    player.apply(frame, 1)
    player.apply(music({ hotspots: [spot('h1', 'high', 0.2, 0.3, 0.05)] }, frame), 2)
    expect(on(graph.hotspots[1].synth, 'triggerRelease').map(c => c.args)).toEqual([[2]])
    expect(on(graph.hotspots[0].synth, 'triggerRelease')).toHaveLength(0)
  })

  it('slide a slot that keeps its spot to the spot\'s new note, and strike a slot that gets a different spot', () => {
    const { graph, player } = setup()
    player.apply(music({ hotspots: [spot('h1', 'high', 0.2, 0.3, 0.05, 0.2)] }), 1)
    const moved = music({ hotspots: [spot('h1', 'high', 0.4, 0.3, 0.05, 0.9)] })
    player.apply(moved, 2)
    expect(on(graph.hotspots[0].synth, 'setNote').map(c => c.args)).toEqual([[midiToHz(moved.hotspots[0].midi), 2]])
    const other = music({ hotspots: [spot('h9', 'high', 0.4, 0.3, 0.05, 0.1)] })
    player.apply(other, 3)
    expect(on(graph.hotspots[0].synth, 'triggerAttack')).toHaveLength(2)
  })
})

describe('the rhythm', () => {
  const xs = Array.from({ length: 16 }, (_, i) => 0.1 + (0.8 * i) / 15)
  const withLine = (density = 0.3) => music({ density, strongest: line(xs) })
  /** The rhythm's notes: the one-off events. (The time voice's pulse is a repeating event.) */
  const notes = () => transport.events.filter(e => e.kind === 'once')

  it('schedules two beats of notes on the Transport: perBeat × 2 of them', () => {
    const { player } = setup()
    player.apply(withLine(0.3), 0)
    expect(notes()).toHaveLength(8)
  })

  it('spaces them by the beat over perBeat, from the frame\'s time', () => {
    const { player } = setup()
    player.apply(withLine(0.3), 0.5)
    const gap = 60 / major.bpm / 4
    expect(notes().map(e => e.time)).toEqual(Array.from({ length: 8 }, (_, i) => 0.5 + i * gap))
  })

  it('plays each note on its synth when the Transport gets there, cycling through the line\'s notes', () => {
    const { graph, player } = setup()
    const frame = withLine(0.3)
    player.apply(frame, 0)
    const [first, second] = notes()
    transport.fire(first.id, 10)
    transport.fire(second.id, 10.1)
    const played = on(graph.rhythm.synth, 'triggerAttackRelease')
    expect(played.map(c => c.args[0])).toEqual([midiToHz(frame.rhythm!.midis[0]), midiToHz(frame.rhythm!.midis[1 % frame.rhythm!.midis.length])])
    expect(played.map(c => c.args[2])).toEqual([10, 10.1])
  })

  it('replaces the notes of the last frame instead of adding to them', () => {
    const { player } = setup()
    player.apply(withLine(0.3), 0)
    const firstIds = notes().map(e => e.id)
    player.apply(withLine(0.1), 1)
    expect(transport.cleared).toEqual(firstIds)
    expect(notes()).toHaveLength(4)
    expect(notes().some(e => firstIds.includes(e.id))).toBe(false)
  })

  it('clears its notes and schedules none when the frame has no line', () => {
    const { player } = setup()
    player.apply(withLine(), 0)
    player.apply(music({}), 1)
    expect(notes()).toHaveLength(0)
    expect(transport.cleared).toHaveLength(8)
  })

  it('pans to the line', () => {
    const { graph, player } = setup()
    const frame = withLine()
    player.apply(frame, 1)
    expect(on(graph.rhythm.panner, 'pan.setValueAtTime').map(c => c.args)).toEqual([[frame.rhythm!.pan, 1]])
  })
})

describe('the motion', () => {
  const moving = (speed: number, dx = speed) => music({ motion: { dx, dy: 0, speed } })

  it('holds a pad that is struck once, in the key of the preset, while there is motion', () => {
    const { graph, player } = setup(PRESETS.dorian)
    player.apply(moving(1), 1)
    player.apply(moving(2), 2)
    expect(on(graph.motion.synth, 'triggerAttack').map(c => c.args)).toEqual([[midiToHz(MOTION_PAD_MIDI + PRESETS.dorian.tonic), 1]])
  })

  it('opens the filter with the speed and pans with the sweep', () => {
    const { graph, player } = setup()
    player.apply(moving(1), 1)
    player.apply(moving(2, -2), 2)
    const cutoffs = on(graph.motion.filter, 'frequency.rampTo').map(c => c.args[0] as number)
    expect(cutoffs[0]).toBeCloseTo(MOTION_FILTER_HZ.low + (MOTION_FILTER_HZ.high - MOTION_FILTER_HZ.low) * 0.5, 6)
    expect(cutoffs[1]).toBeCloseTo(MOTION_FILTER_HZ.high, 6)
    expect(on(graph.motion.panner, 'pan.setValueAtTime').map(c => c.args[0])).toEqual([0.5, -1])
  })

  it('is released when there is no motion', () => {
    const { graph, player } = setup()
    player.apply(moving(1), 1)
    player.apply(music({}), 2)
    expect(on(graph.motion.synth, 'triggerRelease').map(c => c.args)).toEqual([[2]])
  })
})

describe('the time voice', () => {
  it('schedules one repeating click at the preset\'s tempo, once', () => {
    const { player } = setup()
    player.apply(music({}), 1)
    player.apply(music({}), 2)
    expect(transport.events.filter(e => e.kind === 'repeat')).toHaveLength(1)
    expect(transport.events[0].interval).toBeCloseTo(60 / major.bpm, 10)
  })

  it('starts the pulse where the frame is, and sets it again only when the tempo changes', () => {
    const { player } = setup()
    const first = music({})
    player.apply(first, 1)
    const firstId = transport.events[0].id
    player.apply({ ...first, time: { ...first.time, pulseBpm: 100 } }, 2)
    expect(transport.cleared).toEqual([firstId])
    const repeats = transport.events.filter(e => e.kind === 'repeat')
    expect(repeats).toHaveLength(1)
    expect(repeats[0].interval).toBeCloseTo(0.6, 10)
  })

  it('clicks with the sine on the beat, and a year accent goes up an octave and 3 dB louder, once', () => {
    const { graph, player } = setup()
    const base = music({})
    player.apply({ ...base, time: { ...base.time, accent: 'year' } }, 1)
    const id = transport.events[0].id
    transport.fire(id, 10)
    transport.fire(id, 10.7)
    const clicks = on(graph.time.synth, 'triggerAttackRelease')
    expect(clicks.map(c => c.args[0])).toEqual([midiToHz(36 + 12), midiToHz(36)])
    expect(on(graph.time.synth, 'volume.setValueAtTime').map(c => c.args[0])).toEqual([VOICE_GAIN_DB.time + 3, VOICE_GAIN_DB.time])
  })

  it('clicks a decade accent two octaves up and 3 dB louder (SN16)', () => {
    const { graph, player } = setup()
    const base = music({})
    player.apply({ ...base, time: { ...base.time, accent: 'decade' } }, 1)
    transport.fire(transport.events[0].id, 10)
    expect(on(graph.time.synth, 'triggerAttackRelease')[0].args[0]).toBe(midiToHz(36 + 24))
    expect(on(graph.time.synth, 'volume.setValueAtTime')[0].args[0]).toBe(VOICE_GAIN_DB.time + 3)
  })

  it('keeps a month accent waiting for the next click: the frames in between do not cancel it', () => {
    const { graph, player } = setup()
    const base = music({})
    player.apply({ ...base, time: { ...base.time, accent: 'month' } }, 1)
    player.apply(base, 1.1)
    transport.fire(transport.events[0].id, 2)
    expect(on(graph.time.synth, 'volume.setValueAtTime')[0].args[0]).toBe(VOICE_GAIN_DB.time + 3)
    expect(on(graph.time.synth, 'triggerAttackRelease')[0].args[0]).toBe(midiToHz(36))
  })
})

describe('the dropout', () => {
  const dropped = (prev?: MusicFrame) => music({ position: null }, prev)

  it('sounds the two-tap cue once, when a frame becomes a dropout', () => {
    const { graph, player } = setup()
    player.apply(music({}), 1)
    player.apply(dropped(), 2)
    const taps = graph.dropout.map(synth => on(synth, 'triggerAttackRelease'))
    expect(taps.map(t => t.length)).toEqual([1, 1])
    expect(taps[0][0].args[2]).toBe(2)
    expect(taps[1][0].args[2]).toBeCloseTo(2 + DROPOUT_SPACING_S, 10)
  })

  it('does not repeat while the frames stay dropped, and sounds again at the next onset', () => {
    const { graph, player } = setup()
    player.apply(dropped(), 1)
    player.apply(dropped(), 2)
    player.apply(dropped(), 3)
    expect(on(graph.dropout[0], 'triggerAttackRelease')).toHaveLength(1)
    player.apply(music({}), 4)
    player.apply(dropped(), 5)
    expect(on(graph.dropout[0], 'triggerAttackRelease')).toHaveLength(2)
  })

  it('uses no noise: the cue is two sine synths', () => {
    const { graph } = setup()
    expect(graph.dropout).toHaveLength(2)
    for (const synth of graph.dropout) expect((ofNode(synth).options as { oscillator: { type: string } }).oscillator.type).toBe('sine')
  })

  it('can be played on its own, and only when the ensemble is on', () => {
    const { graph, player } = setup()
    player.playDropout(3)
    expect(on(graph.dropout[1], 'triggerAttackRelease')[0].args[2]).toBeCloseTo(3 + DROPOUT_SPACING_S, 10)
    canSound = false
    player.playDropout(4)
    expect(on(graph.dropout[0], 'triggerAttackRelease')).toHaveLength(1)
  })
})

describe('time', () => {
  it('drops a frame that comes less than MIN_APPLY_GAP_S after the last one', () => {
    const { graph, player } = setup()
    const first = music({ position: 0.2 })
    player.apply(first, 1)
    player.apply(music({ position: 0.9 }, first), 1 + 0.01)
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(1)
    expect(on(graph.melody.synth, 'setNote')).toHaveLength(0)
    player.apply(music({ position: 0.9 }, first), 1 + MIN_APPLY_GAP_S)
    expect(on(graph.melody.synth, 'setNote')).toHaveLength(1)
  })

  it('never drops the start of a dropout, even inside the gap', () => {
    const { graph, player } = setup()
    player.apply(music({}), 1)
    player.apply(music({ position: null }), 1.01)
    expect(on(graph.dropout[0], 'triggerAttackRelease')).toHaveLength(1)
    expect(on(graph.melody.synth, 'triggerRelease')).toHaveLength(1)
  })

  it('never queues: each call sets the voices for its own time, and none is replayed later', () => {
    const { graph, player } = setup()
    let prev: MusicFrame | undefined
    for (let i = 0; i < 10; i++) {
      prev = music({ position: 0.1 + i * 0.08 }, prev)
      player.apply(prev, 10 + i * MIN_APPLY_GAP_S * 2)
    }
    const times = [...on(graph.melody.synth, 'triggerAttack'), ...on(graph.melody.synth, 'setNote')].map(c => c.args[1] as number)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times.every(t => t >= 10 && t <= 10 + 10 * MIN_APPLY_GAP_S * 2)).toBe(true)
    // Nothing is waiting: the voices were set directly, and the only Transport events are the rhythm's and the pulse's.
    expect(transport.events.filter(e => e.kind === 'once')).toHaveLength(0)
  })

  it('sounds at now + INTERACTIVE_LOOKAHEAD_S when the caller gives no time, which is within 50 ms', () => {
    const { graph, player } = setup()
    raw.currentTime = 7
    player.apply(music({}))
    const at = on(graph.melody.synth, 'triggerAttack')[0].args[1] as number
    expect(at).toBeCloseTo(7 + INTERACTIVE_LOOKAHEAD_S, 10)
    expect(at - raw.currentTime).toBeLessThanOrEqual(0.05)
  })

  it('makes no sound while the ensemble is not on', () => {
    const { graph, player } = setup()
    canSound = false
    player.apply(music({}), 1)
    player.hold({ midi: 60, level: 1, pan: 0, brightness: 0.5 }, 1)
    player.playNotes([{ midi: 60, level: 1, pan: 0, seconds: 0.2 }], 1)
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(0)
    expect(on(graph.hold.synth, 'triggerAttack')).toHaveLength(0)
    expect(transport.events).toHaveLength(0)
  })
})

describe('the mix', () => {
  const full = music({ position: 0.6, change: change(0.5), hotspots: [spot('h1', 'high', 0.5, 0.5)], density: 0.3, strongest: line([0.2, 0.5, 0.8]), motion: { dx: 1, dy: 0, speed: 1 } })

  it('stops the voices outside a new detail level, and does not strike them again', () => {
    const { graph, player } = setup()
    player.apply(full, 1)
    player.setDetail('calm')
    for (const synth of [graph.bass.synth, graph.hotspots[0].synth, graph.motion.synth]) expect(on(synth, 'triggerRelease')).toHaveLength(1)
    expect(on(graph.melody.synth, 'triggerRelease')).toHaveLength(0)
    expect(on(graph.bass.out, 'gain.rampTo').at(-1)!.args[0]).toBe(0)
    player.apply({ ...full, frameId: 'next' }, 3)
    expect(on(graph.bass.synth, 'triggerAttack')).toHaveLength(1)
  })

  it('brings the voices back when the detail goes up again', () => {
    const { graph, player } = setup()
    player.setDetail('calm')
    player.apply(full, 1)
    expect(on(graph.bass.synth, 'triggerAttack')).toHaveLength(0)
    player.setDetail('full')
    expect(on(graph.bass.synth, 'triggerAttack')).toHaveLength(1)
  })

  it('leaves only the soloed voice, and a muted voice is released', () => {
    const { graph, player } = setup()
    player.apply(full, 1)
    player.setSolo('melody')
    expect(graph.harmony.synths.flatMap(synth => on(synth, 'triggerRelease')).length).toBeGreaterThan(0)
    expect(on(graph.bass.synth, 'triggerRelease')).toHaveLength(1)
    player.setSolo(null)
    player.setMuted('melody', true)
    expect(on(graph.melody.synth, 'triggerRelease')).toHaveLength(1)
    player.setMuted('melody', false)
    expect(on(graph.melody.synth, 'triggerAttack').length).toBeGreaterThanOrEqual(2)
  })

  it('does nothing about the mix before there is a frame', () => {
    const { graph, player } = setup()
    player.setDetail('calm')
    player.setSolo('bass')
    player.setMuted('time', true)
    expect(on(graph.bass.synth, 'triggerAttack')).toHaveLength(0)
  })
})

describe('hold and playNotes', () => {
  it('hold sounds a continuous tone, slides to a new note and releases on null', () => {
    const { graph, player } = setup()
    player.hold({ midi: 60, level: 0.7, pan: -0.4, elevation: 0.2, brightness: 1 }, 1)
    player.hold({ midi: 64.5, level: 0.7, pan: 0.4, brightness: 0 }, 2)
    expect(on(graph.hold.synth, 'triggerAttack').map(c => c.args)).toEqual([[midiToHz(60), 1]])
    expect(on(graph.hold.synth, 'setNote').map(c => c.args)).toEqual([[midiToHz(64.5), 2]])
    expect((ofNode(graph.hold.synth).options as { portamento: number }).portamento).toBe(GLIDE_S)
    expect(on(graph.hold.panner, 'pan.setValueAtTime').map(c => c.args[0])).toEqual([-0.4, 0.4])
    expect(on(graph.hold.filter, 'frequency.rampTo').map(c => c.args[0])).toEqual([HOLD_FILTER_HZ.high, HOLD_FILTER_HZ.low])
    player.hold(null, 3)
    expect(on(graph.hold.synth, 'triggerRelease').map(c => c.args)).toEqual([[3]])
    expect(on(graph.hold.out, 'gain.rampTo').at(-1)!.args[0]).toBe(0)
  })

  it('hold is not a mixer voice: detail, solo and mute do not touch it', () => {
    const { graph, player } = setup()
    player.setDetail('calm')
    player.setSolo('melody')
    player.setMuted('time', true)
    player.hold({ midi: 60, level: 1, pan: 0, brightness: 0.5 }, 1)
    expect(on(graph.hold.synth, 'triggerAttack')).toHaveLength(1)
  })

  it('playNotes sounds each note on its own voice at its place, and drops all but the first SCAN_VOICES', () => {
    const { graph, player } = setup()
    const notes = Array.from({ length: SCAN_VOICES + 3 }, (_, i) => ({ midi: 60 + i, level: 0.5, pan: i / 10, seconds: 0.2 }))
    player.playNotes(notes, 4)
    const played = graph.scan.map(v => on(v.synth, 'triggerAttackRelease'))
    expect(played.map(p => p.length)).toEqual(Array(SCAN_VOICES).fill(1))
    expect(played[3][0].args).toEqual([midiToHz(63), 0.2, 4, 0.5])
    expect(on(graph.scan[3].panner, 'pan.setValueAtTime')[0].args).toEqual([0.3, 4])
  })
})

describe('releaseAll', () => {
  it('releases every voice and forgets what was sounding, so the next frame sets them all again', () => {
    const { graph, player } = setup()
    const frame = music({ position: 0.5, motion: { dx: 1, dy: 0, speed: 1 } })
    player.apply(frame, 1)
    player.releaseAll(2)
    for (const synth of [graph.melody.synth, graph.bass.synth, graph.motion.synth, graph.hold.synth]) expect(on(synth, 'triggerRelease').map(c => c.args)).toContainEqual([2])
    expect(graph.harmony.synths.flatMap(synth => on(synth, 'triggerRelease')).map(c => c.args)).toContainEqual([2])
    player.apply(frame, 3)
    expect(on(graph.melody.synth, 'triggerAttack')).toHaveLength(2)
    expect(on(graph.motion.synth, 'triggerAttack')).toHaveLength(2)
  })
})

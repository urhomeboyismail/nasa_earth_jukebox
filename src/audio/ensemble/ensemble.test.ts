import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toMusicFrame } from '../../sonify/music'
import { PRESETS } from '../../sonify/presets'
import { features, line, spot } from '../../sonify/testFeatures'
import type { MusicFrame } from '../../sonify/types'
import { DUCK_ATTACK_S, DUCK_LINEAR, DUCK_RELEASE_S, duck } from '../duck'
import { MAX_RENDER_S, PAUSE_FADE_S, RESUME_FADE_S, STOP_FADE_S, VOLUME_RAMP_S } from './constants'
import { createEnsemble, type Ensemble } from '.'
import { behaviour, calls, callsOn, nodes, offlineRuns, raw, resetTone, start, transport, type MockNode } from './toneMock'

vi.mock('tone', async () => (await import('./toneMock')).toneModule)

const major = PRESETS.major
const frame = (position = 0.5): MusicFrame => toMusicFrame(features({ position }), major)
const dropout = (): MusicFrame => toMusicFrame(features({ position: null }), major)
/** A loud frame: every voice has something to play, at the levels the rules give. */
const loud = (): MusicFrame => toMusicFrame(features({
  position: 0.7, hotspots: [spot('h1', 'high', 0.3, 0.3, 0.2), spot('h2', 'low', 0.7, 0.7, 0.2)], density: 0.3, strongest: line([0.1, 0.4, 0.7, 0.9]),
  motion: { dx: 2, dy: 0, speed: 2 }, histogram: [0.25, 0.25, 0.25, 0.25],
}), major)

let hidden = false
function setHidden(value: boolean) {
  hidden = value
  document.dispatchEvent(new Event('visibilitychange'))
}

const live: Ensemble[] = []
function ensemble(options?: Parameters<typeof createEnsemble>[1]) {
  const e = createEnsemble(major, options)
  live.push(e)
  return e
}
const master = () => nodes.Gain[0] as MockNode
// The Synths in the order buildGraph makes them.
const MELODY = 0
const HARMONY = [1, 2, 3, 4]
const BASS = 5
const HOTSPOTS = [6, 7, 8]
const MOTION = 10
const HOLD = 12
const melody = () => nodes.Synth[MELODY] as MockNode

beforeEach(() => {
  resetTone()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => {
  for (const e of live.splice(0)) e.dispose()
  Reflect.deleteProperty(document, 'hidden')
})

describe('before start()', () => {
  it('loads no audio, builds no node and makes no sound whatever it is asked', () => {
    const e = ensemble()
    e.apply(frame())
    e.hold({ midi: 60, level: 1, pan: 0, brightness: 0.5 })
    e.playNotes([{ midi: 60, level: 1, pan: 0, seconds: 0.2 }])
    e.playDropout()
    e.setDetail('calm')
    e.solo('melody')
    e.mute('bass', true)
    e.setVolume(0.4)
    e.pause()
    e.resume()
    e.stop()
    expect(start).not.toHaveBeenCalled()
    expect(Object.keys(nodes)).toEqual([])
    expect(calls).toEqual([])
    expect(transport.events).toEqual([])
    expect(e.status()).toBe('off')
    expect(e.now()).toBe(0)
  })
})

describe('start()', () => {
  it('is on when the browser lets the sound run, and starts the context and the Transport', async () => {
    const e = ensemble()
    await e.start()
    expect(start).toHaveBeenCalledTimes(1)
    expect(e.status()).toBe('on')
    expect(transport.state).toBe('started')
  })

  it('is suspended when the browser will not run the sound, so the page can say "Turn sound on"', async () => {
    behaviour.stateAfterStart = 'suspended'
    const e = ensemble()
    await e.start()
    expect(e.status()).toBe('suspended')
    e.apply(frame())
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(0)
  })

  it('brings the sound back from suspended only when start() is called again, from a click', async () => {
    behaviour.stateAfterStart = 'suspended'
    const e = ensemble()
    await e.start()
    behaviour.stateAfterStart = 'running'
    e.resume()
    expect(e.status()).toBe('suspended')
    await e.start()
    expect(e.status()).toBe('on')
  })

  it('builds the graph once, however many times it is called, and fades the master in from silence', async () => {
    const e = ensemble({ volume: 0.6 })
    await Promise.all([e.start(), e.start()])
    await e.start()
    expect(nodes.Limiter).toHaveLength(1)
    expect(master().options).toBe(0)
    expect(callsOn(master(), 'gain.rampTo').at(-1)!.args).toEqual([0.6, RESUME_FADE_S])
  })

  it('makes sound only once it is on', async () => {
    const e = ensemble()
    const f = frame(0.3)
    await e.start()
    e.apply(f, 2)
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(1)
  })
})

describe('stop(), pause() and resume()', () => {
  it('stop releases every voice, fades the master out and stops the Transport; the next start fades back in', async () => {
    const e = ensemble()
    await e.start()
    e.apply(loud(), 1)
    raw.currentTime = 2
    e.stop()
    expect(e.status()).toBe('off')
    expect(callsOn(master(), 'gain.rampTo').at(-1)!.args).toEqual([0, STOP_FADE_S])
    expect(transport.state).toBe('stopped')
    // The melody, the four chord synths, the bass, three hot-spot slots, the motion pad and the explore tone are held notes; the rhythm and the time click are plucks.
    for (const index of [MELODY, ...HARMONY, BASS, ...HOTSPOTS, MOTION, HOLD]) expect(callsOn(nodes.Synth[index], 'triggerRelease').at(-1)!.args).toEqual([2])
    await e.start()
    expect(e.status()).toBe('on')
    expect(callsOn(master(), 'gain.rampTo').at(-1)!.args).toEqual([1, RESUME_FADE_S])
  })

  it('stop clears the rhythm and the pulse it scheduled, and nothing else on the shared Transport', async () => {
    const e = ensemble()
    await e.start()
    const foreign = transport.schedule(() => {}, 5)
    e.apply(loud(), 1)
    const ours = transport.events.filter(ev => ev.id !== foreign).map(ev => ev.id)
    expect(ours.length).toBeGreaterThan(1)
    e.stop()
    expect(transport.cleared.sort()).toEqual([...ours].sort())
    expect(transport.events.map(ev => ev.id)).toEqual([foreign])
  })

  it('pause fades the master out before the Transport pauses, and apply is then ignored', async () => {
    const e = ensemble()
    await e.start()
    raw.currentTime = 4
    e.pause()
    expect(e.status()).toBe('paused')
    expect(callsOn(master(), 'gain.rampTo').at(-1)!.args).toEqual([0, PAUSE_FADE_S])
    expect(transport.pauses).toEqual([4 + PAUSE_FADE_S])
    e.apply(frame(), 5)
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(0)
  })

  it('pause does nothing unless the sound is on', async () => {
    const e = ensemble()
    e.pause()
    await e.start()
    e.stop()
    e.pause()
    expect(transport.pauses).toEqual([])
    expect(e.status()).toBe('off')
  })

  it('resume fades back in and carries on, only from paused', async () => {
    const e = ensemble({ volume: 0.8 })
    await e.start()
    e.resume()
    expect(callsOn(master(), 'gain.rampTo').filter(c => c.args[0] === 0.8)).toHaveLength(1)
    e.pause()
    e.resume()
    expect(e.status()).toBe('on')
    expect(transport.state).toBe('started')
    expect(callsOn(master(), 'gain.rampTo').at(-1)!.args).toEqual([0.8, RESUME_FADE_S])
    e.apply(frame(), 3)
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(1)
  })

  it('resume from suspended does nothing, and resume finds a suspended context under a pause', async () => {
    behaviour.stateAfterStart = 'suspended'
    const a = ensemble()
    await a.start()
    a.resume()
    expect(a.status()).toBe('suspended')

    resetTone()
    const b = ensemble()
    await b.start()
    b.pause()
    raw.state = 'suspended'
    b.resume()
    expect(b.status()).toBe('suspended')
  })
})

describe('the browser and the page', () => {
  it('pauses when the page is hidden while the sound is on, and does not resume when it comes back', async () => {
    const e = ensemble()
    await e.start()
    setHidden(true)
    expect(e.status()).toBe('paused')
    expect(transport.state).toBe('paused')
    setHidden(false)
    expect(e.status()).toBe('paused')
    expect(transport.state).toBe('paused')
  })

  it('says "suspended" when the page comes back and the browser took the context meanwhile', async () => {
    const e = ensemble()
    await e.start()
    setHidden(true)
    raw.state = 'suspended'
    setHidden(false)
    expect(e.status()).toBe('suspended')
  })

  it('leaves a page that was never on alone', async () => {
    const e = ensemble()
    await e.start()
    e.stop()
    setHidden(true)
    expect(e.status()).toBe('off')
  })

  it('becomes suspended when the browser suspends the context, and does not resume by itself', async () => {
    const e = ensemble()
    const seen: string[] = []
    e.onStatus(s => seen.push(s))
    await e.start()
    raw.setState('suspended')
    expect(e.status()).toBe('suspended')
    raw.setState('running')
    expect(e.status()).toBe('suspended')
    expect(seen).toEqual(['on', 'suspended'])
  })

  it('treats an interrupted context (a phone call) like a suspended one', async () => {
    const e = ensemble()
    await e.start()
    raw.setState('interrupted')
    expect(e.status()).toBe('suspended')
  })
})

describe('status listeners', () => {
  it('are told of every change, once, and can be removed', async () => {
    const e = ensemble()
    const seen: string[] = []
    const off = e.onStatus(s => seen.push(s))
    await e.start()
    e.pause()
    e.resume()
    off()
    e.stop()
    expect(seen).toEqual(['on', 'paused', 'on'])
  })
})

describe('detail, solo, mute and volume', () => {
  it('apply at calm never strikes the bass, the hot spots, the rhythm or the motion', async () => {
    const e = ensemble({ detail: 'calm' })
    await e.start()
    e.apply(loud(), 1)
    expect(callsOn(nodes.Synth[BASS], 'triggerAttack')).toHaveLength(0)
    expect(HOTSPOTS.flatMap(i => callsOn(nodes.Synth[i], 'triggerAttack'))).toHaveLength(0)
    expect(transport.events.filter(ev => ev.kind === 'once')).toHaveLength(0)
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(1)
    e.setDetail('full')
    expect(callsOn(nodes.Synth[BASS], 'triggerAttack')).toHaveLength(1)
  })

  it('a solo or a mute set before start() holds once it is on', async () => {
    const e = ensemble()
    e.solo('harmony')
    e.mute('harmony', false)
    await e.start()
    e.apply(loud(), 1)
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(0)
    expect(HARMONY.flatMap(i => callsOn(nodes.Synth[i], 'triggerAttack')).length).toBeGreaterThan(0)
    e.solo(null)
    const releasesBefore = HARMONY.flatMap(i => callsOn(nodes.Synth[i], 'triggerRelease')).length
    e.mute('harmony', true)
    expect(HARMONY.flatMap(i => callsOn(nodes.Synth[i], 'triggerRelease')).length).toBeGreaterThan(releasesBefore)
    expect(callsOn(melody(), 'triggerAttack')).toHaveLength(1)
  })

  it('setVolume clamps to 0 to 1 and ramps the master while the sound is on', async () => {
    const e = ensemble()
    await e.start()
    e.setVolume(3)
    e.setVolume(-1)
    e.setVolume(Number.NaN)
    e.setVolume(0.25)
    const ramps = callsOn(master(), 'gain.rampTo').filter(c => c.args[1] === VOLUME_RAMP_S).map(c => c.args[0])
    expect(ramps).toEqual([1, 0, 0, 0.25])
  })

  it('a volume set while paused is used at resume', async () => {
    const e = ensemble()
    await e.start()
    e.pause()
    e.setVolume(0.3)
    expect(callsOn(master(), 'gain.rampTo').filter(c => c.args[1] === VOLUME_RAMP_S)).toHaveLength(0)
    e.resume()
    expect(callsOn(master(), 'gain.rampTo').at(-1)!.args).toEqual([0.3, RESUME_FADE_S])
  })
})

describe('the audio clock', () => {
  it('is the raw context\'s time once started, and 0 before', async () => {
    const e = ensemble()
    expect(e.now()).toBe(0)
    await e.start()
    raw.currentTime = 12.5
    expect(e.now()).toBe(12.5)
  })
})

describe('the dropout cue', () => {
  it('plays once when a frame becomes a dropout, through the ensemble', async () => {
    const e = ensemble()
    await e.start()
    e.apply(frame(), 1)
    e.apply(dropout(), 2)
    e.apply(dropout(), 3)
    expect(nodes.Synth.slice(-2).map(s => callsOn(s, 'triggerAttackRelease').length)).toEqual([1, 1])
  })
})

describe('renderOffline', () => {
  const schedule = (seconds = 3) => [
    { frame: frame(0.3), atSeconds: 0 },
    { frame: loud(), atSeconds: 1 },
    { frame: dropout(), atSeconds: seconds - 0.5 },
  ]

  it('renders two channels on an offline graph, to the sample rate and length asked, without starting or touching the live sound', async () => {
    const e = ensemble()
    const [left, right] = await e.renderOffline(schedule(), { detail: 'full', sampleRate: 22050, tailSeconds: 1 })
    expect(left).toBeInstanceOf(Float32Array)
    expect(right).toBeInstanceOf(Float32Array)
    expect(offlineRuns).toEqual([{ duration: 3.5 + 0, channels: 2, sampleRate: 22050 }])
    expect(start).not.toHaveBeenCalled()
    expect(e.status()).toBe('off')
    expect(nodes.Limiter).toHaveLength(1)
    expect(master().options).toBe(1)
    expect(transport.starts).toEqual([0])
  })

  it('gives identical channels for the same schedule twice', async () => {
    const e = ensemble()
    const first = await e.renderOffline(schedule(), { detail: 'full' })
    const second = await e.renderOffline(schedule(), { detail: 'full' })
    expect(Array.from(second[0])).toEqual(Array.from(first[0]))
    expect(Array.from(second[1])).toEqual(Array.from(first[1]))
  })

  it('makes the sound the detail level allows, and puts the dropout cue in a render too', async () => {
    const e = ensemble()
    await e.renderOffline(schedule(), { detail: 'calm' })
    const bassAttacks = callsOn(nodes.Synth[BASS], 'triggerAttack')
    expect(bassAttacks).toHaveLength(0)
    expect(nodes.Synth.slice(-2).map(s => callsOn(s, 'triggerAttackRelease').length)).toEqual([1, 1])
  })

  it('places each frame at its own time', async () => {
    const e = ensemble()
    const first = frame(0.2)
    const second = toMusicFrame(features({ position: 0.9 }), major, first)
    await e.renderOffline([{ frame: first, atSeconds: 0.5 }, { frame: second, atSeconds: 2 }], { detail: 'full' })
    expect(callsOn(melody(), 'triggerAttack').map(c => c.args[1])).toEqual([0.5])
    expect(callsOn(melody(), 'setNote').map(c => c.args[1])).toEqual([2])
  })

  it('refuses more than MAX_RENDER_S, with a message, and builds nothing', async () => {
    const e = ensemble()
    await expect(e.renderOffline([{ frame: frame(), atSeconds: MAX_RENDER_S }], { detail: 'full' })).rejects.toThrow('That is too long to render (over 3 minutes).')
    expect(offlineRuns).toEqual([])
    expect(nodes.Limiter).toBeUndefined()
  })

  it('refuses an empty schedule', async () => {
    await expect(ensemble().renderOffline([], { detail: 'full' })).rejects.toThrow('There is nothing to render yet.')
  })

  it('sorts a schedule that is out of order', async () => {
    const e = ensemble()
    await e.renderOffline([{ frame: frame(0.9), atSeconds: 2 }, { frame: frame(0.2), atSeconds: 0.5 }], { detail: 'full' })
    // In the order given, the later frame would come first and the earlier one would be dropped as too close behind it.
    expect(callsOn(melody(), 'triggerAttack').map(c => c.args[1])).toEqual([0.5, 2])
  })
})

describe('dispose()', () => {
  it('releases the voices, removes the listeners, disposes every node and goes off', async () => {
    const e = ensemble()
    await e.start()
    e.apply(loud(), 1)
    const made = Object.values(nodes).flat().length
    expect(raw.listenerCount()).toBe(1)
    e.dispose()
    expect(e.status()).toBe('off')
    expect(raw.listenerCount()).toBe(0)
    expect(calls.filter(c => c.method === 'dispose')).toHaveLength(made)
    expect(callsOn(melody(), 'triggerRelease').length).toBeGreaterThan(0)
  })

  it('stops reacting to the page and the browser', async () => {
    const e = ensemble()
    await e.start()
    e.dispose()
    const ramps = calls.filter(c => c.method === 'gain.rampTo').length
    setHidden(true)
    raw.setState('suspended')
    expect(calls.filter(c => c.method === 'gain.rampTo')).toHaveLength(ramps)
    expect(e.status()).toBe('off')
  })

  it('makes every later call do nothing', async () => {
    const e = ensemble()
    await e.start()
    e.dispose()
    const before = calls.length
    const statusSeen: string[] = []
    e.onStatus(s => statusSeen.push(s))
    await e.start()
    e.stop()
    e.pause()
    e.resume()
    e.apply(frame(), 5)
    e.hold({ midi: 60, level: 1, pan: 0, brightness: 0.5 }, 5)
    e.playNotes([{ midi: 60, level: 1, pan: 0, seconds: 1 }], 5)
    e.playDropout(5)
    e.setDetail('calm')
    e.solo('melody')
    e.mute('bass', true)
    e.setVolume(0.2)
    expect(calls).toHaveLength(before)
    expect(start).toHaveBeenCalledTimes(1)
    expect(statusSeen).toEqual([])
    await expect(e.renderOffline([{ frame: frame(), atSeconds: 0 }], { detail: 'full' })).rejects.toThrow(/disposed/)
  })

  it('can be called twice, and before start()', () => {
    const e = ensemble()
    e.dispose()
    e.dispose()
    expect(e.status()).toBe('off')
  })

  it('does not build a graph for a start() that was still loading when it was disposed', async () => {
    const e = ensemble()
    const starting = e.start()
    e.dispose()
    await starting
    expect(nodes.Limiter).toBeUndefined()
    expect(e.status()).toBe('off')
  })
})

describe('ducking under a voice (SN13)', () => {
  const ramps = () => callsOn(master(), 'gain.rampTo')
  beforeEach(() => duck.reset())
  afterEach(() => duck.reset())

  it('a duck ramps the master to volume × DUCK_LINEAR, and the release ramps it back', async () => {
    const e = ensemble({ volume: 0.5 })
    await e.start()
    duck.begin('guide')
    expect(ramps().at(-1)!.args).toEqual([0.5 * DUCK_LINEAR, DUCK_ATTACK_S])
    duck.end('guide')
    expect(ramps().at(-1)!.args).toEqual([0.5, DUCK_RELEASE_S])
  })

  it('a pause still fades to 0, and a resume fades back to the target, not to 1, while ducked', async () => {
    const e = ensemble({ volume: 0.8 })
    await e.start()
    duck.begin('speech')
    e.pause()
    expect(ramps().at(-1)!.args).toEqual([0, PAUSE_FADE_S])
    e.resume()
    expect(ramps().at(-1)!.args).toEqual([0.8 * DUCK_LINEAR, RESUME_FADE_S])
    duck.end('speech')
    expect(ramps().at(-1)!.args).toEqual([0.8, DUCK_RELEASE_S])
  })

  it('a duck while paused does not wake the master; the resume uses the current target', async () => {
    const e = ensemble()
    await e.start()
    e.pause()
    const before = ramps().length
    duck.begin('guide')
    expect(ramps()).toHaveLength(before)
    e.resume()
    expect(ramps().at(-1)!.args).toEqual([DUCK_LINEAR, RESUME_FADE_S])
  })

  it('setVolume while ducked stays ducked', async () => {
    const e = ensemble()
    await e.start()
    duck.begin('guide')
    e.setVolume(0.4)
    expect(ramps().at(-1)!.args).toEqual([0.4 * DUCK_LINEAR, VOLUME_RAMP_S])
  })

  it('starts ducked when a voice is already speaking, and dispose stops listening', async () => {
    duck.begin('speech')
    const e = ensemble()
    await e.start()
    expect(ramps().at(-1)!.args).toEqual([DUCK_LINEAR, RESUME_FADE_S])
    e.dispose()
    const before = ramps().length
    duck.end('speech')
    expect(ramps()).toHaveLength(before)
  })
})

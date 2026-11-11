import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Contour } from '../analysis/types'
import type { SoundMapping, Visualization } from '../data'
import { DUCK_ATTACK_S, DUCK_LINEAR, DUCK_RELEASE_S, duck } from './duck'
import { validateMapping } from './engine'
import * as wav from './wav'
import { createSoundEngine, type SequenceStep } from '.'

const mapping = (fixture as Visualization).mapping

// A recording stand-in for Tone: every node remembers what was done to it, and no audio is made.
const mocks = vi.hoisted(() => {
  const calls: { node: string; method: string; args: unknown[] }[] = []
  const nodes: Record<string, unknown[]> = {}
  const param = (node: string, name: string) => ({
    value: 0,
    rampTo: (...args: unknown[]) => calls.push({ node, method: `${name}.rampTo`, args }),
    setValueAtTime: (...args: unknown[]) => calls.push({ node, method: `${name}.setValueAtTime`, args }),
    cancelScheduledValues: (...args: unknown[]) => calls.push({ node, method: `${name}.cancelScheduledValues`, args }),
  })
  function make(node: string, methods: string[] = [], params: string[] = []) {
    class Base {
      options: unknown
      [key: string]: unknown
      constructor(...args: unknown[]) {
        this.options = args[0]
        nodes[node] = [...(nodes[node] ?? []), this]
        for (const name of params) this[name] = param(node, name)
        calls.push({ node, method: 'new', args })
      }
      connect(target: unknown) { calls.push({ node, method: 'connect', args: [target] }); return this }
      toDestination() { calls.push({ node, method: 'toDestination', args: [] }); return this }
    }
    for (const method of methods) {
      ;(Base.prototype as Record<string, unknown>)[method] = function (...args: unknown[]) { calls.push({ node, method, args }) }
    }
    return Base
  }

  // A Transport that only moves when the test calls advance(), and a Draw that runs its callbacks at once.
  const AUDIO_CLOCK_OFFSET = 100
  const transport = {
    events: [] as { cb: (time: number) => void; at: number; fired: boolean }[],
    position: 0,
    running: false,
    starts: [] as unknown[],
    schedule(cb: (time: number) => void, at: number) { this.events.push({ cb, at, fired: false }) },
    start(when?: unknown) { this.running = true; this.starts.push(when) },
    pause() { this.running = false },
    stop() { this.running = false; this.position = 0 },
    cancel() { this.events = [] },
    get seconds() { return this.position },
    set seconds(value: number) { this.position = value },
    advance(seconds: number) {
      if (!this.running) return
      const end = this.position + seconds
      const due = this.events.filter(e => !e.fired && e.at <= end).sort((a, b) => a.at - b.at)
      for (const event of due) { event.fired = true; event.cb(AUDIO_CLOCK_OFFSET + event.at) }
      this.position = end
    },
    reset() { this.events = []; this.position = 0; this.running = false; this.starts = [] },
  }
  const draw = { times: [] as number[], schedule(cb: () => void, time: number) { this.times.push(time); cb() } }
  // Offline runs the callback, then plays the Transport through, like a render; its buffer is two silent channels.
  const offline = vi.fn(async (callback: () => void, duration: number) => {
    callback()
    transport.advance(duration)
    return { getChannelData: () => new Float32Array(8) }
  })
  return { calls, nodes, make, transport, draw, offline, start: vi.fn(async () => {}) }
})

vi.mock('tone', () => ({
  start: mocks.start,
  now: () => 0,
  getTransport: () => mocks.transport,
  getDraw: () => mocks.draw,
  Gain: mocks.make('Gain', ['disconnect'], ['gain']),
  Panner: mocks.make('Panner', ['dispose'], ['pan']),
  Panner3D: mocks.make('Panner3D', ['dispose'], ['positionX', 'positionY', 'positionZ']),
  Filter: mocks.make('Filter', [], ['frequency']),
  Compressor: mocks.make('Compressor', ['disconnect']),
  Limiter: mocks.make('Limiter', ['disconnect']),
  Synth: mocks.make('Synth', ['triggerAttackRelease', 'triggerAttack', 'triggerRelease', 'set']),
  PolySynth: mocks.make('PolySynth', ['triggerAttackRelease', 'releaseAll']),
  Freeverb: mocks.make('Freeverb', [], ['wet']),
  Offline: mocks.offline,
  NoiseSynth: mocks.make('NoiseSynth', ['triggerAttackRelease', 'triggerRelease']),
}))

const played = () => mocks.calls.filter(c => c.method === 'triggerAttackRelease')
const playedNotes = () => played().filter(c => c.node === 'Synth').map(c => c.args[0])
const steps: SequenceStep[] = [
  { category: 'cold', atMs: 0 },
  { category: 'mild', atMs: 1000 },
  { category: 'insufficient', atMs: 2000 },
]

beforeEach(() => {
  mocks.offline.mockClear()
  mocks.calls.length = 0
  for (const key of Object.keys(mocks.nodes)) delete mocks.nodes[key]
  mocks.transport.reset()
  mocks.draw.times.length = 0
  duck.reset()
})

async function unlocked(map: SoundMapping = mapping) {
  const engine = createSoundEngine(map)
  await engine.unlock()
  mocks.calls.length = 0
  return engine
}

describe('mapping validation', () => {
  it('accepts the fixture mapping', () => {
    expect(() => validateMapping(mapping)).not.toThrow()
  })

  it('rejects a note name Tonal does not know', () => {
    const bad = { ...mapping, categories: mapping.categories.map((c, i) => (i === 2 ? { ...c, note: 'H9' } : c)) }
    expect(() => createSoundEngine(bad)).toThrow(/mild.*not a note name/)
  })

  it('rejects categories where a cooler one is not lower', () => {
    const swapped = { ...mapping, categories: [mapping.categories[1], mapping.categories[0], ...mapping.categories.slice(2)] }
    expect(() => createSoundEngine(swapped)).toThrow(/higher/)
  })

  it('rejects a note whose chord note, an octave down, would sound under C3', () => {
    const low = { ...mapping, categories: mapping.categories.map((c, i) => (i === 0 ? { ...c, note: 'B3' } : c)) }
    expect(() => validateMapping(low)).toThrow(/cold.*too low/)
    expect(() => validateMapping({ ...mapping, categories: mapping.categories.map((c, i) => (i === 0 ? { ...c, note: 'C4' } : c)) })).not.toThrow()
  })

  it('rejects a tick that is not a note', () => {
    expect(() => createSoundEngine({ ...mapping, tick: { ...mapping.tick, note: 'nope' } })).toThrow(/tick/)
  })
})

describe('unlocking', () => {
  it('makes no sound before unlock()', () => {
    const engine = createSoundEngine(mapping)
    const onStep = vi.fn()
    engine.playCategory('cold')
    engine.playTick()
    engine.playMissing()
    engine.playSequence(steps, onStep)
    mocks.transport.advance(5)
    expect(onStep).not.toHaveBeenCalled()
    expect(engine.isPlaying()).toBe(false)
    expect(mocks.transport.starts).toEqual([])
    expect(mocks.calls).toEqual([])
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('starts the audio context once, however many times it is called', async () => {
    const engine = createSoundEngine(mapping)
    await Promise.all([engine.unlock(), engine.unlock()])
    await engine.unlock()
    expect(mocks.start).toHaveBeenCalledTimes(1)
  })
})

describe('voices', () => {
  it('plays each category as its own note', async () => {
    const engine = await unlocked()
    for (const category of mapping.categories) engine.playCategory(category.id)
    expect(playedNotes()).toEqual(mapping.categories.map(c => c.note))
  })

  it('ignores an unknown category', async () => {
    const engine = await unlocked()
    engine.playCategory('lukewarm')
    expect(played()).toEqual([])
  })

  it('uses the requested duration and pan, clamped to -1…1', async () => {
    const engine = await unlocked()
    engine.playCategory('warm', { durationMs: 250, pan: -3 })
    expect(played()[0].args[1]).toBe(0.25)
    const panner = mocks.nodes.Panner[0] as { pan: { value: number } }
    expect(panner.pan.value).toBe(-1)
    engine.playCategory('warm', { pan: 0.4 })
    expect(panner.pan.value).toBe(0.4)
    engine.playCategory('warm')
    expect(panner.pan.value).toBe(0)
  })

  it('plays the tick on its own quieter synth, at the tick note', async () => {
    const engine = await unlocked()
    engine.playTick()
    expect(played()[0].args[0]).toBe(mapping.tick.note)
    const [category, tick] = mocks.nodes.Synth as { options: { volume: number } }[]
    expect(tick.options.volume).toBeLessThan(category.options.volume)
  })

  it('plays the missing-data cue as filtered noise, which no category uses', async () => {
    const engine = await unlocked()
    engine.playMissing()
    const cue = played()[0]
    expect(cue.node).toBe('NoiseSynth')
    expect(cue.args[0]).toBeCloseTo(mapping.missingCue.durationMs / 1000)
    expect(mocks.nodes.Filter).toHaveLength(1)
  })

  it('plays the hiss even if a manifest got past the schema asking for a note', async () => {
    const engine = await unlocked({ ...mapping, missingCue: { type: 'note', durationMs: 300 } } as unknown as typeof mapping)
    engine.playMissing()
    expect(played()[0].node).toBe('NoiseSynth')
    expect(playedNotes()).toEqual([])
  })
})

describe('volume', () => {
  it('ramps to the new level and keeps it between 0 and 1', async () => {
    const engine = await unlocked()
    const ramps = () => mocks.calls.filter(c => c.method === 'gain.rampTo' && c.args[1] === 0.05).map(c => c.args[0])
    engine.setVolume(0.4)
    engine.setVolume(3)
    engine.setVolume(-1)
    engine.setVolume(Number.NaN)
    expect(ramps()).toEqual([0.4, 1, 0, 0])
  })

  it('applies a volume chosen before unlock() once the audio starts', async () => {
    const engine = createSoundEngine(mapping)
    engine.setVolume(0.3)
    await engine.unlock()
    const master = mocks.calls.find(c => c.node === 'Gain' && c.method === 'new')
    expect(master?.args[0]).toBe(0.3)
  })
})

describe('stop and duck', () => {
  const fade = () => mocks.calls.filter(c => c.method === 'gain.rampTo' && c.args[0] === 0)

  it('stop() fades the sound out in under 50 ms and cancels the sequence', async () => {
    const engine = await unlocked()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    mocks.transport.advance(0)
    engine.stop()
    expect(fade()).toHaveLength(1)
    expect(fade()[0].args[1]).toBeLessThan(0.05)
    expect(engine.isPlaying()).toBe(false)
    mocks.transport.advance(5)
    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('opens the sound again for the next note after a stop', async () => {
    const engine = await unlocked()
    engine.stop()
    engine.playCategory('cold')
    const cutNode = mocks.nodes.Gain[1] as { gain: { value: number } }
    expect(cutNode.gain.value).toBe(1)
  })

  describe('duck (SN13)', () => {
    const masterRamps = () => mocks.calls.filter(c => c.node === 'Gain' && c.method === 'gain.rampTo')

    it('duck() ramps the master to DUCK_LINEAR over DUCK_ATTACK_S, with no pause and no silence', async () => {
      const engine = await unlocked()
      const onStep = vi.fn()
      engine.playSequence(steps, onStep)
      mocks.transport.advance(0.5)
      engine.duck()
      expect(masterRamps()).toEqual([{ node: 'Gain', method: 'gain.rampTo', args: [DUCK_LINEAR, DUCK_ATTACK_S] }])
      expect(engine.isPlaying()).toBe(true)
      expect(fade()).toHaveLength(0)
      mocks.transport.advance(1)
      expect(onStep.mock.calls).toEqual([[0], [1]])
    })

    it('unduck() ramps back over DUCK_RELEASE_S', async () => {
      const engine = await unlocked()
      engine.duck()
      engine.unduck()
      expect(masterRamps().at(-1)?.args).toEqual([1, DUCK_RELEASE_S])
      expect(fade()).toHaveLength(0)
    })

    it('keeps the chosen volume under the duck, and a volume set while ducked is ducked too', async () => {
      const engine = await unlocked()
      engine.setVolume(0.5)
      engine.duck()
      expect(masterRamps().at(-1)?.args).toEqual([0.5 * DUCK_LINEAR, DUCK_ATTACK_S])
      engine.setVolume(0.8)
      expect(masterRamps().at(-1)?.args).toEqual([0.8 * DUCK_LINEAR, 0.05])
      engine.unduck()
      expect(masterRamps().at(-1)?.args).toEqual([0.8, DUCK_RELEASE_S])
    })

    it('follows a duck from the guide, the speech or an announcement, and begins ducked when unlocked during one', async () => {
      const engine = await unlocked()
      duck.begin('guide')
      expect(masterRamps().at(-1)?.args).toEqual([DUCK_LINEAR, DUCK_ATTACK_S])
      duck.end('guide')
      expect(masterRamps().at(-1)?.args).toEqual([1, DUCK_RELEASE_S])
      expect(engine.isPlaying()).toBe(false)

      duck.begin('speech')
      await createSoundEngine(mapping).unlock()
      expect(mocks.calls.find(c => c.node === 'Gain' && c.method === 'new')?.args[0]).toBeCloseTo(DUCK_LINEAR, 6)
      duck.end('speech')
    })

    it('calling duck() twice holds one reason, so one unduck() releases it', async () => {
      const engine = await unlocked()
      engine.duck()
      engine.duck()
      engine.unduck()
      expect(duck.target()).toBe(1)
    })
  })
})

describe('sequences on the Transport', () => {
  it('fires onStep in order at each step time, then stops playing', async () => {
    const engine = await unlocked()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    expect(engine.isPlaying()).toBe(true)
    mocks.transport.advance(0)
    expect(onStep.mock.calls).toEqual([[0]])
    mocks.transport.advance(1)
    expect(onStep.mock.calls).toEqual([[0], [1]])
    mocks.transport.advance(1)
    expect(onStep.mock.calls).toEqual([[0], [1], [2]])
    expect(engine.isPlaying()).toBe(true) // the last sound is still ringing
    mocks.transport.advance(1)
    expect(engine.isPlaying()).toBe(false)
  })

  it('sounds each step then a tick, and the cue for missing data', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn())
    mocks.transport.advance(3)
    expect(played().map(c => c.node === 'Synth' ? c.args[0] : c.node)).toEqual([
      'C4', 'C6', 'G4', 'C6', 'NoiseSynth', 'C6',
    ])
  })

  it('puts each tick after its sound and before the next step', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn())
    mocks.transport.advance(3)
    const [note, tick] = played()
    const time = (c: typeof note) => c.args[c.node === 'NoiseSynth' ? 1 : 2] as number
    expect(time(note)).toBe(100)
    expect(time(tick)).toBeGreaterThan(100)
    expect(time(tick)).toBeLessThan(101)
  })

  it('shortens the note when steps are close together, so the tick still fits', async () => {
    const engine = await unlocked()
    engine.playSequence([{ category: 'cold', atMs: 0 }, { category: 'hot', atMs: 200 }], vi.fn())
    mocks.transport.advance(1)
    const [first, firstTick] = played()
    expect(first.args[1]).toBeCloseTo(0.12)
    expect(firstTick.args[2]).toBeCloseTo(100.12)
  })

  it('runs onStep through Tone.Draw at the time of the sound', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn())
    mocks.transport.advance(2)
    expect(mocks.draw.times.slice(0, 3)).toEqual([100, 101, 102])
  })

  it('passes each step\'s pan to its note', async () => {
    const engine = await unlocked()
    engine.playSequence([{ category: 'hot', atMs: 0, pan: 0.8 }], vi.fn())
    mocks.transport.advance(0)
    const pans = mocks.calls.filter(c => c.method === 'pan.setValueAtTime')
    expect(pans[0].args).toEqual([0.8, 100])
  })

  it('pauses and resumes from the same step', async () => {
    const engine = await unlocked()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    mocks.transport.advance(0.5)
    engine.pause()
    expect(engine.isPlaying()).toBe(false)
    mocks.transport.advance(5)
    expect(onStep.mock.calls).toEqual([[0]])
    engine.resume()
    expect(engine.isPlaying()).toBe(true)
    mocks.transport.advance(0.5)
    expect(onStep.mock.calls).toEqual([[0], [1]])
    mocks.transport.advance(1)
    expect(onStep.mock.calls).toEqual([[0], [1], [2]])
  })

  it('does nothing on resume() unless paused', async () => {
    const engine = await unlocked()
    engine.resume()
    expect(mocks.transport.starts).toEqual([])
    engine.playSequence(steps, vi.fn())
    engine.resume()
    expect(mocks.transport.starts).toHaveLength(1)
  })

  it('replaces a sequence already playing, from the start', async () => {
    const engine = await unlocked()
    const first = vi.fn()
    const second = vi.fn()
    engine.playSequence(steps, first)
    mocks.transport.advance(1.5)
    engine.playSequence(steps, second)
    mocks.transport.advance(0)
    expect(second.mock.calls).toEqual([[0]])
    mocks.transport.advance(2)
    expect(first.mock.calls).toEqual([[0], [1]])
    expect(second.mock.calls).toEqual([[0], [1], [2]])
  })

  it('takes a different speed on each play, by the spacing of the steps', async () => {
    const engine = await unlocked()
    const slow = vi.fn()
    engine.playSequence(steps, slow)
    mocks.transport.advance(1)
    expect(slow).toHaveBeenCalledTimes(2)
    const fast = vi.fn()
    engine.playSequence(steps.map(step => ({ ...step, atMs: step.atMs / 2 })), fast)
    mocks.transport.advance(1)
    expect(fast.mock.calls).toEqual([[0], [1], [2]])
  })

  it('sorts steps by time and ignores an empty sequence', async () => {
    const engine = await unlocked()
    const onStep = vi.fn()
    engine.playSequence([steps[1], steps[0]], onStep)
    mocks.transport.advance(1)
    expect(playedNotes().filter(note => note !== 'C6')).toEqual(['C4', 'G4'])
    engine.playSequence([], onStep)
    expect(engine.isPlaying()).toBe(false)
  })

  it('leaves out the tick after each sound when asked, for sweeps that are not dates', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn(), { tick: false })
    mocks.transport.advance(3)
    expect(played().map(c => c.node === 'Synth' ? c.args[0] : c.node)).toEqual(['C4', 'G4', 'NoiseSynth'])
  })

  it('ticks by default, and when tick is true', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn(), { tick: true })
    mocks.transport.advance(3)
    expect(playedNotes()).toEqual(['C4', 'C6', 'G4', 'C6', 'C6'])
  })

})

describe('the musical layer', () => {
  const notes = () => played().map(c => c.node === 'Synth' ? c.args[0] : c.node)
  const portamentos = () => (mocks.nodes.Synth as { portamento?: number }[])[0].portamento
  const voiced: SequenceStep[] = [
    { category: 'cold', atMs: 0 },
    { category: 'hot', atMs: 1000, pad: ['warm', 'hot'], glide: true, bell: true },
  ]

  it('plays the chord an octave below the notes, as long as the melody note, on its own quiet voice', async () => {
    const engine = createSoundEngine(mapping)
    await engine.unlock() // keeps the construction calls, which unlocked() clears
    engine.playSequence(voiced, vi.fn(), { tick: false })
    mocks.transport.advance(1)
    const chord = played().find(c => c.node === 'PolySynth')!
    expect(chord.args[0]).toEqual(['C4', 'E4'])
    const melody = played().filter(c => c.node === 'Synth')[1]
    expect(chord.args[1]).toBe(melody.args[1])
    expect(chord.args[2]).toBe(melody.args[2])
    const padOptions = mocks.calls.find(c => c.node === 'PolySynth' && c.method === 'new')!.args[1] as { volume: number }
    const [melodyVoice] = mocks.nodes.Synth as { options: { volume: number } }[]
    expect(padOptions.volume).toBeLessThan(melodyVoice.options.volume)
  })

  it('sets the slide before the note is triggered, and clears it on a step without one', async () => {
    const engine = await unlocked()
    const slides: (number | undefined)[] = []
    const [melody] = mocks.nodes.Synth as { triggerAttackRelease: (...args: unknown[]) => void; portamento?: number }[]
    const original = melody.triggerAttackRelease.bind(melody)
    melody.triggerAttackRelease = (...args) => { slides.push(melody.portamento); original(...args) }
    engine.playSequence(voiced, vi.fn(), { tick: false })
    mocks.transport.advance(1)
    expect(slides).toEqual([0, 0.12])
    engine.playCategory('cold')
    expect(portamentos()).toBe(0)
  })

  it('rings the bell on G5 just after the note', async () => {
    const engine = await unlocked()
    engine.playSequence(voiced, vi.fn(), { tick: false })
    mocks.transport.advance(1)
    const calls = played().filter(c => c.node === 'Synth')
    expect(calls.map(c => c.args[0])).toEqual(['C4', 'E5', 'G5'])
    expect(calls[2].args[2]).toBeCloseTo((calls[1].args[2] as number) + 0.05)
  })

  it('does not give a step without chord, slide or bell any of them', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn())
    mocks.transport.advance(3)
    expect(notes()).toEqual(['C4', 'C6', 'G4', 'C6', 'NoiseSynth', 'C6'])
    expect(played().some(c => c.node === 'PolySynth')).toBe(false)
  })

  it('plays a chord on a single note too', async () => {
    const engine = await unlocked()
    engine.playCategory('cold', { pad: ['cold', 'mild'] })
    expect(played().find(c => c.node === 'PolySynth')?.args[0]).toEqual(['C3', 'G3'])
  })

  it('starts in the full style, with the reverb on', async () => {
    await unlocked()
    const reverb = mocks.nodes.Freeverb[0] as { options: { roomSize: number; wet: number } }
    expect(reverb.options).toMatchObject({ roomSize: 0.6, wet: 0.2 })
  })

  describe('in the simple style', () => {
    it('plays neither chord nor bell nor slide, and turns the reverb off', async () => {
      const engine = await unlocked()
      engine.setStyle('simple')
      const reverb = mocks.nodes.Freeverb[0] as { wet: { value: number } }
      expect(reverb.wet.value).toBe(0)
      engine.playSequence(voiced, vi.fn(), { tick: false })
      mocks.transport.advance(1)
      expect(notes()).toEqual(['C4', 'E5'])
      expect(played().some(c => c.node === 'PolySynth')).toBe(false)
      expect(portamentos()).toBe(0)
    })

    it('keeps the melody, tick and missing cue as they were, with the original melody shape', async () => {
      const engine = await unlocked()
      engine.setStyle('simple')
      const [melody] = mocks.nodes.Synth as { set: unknown }[]
      expect(mocks.calls.filter(c => c.method === 'set').at(-1)?.args[0]).toEqual({ envelope: { attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.4 } })
      expect(melody).toBeDefined()
      engine.playSequence(steps, vi.fn())
      mocks.transport.advance(3)
      expect(notes()).toEqual(['C4', 'C6', 'G4', 'C6', 'NoiseSynth', 'C6'])
    })

    it('takes effect when chosen before unlock(), and comes back to full', async () => {
      const engine = createSoundEngine(mapping)
      engine.setStyle('simple')
      await engine.unlock()
      const reverb = mocks.nodes.Freeverb[0] as { options: { wet: number }; wet: { value: number } }
      expect(reverb.options.wet).toBe(0)
      engine.setStyle('full')
      expect(reverb.wet.value).toBe(0.2)
      mocks.calls.length = 0
      engine.playCategory('cold', { pad: ['cold'] })
      expect(played().some(c => c.node === 'PolySynth')).toBe(true)
    })
  })

  it('accepts a sound style before unlock without making a sound', () => {
    const engine = createSoundEngine(mapping)
    expect(() => { engine.setStyle('simple'); engine.setStyle('full') }).not.toThrow()
    expect(mocks.calls).toEqual([])
  })
})

describe('renderToWav', () => {
  const encode = vi.spyOn(wav, 'encodeWav')

  it('renders two channels at 44 100 Hz for the last step plus 1.5 s, then encodes them as a WAV', async () => {
    encode.mockClear()
    const engine = await unlocked()
    const blob = await engine.renderToWav(steps)
    expect(mocks.offline).toHaveBeenCalledWith(expect.any(Function), 3.5, 2, 44100)
    expect(encode).toHaveBeenCalledTimes(1)
    const [channels, rate] = encode.mock.calls[0]
    expect(channels).toHaveLength(2)
    expect(rate).toBe(44100)
    expect(blob.type).toBe('audio/wav')
  })

  it('plays the same sound as live: the same voices, the steps in order and a tick after each', async () => {
    const engine = await unlocked()
    await engine.renderToWav([{ category: 'hot', atMs: 1000, pad: ['hot'], bell: true }, { category: 'cold', atMs: 0 }])
    expect(played().map(c => c.node === 'Synth' ? c.args[0] : c.node)).toEqual(['C4', 'C6', 'E5', 'PolySynth', 'G5', 'C6'])
  })

  it('renders missing data as the hiss and never as a note', async () => {
    const engine = await unlocked()
    await engine.renderToWav([{ category: 'insufficient', atMs: 0 }])
    expect(played().map(c => c.node)).toEqual(['NoiseSynth', 'Synth'])
    expect(playedNotes()).toEqual([mapping.tick.note])
  })

  it('works before unlock() and uses the current style', async () => {
    const engine = createSoundEngine(mapping)
    engine.setStyle('simple')
    await engine.renderToWav([{ category: 'hot', atMs: 0, pad: ['hot'], bell: true }])
    expect(played().some(c => c.node === 'PolySynth')).toBe(false)
    expect((mocks.nodes.Freeverb[0] as { options: { wet: number } }).options.wet).toBe(0)
  })

  it('accepts a sequence up to 180 s and rejects one above it', async () => {
    const engine = await unlocked()
    await expect(engine.renderToWav([{ category: 'cold', atMs: 178_500 }])).resolves.toBeInstanceOf(Blob)
    mocks.offline.mockClear()
    await expect(engine.renderToWav([{ category: 'cold', atMs: 178_501 }])).rejects.toThrow('That is too long to download (over 3 minutes).')
    expect(mocks.offline).not.toHaveBeenCalled()
  })

  it('rejects an empty sequence with a readable message', async () => {
    const engine = await unlocked()
    await expect(engine.renderToWav([])).rejects.toThrow(/nothing to download/)
  })
})

describe('3D sound', () => {
  const panner3d = () => mocks.nodes.Panner3D?.[0] as { options: { panningModel: string }; positionX: { value: number }; positionY: { value: number } }

  it("starts in stereo: a stereo panner and no HRTF panner, and elevation is ignored", async () => {
    const engine = await unlocked()
    expect(mocks.nodes.Panner).toHaveLength(1)
    expect(mocks.nodes.Panner3D).toBeUndefined()
    engine.playCategory('warm', { pan: 0.4, elevation: 1 })
    expect((mocks.nodes.Panner[0] as { pan: { value: number } }).pan.value).toBe(0.4)
  })

  it("setSpatial('3d') replaces the stereo panner with an HRTF one, and back again, while the voices stay the same", async () => {
    const engine = await unlocked()
    const voicesBefore = mocks.nodes.Synth.length
    engine.setSpatial('3d')
    expect(panner3d().options.panningModel).toBe('HRTF')
    expect(mocks.calls.some(c => c.node === 'Panner' && c.method === 'dispose')).toBe(true)
    engine.setSpatial('stereo')
    expect(mocks.nodes.Panner).toHaveLength(2)
    expect(mocks.calls.some(c => c.node === 'Panner3D' && c.method === 'dispose')).toBe(true)
    expect(mocks.nodes.Synth).toHaveLength(voicesBefore)
  })

  it('sets the place from pan and elevation in 3D: north is up, and the pitch is the same as in stereo', async () => {
    const engine = await unlocked()
    engine.setSpatial('3d')
    engine.playCategory('warm', { pan: 1, elevation: 1 })
    const note3d = playedNotes()[0]
    expect(panner3d().positionX.value).toBeGreaterThan(0.5)
    expect(panner3d().positionY.value).toBeGreaterThan(0.5)
    engine.playCategory('warm', { pan: -1, elevation: -1 })
    expect(panner3d().positionX.value).toBeLessThan(-0.5)
    expect(panner3d().positionY.value).toBeLessThan(-0.5)
    expect(playedNotes()[1]).toBe(note3d)
  })

  it('is set before unlock() too, and in a step the place is set at the step time', async () => {
    const engine = createSoundEngine(mapping)
    engine.setSpatial('3d')
    await engine.unlock()
    expect(panner3d().options.panningModel).toBe('HRTF')
    engine.playSequence([{ category: 'warm', atMs: 0, pan: -1, elevation: 1 }], vi.fn())
    mocks.transport.advance(0.1)
    const set = mocks.calls.find(c => c.node === 'Panner3D' && c.method === 'positionY.setValueAtTime')
    expect(set?.args[0]).toBeGreaterThan(0.5)
  })

  it('renders with the current mode', async () => {
    const engine = await unlocked()
    engine.setSpatial('3d')
    mocks.calls.length = 0
    await engine.renderToWav([{ category: 'warm', atMs: 0, pan: 1, elevation: 1 }])
    expect(mocks.calls.filter(c => c.node === 'Panner3D' && c.method === 'new')).toHaveLength(1)
  })
})

describe('the nodes of the full and simple styles', () => {
  // Recorded before the "change" style was added: T114 must leave these exactly as they were.
  const BUILT = ['Gain', 'Gain', 'Freeverb', 'Panner', 'Gain', 'Synth', 'Synth', 'Filter', 'NoiseSynth', 'Synth', 'PolySynth']
  const built = () => mocks.calls.filter(c => c.method === 'new').map(c => c.node)

  it.each(['full', 'simple'] as const)('builds the same nodes as before in the %s style, and none for the change style', async style => {
    const engine = createSoundEngine(mapping)
    engine.setStyle(style)
    await engine.unlock()
    expect(built()).toEqual(BUILT)
    engine.playSequence([{ category: 'cold', atMs: 0, changeStep: 'above', medianChange: 1 }], vi.fn())
    mocks.transport.advance(1)
    engine.setStyle(style === 'full' ? 'simple' : 'full')
    expect(built()).toEqual(BUILT)
  })

  it('ignores the change fields in the full and simple styles: the category note plays', async () => {
    for (const style of ['full', 'simple'] as const) {
      const engine = await unlocked(changeMapping)
      engine.setStyle(style)
      engine.playSequence([{ category: 'cold', atMs: 0, changeStep: 'much-above', medianChange: 3 }], vi.fn(), { tick: false })
      mocks.transport.advance(1)
      expect(playedNotes()).toEqual(['C4'])
      mocks.calls.length = 0
    }
  })
})

// The five change steps of the test data set, most below normal first, each with its note in C3 to C4, and the two contour levels.
const changeMapping = {
  ...mapping,
  changeSteps: [
    { id: 'much-below', range: [-10, -1], note: 'C3' },
    { id: 'below', range: [-1, -0.25], note: 'E3' },
    { id: 'near', range: [-0.25, 0.25], note: 'G3' },
    { id: 'above', range: [0.25, 1], note: 'A3' },
    { id: 'much-above', range: [1, 10], note: 'C4' },
  ],
  contourLevels: [{ value: 1, note: 'C5' }, { value: 2, note: 'G5' }],
} as SoundMapping & import('./changeVoice').ChangeSounds

describe('mapping validation for the change style', () => {
  const withSteps = (steps: { id: string; range: [number, number]; note: string }[]) => ({ ...mapping, changeSteps: steps })
  it('accepts the test mapping, and a data set with no change notes at all', () => {
    expect(() => validateMapping(changeMapping)).not.toThrow()
    expect(() => validateMapping(mapping)).not.toThrow()
  })
  it('rejects a change step whose note is not a note, is outside C3 to C4, or does not rise', () => {
    const [a, b] = changeMapping.changeSteps!
    expect(() => validateMapping(withSteps([{ ...a, note: 'X' }]))).toThrow('not a note name')
    expect(() => validateMapping(withSteps([{ ...a, note: 'B2' }]))).toThrow('between C3 and C4')
    expect(() => validateMapping(withSteps([{ ...a, note: 'D4' }]))).toThrow('between C3 and C4')
    expect(() => validateMapping(withSteps([a, { ...b, note: 'C3' }]))).toThrow('higher than the step before')
  })
  it('rejects a contour level whose note is not a note or is outside C3 to C6', () => {
    expect(() => validateMapping({ ...mapping, contourLevels: [{ value: 1, note: 'nope' }] })).toThrow('not a note name')
    expect(() => validateMapping({ ...mapping, contourLevels: [{ value: 1, note: 'D6' }] })).toThrow('between C3 and C6')
  })
})

describe('the change style', () => {
  const synths = () => mocks.nodes.Synth as { options: { oscillator: { type: string } } }[]
  const bedCalls = () => played().filter(c => c.node === 'Synth' && ['C3', 'E3', 'G3', 'A3', 'C4'].includes(c.args[0] as string))
  const changeStepsOf = (...ids: (string | undefined)[]): SequenceStep[] => ids.map((id, k) => ({ category: 'mild', atMs: k * 1000, changeStep: id, medianChange: 0.5 }))

  async function changing() {
    const engine = await unlocked(changeMapping)
    engine.setStyle('change')
    mocks.calls.length = 0
    return engine
  }

  describe('the master chain', () => {
    it('is built on first use: a compressor, then a limiter at -1 dBFS, then the speakers', async () => {
      const engine = await unlocked(changeMapping)
      expect(mocks.nodes.Compressor).toBeUndefined()
      engine.setStyle('change')
      expect(mocks.nodes.Compressor).toHaveLength(1)
      expect((mocks.nodes.Limiter[0] as { options: unknown }).options).toBe(-1)
      const links = mocks.calls.filter(c => c.method === 'connect')
      const [master, cut] = mocks.nodes.Gain
      expect(links.some(c => c.node === 'Gain' && c.args[0] === mocks.nodes.Compressor[0])).toBe(true)
      expect(links.some(c => c.node === 'Compressor' && c.args[0] === mocks.nodes.Limiter[0])).toBe(true)
      expect(links.at(-1)).toMatchObject({ node: 'Limiter', args: [master] })
      expect(master).not.toBe(cut)
    })

    it('is built straight away when chosen before unlock(), and renderToWav uses it too', async () => {
      const engine = createSoundEngine(changeMapping)
      engine.setStyle('change')
      await engine.unlock()
      expect(mocks.nodes.Compressor).toHaveLength(1)
      mocks.calls.length = 0
      await engine.renderToWav([{ category: 'mild', atMs: 0, changeStep: 'above' }])
      expect(mocks.calls.filter(c => c.method === 'new' && c.node === 'Limiter')).toHaveLength(1)
      expect(bedCalls().length).toBe(2)
    })

    it('goes round the chain again when the style goes back, and is not built twice', async () => {
      const engine = await unlocked(changeMapping)
      engine.setStyle('change')
      engine.setStyle('full')
      const gains = mocks.nodes.Gain as unknown[]
      const cutToMaster = mocks.calls.filter(c => c.method === 'connect' && c.node === 'Gain' && c.args[0] === gains[0])
      expect(cutToMaster.length).toBeGreaterThan(0)
      engine.setStyle('change')
      expect(mocks.nodes.Compressor).toHaveLength(1)
      expect(mocks.nodes.Limiter).toHaveLength(1)
    })
  })

  describe('the change bed', () => {
    it('plays each step as its own note, a sine and a quiet sawtooth together, so pitch steps with the change', async () => {
      const engine = await changing()
      engine.playSequence(changeStepsOf('much-below', 'below', 'near', 'above', 'much-above'), vi.fn(), { tick: false })
      mocks.transport.advance(5)
      expect(bedCalls().map(c => c.args[0])).toEqual(['C3', 'C3', 'E3', 'E3', 'G3', 'G3', 'A3', 'A3', 'C4', 'C4'])
      expect(played().some(c => c.node === 'NoiseSynth')).toBe(false)
      const types = synths().map(s => s.options.oscillator?.type)
      expect(types).toEqual(expect.arrayContaining(['sine', 'sawtooth']))
    })

    it('holds the note nearly to the next step, and the last step for the usual note length', async () => {
      const engine = await changing()
      engine.playSequence(changeStepsOf('near', 'above'), vi.fn(), { tick: false })
      mocks.transport.advance(2)
      const durations = bedCalls().map(c => c.args[1] as number)
      expect(durations[0]).toBeCloseTo(0.97)
      expect(durations[2]).toBeCloseTo(0.6)
    })

    it('opens the filter wider for each higher step, and a little for a larger change within one', async () => {
      const engine = await changing()
      const cutoffs = () => mocks.calls.filter(c => c.node === 'Filter' && c.method === 'frequency.setValueAtTime').map(c => c.args[0] as number)
      engine.playSequence(changeStepsOf('much-below', 'below', 'near', 'above', 'much-above'), vi.fn(), { tick: false })
      mocks.transport.advance(5)
      const byStep = cutoffs()
      expect(byStep).toHaveLength(5)
      expect(byStep).toEqual([...byStep].sort((a, b) => a - b))
      expect(new Set(byStep).size).toBe(5)

      mocks.calls.length = 0
      mocks.transport.reset()
      engine.playSequence([{ category: 'mild', atMs: 0, changeStep: 'near', medianChange: -0.2 }, { category: 'mild', atMs: 1000, changeStep: 'near', medianChange: 0.2 }], vi.fn(), { tick: false })
      mocks.transport.advance(2)
      const [low, high] = cutoffs().slice(-2)
      expect(high).toBeGreaterThan(low)
      expect(bedCalls().slice(-4).map(c => c.args[0])).toEqual(['G3', 'G3', 'G3', 'G3'])
    })

    it('sets the level from the step, quieter where the filter is open, never above 0 dB', async () => {
      const engine = await changing()
      engine.playSequence(changeStepsOf('much-below', 'much-above'), vi.fn(), { tick: false })
      mocks.transport.advance(2)
      const gains = mocks.calls.filter(c => c.node === 'Gain' && c.method === 'gain.setValueAtTime').map(c => c.args[0] as number)
      expect(gains).toHaveLength(2)
      expect(Math.max(...gains)).toBeLessThanOrEqual(1)
      expect(gains[1]).toBeLessThanOrEqual(gains[0])
    })

    it('keeps the bed centred and dry: it never goes through the panner, so a step\'s pan or elevation cannot move it', async () => {
      const engine = await unlocked(changeMapping)
      engine.setStyle('change')
      // Gains in build order: master, cut, bus, then the bed's level. Its only output is the cut gain, ahead of the master chain.
      const [, cut, , bedLevel] = mocks.nodes.Gain
      expect(mocks.calls.filter(c => c.method === 'connect' && c.node === 'Gain' && c.args[0] === cut)).toHaveLength(1)
      expect(bedLevel).toBeDefined()
      mocks.calls.length = 0
      engine.playSequence([{ category: 'mild', atMs: 0, changeStep: 'above', pan: 0.9, elevation: 1 }], vi.fn(), { tick: false })
      mocks.transport.advance(1)
      expect(bedCalls()).toHaveLength(2)
      expect(mocks.calls.filter(c => (c.node === 'Panner' || c.node === 'Panner3D') && c.method.endsWith('setValueAtTime'))).toEqual([])
    })

    it('hisses for a date with too little data, and never plays a bed for it', async () => {
      const engine = await changing()
      engine.playSequence(changeStepsOf('insufficient'), vi.fn(), { tick: false })
      mocks.transport.advance(1)
      expect(played().map(c => c.node)).toEqual(['NoiseSynth'])
    })

    it('plays the category note for a step with no change step, or one this data set does not have, as today', async () => {
      const engine = await changing()
      engine.playSequence(changeStepsOf(undefined, 'not-a-step'), vi.fn(), { tick: false })
      mocks.transport.advance(2)
      expect(playedNotes()).toEqual(['G4', 'G4'])
      expect(bedCalls()).toEqual([])
    })

    it('plays the category notes for a data set with no change steps at all', async () => {
      const engine = await unlocked()
      engine.setStyle('change')
      mocks.calls.length = 0
      engine.playSequence(changeStepsOf('above'), vi.fn(), { tick: false })
      mocks.transport.advance(1)
      expect(playedNotes()).toEqual(['G4'])
    })

    it('keeps the tick after each bed step, unless asked not to, and reports each step', async () => {
      const engine = await changing()
      const onStep = vi.fn()
      engine.playSequence(changeStepsOf('near', 'above'), onStep, { tick: true })
      mocks.transport.advance(2)
      expect(onStep.mock.calls.map(c => c[0])).toEqual([0, 1])
      expect(playedNotes().filter(n => n === 'C6')).toHaveLength(2)
    })

    it('renders the same notes as live playback', async () => {
      const engine = await changing()
      await engine.renderToWav(changeStepsOf('much-below', 'near', 'much-above'))
      expect(bedCalls().map(c => c.args[0])).toEqual(['C3', 'C3', 'G3', 'G3', 'C4', 'C4'])
    })
  })

  describe('the contour voice', () => {
    const line = (extra: Partial<Contour> = {}): Contour => ({
      level: 1,
      closed: false,
      brokenEnds: 0,
      brokenStart: false,
      brokenEnd: false,
      points: Array.from({ length: 64 }, (_, k) => ({ x: k / 63, y: 0.5, turn: k === 20 ? Math.PI / 2 : 0, front: 1 })),
      ...extra,
    })
    const panAt = () => mocks.calls.filter(c => c.node === 'Panner' && c.method === 'pan.setValueAtTime').map(c => c.args[0] as number)

    it('does nothing outside the change style, or before unlock()', async () => {
      const early = createSoundEngine(changeMapping)
      early.setStyle('change')
      early.traceContour(line())
      expect(mocks.calls).toEqual([])
      for (const style of ['full', 'simple'] as const) {
        const engine = await unlocked(changeMapping)
        engine.setStyle(style)
        const onPoint = vi.fn()
        engine.traceContour(line(), onPoint)
        mocks.transport.advance(10)
        expect(mocks.calls.filter(c => c.method === 'triggerAttack')).toEqual([])
        expect(onPoint).not.toHaveBeenCalled()
        expect(engine.isPlaying()).toBe(false)
      }
    })

    it('holds one tone at the level\'s note while the line is traced, and releases it at the end', async () => {
      const engine = await changing()
      engine.traceContour(line())
      expect(engine.isPlaying()).toBe(true)
      mocks.transport.advance(10)
      expect(mocks.calls.filter(c => c.method === 'triggerAttack').map(c => c.args[0])).toEqual(['C5'])
      expect(mocks.calls.filter(c => c.node === 'Synth' && c.method === 'triggerRelease').length).toBeGreaterThan(0)
      expect(engine.isPlaying()).toBe(false)
    })

    it('plays the +2 line at its own, higher note, and the nearest level\'s note for a level in between', async () => {
      const engine = await changing()
      engine.traceContour(line({ level: 2 }))
      mocks.transport.advance(10)
      engine.traceContour(line({ level: 1.9 }))
      mocks.transport.advance(10)
      expect(mocks.calls.filter(c => c.method === 'triggerAttack').map(c => c.args[0])).toEqual(['G5', 'G5'])
    })

    it('uses C5 and G5 when the data set names no notes for its levels', async () => {
      const engine = await unlocked({ ...changeMapping, contourLevels: undefined } as typeof changeMapping)
      engine.setStyle('change')
      mocks.calls.length = 0
      engine.traceContour(line({ level: 1 }))
      mocks.transport.advance(10)
      engine.traceContour(line({ level: 2 }))
      mocks.transport.advance(10)
      expect(mocks.calls.filter(c => c.method === 'triggerAttack').map(c => c.args[0])).toEqual(['C5', 'G5'])
    })

    it('reports each point in order as it sounds, and pans west to east along the line', async () => {
      const engine = await changing()
      const onPoint = vi.fn()
      engine.traceContour(line(), onPoint)
      mocks.transport.advance(10)
      expect(onPoint.mock.calls.map(c => c[0])).toEqual(Array.from({ length: 64 }, (_, k) => k))
      const pans = panAt()
      expect(pans).toHaveLength(64)
      expect(pans[0]).toBe(-1)
      expect(pans.at(-1)).toBe(1)
      expect(pans).toEqual([...pans].sort((a, b) => a - b))
    })

    it('sets the height from y in 3D, north up', async () => {
      const engine = await changing()
      engine.setSpatial('3d')
      engine.traceContour(line({ points: [{ x: 0.5, y: 0, turn: 0, front: 1 }, { x: 0.5, y: 1, turn: 0, front: 1 }] }))
      mocks.transport.advance(10)
      const heights = mocks.calls.filter(c => c.node === 'Panner3D' && c.method === 'positionY.setValueAtTime').map(c => c.args[0] as number)
      expect(heights.length).toBeGreaterThanOrEqual(2)
      expect(heights[0]).toBeGreaterThan(0.5)
      expect(heights.at(-1)).toBeLessThan(-0.5)
    })

    it('clicks at a sharp turn only', async () => {
      const engine = await changing()
      engine.traceContour(line())
      mocks.transport.advance(10)
      expect(played().filter(c => c.node === 'Synth' && c.args[0] === 'C6')).toHaveLength(1)
    })

    it('hisses at the end that stops at no data, and not at one that runs off the map', async () => {
      const engine = await changing()
      engine.traceContour(line())
      mocks.transport.advance(10)
      expect(played().some(c => c.node === 'NoiseSynth')).toBe(false)
      engine.traceContour(line({ brokenEnds: 2, brokenStart: true, brokenEnd: true }))
      mocks.transport.advance(10)
      expect(played().filter(c => c.node === 'NoiseSynth')).toHaveLength(2)
    })

    it('brightens the tone where the front is steeper', async () => {
      const engine = await changing()
      const points = line().points.map((p: Contour['points'][number], k: number) => ({ ...p, front: k < 32 ? 0.1 : 3 }))
      engine.traceContour(line({ points }))
      mocks.transport.advance(10)
      const cutoffs = mocks.calls.filter(c => c.node === 'Filter' && c.method === 'frequency.setValueAtTime').map(c => c.args[0] as number)
      expect(cutoffs.at(-1)).toBeGreaterThan(cutoffs[0])
    })

    it('replaces a sequence, is ended by stop(), and does not report points after it', async () => {
      const engine = await changing()
      engine.playSequence(changeStepsOf('near', 'above'), vi.fn())
      const onPoint = vi.fn()
      engine.traceContour(line(), onPoint)
      mocks.transport.advance(1)
      expect(onPoint.mock.calls.length).toBeGreaterThan(0)
      const heard = onPoint.mock.calls.length
      engine.stop()
      expect(engine.isPlaying()).toBe(false)
      mocks.transport.advance(10)
      expect(onPoint).toHaveBeenCalledTimes(heard)
      expect(bedCalls()).toEqual([])
    })

    it('ignores a line with no points', async () => {
      const engine = await changing()
      engine.traceContour(line({ points: [] }))
      expect(engine.isPlaying()).toBe(false)
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { SoundMapping, Visualization } from '../data'
import { validateMapping } from './engine'
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
  return { calls, nodes, make, transport, draw, start: vi.fn(async () => {}) }
})

vi.mock('tone', () => ({
  start: mocks.start,
  now: () => 0,
  getTransport: () => mocks.transport,
  getDraw: () => mocks.draw,
  Gain: mocks.make('Gain', [], ['gain']),
  Panner: mocks.make('Panner', [], ['pan']),
  Filter: mocks.make('Filter'),
  Synth: mocks.make('Synth', ['triggerAttackRelease', 'triggerRelease']),
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
  mocks.calls.length = 0
  for (const key of Object.keys(mocks.nodes)) delete mocks.nodes[key]
  mocks.transport.reset()
  mocks.draw.times.length = 0
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

  it('can use a note for the missing cue instead, below every category', async () => {
    const engine = await unlocked({ ...mapping, missingCue: { type: 'note', durationMs: 300 } })
    engine.playMissing()
    expect(playedNotes()).toEqual(['B1'])
    expect(mocks.nodes.NoiseSynth).toBeUndefined()
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

  it('duck() pauses, remembers its place and silences the sound', async () => {
    const engine = await unlocked()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    mocks.transport.advance(0.5)
    engine.duck()
    expect(engine.isPlaying()).toBe(false)
    expect(fade()).toHaveLength(1)
    mocks.transport.advance(5)
    expect(onStep.mock.calls).toEqual([[0]])
    expect(mocks.transport.position).toBe(0.5)
  })

  it('unduck() does not resume by itself; resume() continues from the next step', async () => {
    const engine = await unlocked()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    mocks.transport.advance(0.5)
    engine.duck()
    engine.unduck()
    mocks.transport.advance(5)
    expect(onStep.mock.calls).toEqual([[0]])
    engine.resume()
    mocks.transport.advance(0.5)
    expect(onStep.mock.calls).toEqual([[0], [1]])
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
      'C4', 'C6', 'E4', 'C6', 'NoiseSynth', 'C6',
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
    expect(playedNotes().filter(note => note !== 'C6')).toEqual(['C4', 'E4'])
    engine.playSequence([], onStep)
    expect(engine.isPlaying()).toBe(false)
  })

  it('leaves out the tick after each sound when asked, for sweeps that are not dates', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn(), { tick: false })
    mocks.transport.advance(3)
    expect(played().map(c => c.node === 'Synth' ? c.args[0] : c.node)).toEqual(['C4', 'E4', 'NoiseSynth'])
  })

  it('ticks by default, and when tick is true', async () => {
    const engine = await unlocked()
    engine.playSequence(steps, vi.fn(), { tick: true })
    mocks.transport.advance(3)
    expect(playedNotes()).toEqual(['C4', 'C6', 'E4', 'C6', 'C6'])
  })

  // T68 gives these meaning. Until then the engine must accept them and sound exactly as before.
  it('accepts a chord, a glide and a bell on a step, and sounds the same until T68', async () => {
    const engine = await unlocked()
    const voiced: SequenceStep[] = steps.map(step => ({ ...step, pad: ['cold', 'mild'], glide: true, bell: true }))
    engine.playSequence(voiced, vi.fn())
    mocks.transport.advance(3)
    expect(played().map(c => c.node === 'Synth' ? c.args[0] : c.node)).toEqual(['C4', 'C6', 'E4', 'C6', 'NoiseSynth', 'C6'])
  })

  it('accepts a chord on a single note, and sounds the same until T68', async () => {
    const engine = await unlocked()
    engine.playCategory('cold', { pad: ['cold', 'mild'] })
    expect(playedNotes()).toEqual(['C4'])
  })

  it('accepts a sound style in either state, before and after unlock, without changing the sound until T68', async () => {
    const engine = createSoundEngine(mapping)
    expect(() => { engine.setStyle('simple'); engine.setStyle('full') }).not.toThrow()
    await engine.unlock()
    mocks.calls.length = 0
    engine.setStyle('simple')
    engine.playCategory('cold')
    expect(playedNotes()).toEqual(['C4'])
  })

  it('reports WAV export as not built', async () => {
    const engine = await unlocked()
    await expect(engine.renderToWav(steps)).rejects.toThrow(/T08/)
  })
})

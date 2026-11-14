// A recording stand-in for Tone, for the ensemble's tests. Not shipped: only test files import this. Every node remembers what was done to it and no audio is
// made (jsdom has no AudioContext). Use it with:
//
//   vi.mock('tone', async () => (await import('./toneMock')).toneModule)
//
// and call `resetTone()` in beforeEach.

import { vi } from 'vitest'

export type Call = { node: string; id: number; method: string; args: unknown[] }
export type MockNode = { id: number; name: string; options: unknown; connectedTo: MockNode[]; toDestinationCalled: boolean; [key: string]: unknown }
type Param = { value: number; rampTo: (...a: unknown[]) => void; setValueAtTime: (...a: unknown[]) => void; linearRampToValueAtTime: (...a: unknown[]) => void; cancelScheduledValues: (...a: unknown[]) => void }

export const calls: Call[] = []
export const nodes: Record<string, MockNode[]> = {}
let nextNode = 0

function makeParam(node: string, id: number, name: string): Param {
  const record = (method: string) => (...args: unknown[]) => { calls.push({ node, id, method: `${name}.${method}`, args }) }
  return { value: 0, rampTo: record('rampTo'), setValueAtTime: record('setValueAtTime'), linearRampToValueAtTime: record('linearRampToValueAtTime'), cancelScheduledValues: record('cancelScheduledValues') }
}

function make(name: string, methods: string[], params: string[] = []) {
  class Node {
    id = nextNode++
    name = name
    options: unknown
    connectedTo: MockNode[] = []
    toDestinationCalled = false
    ;[key: string]: unknown
    constructor(...args: unknown[]) {
      this.options = args.length > 1 ? args : args[0]
      for (const param of params) this[param] = makeParam(name, this.id, param)
      ;(nodes[name] ??= []).push(this as unknown as MockNode)
      calls.push({ node: name, id: this.id, method: 'new', args })
    }
    connect(target: MockNode) {
      this.connectedTo.push(target)
      calls.push({ node: name, id: this.id, method: 'connect', args: [target] })
      return this
    }
    toDestination() {
      this.toDestinationCalled = true
      calls.push({ node: name, id: this.id, method: 'toDestination', args: [] })
      return this
    }
  }
  for (const method of ['dispose', ...methods]) {
    ;(Node.prototype as unknown as Record<string, unknown>)[method] = function (this: Node, ...args: unknown[]) {
      calls.push({ node: name, id: this.id, method, args })
      return this
    }
  }
  return Node
}

// ---- The Transport: events fire only when a test calls fire(). ----
type TransportEvent = { id: number; kind: 'once' | 'repeat'; cb: (time: number) => void; time: number; interval?: number }
export const transport = {
  nextId: 1,
  events: [] as TransportEvent[],
  cleared: [] as number[],
  seconds: 0,
  state: 'stopped' as 'stopped' | 'started' | 'paused',
  starts: [] as unknown[],
  pauses: [] as unknown[],
  stops: 0,
  schedule(cb: (time: number) => void, time: number) { const id = this.nextId++; this.events.push({ id, kind: 'once', cb, time }); return id },
  scheduleRepeat(cb: (time: number) => void, interval: number, time: number) { const id = this.nextId++; this.events.push({ id, kind: 'repeat', cb, time, interval }); return id },
  clear(id: number) { this.cleared.push(id); this.events = this.events.filter(e => e.id !== id) },
  cancel() { this.events = [] },
  start(when?: unknown) { this.state = 'started'; this.starts.push(when) },
  pause(when?: unknown) { this.state = 'paused'; this.pauses.push(when) },
  stop() { this.state = 'stopped'; this.stops++ },
  /** Runs one event's callback at an audio time. */
  fire(id: number, time: number) { this.events.find(e => e.id === id)?.cb(time) },
  reset() { this.nextId = 1; this.events = []; this.cleared = []; this.seconds = 0; this.state = 'stopped'; this.starts = []; this.pauses = []; this.stops = 0 },
}

// ---- The raw audio context. ----
const listeners = new Map<string, Set<() => void>>()
export const raw = {
  state: 'running' as string,
  currentTime: 0,
  /** UI08: the read-only tap on the master. Every analyser made is kept, newest last. */
  analysers: [] as { fftSize: number; smoothingTimeConstant: number; connected: boolean; disconnect(): void }[],
  createAnalyser() {
    const analyser = { fftSize: 2048, smoothingTimeConstant: 0.8, connected: true, disconnect() { analyser.connected = false } }
    this.analysers.push(analyser)
    return analyser
  },
  addEventListener(type: string, listener: () => void) { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(listener) },
  removeEventListener(type: string, listener: () => void) { listeners.get(type)?.delete(listener) },
  /** The browser changes the state: a statechange event follows. */
  setState(state: string) { this.state = state; for (const listener of [...(listeners.get('statechange') ?? [])]) listener() },
  listenerCount: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
}

/** What Tone.start() leaves the context in. Tests set it to 'suspended' to see a browser that will not start the sound. */
export const behaviour = { stateAfterStart: 'running' as string }

export const offlineRuns: { duration: number; channels: number; sampleRate: number }[] = []
export const start = vi.fn(async () => { raw.state = behaviour.stateAfterStart })
const offline = vi.fn(async (callback: () => void, duration: number, channels: number, sampleRate: number) => {
  offlineRuns.push({ duration, channels, sampleRate })
  const before = calls.length
  callback()
  // A buffer that depends on the notes this run played, so "the same schedule gives the same samples" is a real comparison.
  const notes = calls.slice(before).filter(c => c.method === 'triggerAttack' || c.method === 'triggerAttackRelease').length
  return { getChannelData: (channel: number) => Float32Array.from({ length: 16 }, (_, i) => Math.sin(i + channel) * 0.1 + notes * 0.001) }
})

export const toneModule = {
  start,
  now: () => raw.currentTime,
  getTransport: () => transport,
  getContext: () => ({ rawContext: raw }),
  Offline: offline,
  Gain: make('Gain', ['disconnect'], ['gain']),
  Panner: make('Panner', [], ['pan']),
  Panner3D: make('Panner3D', [], ['positionX', 'positionY', 'positionZ']),
  Filter: make('Filter', [], ['frequency']),
  Compressor: make('Compressor', []),
  Limiter: make('Limiter', []),
  FeedbackDelay: make('FeedbackDelay', [], ['wet']),
  WaveShaper: make('WaveShaper', []),
  Freeverb: make('Freeverb', [], ['wet']),
  Synth: make('Synth', ['triggerAttack', 'triggerRelease', 'triggerAttackRelease', 'setNote', 'set'], ['volume', 'frequency']),
  PolySynth: make('PolySynth', ['triggerAttack', 'triggerRelease', 'releaseAll', 'set'], ['volume']),
}

export function resetTone() {
  calls.length = 0
  for (const key of Object.keys(nodes)) delete nodes[key]
  nextNode = 0
  transport.reset()
  raw.state = 'running'
  raw.currentTime = 0
  raw.analysers.length = 0
  listeners.clear()
  behaviour.stateAfterStart = 'running'
  offlineRuns.length = 0
  start.mockClear()
  offline.mockClear()
}

/** The calls of one method on one kind of node. */
export const callsOf = (node: string, method: string) => calls.filter(c => c.node === node && c.method === method)
/** The calls of one method on one particular node. */
export const callsOn = (target: { id: number }, method: string) => calls.filter(c => c.id === target.id && c.method === method)

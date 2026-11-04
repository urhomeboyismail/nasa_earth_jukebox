// Fakes for the browser APIs that jsdom lacks, so components that use sound or workers can be rendered in tests.
//
//   const audio = installFakeAudioContext()      // in beforeEach
//   ...
//   audio.uninstall()                            // in afterEach (vi.unstubAllGlobals() works too)
//
// Neither fake makes sound or runs code in another thread. They record what happened so a test can check it.

import { vi } from 'vitest'

// ---- AudioContext -------------------------------------------------------------------------------------------

export class FakeAudioParam {
  value = 0
  calls: { method: string; args: unknown[] }[] = []
  setValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ method: 'setValueAtTime', args: [value, time] }); return this }
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ method: 'linearRampToValueAtTime', args: [value, time] }); return this }
  cancelScheduledValues(time: number) { this.calls.push({ method: 'cancelScheduledValues', args: [time] }); return this }
}

class FakeNode {
  connected: unknown[] = []
  connect(target: unknown) { this.connected.push(target); return target }
  disconnect() { this.connected = [] }
}

export class FakeGainNode extends FakeNode { gain = new FakeAudioParam() }
export class FakeOscillatorNode extends FakeNode {
  type = 'sine'
  frequency = new FakeAudioParam()
  started: number[] = []
  stopped: number[] = []
  start(when = 0) { this.started.push(when) }
  stop(when = 0) { this.stopped.push(when) }
}

export class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  currentTime = 0
  sampleRate = 44100
  destination = new FakeNode()
  oscillators: FakeOscillatorNode[] = []
  constructor() { FakeAudioContext.instances.push(this) }
  async resume() { this.state = 'running' }
  async suspend() { this.state = 'suspended' }
  async close() { this.state = 'closed' }
  createGain() { return new FakeGainNode() }
  createOscillator() { const node = new FakeOscillatorNode(); this.oscillators.push(node); return node }
}

export function installFakeAudioContext() {
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.stubGlobal('webkitAudioContext', FakeAudioContext)
  return {
    /** Every context the code under test created. */
    get contexts() { return FakeAudioContext.instances },
    uninstall() { vi.unstubAllGlobals() },
  }
}

// ---- Worker -------------------------------------------------------------------------------------------------

export type FakeWorkerHandler = (message: unknown) => unknown | Promise<unknown>

/** A Worker that answers each postMessage by calling `handler`, on the main thread, and delivers the result to onmessage. */
export function createFakeWorker(handler: FakeWorkerHandler = message => message) {
  return class FakeWorker {
    static instances: FakeWorker[] = []
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: ((event: ErrorEvent) => void) | null = null
    received: unknown[] = []
    terminated = false
    url?: string | URL
    options?: WorkerOptions
    constructor(url?: string | URL, options?: WorkerOptions) {
      this.url = url
      this.options = options
      FakeWorker.instances.push(this)
    }
    postMessage(message: unknown) {
      this.received.push(message)
      queueMicrotask(async () => {
        if (this.terminated) return
        try {
          this.onmessage?.({ data: await handler(message) } as MessageEvent)
        } catch {
          this.onerror?.({ message: 'The fake worker\'s handler threw.' } as ErrorEvent)
        }
      })
    }
    terminate() { this.terminated = true }
    addEventListener() {}
    removeEventListener() {}
  }
}

export function installFakeWorker(handler?: FakeWorkerHandler) {
  const FakeWorker = createFakeWorker(handler)
  vi.stubGlobal('Worker', FakeWorker)
  return {
    /** Every worker the code under test created. */
    get workers() { return FakeWorker.instances },
    uninstall() { vi.unstubAllGlobals() },
  }
}

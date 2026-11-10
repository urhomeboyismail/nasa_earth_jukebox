// Fakes for the live source's tests: a <video> that records what is done to it, bitmaps that remember whether they were closed, animation frames that
// run when a test says so, and an extractor whose answers a test releases one at a time. Not shipped: only test files import this.

import { vi } from 'vitest'
import type { Pixels } from '../analyze'
import type { FrameFeatures } from '../features/types'
import { features } from '../../sonify/testFeatures'

type FrameCallback = (now: number, metadata: { mediaTime: number }) => void

/** A <video> with requestVideoFrameCallback. `present` plays the part of the browser showing a frame. */
export class FakeVideo {
  currentTime = 0
  paused = true
  readyState = 4
  error: unknown = null
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  cancelVideoFrameCallback = vi.fn((id: number) => {
    this.callbacks.delete(id)
  })
  private callbacks = new Map<number, FrameCallback>()
  private nextId = 1
  private listeners = new Map<string, Set<() => void>>()

  requestVideoFrameCallback = (callback: FrameCallback) => {
    const id = this.nextId++
    this.callbacks.set(id, callback)
    return id
  }

  addEventListener(type: string, listener: () => void) {
    ;(this.listeners.get(type) ?? this.listeners.set(type, new Set()).get(type)!).add(listener)
  }

  removeEventListener(type: string, listener: () => void) {
    this.listeners.get(type)?.delete(listener)
  }

  /** The browser shows a frame whose media time is `mediaTime`, at performance time `now` (ms). Only the callbacks waiting now are called. */
  present(now: number, mediaTime: number) {
    const waiting = [...this.callbacks.values()]
    this.callbacks.clear()
    this.currentTime = mediaTime
    for (const callback of waiting) callback(now, { mediaTime })
  }

  fire(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener()
  }

  get waiting() {
    return this.callbacks.size
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0
  }
}

/** The same without requestVideoFrameCallback: an older browser. */
export class FakeVideoWithoutCallback {
  currentTime = 0
  paused = true
  readyState = 4
  play = vi.fn(() => {
    this.paused = false
    return Promise.resolve()
  })
  pause = vi.fn(() => {
    this.paused = true
  })
  addEventListener() {}
  removeEventListener() {}
}

export const asVideo = (video: FakeVideo | FakeVideoWithoutCallback) => video as unknown as HTMLVideoElement

export type FakeBitmap = { width: number; height: number; close: ReturnType<typeof vi.fn> }

/** Replaces createImageBitmap with one that makes a fake bitmap each time and remembers it. */
export function stubBitmaps(size = { width: 800, height: 400 }) {
  const made: FakeBitmap[] = []
  const create = vi.fn(async () => {
    const bitmap: FakeBitmap = { ...size, close: vi.fn() }
    made.push(bitmap)
    return bitmap
  })
  vi.stubGlobal('createImageBitmap', create)
  return { made, create }
}

/** Replaces requestAnimationFrame with a queue that runs when `tick` is called. */
export function stubAnimationFrames() {
  const queue = new Map<number, (now: number) => void>()
  let next = 1
  vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) => {
    const id = next++
    queue.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id)
  })
  return {
    tick(now: number) {
      const waiting = [...queue.values()]
      queue.clear()
      for (const callback of waiting) callback(now)
    },
    get waiting() {
      return queue.size
    },
  }
}

type Deferred = { stream: string; bitmap: ImageBitmap; input: Parameters<import('./types').Extract>[2]; resolve(confidence?: number): void; reject(error: Error): void }

/** An extractor that answers only when a test says so, so a reading can be "in flight" for as long as the test needs. */
export function controlledExtract() {
  const pending: Deferred[] = []
  const calls: { stream: string; bitmap: ImageBitmap; input: Deferred['input'] }[] = []
  const extract: import('./types').Extract = (stream, bitmap, input) =>
    new Promise<FrameFeatures>((resolve, reject) => {
      calls.push({ stream, bitmap, input })
      pending.push({ stream, bitmap, input, resolve: (confidence = 1) => resolve({ ...features({ frameId: input.frameId, date: input.date }), confidence }), reject })
    })
  return { extract, calls, pending }
}

/** An extractor that answers at once. */
export function instantExtract(confidence = 1) {
  const calls: { stream: string; bitmap: ImageBitmap; input: Parameters<import('./types').Extract>[2] }[] = []
  const extract: import('./types').Extract = async (stream, bitmap, input) => {
    calls.push({ stream, bitmap, input })
    return { ...features({ frameId: input.frameId, date: input.date }), confidence }
  }
  return { extract, calls }
}

export const tinyPixels = (width = 800, height = 400): Pixels => ({ data: new Uint8ClampedArray(width * height * 4), width, height })

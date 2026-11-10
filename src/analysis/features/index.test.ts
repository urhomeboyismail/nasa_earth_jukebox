// The stream rules: the worker keeps the last features of each stream, `resetStream` starts one fresh, and the main-thread path gives the same features.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeWorker } from '../../test/fakes'
import type { FeatureRequest, FeatureResponse } from './protocol'
import { runRequest, type StreamState } from './stream'
import { fakeBitmap, stubOffscreenCanvas } from './testBitmap'
import { inputFor, withSquare } from './testScenes'

type Api = typeof import('./index')

const frame = (column: number) => fakeBitmap(withSquare(5, [column, 10, 6, 4], 10))

let api: Api

beforeEach(async () => {
  // The module keeps its worker and its streams, so each test gets a fresh copy.
  vi.resetModules()
  api = await import('./index')
})
afterEach(() => vi.unstubAllGlobals())

/** A fake worker that does what worker.ts does, with its own streams. */
function installWorker(options: { fail?: string } = {}) {
  const streams: StreamState = new Map()
  stubOffscreenCanvas()
  return installFakeWorker((message): FeatureResponse => {
    const request = message as FeatureRequest
    try {
      if (options.fail) throw new Error(options.fail)
      return { id: request.id, features: runRequest(streams, request) }
    } catch (error) {
      return { id: request.id, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

describe('extractInWorker: in a worker', () => {
  it('carries the first frame of a stream to the second as `previous`', async () => {
    const fake = installWorker()
    const first = await api.extractInWorker('a', frame(20), inputFor({ frameId: 'one' }))
    const second = await api.extractInWorker('a', frame(22), inputFor({ frameId: 'two' }))
    expect(first.motion).toBeNull()
    expect(first.hotspots.map(h => h.id)).toEqual(['h1'])
    expect(second.motion?.dx).toBeCloseTo(2, 10) // it had the first frame to compare with
    expect(second.hotspots.map(h => h.id)).toEqual(['h1'])
    expect(fake.workers).toHaveLength(1)
    expect(fake.workers[0].received).toHaveLength(2)
    expect(fake.workers[0].received[0]).toMatchObject({ stream: 'a', input: { frameId: 'one' } })
    expect(fake.workers[0].received[1]).toMatchObject({ stream: 'a', input: { frameId: 'two' } })
    expect(fake.workers[0].received[1]).not.toHaveProperty('reset')
  })

  it('keeps streams apart', async () => {
    installWorker()
    await api.extractInWorker('a', frame(20), inputFor())
    const other = await api.extractInWorker('b', frame(22), inputFor())
    expect(other.motion).toBeNull()
  })

  it('starts the next frame of a stream fresh after resetStream, once', async () => {
    const fake = installWorker()
    await api.extractInWorker('a', frame(20), inputFor())
    api.resetStream('a')
    const fresh = await api.extractInWorker('a', frame(10), inputFor())
    expect(fresh.motion).toBeNull()
    expect(fake.workers[0].received[1]).toMatchObject({ reset: true })
    const next = await api.extractInWorker('a', frame(12), inputFor())
    expect(next.motion?.dx).toBeCloseTo(2, 10)
    expect(fake.workers[0].received[2]).not.toHaveProperty('reset')
  })

  it('closes the bitmap it was given', async () => {
    installWorker()
    const bitmap = frame(20)
    await api.extractInWorker('a', bitmap, inputFor())
    expect(bitmap.close).toHaveBeenCalled()
  })

  it('rejects with the worker\'s message when it fails, and carries on with the next frame', async () => {
    installWorker({ fail: 'The baseline image must be the same size as the frame.' })
    await expect(api.extractInWorker('a', frame(20), inputFor())).rejects.toThrow('The baseline image must be the same size as the frame.')
  })

  it('rejects when the picture cannot be posted, frees it, and asks for the reset again next time', async () => {
    stubOffscreenCanvas()
    const sent: FeatureRequest[] = []
    let refuse = true
    class RefusingWorker {
      onmessage = null
      onerror = null
      postMessage(message: FeatureRequest) { sent.push(message); if (refuse) throw new Error('refused') }
      terminate() {}
    }
    vi.stubGlobal('Worker', RefusingWorker)
    api.resetStream('a')
    const bitmap = frame(20)
    await expect(api.extractInWorker('a', bitmap, inputFor())).rejects.toThrow('refused')
    expect(bitmap.close).toHaveBeenCalled()
    refuse = false
    void api.extractInWorker('a', frame(22), inputFor()) // never answered: only what it sent matters
    expect(sent.map(m => m.reset)).toEqual([true, true])
  })
})

describe('extractInWorker: without a Worker', () => {
  it('gives the same features as the worker does', async () => {
    stubOffscreenCanvas()
    const local = [await api.extractInWorker('a', frame(20), inputFor({ frameId: 'one' })), await api.extractInWorker('a', frame(22), inputFor({ frameId: 'two' }))]
    vi.unstubAllGlobals()
    vi.resetModules()
    api = await import('./index')
    installWorker()
    const remote = [await api.extractInWorker('a', frame(20), inputFor({ frameId: 'one' })), await api.extractInWorker('a', frame(22), inputFor({ frameId: 'two' }))]
    expect(remote).toEqual(local)
    expect(local[1].motion?.dx).toBeCloseTo(2, 10)
  })

  it('follows the same stream rules: streams apart, and resetStream starts one fresh', async () => {
    stubOffscreenCanvas()
    await api.extractInWorker('a', frame(20), inputFor())
    expect((await api.extractInWorker('b', frame(22), inputFor())).motion).toBeNull()
    api.resetStream('a')
    expect((await api.extractInWorker('a', frame(10), inputFor())).motion).toBeNull()
    expect((await api.extractInWorker('a', frame(12), inputFor())).motion?.dx).toBeCloseTo(2, 10)
  })

  it('closes the bitmap, and rejects when it cannot be read', async () => {
    stubOffscreenCanvas()
    const bitmap = frame(20)
    await api.extractInWorker('a', bitmap, inputFor())
    expect(bitmap.close).toHaveBeenCalled()
    vi.unstubAllGlobals()
    stubOffscreenCanvas({ noContext: true })
    const unreadable = frame(20)
    await expect(api.extractInWorker('a', unreadable, inputFor())).rejects.toThrow('This browser cannot read image pixels.')
    expect(unreadable.close).toHaveBeenCalled()
  })

  it('leaves the stream as it was after a failure', async () => {
    stubOffscreenCanvas()
    await api.extractInWorker('a', frame(20), inputFor())
    const baselineOfAnotherSize = { pixels: { data: new Uint8ClampedArray(4), width: 1, height: 1 }, noiseFloor: 0 }
    await expect(api.extractInWorker('a', frame(22), inputFor({ baseline: baselineOfAnotherSize }))).rejects.toThrow('same size')
    expect((await api.extractInWorker('a', frame(22), inputFor())).motion?.dx).toBeCloseTo(2, 10)
  })
})

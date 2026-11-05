import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { analyzePixels, gridFromPixels, type Pixels } from './analyze'
import type { WorkerRequest, WorkerResponse } from './protocol'

const visualization = fixture as Visualization
const region = visualization.regions[0]
const { colorScale, mapping, frames } = visualization

// jsdom cannot decode PNGs, so stand in for the fixture images: solid blue, yellow and red, and grey for missing data.
const SOLID: Record<string, [number, number, number]> = {
  '2024-01-15': [0, 0, 255],
  '2024-07-15': [255, 255, 0],
  '2024-12-15': [255, 0, 0],
  '2025-03-15': [200, 200, 200],
}
const readPixels = vi.fn(async (url: string): Promise<Pixels> => {
  const [r, g, b] = SOLID[/(\d{4}-\d{2}-\d{2})\.png/.exec(url)![1]]
  return { width: 2, height: 2, data: new Uint8ClampedArray(Array.from({ length: 4 }, () => [r, g, b, 255]).flat()) }
})
vi.mock('./pixels', () => ({ readPixels: (url: string) => readPixels(url) }))

// Each test gets a fresh module, so the cache and worker do not leak between tests.
async function load() {
  vi.resetModules()
  return import('.')
}

beforeEach(() => { readPixels.mockClear() })
afterEach(() => vi.unstubAllGlobals())

describe('frame analysis on the main thread', () => {
  it('gives the categories the fixture frames should give', async () => {
    const { analyzeAll } = await load()
    const results = await analyzeAll(frames, region, colorScale, mapping)
    expect(results.map(result => result.category)).toEqual(['cold', 'mild', 'hot', 'insufficient'])
  })

  it('never reads missing data as a value', async () => {
    const { analyzeFrame } = await load()
    const result = await analyzeFrame(frames[3], region, colorScale, mapping)
    expect(result).toMatchObject({ category: 'insufficient', valid: 0, sampled: region.points.length })
    expect(result.medianValue).toBeUndefined()
  })

  it('caches by frame and region, and gives the same result every time', async () => {
    const { analyzeFrame } = await load()
    const first = await analyzeFrame(frames[1], region, colorScale, mapping)
    const second = await analyzeFrame(frames[1], region, colorScale, mapping)
    expect(second).toEqual(first)
    expect(readPixels).toHaveBeenCalledTimes(1)
    await analyzeFrame(frames[1], { ...region, id: 'other' }, colorScale, mapping)
    expect(readPixels).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failure, so a retry can succeed', async () => {
    const { analyzeFrame } = await load()
    readPixels.mockRejectedValueOnce(new Error('network down'))
    await expect(analyzeFrame(frames[0], region, colorScale, mapping)).rejects.toThrow('network down')
    await expect(analyzeFrame(frames[0], region, colorScale, mapping)).resolves.toMatchObject({ category: 'cold' })
  })
})

/** A worker that answers like worker.ts does, but in-process. */
class FakeWorker {
  static instances: FakeWorker[] = []
  static failWith: string | null = null
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  received: WorkerRequest[] = []
  terminated = false
  constructor() { FakeWorker.instances.push(this) }
  postMessage(request: WorkerRequest) {
    this.received.push(request)
    queueMicrotask(async () => {
      if (FakeWorker.failWith) return this.onmessage?.({ data: { id: request.id, error: FakeWorker.failWith } } as MessageEvent<WorkerResponse>)
      const pixels = await readPixels(request.url)
      const result = request.kind === 'grid'
        ? gridFromPixels(pixels, request.frame, request.colorScale, request.mapping, request.area)
        : analyzePixels(pixels, request.frame, request.region, request.colorScale, request.mapping)
      this.onmessage?.({ data: { id: request.id, result } } as MessageEvent<WorkerResponse>)
    })
  }
  terminate() { this.terminated = true }
}

describe('frame analysis in a worker', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    FakeWorker.failWith = null
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('OffscreenCanvas', class {})
  })

  it('analyzes every frame in one worker and returns the same results as the main thread', async () => {
    const { analyzeAll } = await load()
    const results = await analyzeAll(frames, region, colorScale, mapping)
    expect(results.map(result => result.category)).toEqual(['cold', 'mild', 'hot', 'insufficient'])
    expect(FakeWorker.instances).toHaveLength(1)
    expect(FakeWorker.instances[0].received).toHaveLength(frames.length)
  })

  it('sends the worker an absolute image URL', async () => {
    const { analyzeFrame } = await load()
    await analyzeFrame(frames[0], region, colorScale, mapping)
    expect(FakeWorker.instances[0].received[0].url).toMatch(/^https?:\/\//)
  })

  it('asks the worker once per frame and region', async () => {
    const { analyzeFrame } = await load()
    await Promise.all([analyzeFrame(frames[0], region, colorScale, mapping), analyzeFrame(frames[0], region, colorScale, mapping)])
    expect(FakeWorker.instances[0].received).toHaveLength(1)
  })

  it('rejects with the worker\'s error and allows a retry', async () => {
    const { analyzeFrame } = await load()
    FakeWorker.failWith = 'bad image'
    await expect(analyzeFrame(frames[0], region, colorScale, mapping)).rejects.toThrow('bad image')
    FakeWorker.failWith = null
    await expect(analyzeFrame(frames[0], region, colorScale, mapping)).resolves.toMatchObject({ category: 'cold' })
  })

  it('rejects waiting callers and starts a new worker when the worker crashes', async () => {
    const { analyzeFrame } = await load()
    FakeWorker.instances = []
    const waiting = analyzeFrame(frames[0], region, colorScale, mapping)
    FakeWorker.instances[0].onerror?.()
    await expect(waiting).rejects.toThrow('stopped')
    expect(FakeWorker.instances[0].terminated).toBe(true)
    await expect(analyzeFrame(frames[0], region, colorScale, mapping)).resolves.toMatchObject({ category: 'cold' })
    expect(FakeWorker.instances).toHaveLength(2)
  })
})

describe('fixture data', () => {
  it('is internally consistent', () => {
    const frameIds = new Set(visualization.frames.map(frame => frame.id))
    for (const comparison of visualization.comparisons) {
      expect(frameIds.has(comparison.frameA) && frameIds.has(comparison.frameB)).toBe(true)
      expect(visualization.regions.some(r => r.id === comparison.regionId)).toBe(true)
    }
    const values = visualization.colorScale.stops.map(stop => stop.value)
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })
})

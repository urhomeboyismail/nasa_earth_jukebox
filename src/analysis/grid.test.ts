import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { gridFromPixels, type Pixels } from './analyze'
import type { WorkerRequest, WorkerResponse } from './protocol'

const { frames, colorScale, mapping } = fixture as Visualization
const frame = frames[0] // 200 × 100 px in the manifest, so 24 × 12 cells

// jsdom cannot decode PNGs. The stand-in image is 48 × 24 px: blue in the west half, red in the east, grey in the bottom two rows.
const picture: Pixels = (() => {
  const data = new Uint8ClampedArray(48 * 24 * 4)
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 48; x++) data.set(y >= 22 ? [128, 128, 128, 255] : x < 24 ? [0, 0, 255, 255] : [255, 0, 0, 255], (y * 48 + x) * 4)
  }
  return { data, width: 48, height: 24 }
})()
const readPixels = vi.fn(async (): Promise<Pixels> => picture)
vi.mock('./pixels', () => ({ readPixels: () => readPixels() }))

async function load() {
  vi.resetModules()
  return import('.')
}

beforeEach(() => { readPixels.mockClear() })
afterEach(() => vi.unstubAllGlobals())

describe('analyzeGrid on the main thread', () => {
  it('reads the picture into 24 columns, with the rows its shape gives, for the frame asked about', async () => {
    const { analyzeGrid } = await load()
    const grid = await analyzeGrid(frame, colorScale, mapping)
    expect(grid).toMatchObject({ frameId: frame.id, cols: 24, rows: 12, area: { x0: 0, y0: 0, x1: 1, y1: 1 } })
    expect(grid.cells).toHaveLength(24 * 12)
  })

  it('reads cold in the west, hot in the east and no data where the picture has none', async () => {
    const { analyzeGrid } = await load()
    const grid = await analyzeGrid(frame, colorScale, mapping)
    const cell = (col: number, row: number) => grid.cells[row * grid.cols + col]
    expect(cell(0, 0)).toEqual({ value: 0, category: 'cold' })
    expect(cell(23, 0)).toEqual({ value: 30, category: 'hot' })
    expect(cell(3, grid.rows - 1)).toEqual({ value: null, category: 'insufficient' })
  })

  it('gives the same cells as reading the pixels directly, so the cell and the region cannot disagree', async () => {
    const { analyzeGrid } = await load()
    const area = { x0: 0, y0: 0, x1: 1, y1: 0.5 }
    expect(await analyzeGrid(frame, colorScale, mapping, area)).toEqual(gridFromPixels(picture, frame, colorScale, mapping, area))
  })

  it('keeps the area it was given, and caches by frame, image, area and size', async () => {
    const { analyzeGrid } = await load()
    const area = { x0: 0, y0: 0, x1: 1, y1: 0.88 }
    expect((await analyzeGrid(frame, colorScale, mapping, area)).area).toEqual(area)
    await analyzeGrid(frame, colorScale, mapping, area)
    expect(readPixels).toHaveBeenCalledTimes(1)
    await analyzeGrid(frame, colorScale, mapping)
    expect(readPixels).toHaveBeenCalledTimes(2)
    await analyzeGrid({ ...frame, image: 'other.png' }, colorScale, mapping, area)
    expect(readPixels).toHaveBeenCalledTimes(3)
  })

  it('gives the same result every time', async () => {
    const { analyzeGrid } = await load()
    expect(await analyzeGrid(frames[2], colorScale, mapping)).toEqual(await analyzeGrid(frames[2], colorScale, mapping))
  })

  it('does not cache a failure, so a retry can succeed', async () => {
    const { analyzeGrid } = await load()
    readPixels.mockRejectedValueOnce(new Error('network down'))
    await expect(analyzeGrid(frame, colorScale, mapping)).rejects.toThrow('network down')
    await expect(analyzeGrid(frame, colorScale, mapping)).resolves.toMatchObject({ cols: 24 })
  })
})

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  received: WorkerRequest[] = []
  constructor() { FakeWorker.instances.push(this) }
  postMessage(request: WorkerRequest) {
    this.received.push(request)
    queueMicrotask(() => {
      const result = gridFromPixels(picture, request.frame, request.colorScale, request.mapping, request.kind === 'grid' ? request.area : undefined)
      this.onmessage?.({ data: { id: request.id, result } } as MessageEvent<WorkerResponse>)
    })
  }
  terminate() {}
}

describe('analyzeGrid in a worker', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('OffscreenCanvas', class {})
  })

  it('asks the worker for a grid, with the area and an absolute image URL, once per request', async () => {
    const { analyzeGrid } = await load()
    const area = { x0: 0, y0: 0, x1: 1, y1: 0.88 }
    const [first, second] = await Promise.all([analyzeGrid(frame, colorScale, mapping, area), analyzeGrid(frame, colorScale, mapping, area)])
    expect(second).toBe(first)
    const { received } = FakeWorker.instances[0]
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({ kind: 'grid', area })
    expect(received[0].url).toMatch(/^https?:\/\//)
    expect(first.cols).toBe(24)
  })

  it('uses the same worker as the frame analysis', async () => {
    const { analyzeGrid } = await load()
    await analyzeGrid(frames[0], colorScale, mapping)
    await analyzeGrid(frames[1], colorScale, mapping)
    expect(FakeWorker.instances).toHaveLength(1)
  })
})

// Frame analysis contract (docs/PLAN.md §5.2).
// Pixels are read and analyzed in a Web Worker (see worker.ts). Without Worker or OffscreenCanvas the same
// code runs on the main thread. Results are cached per frame and region.

import type { CategoryId, ColorScale, Frame, MapArea, Region, SoundMapping } from '../data'
import { analyzePixels, GRID_COLS, gridFromPixels, gridRows } from './analyze'
import { readPixels } from './pixels'
import type { WorkerRequest, WorkerResponse } from './protocol'

export type FrameAnalysis = {
  frameId: string
  regionId: string
  sampled: number
  valid: number
  medianValue?: number
  category: CategoryId | 'insufficient'
  /** The fraction of the valid points that fall in each category; sums to 1 when `valid` > 0. Left out when `valid` is 0. */
  shares?: Record<CategoryId, number>
}

/** One cell of the sound map. A cell without enough readable pixels has no value and is never read as a low one. */
export type GridCell = { value: number | null; category: CategoryId | 'insufficient' }

/** The whole map read into a grid, for exploring it by ear (PLAN.md §5.6). Row-major; row 0 is the top (north). */
export type FrameGrid = { frameId: string; cols: number; rows: number; area: MapArea; cells: GridCell[] }

type Pending = { resolve: (result: FrameAnalysis | FrameGrid) => void; reject: (error: Error) => void }

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, Pending>()

function failAll(error: Error) {
  pending.forEach(p => p.reject(error))
  pending.clear()
  worker?.terminate()
  worker = null
}

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  created.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if ('error' in message) entry.reject(new Error(message.error))
    else entry.resolve(message.result)
  }
  created.onerror = () => failAll(new Error('The frame analysis worker stopped.'))
  worker = created
  return created
}

const canUseWorker = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'

/** What a request asks for, without the id the page adds when it sends it. */
type Job = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never

function runInWorker<T extends FrameAnalysis | FrameGrid>(request: Job): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve: result => resolve(result as T), reject })
    try {
      getWorker().postMessage({ ...request, id } as WorkerRequest)
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

async function runOnMainThread<T extends FrameAnalysis | FrameGrid>(request: Job): Promise<T> {
  const pixels = await readPixels(request.url)
  const { frame, colorScale, mapping } = request
  return (request.kind === 'grid'
    ? gridFromPixels(pixels, frame, colorScale, mapping, request.area)
    : analyzePixels(pixels, frame, request.region, colorScale, mapping)) as T
}

const cache = new Map<string, Promise<FrameAnalysis>>()

export function analyzeFrame(frame: Frame, region: Region, colorScale: ColorScale, mapping: SoundMapping): Promise<FrameAnalysis> {
  // The image is part of the key so two visualizations that reuse a frame id never share a result.
  const key = `${frame.id}|${region.id}|${frame.image}`
  const cached = cache.get(key)
  if (cached) return cached

  const request: Job = { kind: 'frame', url: new URL(frame.image, document.baseURI).href, frame, region, colorScale, mapping }
  const result = canUseWorker() ? runInWorker<FrameAnalysis>(request) : runOnMainThread<FrameAnalysis>(request)
  cache.set(key, result)
  // A failure is not cached, so a retry can succeed.
  result.catch(() => cache.delete(key))
  return result
}

export function analyzeAll(frames: Frame[], region: Region, colorScale: ColorScale, mapping: SoundMapping): Promise<FrameAnalysis[]> {
  return Promise.all(frames.map(frame => analyzeFrame(frame, region, colorScale, mapping)))
}

const gridCache = new Map<string, Promise<FrameGrid>>()

/**
 * The whole map of one frame, read into a grid for exploring it by ear (PLAN.md §5.6). It reads pixels the same way
 * `analyzeFrame` does, so a cell and a region never disagree. `area` defaults to the whole image.
 */
export function analyzeGrid(frame: Frame, colorScale: ColorScale, mapping: SoundMapping, area?: MapArea): Promise<FrameGrid> {
  const read = area ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
  const key = `${frame.id}|${frame.image}|${read.x0},${read.y0},${read.x1},${read.y1}|${GRID_COLS}×${gridRows(frame.width, frame.height, read)}`
  const cached = gridCache.get(key)
  if (cached) return cached

  const request: Job = { kind: 'grid', url: new URL(frame.image, document.baseURI).href, frame, colorScale, mapping, area: read }
  const result = canUseWorker() ? runInWorker<FrameGrid>(request) : runOnMainThread<FrameGrid>(request)
  gridCache.set(key, result)
  result.catch(() => gridCache.delete(key))
  return result
}

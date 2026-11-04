// Frame analysis contract (docs/PLAN.md §5.2).
// Pixels are read and analyzed in a Web Worker (see worker.ts). Without Worker or OffscreenCanvas the same
// code runs on the main thread. Results are cached per frame and region.

import type { CategoryId, ColorScale, Frame, MapArea, Region, SoundMapping } from '../data'
import { analyzePixels } from './analyze'
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

type Pending = { resolve: (result: FrameAnalysis) => void; reject: (error: Error) => void }

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

function runInWorker(request: Omit<WorkerRequest, 'id'>): Promise<FrameAnalysis> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    try {
      getWorker().postMessage({ ...request, id } satisfies WorkerRequest)
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

async function runOnMainThread({ url, frame, region, colorScale, mapping }: Omit<WorkerRequest, 'id'>): Promise<FrameAnalysis> {
  return analyzePixels(await readPixels(url), frame, region, colorScale, mapping)
}

const cache = new Map<string, Promise<FrameAnalysis>>()

export function analyzeFrame(frame: Frame, region: Region, colorScale: ColorScale, mapping: SoundMapping): Promise<FrameAnalysis> {
  // The image is part of the key so two visualizations that reuse a frame id never share a result.
  const key = `${frame.id}|${region.id}|${frame.image}`
  const cached = cache.get(key)
  if (cached) return cached

  const request = { url: new URL(frame.image, document.baseURI).href, frame, region, colorScale, mapping }
  const result = canUseWorker() ? runInWorker(request) : runOnMainThread(request)
  cache.set(key, result)
  // A failure is not cached, so a retry can succeed.
  result.catch(() => cache.delete(key))
  return result
}

export function analyzeAll(frames: Frame[], region: Region, colorScale: ColorScale, mapping: SoundMapping): Promise<FrameAnalysis[]> {
  return Promise.all(frames.map(frame => analyzeFrame(frame, region, colorScale, mapping)))
}

const STUB_COLS = 24
const STUB_ROWS = 12

/**
 * The map of one frame as a grid. This is a stub (T64) so the explorer can be built against it: it ignores the pixels and
 * runs from the coolest category in the west to the warmest in the east, with the last two columns without data.
 * T65 replaces it behind the same signature. `area` defaults to the whole image.
 */
export function analyzeGrid(frame: Frame, _colorScale: ColorScale, mapping: SoundMapping, area: MapArea = { x0: 0, y0: 0, x1: 1, y1: 1 }): Promise<FrameGrid> {
  const { categories } = mapping
  const readable = STUB_COLS - 2
  const cells: GridCell[] = []
  for (let row = 0; row < STUB_ROWS; row++) {
    for (let col = 0; col < STUB_COLS; col++) {
      if (col >= readable) {
        cells.push({ value: null, category: 'insufficient' })
        continue
      }
      const category = categories[Math.min(categories.length - 1, Math.floor((col / readable) * categories.length))]
      cells.push({ value: (category.range[0] + category.range[1]) / 2, category: category.id })
    }
  }
  return Promise.resolve({ frameId: frame.id, cols: STUB_COLS, rows: STUB_ROWS, area, cells })
}

// Frame analysis contract (docs/PLAN.md §5.2).
// Pixels are read and analyzed in a Web Worker (see worker.ts). Without Worker or OffscreenCanvas the same
// code runs on the main thread. Results are cached per frame and region.

import type { CategoryId, ColorScale, Frame, MapArea, Region, SoundMapping } from '../data'
import { analyzePixels, GRID_COLS, gridFromPixels, gridRows } from './analyze'
import { readPixels } from './pixels'
import type { ChangeSpec, WorkerRequest, WorkerResponse } from './protocol'
import { scorePixels } from './score'
import type { BaselineSource, ChangeFrame, ChangeMapping, ChangeStepId, ChangeVisualization, Score } from './types'

export type { Contour, Score, ValueField } from './types'

export type FrameAnalysis = {
  frameId: string
  regionId: string
  sampled: number
  valid: number
  medianValue?: number
  category: CategoryId | 'insufficient'
  /** v2, only for a data set with a baseline: the step of the median change from normal in this region. `category` is untouched. */
  changeStep?: ChangeStepId | 'insufficient'
  medianChange?: number
  /** The fraction of the valid points that fall in each category; sums to 1 when `valid` > 0. Left out when `valid` is 0. */
  shares?: Record<CategoryId, number>
}

/** One cell of the sound map. A cell without enough readable pixels has no value and is never read as a low one. */
export type GridCell = { value: number | null; category: CategoryId | 'insufficient' }

/** The whole map read into a grid, for exploring it by ear (PLAN.md §5.6). Row-major; row 0 is the top (north). */
export type FrameGrid = { frameId: string; cols: number; rows: number; area: MapArea; cells: GridCell[] }

type Pending = { resolve: (result: FrameAnalysis | FrameGrid | Score) => void; reject: (error: Error) => void }

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

function runInWorker<T extends FrameAnalysis | FrameGrid | Score>(request: Job): Promise<T> {
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

async function runOnMainThread<T extends FrameAnalysis | FrameGrid | Score>(request: Job): Promise<T> {
  const pixels = await readPixels(request.url)
  const { frame, colorScale, mapping } = request
  if (request.kind === 'grid') return gridFromPixels(pixels, frame, colorScale, mapping, request.area) as T
  const baseline = request.change?.baselineUrl ? await readPixels(request.change.baselineUrl) : null
  if (request.kind === 'change') {
    const input = { frameId: frame.id, colorScale, mapping: request.change.mapping, area: request.area, noiseFloor: request.change.noiseFloor }
    return scorePixels(pixels, baseline, input) as T
  }
  const change = request.change && { baseline, noiseFloor: request.change.noiseFloor, changeSteps: request.change.mapping.changeSteps }
  return analyzePixels(pixels, frame, request.region, colorScale, mapping, change) as T
}

const absolute = (url: string) => new URL(url, document.baseURI).href

/**
 * Where a frame's normal is, or null when the data set has no baseline (v2 is then off and the data set plays as today).
 * Anomaly product: nothing to read, the frame already is the change. Climatology: the frame's own `baselineImage`.
 * Reference date: another frame of the same data set.
 */
export function baselineSource(frame: ChangeFrame, visualization: Pick<ChangeVisualization, 'baseline' | 'frames'>): BaselineSource | null {
  const baseline = visualization.baseline
  if (!baseline) return null
  if (baseline.kind === 'anomaly-product') return { image: null, noiseFloor: 0 }
  if (baseline.kind === 'climatology') {
    if (!frame.baselineImage) throw new Error(`Frame ${frame.id} has no baselineImage.`)
    return { image: frame.baselineImage, noiseFloor: baseline.noiseFloor }
  }
  const reference = visualization.frames.find(f => f.id === baseline.frameId)
  if (!reference) throw new Error(`The reference frame ${baseline.frameId} does not exist.`)
  return { image: reference.image, noiseFloor: baseline.noiseFloor }
}

function changeSpecFor(frame: ChangeFrame, visualization: ChangeVisualization): ChangeSpec | null {
  const source = baselineSource(frame, visualization)
  const { changeSteps, contourLevels } = visualization.mapping
  if (!source || !changeSteps || !contourLevels) return null
  const mapping: ChangeMapping = { minValidFraction: visualization.mapping.minValidFraction, changeSteps, contourLevels }
  return { baselineUrl: source.image && absolute(source.image), noiseFloor: source.noiseFloor, mapping }
}

const cache = new Map<string, Promise<FrameAnalysis>>()

/** `visualization` is optional: with a baseline it adds `changeStep` and `medianChange`; without one the result is exactly as before. */
export function analyzeFrame(frame: Frame, region: Region, colorScale: ColorScale, mapping: SoundMapping, visualization?: ChangeVisualization): Promise<FrameAnalysis> {
  const change = visualization ? changeSpecFor(frame, visualization) : null
  // The image is part of the key so two visualizations that reuse a frame id never share a result.
  const key = `${frame.id}|${region.id}|${frame.image}|${change?.baselineUrl ?? ''}|${change?.noiseFloor ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached

  const request: Job = { kind: 'frame', url: absolute(frame.image), frame, region, colorScale, mapping, ...(change && { change }) }
  const result = canUseWorker() ? runInWorker<FrameAnalysis>(request) : runOnMainThread<FrameAnalysis>(request)
  cache.set(key, result)
  // A failure is not cached, so a retry can succeed.
  result.catch(() => cache.delete(key))
  return result
}

export function analyzeAll(frames: Frame[], region: Region, colorScale: ColorScale, mapping: SoundMapping, visualization?: ChangeVisualization): Promise<FrameAnalysis[]> {
  return Promise.all(frames.map(frame => analyzeFrame(frame, region, colorScale, mapping, visualization)))
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

  const request: Job = { kind: 'grid', url: absolute(frame.image), frame, colorScale, mapping, area: read }
  const result = canUseWorker() ? runInWorker<FrameGrid>(request) : runOnMainThread<FrameGrid>(request)
  gridCache.set(key, result)
  result.catch(() => gridCache.delete(key))
  return result
}

const scoreCache = new Map<string, Promise<Score>>()

/**
 * How far the whole map is from its baseline (PLAN.md §5.9): the change step, and `contours` (empty until T113 traces them).
 * Same input, same `Score`. Rejects for a data set with no baseline.
 */
export function analyzeChange(frame: ChangeFrame, visualization: ChangeVisualization): Promise<Score> {
  const change = changeSpecFor(frame, visualization)
  if (!change) return Promise.reject(new Error('This data set has no baseline, so there is no change to score.'))
  const area = visualization.mapArea ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
  const key = `${frame.id}|${frame.image}|${change.baselineUrl ?? ''}|${change.noiseFloor}|${area.x0},${area.y0},${area.x1},${area.y1}`
  const cached = scoreCache.get(key)
  if (cached) return cached

  const request: Job = { kind: 'change', url: absolute(frame.image), frame, colorScale: visualization.colorScale, mapping: visualization.mapping, area, change }
  const result = canUseWorker() ? runInWorker<Score>(request) : runOnMainThread<Score>(request)
  scoreCache.set(key, result)
  result.catch(() => scoreCache.delete(key))
  return result
}

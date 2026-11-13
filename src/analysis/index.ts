// Frame analysis contract (docs/PLAN.md §5.2).
// Pixels are read and analyzed in a Web Worker (see worker.ts). Without Worker or OffscreenCanvas the same
// code runs on the main thread. Results are cached per frame and region.

import type { CategoryId, ColorScale, Frame, MapArea, Region, SoundMapping, Visualization } from '../data'
import { analyzePixels, GRID_COLS, gridFromPixels, gridRows } from './analyze'
import { createLru } from './lru'
import { readPixels } from './pixels'
import type { ChangeSpec, WorkerRequest, WorkerResponse } from './protocol'
import { scorePixels } from './score'
import type { BaselineSource, ChangeMapping, ChangeStepId, Score } from './types'

export { hasChange } from './available'
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

type AnyResult = FrameAnalysis | FrameGrid | Score
type Pending = { resolve: (result: AnyResult) => void; reject: (error: Error) => void }

/** Frames read at the same time. Each decoded image is large, so a whole data set is never held in memory at once. */
const MAX_IN_FLIGHT = 3
/** Entries each cache keeps. An evicted entry is analysed again when it is asked for. */
const CACHE_LIMIT = 128

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

function runInWorker(request: Job): Promise<AnyResult> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    try {
      getWorker().postMessage({ ...request, id })
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

async function runOnMainThread(request: Job): Promise<AnyResult> {
  const pixels = await readPixels(request.url)
  const { frame, colorScale, mapping } = request
  if (request.kind === 'grid') return gridFromPixels(pixels, frame, colorScale, mapping, request.area)
  const baseline = request.change?.baselineUrl ? await readPixels(request.change.baselineUrl) : null
  if (request.kind === 'change') {
    const input = { frameId: frame.id, colorScale, mapping: request.change.mapping, area: request.area, noiseFloor: request.change.noiseFloor }
    return scorePixels(pixels, baseline, input)
  }
  const change = request.change && { baseline, noiseFloor: request.change.noiseFloor, changeSteps: request.change.mapping.changeSteps }
  return analyzePixels(pixels, frame, request.region, colorScale, mapping, change)
}

const run = (request: Job): Promise<AnyResult> => (canUseWorker() ? runInWorker(request) : runOnMainThread(request))

// Each kind of request says what it gets back, and the answer is checked instead of trusted.
const isFrameAnalysis = (result: AnyResult): result is FrameAnalysis => 'regionId' in result
const isFrameGrid = (result: AnyResult): result is FrameGrid => 'cells' in result
const isScore = (result: AnyResult): result is Score => 'contours' in result

async function expectResult<R extends AnyResult>(request: Job, accept: (result: AnyResult) => result is R, what: string): Promise<R> {
  const result = await run(request)
  if (!accept(result)) throw new Error(`The analysis worker did not return ${what}.`)
  return result
}

const absolute = (url: string) => new URL(url, document.baseURI).href

/**
 * Where a frame's normal is, or null when the data set has no baseline (v2 is then off and the data set plays as today).
 * Anomaly product: nothing to read, the frame already is the change. Climatology: the frame's own `baselineImage`.
 * Reference date: another frame of the same data set.
 */
export function baselineSource(frame: Frame, visualization: Pick<Visualization, 'baseline' | 'frames'>): BaselineSource | null {
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

function changeSpecFor(frame: Frame, visualization: Visualization): ChangeSpec | null {
  const source = baselineSource(frame, visualization)
  const { changeSteps, contourLevels } = visualization.mapping
  if (!source || !changeSteps || !contourLevels) return null
  const mapping: ChangeMapping = { minValidFraction: visualization.mapping.minValidFraction, changeSteps, contourLevels }
  return { baselineUrl: source.image && absolute(source.image), noiseFloor: source.noiseFloor, mapping }
}

const cache = createLru<Promise<FrameAnalysis>>(CACHE_LIMIT)

/** `visualization` is optional: with a baseline it adds `changeStep` and `medianChange`; without one the result is exactly as before. */
export function analyzeFrame(frame: Frame, region: Region, colorScale: ColorScale, mapping: SoundMapping, visualization?: Visualization): Promise<FrameAnalysis> {
  const change = visualization ? changeSpecFor(frame, visualization) : null
  // The image is part of the key so two visualizations that reuse a frame id never share a result.
  const key = `${frame.id}|${region.id}|${frame.image}|${change?.baselineUrl ?? ''}|${change?.noiseFloor ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached

  const request: Job = { kind: 'frame', url: absolute(frame.image), frame, region, colorScale, mapping, ...(change && { change }) }
  const result = expectResult(request, isFrameAnalysis, 'a frame analysis')
  cache.set(key, result)
  // A failure is not cached, so a retry can succeed.
  result.catch(() => cache.delete(key))
  return result
}

export function analyzeAll(frames: Frame[], region: Region, colorScale: ColorScale, mapping: SoundMapping, visualization?: Visualization): Promise<FrameAnalysis[]> {
  return mapLimited(frames, MAX_IN_FLIGHT, frame => analyzeFrame(frame, region, colorScale, mapping, visualization))
}

/** Runs `task` for every item with at most `limit` running at once. The results keep the order of `items`. The first failure stops new work and is thrown. */
async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let failed = false
  async function lane() {
    while (!failed && next < items.length) {
      const i = next++
      try {
        results[i] = await task(items[i])
      } catch (error) {
        failed = true
        throw error
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane))
  return results
}

const gridCache = createLru<Promise<FrameGrid>>(CACHE_LIMIT)

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
  const result = expectResult(request, isFrameGrid, 'a grid')
  gridCache.set(key, result)
  result.catch(() => gridCache.delete(key))
  return result
}

const scoreCache = createLru<Promise<Score>>(CACHE_LIMIT)

/**
 * How far the whole map is from its baseline (PLAN.md §5.9): the change step, and `contours` (the lines of change, traced from the map).
 * Same input, same `Score`. Rejects for a data set with no baseline.
 */
export function analyzeChange(frame: Frame, visualization: Visualization): Promise<Score> {
  const change = changeSpecFor(frame, visualization)
  if (!change) return Promise.reject(new Error('This data set has no baseline, so there is no change to score.'))
  const area = visualization.mapArea ?? { x0: 0, y0: 0, x1: 1, y1: 1 }
  const key = `${frame.id}|${frame.image}|${change.baselineUrl ?? ''}|${change.noiseFloor}|${area.x0},${area.y0},${area.x1},${area.y1}`
  const cached = scoreCache.get(key)
  if (cached) return cached

  const request: Job = { kind: 'change', url: absolute(frame.image), frame, colorScale: visualization.colorScale, mapping: visualization.mapping, area, change }
  const result = expectResult(request, isScore, 'a score')
  scoreCache.set(key, result)
  result.catch(() => scoreCache.delete(key))
  return result
}

// Frame analysis contract (docs/PLAN.md §5.2).
// Pixels are read and analyzed in a Web Worker (see worker.ts). Without Worker or OffscreenCanvas the same
// code runs on the main thread. Results are cached per frame and region.

import type { CategoryId, ColorScale, Frame, Region, SoundMapping } from '../data'
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
}

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

// The feature extractor's public API (docs/PLAN.md §6.3, SN01).
// `extractFeatures` is the pure maths. `extractInWorker` reads one frame of a stream in a Web Worker; without Worker or
// OffscreenCanvas (jsdom, old browsers) the same code runs on the main thread with the same stream rules, and gives the same features.

import type { FeatureRequest, FeatureResponse } from './protocol'
import { runRequest, type StreamState } from './stream'
import type { ExtractInput, FrameFeatures } from './types'

export { extractFeatures } from './extract'
export { findHotspots, trackHotspots } from './hotspots'
export { edgeSummary } from './edges'
export { estimateMotion } from './motion'
export { pixelsFromBitmap } from './bitmap'
export * from './types'

type Pending = { resolve: (features: FrameFeatures) => void; reject: (error: Error) => void }

let worker: Worker | null = null
let nextId = 0
const pending = new Map<number, Pending>()
/** Streams whose next request must start fresh. */
const resets = new Set<string>()
/** The last features of each stream, for the main-thread path. */
const local: StreamState = new Map()

function failAll(error: Error) {
  pending.forEach(p => p.reject(error))
  pending.clear()
  worker?.terminate()
  worker = null
}

function getWorker(): Worker {
  if (worker) return worker
  const created = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  created.onmessage = (event: MessageEvent<FeatureResponse>) => {
    const message = event.data
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if ('error' in message) entry.reject(new Error(message.error))
    else entry.resolve(message.features)
  }
  created.onerror = () => failAll(new Error('The feature worker stopped.'))
  worker = created
  return created
}

const canUseWorker = () => typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'

/**
 * The features of one frame of `stream`. Frames of one stream must be asked for in order, one after another: the previous frame's
 * features give this one its motion and its hot-spot ids. The bitmap is closed (transferred to the worker) and cannot be used afterwards.
 */
export function extractInWorker(stream: string, bitmap: ImageBitmap, input: ExtractInput): Promise<FrameFeatures> {
  const reset = resets.delete(stream)
  const id = nextId++
  const request: FeatureRequest = { id, stream, ...(reset && { reset }), bitmap, input }

  if (!canUseWorker()) {
    try {
      return Promise.resolve(runRequest(local, request))
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      getWorker().postMessage(request, [bitmap])
    } catch (error) {
      pending.delete(id)
      // The message did not go, so the stream was not reset: ask again next time.
      if (reset) resets.add(stream)
      reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      // After a transfer this does nothing; if the transfer failed, it frees the picture.
      bitmap.close()
    }
  })
}

/** The next frame of this stream has no `previous`: playback restarted, or a new data set. */
export function resetStream(stream: string): void {
  local.delete(stream)
  resets.add(stream)
}

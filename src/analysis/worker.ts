// Runs frame analysis off the main thread, so analyzing a whole visualization never freezes the page.

import { analyzePixels, gridFromPixels } from './analyze'
import { readPixels, rememberLast } from './pixels'
import type { WorkerRequest, WorkerResponse } from './protocol'

// The grid and the region reading of the same date ask for the same image, so it is decoded once.
const read = rememberLast(readPixels)

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  let response: WorkerResponse
  try {
    const pixels = await read(request.url)
    const result = request.kind === 'grid'
      ? gridFromPixels(pixels, request.frame, request.colorScale, request.mapping, request.area)
      : analyzePixels(pixels, request.frame, request.region, request.colorScale, request.mapping)
    response = { id: request.id, result }
  } catch (error) {
    response = { id: request.id, error: error instanceof Error ? error.message : String(error) }
  }
  self.postMessage(response)
}

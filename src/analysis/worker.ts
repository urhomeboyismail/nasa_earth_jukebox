// Runs frame analysis off the main thread, so analyzing a whole visualization never freezes the page.

import { analyzePixels } from './analyze'
import { readPixels } from './pixels'
import type { WorkerRequest, WorkerResponse } from './protocol'

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, url, frame, region, colorScale, mapping } = event.data
  let response: WorkerResponse
  try {
    const pixels = await readPixels(url)
    response = { id, result: analyzePixels(pixels, frame, region, colorScale, mapping) }
  } catch (error) {
    response = { id, error: error instanceof Error ? error.message : String(error) }
  }
  self.postMessage(response)
}

// Reads frames off the main thread, so a playing animation never freezes the page. Keeps the last features of each stream (stream.ts).

import type { FeatureRequest, FeatureResponse } from './protocol'
import { runRequest, type StreamState } from './stream'

const streams: StreamState = new Map()

self.onmessage = (event: MessageEvent<FeatureRequest>) => {
  const request = event.data
  let response: FeatureResponse
  try {
    response = { id: request.id, features: runRequest(streams, request) }
  } catch (error) {
    response = { id: request.id, error: error instanceof Error ? error.message : String(error) }
  }
  self.postMessage(response)
}

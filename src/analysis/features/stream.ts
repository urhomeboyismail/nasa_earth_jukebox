// The stream rules (SN01), shared by the worker and the main-thread fallback so both give the same features:
// each stream's last features are the next frame's `previous`, and `reset` starts the stream fresh.

import { pixelsFromBitmap } from './bitmap'
import { extractFeatures } from './extract'
import type { FeatureRequest } from './protocol'
import type { FrameFeatures } from './types'

/** The last features of each stream. */
export type StreamState = Map<string, FrameFeatures>

/** Reads the request's bitmap (and closes it), extracts its features with the stream's last ones as `previous`, and remembers them. A failure leaves the stream as it was. */
export function runRequest(state: StreamState, request: FeatureRequest): FrameFeatures {
  if (request.reset) state.delete(request.stream)
  let pixels
  try {
    pixels = pixelsFromBitmap(request.bitmap)
  } finally {
    request.bitmap.close()
  }
  const features = extractFeatures(pixels, request.input, state.get(request.stream))
  state.set(request.stream, features)
  return features
}

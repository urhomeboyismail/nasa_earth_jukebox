// Messages between the page and the feature worker (SN01). The bitmap is transferred, so the page cannot use it afterwards.

import type { ExtractInput, FrameFeatures } from './types'

/** `stream` names a run of frames that follow each other (one playing animation). The worker keeps the last features of each stream. */
export type FeatureRequest = {
  id: number
  stream: string
  /** Forget the stream's last features first: playback restarted, or a new data set. */
  reset?: boolean
  bitmap: ImageBitmap
  input: ExtractInput
}

export type FeatureResponse = { id: number; features: FrameFeatures } | { id: number; error: string }

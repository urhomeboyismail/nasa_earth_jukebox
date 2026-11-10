// The live source's types (docs/PLAN.md §6.3, ticket SN06). Types only.

import type { Visualization } from '../../data'
import type { ExtractInput, FrameFeatures } from '../features/types'
import type { Pixels } from '../analyze'
import type { SequenceSpeed } from './clock'

export type LiveFrame = {
  features: FrameFeatures
  /** `dateOfVideoFrame(video, videoIndex)` (SN05) for a video frame, or the checked frame's own date in sequence mode. */
  date: string
  /** null in sequence mode. */
  videoIndex: number | null
  mediaTime: number | null
  /** `features.confidence`, repeated here for the status line. */
  confidence: number
}

/** video: the <video> is producing frames. frames: the checked PNG frames are in use (the reason says why). */
export type SourceStatus = 'idle' | 'video' | 'frames' | 'stopped' | 'error'

export type Extract = (stream: string, bitmap: ImageBitmap, input: ExtractInput) => Promise<FrameFeatures>

/** What both sources need. The three seams replace the worker, the PNG loader and the picture decoder in tests. */
export type SourceOptions = {
  visualization: Visualization
  onFrame(frame: LiveFrame): void
  onStatus(status: SourceStatus, reason?: string): void
  /** Test seam: replaces the worker call. Defaults to `extractInWorker` (SN01). */
  extract?: Extract
  /** Test seam: replaces the PNG loader (`readPixels`, kept for the last two pictures). */
  loadPixels?: (url: string) => Promise<Pixels>
  /** Test seam: turns a checked frame's picture into a bitmap. Defaults to loading the PNG and drawing it. */
  loadBitmap?: (url: string) => Promise<ImageBitmap>
  /** How long a checked frame is shown in the fallback. Default 'normal'. */
  step?: SequenceSpeed
}

export type LiveSourceOptions = SourceOptions & {
  video: HTMLVideoElement
}

export type FrameSequenceOptions = SourceOptions & {
  /** Said with the 'frames' status, for example why the checked frames are in use. */
  reason?: string
}

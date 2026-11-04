// Messages between the page and the analysis worker.

import type { ColorScale, Frame, Region, SoundMapping } from '../data'
import type { FrameAnalysis } from '.'

export type WorkerRequest = {
  id: number
  /** Absolute URL of the frame image. */
  url: string
  frame: Frame
  region: Region
  colorScale: ColorScale
  mapping: SoundMapping
}

export type WorkerResponse = { id: number; result: FrameAnalysis } | { id: number; error: string }

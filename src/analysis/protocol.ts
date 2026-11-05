// Messages between the page and the analysis worker.

import type { ColorScale, Frame, MapArea, Region, SoundMapping } from '../data'
import type { FrameAnalysis, FrameGrid } from '.'

type Shared = {
  id: number
  /** Absolute URL of the frame image. */
  url: string
  frame: Frame
  colorScale: ColorScale
  mapping: SoundMapping
}

/** `frame`: the median of a region's points. `grid`: the whole map, read into cells. */
export type WorkerRequest =
  | (Shared & { kind: 'frame'; region: Region })
  | (Shared & { kind: 'grid'; area?: MapArea })

export type WorkerResponse = { id: number; result: FrameAnalysis | FrameGrid } | { id: number; error: string }

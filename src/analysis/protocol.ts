// Messages between the page and the analysis worker.

import type { ColorScale, Frame, MapArea, Region, SoundMapping } from '../data'
import type { FrameAnalysis, FrameGrid } from '.'
import type { ChangeMapping, Score } from './types'

type Shared = {
  id: number
  /** Absolute URL of the frame image. */
  url: string
  frame: Frame
  colorScale: ColorScale
  mapping: SoundMapping
}

/** Where a frame's normal is: an image to read (null for an anomaly product), the noise floor and the steps. */
export type ChangeSpec = { baselineUrl: string | null; noiseFloor: number; mapping: ChangeMapping }

/** `frame`: the median of a region's points (and its change step when `change` is given). `grid`: the whole map, read into cells. `change`: the whole map's change from its baseline. */
export type WorkerRequest =
  | (Shared & { kind: 'frame'; region: Region; change?: ChangeSpec })
  | (Shared & { kind: 'grid'; area?: MapArea })
  | (Shared & { kind: 'change'; area: MapArea; change: ChangeSpec })

export type WorkerResponse = { id: number; result: FrameAnalysis | FrameGrid | Score } | { id: number; error: string }

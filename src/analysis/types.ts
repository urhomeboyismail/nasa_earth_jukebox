// Types of sound pipeline v2 (docs/PLAN.md §5.9). Types only, so T113 (contours) and T114 (audio) can import them without pulling in any code.

import type { ColorScale, Frame, MapArea, SoundMapping, Visualization } from '../data'

/** Row-major, row 0 north. NaN = cannot be read (missing data, land, cloud, a color off the legend). */
export type ValueField = { cols: number; rows: number; area: MapArea; values: Float32Array }

/** One of a data set's `changeSteps`, most below normal first. */
export type ChangeStepId = string

/** The part of `SoundMapping` the change maths needs. */
export type ChangeMapping = {
  minValidFraction: number
  /** Most below normal first; each starts where the one before ends. */
  changeSteps: { id: ChangeStepId; range: [number, number] }[]
  contourLevels: { value: number }[]
}

export type ChangeSummary = {
  step: ChangeStepId | 'insufficient'
  medianChange?: number
  /** One share per contour level: the readable cells at or above that level. */
  shareAbove: number[]
  validFraction: number
}

export type ContourPoint = {
  /** 0 to 1 fractions of the whole image, like `panForPoint`. */
  x: number
  y: number
  /** Turning angle at this point, radians, −π to π. */
  turn: number
  /** How steeply the change rises across the line, variable units per cell. */
  front: number
}

export type Contour = {
  level: number
  closed: boolean
  /** Ends that stop at a NaN cell (0, 1 or 2). */
  brokenEnds: number
  points: ContourPoint[]
}

export type Score = { frameId: string; change: ChangeSummary; contours: Contour[] }

/** Where a frame's normal comes from. `image` is the picture to read (null for an anomaly product: the frame already is the change). */
export type BaselineSource = { image: string | null; noiseFloor: number }

/**
 * The manifest fields v2 adds. They are optional here and in the manifest until T111 puts them in `src/data/types.ts` and the schema;
 * then these two types become plain `Frame` and `Visualization`.
 */
export type ChangeFrame = Frame & { baselineImage?: string }
export type ChangeVisualization = Omit<Visualization, 'frames' | 'mapping'> & {
  frames: ChangeFrame[]
  mapping: SoundMapping & { changeSteps?: ChangeMapping['changeSteps']; contourLevels?: ChangeMapping['contourLevels'] }
  baseline?:
    | { kind: 'anomaly-product' }
    | { kind: 'climatology'; label: string; noiseFloor: number }
    | { kind: 'reference-date'; frameId: string; label: string; noiseFloor: number }
}

export type { ColorScale, MapArea }

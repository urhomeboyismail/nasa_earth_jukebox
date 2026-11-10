// Sound pipeline v3 (docs/PLAN.md §6.3, ticket SN01): what the feature extractor reads from one frame.
// Types and constants only, so the ruleset (SN03), the descriptions (SN10) and the rest can import them without pulling in code.
// SN01 is the first v3 ticket to merge: these types are the contract every later v3 ticket reads.

import type { ColorScale, MapArea, SoundMapping } from '../../data'
import type { Pixels } from '../analyze'
import type { ChangeSummary, Contour } from '../types'

export const FEATURE_COLS = 64
export const FEATURE_ROWS = 32
/** Share of the legend's maximum colour distance a live (video) pixel may differ by: H.264 shifts colours. Data frames use 1. */
export const LIVE_COLOUR_TOLERANCE = 1.5
/** Confidence counts a pixel as agreeing with the legend only within this share of the maximum colour distance. */
export const STRICT_COLOUR_TOLERANCE = 0.5
export const HOTSPOT_MIN_CELLS = 4
export const HOTSPOTS_KEPT = 6
/** Hot spots with the same band whose centroids are this close (fraction of the image width) are the same spot. */
export const TRACK_DISTANCE = 0.12
/** Picture mode: a cell at or above this brightness is "high", at or below BRIGHTNESS_LOW is "low" (0 to 1). */
export const BRIGHTNESS_HIGH = 0.8
export const BRIGHTNESS_LOW = 0.2
/** Picture mode: the histogram has this many equal brightness bands. */
export const PICTURE_BANDS = 5
/** Two neighbouring cells differ by more than this (0 to 1 across the legend) count as an edge. */
export const EDGE_STEP = 0.1
export const MOTION_BLOCK_COLS = 8
export const MOTION_BLOCK_ROWS = 4
/** Search range in cells, each way. */
export const MOTION_SEARCH = 2
/** A block has moved only if the best shift beats "no shift" by this much (mean absolute difference, 0 to 1). */
export const MOTION_MIN_GAIN = 0.02

export type FeatureMode = 'data' | 'picture'
/** 'high' is the top band (the warmest category, or the brightest cells); 'low' the bottom band. */
export type Band = 'high' | 'low'
/** x, y: 0 to 1 fractions of the whole image. */
export type Place = { value: number; x: number; y: number }

export type Hotspot = {
  /** Stable while the spot is tracked from frame to frame: 'h1', 'h2', … New spots get new ids. */
  id: string
  band: Band
  /** 0 to 1 fractions of the whole image. */
  centroid: { x: number; y: number }
  cells: number
  /** cells / (FEATURE_COLS × FEATURE_ROWS) */
  areaShare: number
  /** Strongest cell, in grid units: the variable's unit (data) or 0 to 1 (picture). */
  peak: number
  /** The same cell as 0 to 1 across the legend (picture: brightness). */
  peakPosition: number
}

/** Motion between this frame and the previous one, in grid cells per step (a step is the gap between the two frames). */
export type Motion = {
  /** + is east */
  dx: number
  /** + is south (image rows grow downwards) */
  dy: number
  /** hypot(dx, dy) */
  speed: number
  /** Radians: 0 east, π/2 north; null when speed is 0. */
  direction: number | null
  /** Share of the blocks that moved. */
  changedShare: number
}

export type FrameFeatures = {
  frameId: string
  /** YYYY-MM-DD. For a video frame, the date its frame maps to (SN05 `dateOfVideoFrame`). */
  date: string
  mode: FeatureMode
  grid: {
    cols: number
    rows: number
    /** Row-major, row 0 north. In grid units (data: the variable's unit; picture: 0 to 1). NaN = cannot be read. */
    values: Float32Array
    /** The same cells as 0 to 1 across the legend's range (picture: brightness). NaN = cannot be read. */
    position: Float32Array
  }
  stats: {
    /** Readable cells / all cells. */
    validShare: number
    /** Grid units; null when validShare is below minValidFraction. */
    median: number | null
    /** The median as 0 to 1 across the legend (picture: brightness); null with median. */
    position: number | null
    /** 75th minus 25th percentile, grid units. */
    iqr: number | null
    min: Place | null
    max: Place | null
  }
  /** Share of the readable cells in each band: data mode, one per category (coolest first); picture mode, PICTURE_BANDS. Sums to 1, or 0s when nothing is readable. */
  histogram: number[]
  /** At most HOTSPOTS_KEPT, largest first, ties by centroid (north first, then west). */
  hotspots: Hotspot[]
  edges: {
    /** Share of the readable neighbour pairs that differ by more than EDGE_STEP. 0 when there are none. */
    density: number
    /** The longest line where the value crosses its median, or null. */
    strongest: Contour | null
  }
  /** null for the first frame of a stream, and whenever the previous frame had no readable cells. */
  motion: Motion | null
  /** null when the data set has no baseline. `shift` is −1 (most below normal) to +1 (most above), 0 at the middle step; null when the step is "insufficient". */
  change: (ChangeSummary & { shift: number | null }) | null
  /** The first readable position of this run of frames (carried from `previous`). The bass uses it when there is no baseline. */
  reference: number | null
  /** 0 to 1. Data mode: the share of readable samples that agree with the legend within STRICT_COLOUR_TOLERANCE. Picture mode: the share of opaque samples. */
  confidence: number
  /**
   * The highest hot-spot number issued so far in this stream (the 3 in 'h3'). The next new spot is `h{hotspotSerial + 1}`, so an id is never
   * issued twice, even when the spot with the highest number vanishes for a frame. Always set by `extractFeatures`; left out, it is read from the previous ids.
   */
  hotspotSerial?: number
}

export type ExtractInput = {
  frameId: string
  date: string
  mode: FeatureMode
  /** Read in data mode; ignored in picture mode (the schema still requires it). */
  colorScale: ColorScale
  /** Only `minValidFraction`, `categories` (for the histogram and hot spots) and `changeSteps` (for `shift`) are read. */
  mapping: SoundMapping
  /** The map, as fractions of the image (`mapArea` or the whole image). */
  area: MapArea
  /** Multiplies `colorScale.maxColorDistance`. Default 1. Use LIVE_COLOUR_TOLERANCE for video. */
  colourTolerance?: number
  /** Only for a data set with a baseline. `pixels` null means an anomaly product: the frame already is the change. */
  baseline?: { pixels: Pixels | null; noiseFloor: number }
}

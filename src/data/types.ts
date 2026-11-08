// The content data contract (docs/PLAN.md §5.1). Hand-written so every ticket can build on it from day 1.
// T30 adds Zod schemas whose inferred types must equal these; change both together, and only after agreeing
// with everyone who uses them.

export type RGB = [number, number, number]

/** A category id from `mapping.categories`, for example "warm". */
export type CategoryId = string

/** The request's "LegendMetadata". */
export type ColorScale = {
  /** Ordered by value, from NASA's legend. */
  stops: { value: number; rgb: RGB }[]
  /** Land, labels, missing pixels: never read as a value. */
  noData: RGB[]
  /** Above this RGB distance a pixel is "unmatched", not a guess. */
  maxColorDistance: number
}

/** A region's `points` are the request's "SamplingPoint"s. */
export type Region = {
  id: string
  name: string
  description: string
  /** Fractions of the image, 0 to 1, the same on every date. */
  points: { x: number; y: number }[]
}

export type Frame = {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** Relative to the manifest in the data file; full URL once loaded. */
  image: string
  width: number
  height: number
  altText: string
  note?: string
  /**
   * v2, climatology baselines only: this frame's normal, a picture of the same size, area and legend. Relative to the manifest in the data
   * file; full URL once loaded. Never resampled: a baseline of another size is rejected by `npm run check-data`.
   */
  baselineImage?: string
}

/** The request's "DataCategory". */
export type Category = {
  id: CategoryId
  label: string
  range: [number, number]
  /** A note name such as "C4". */
  note: string
}

/** One of the five steps of "how far from normal", most below normal first (v2, docs/PLAN.md §5.1). `note` is the bed's pitch, C3 to C4. */
export type ChangeStep = {
  id: string
  label: string
  range: [number, number]
  note: string
}

/** A fixed change to trace as a line, for example +1 °C (v2). `note` is the contour voice's pitch, C3 to C6. */
export type ContourLevel = { value: number; note: string }

export type SoundMapping = {
  scale: string
  summary: 'median'
  minValidFraction: number
  /** Coolest first. */
  categories: Category[]
  tick: { note: string; durationMs: number }
  missingCue: { type: 'noise'; durationMs: number }
  /** v2: five steps, most below normal first, each starting where the one before ends. Comes with `baseline` and `contourLevels`, or not at all. */
  changeSteps?: ChangeStep[]
  /** v2: the fixed change levels to trace, lowest first. */
  contourLevels?: ContourLevel[]
}

/**
 * What a frame's change is measured against (v2, docs/PLAN.md §5.1). Prefer them in this order: `anomaly-product` (NASA has already
 * subtracted the normal), `climatology` (the same calendar month's long-term average, one `baselineImage` per frame), `reference-date`
 * (one earlier frame, always called "change since <date>", never "anomaly"). `noiseFloor` is in the variable's unit: a smaller change is
 * legend rounding and counts as 0.
 */
export type Baseline =
  | { kind: 'anomaly-product' }
  | { kind: 'climatology'; label: string; noiseFloor: number }
  | { kind: 'reference-date'; frameId: string; label: string; noiseFloor: number }

export type Comparison = {
  id: string
  regionId: string
  frameA: string
  frameB: string
  question: string
  answer: 'a' | 'b' | 'same'
  explanation: string
}

/** The part of the image that is map, as fractions 0 to 1 (x0 < x1, y0 < y1). Leaves out legend bars and titles. */
export type MapArea = { x0: number; y0: number; x1: number; y1: number }

/** One chapter of the story mode. fromFrame and toFrame are frame ids; fromFrame comes first in date order. */
export type StoryChapter = { id: string; title: string; text: string; fromFrame: string; toFrame: string }

/** The request's "FrameManifest": one data set's manifest.json. */
export type Visualization = {
  id: string
  title: string
  summary: string
  description: string
  variable: { name: string; unit: string }
  source: { name: string; url: string; credit: string; license: string; retrievedOn: string }
  colorScale: ColorScale
  regions: Region[]
  frames: Frame[]
  mapping: SoundMapping
  comparisons: Comparison[]
  /** Default: the whole image. */
  mapArea?: MapArea
  story?: StoryChapter[]
  /** v2. Comes with `mapping.changeSteps` and `mapping.contourLevels`, or not at all; without them the data set plays exactly as before. */
  baseline?: Baseline
}

export type CatalogEntry = { id: string; title: string; summary: string }

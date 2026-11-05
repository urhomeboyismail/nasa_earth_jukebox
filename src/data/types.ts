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
}

/** The request's "DataCategory". */
export type Category = {
  id: CategoryId
  label: string
  range: [number, number]
  /** A note name such as "C4". */
  note: string
}

export type SoundMapping = {
  scale: string
  summary: 'median'
  minValidFraction: number
  /** Coolest first. */
  categories: Category[]
  tick: { note: string; durationMs: number }
  missingCue: { type: 'noise'; durationMs: number }
}

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
}

export type CatalogEntry = { id: string; title: string; summary: string }

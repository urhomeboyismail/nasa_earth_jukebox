// The content data contract (docs/PLAN.md §5.1). Hand-written so every ticket can build on it from day 1.
// T30 adds Zod schemas whose inferred types must equal these; change both together, and only after agreeing
// with everyone who uses them.

import type { DetailLevel, LegendKind, PresetId, VoiceId } from './sonification'

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

/**
 * The words for comparing values (F36). `higher`/`lower` ("warmer"), `highest`/`lowest` ("warmest"), `edge` ("warm edge", the boundary
 * the change style traces) and `thing` ("water", what the value is about; may be empty). Any left out use the defaults in words.ts.
 */
export type VariableWords = { higher: string; lower: string; highest: string; lowest: string; edge: string; thing: string }

/** The animation a live reader plays (SN06). The file is in the data set's folder. Video frame n shows the date `firstFrameDate + n × frameStepDays`. */
export type VideoSpec = {
  /** Relative to the manifest, for example "video/<id>.mp4". Same origin: an H.264 MP4 the site serves itself. */
  src: string
  /** Video frames a second, 1 to 60. */
  fps: number
  /** YYYY-MM-DD: the date shown in the first video frame. */
  firstFrameDate: string
  /** Whole days between consecutive video frames, 1 or more. */
  frameStepDays: number
}

/**
 * How the data set is sonified by default (SN07). Every field after `preset` is optional. `voices`, when given, is a non-empty list of
 * distinct voice ids; a voice left out is never sounded for this data set.
 */
export type SonificationSpec = { preset: PresetId; detail?: DetailLevel; voices?: VoiceId[]; timbre?: TimbreSpec }

/**
 * How the live voices sound for this data set (SN14). General, never tied to a named measure, and every field optional: left out, the voices
 * sound exactly as before. `instrument` 'fm' gives every pitched voice an FM oscillator; `filterHz` is the low-pass range brightness moves
 * through, along `curve`; `panWidth` (0 to 1) scales how far left and right the voices are placed.
 */
export type TimbreSpec = { instrument?: TimbreInstrument; filterHz?: { low: number; high: number }; curve?: TimbreCurve; panWidth?: number }
export type TimbreInstrument = 'synth' | 'fm'
export type TimbreCurve = 'linear' | 'exponential'

/** The look of Echo's jet trail (JB04). A style, never the name of a data set. */
export type MascotTrail = 'sparks' | 'bubbles' | 'ions' | 'pulse'

/**
 * How Echo looks while this data set is open (JB04). `accent` is a colour written "#rrggbb" for the boots, headphones and trail; without it, or
 * with too little contrast against Echo's visor, Echo takes the most saturated colour of `colorScale`, then the theme's primary colour.
 * `trail` defaults to 'sparks'. Read it with `mascotTheme` (src/features/mascot/accent.ts).
 */
export type MascotSpec = { accent?: string; trail?: MascotTrail }

/** The request's "FrameManifest": one data set's manifest.json. */
export type Visualization = {
  id: string
  title: string
  summary: string
  description: string
  variable: { name: string; unit: string; words?: Partial<VariableWords> }
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
  /** v3: 'data' (default) when the colour bar decodes values; 'picture' for true-colour imagery with no measured values (the extractor reads brightness). Read it with `legendOf`. */
  legend?: LegendKind
  /** v3: the animation for live reading. Optional; without it, Symphony reads the checked frames. */
  video?: VideoSpec
  /** v3: the default sonification. Optional; without it, Listen uses preset 'major', detail 'standard', all seven voices. */
  sonification?: SonificationSpec
  /** Echo's accent and jet trail for this data set. Optional; without it, the accent comes from `colorScale` and the trail is 'sparks'. */
  mascot?: MascotSpec
  /** Data sets this one can be heard together with in Compare ("Two data sets"), each with the reason the pair is meaningful. Optional; default none. */
  pairsWith?: { id: string; note: string }[]
}

export type CatalogEntry = { id: string; title: string; summary: string }

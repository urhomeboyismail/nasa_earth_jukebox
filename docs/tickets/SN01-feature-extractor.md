# SN01 Feature extractor: `FrameFeatures` from any frame

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/SN01-feature-extractor` |

## Goal

`extractFeatures(pixels, input, previous?)` reads one frame into `FrameFeatures`: a 64 × 32 grid, the statistics, a histogram, the hot spots with ids that stay the same from frame to frame, the edges, the motion, the change from the baseline (when there is one) and a confidence. It works in **data mode** (the colour bar decodes the values) and in **picture mode** (no colour bar: brightness). It is pure, runs in a worker, and gives the same output for the same input.

Every later v3 ticket reads these types. SN01 is the first ticket to merge, so its types are the contract.

## Why

- `src/analysis/analyze.ts` `analyzePixels` reduces a region to one median and one category. `gridFromPixels` (analyze.ts, `GRID_COLS = 24`) makes a 24-column sound map. Neither keeps shape, so nothing can tell a warm pool from a warm edge.
- `src/analysis/field.ts` `readField` already reads a value per cell through `valueAtPixel`, with a 3 × 3 lattice and `MIN_LATTICE_SAMPLES = 5`. Reuse it. Do not write a second pixel reader.
- `src/analysis/worker.ts` only knows the `frame`, `grid` and `change` requests (`protocol.ts`). Live video (SN06) and offline rendering (SN12) need frames that arrive as an `ImageBitmap`, not as a URL, so a new worker entry point is needed.
- `src/analysis/pixels.ts` `readPixels(url)` decodes a URL. There is no function that turns a bitmap into `Pixels`.

## Design

Files, all under `src/analysis/features/` (new folder, team leader's area, `PLAN.md` §4):

| File | Contents |
|---|---|
| `types.ts` | Every type below, and the constants below. Types and constants only. |
| `extract.ts` | `extractFeatures` (pure). |
| `hotspots.ts` | `findHotspots`, `trackHotspots` (pure). |
| `edges.ts` | `edgeSummary` (pure). |
| `motion.ts` | `estimateMotion` (pure). |
| `bitmap.ts` | `pixelsFromBitmap(bitmap: ImageBitmap): Pixels`. |
| `protocol.ts` | Worker messages. |
| `worker.ts` | Worker entry point; keeps the last features per `stream`. |
| `index.ts` | Public API: `extractFeatures`, `extractInWorker(stream, bitmap, input)`, `resetStream(stream)`. |

### Constants (`types.ts`, named, never inline)

```ts
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
```

### Types (`types.ts`)

```ts
import type { ChangeSummary, Contour } from '../types'   // src/analysis/types.ts

export type FeatureMode = 'data' | 'picture'
/** 'high' is the top band (the warmest category, or the brightest cells); 'low' the bottom band. */
export type Band = 'high' | 'low'
export type Place = { value: number; x: number; y: number }   // x, y: 0 to 1 fractions of the whole image

export type Hotspot = {
  /** Stable while the spot is tracked from frame to frame: 'h1', 'h2', … New spots get new ids. */
  id: string
  band: Band
  centroid: { x: number; y: number }   // 0 to 1 fractions of the whole image
  cells: number
  areaShare: number                    // cells / (FEATURE_COLS × FEATURE_ROWS)
  peak: number                         // strongest cell, in grid units: the variable's unit (data) or 0 to 1 (picture)
  peakPosition: number                 // the same cell as 0 to 1 across the legend (picture: brightness)
}

/** Motion between this frame and the previous one, in grid cells per step (a step is the gap between the two frames). */
export type Motion = {
  dx: number                // + is east
  dy: number                // + is south (image rows grow downwards)
  speed: number             // hypot(dx, dy)
  direction: number | null  // radians: 0 east, π/2 north; null when speed is 0
  changedShare: number      // share of the blocks that moved
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
    validShare: number                 // readable cells / all cells
    median: number | null              // grid units; null when validShare is below minValidFraction
    position: number | null            // the median as 0 to 1 across the legend (picture: brightness); null with median
    iqr: number | null                 // 75th minus 25th percentile, grid units
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
```

`ColorScale`, `SoundMapping` and `MapArea` come from `src/data` (`types.ts`). `Pixels` comes from `src/analysis/analyze.ts`.

### Function signatures

```ts
// extract.ts
export function extractFeatures(pixels: Pixels, input: ExtractInput, previous?: FrameFeatures): FrameFeatures

// hotspots.ts
/** `bandOf(cell)` gives 'high', 'low' or null for each cell index (row-major). The grid is read, not copied. */
export function findHotspots(grid: { cols: number; rows: number; values: Float32Array; position: Float32Array }, area: MapArea, bandOf: (cell: number) => Band | null): Hotspot[]
export function trackHotspots(previous: Hotspot[], current: Hotspot[]): Hotspot[]

// motion.ts
export function estimateMotion(previous: Float32Array, current: Float32Array, cols: number, rows: number): Motion

// bitmap.ts
export function pixelsFromBitmap(bitmap: ImageBitmap): Pixels

// index.ts (main thread)
export function extractInWorker(stream: string, bitmap: ImageBitmap, input: ExtractInput): Promise<FrameFeatures>
export function resetStream(stream: string): void   // the next frame of this stream has no `previous`
```
The exact parameters of `findHotspots` are the implementer's choice. The return types above are the contract.

### The steps (`extractFeatures`)

1. **Read the grid.** The lattice reads every cell with the same 3 × 3 samples as `readField`.
   - Data mode: `readField(pixels, scale, area, 64, 32)` with `scale = { ...colorScale, maxColorDistance: colorScale.maxColorDistance × (colourTolerance ?? 1) }`. `position = (value − stops[0].value) / (last stop − first stop)`, clamped to 0 to 1.
   - Picture mode: each opaque sample has brightness `Y = (0.2126 R + 0.7152 G + 0.0722 B) / 255`; a cell is the median of its samples (at least `MIN_LATTICE_SAMPLES`). `values = position = Y`. A sample that is not fully opaque (alpha below 255) is unreadable.
2. **Stats.** Over the readable cells. `validShare` is readable ÷ all. If `validShare < mapping.minValidFraction`, `median`, `position`, `iqr`, `min`, `max` are all `null` and steps 3 to 6 still run (they give empty or zero results). `min` and `max` are the cell centre of the first cell in row-major order with that value.
3. **Histogram.** Data mode: the band of a cell is `stepFor(value, mapping.categories)` (`src/analysis/change.ts`, which uses the same edge rule as `categoryFor`); the bands are the category ids in order. Picture mode: `band = min(PICTURE_BANDS − 1, floor(position × PICTURE_BANDS))`.
4. **Hot spots** (`hotspots.ts`). The "high" cells are the warmest category (data mode) or `position ≥ BRIGHTNESS_HIGH` (picture). The "low" cells are the coolest category or `position ≤ BRIGHTNESS_LOW`. Group each band's cells into 4-connected components. Keep a component with at least `HOTSPOT_MIN_CELLS` cells. `centroid` is the mean of the cell centres. `peak` is the largest value (high) or the smallest (low); `peakPosition` is the same cell's position. Sort by cells (largest first), then centroid y, then centroid x. Keep `HOTSPOTS_KEPT`. Then **track**: each spot takes the id of the nearest spot in `previous.hotspots` with the same band, if the centroids are within `TRACK_DISTANCE`. Matching is greedy: the closest pairs first, each previous spot used once, ties by previous order. A spot with no match takes `h{n}`, where `n` is one more than the largest number among the previous ids (and 1 when there is no previous frame). Ids never repeat within a stream.
5. **Edges** (`edges.ts`). Count the horizontal and vertical neighbour pairs where both cells are readable (`pairs`) and `|Δposition| > EDGE_STEP` (`edges`). `density = edges / pairs` (0 when `pairs` is 0). `strongest`: `traceContours` on a `ValueField` made from `position` (the same `area`), at the median position, then `pickContours(lines, 1)[0] ?? null`. No line when the median is `null`.
6. **Motion** (`motion.ts`). Only when `previous` exists, its grid has the same size, and its `position` is readable. Blocks are `MOTION_BLOCK_COLS × MOTION_BLOCK_ROWS` cells (8 × 4), so 8 × 8 blocks on the 64 × 32 grid. For each block, try every shift `(dx, dy)` with `|dx|, |dy| ≤ MOTION_SEARCH`. The current cell `(x, y)` is compared with the previous cell `(x − dx, y − dy)`. A pattern that moved east by two cells therefore gives `dx = 2`. Score each shift by the mean absolute difference of `position` over the pairs where both cells are readable. A shift needs at least half the block's pairs. The best shift is the lowest score; ties go to the smaller `|dx| + |dy|`, then smaller `dy`, then smaller `dx`. A block **moved** when its best shift is not `(0, 0)` and it beats `(0, 0)` by at least `MOTION_MIN_GAIN`. `dx`, `dy` are the means over the moved blocks. `changedShare` is moved blocks ÷ blocks with a readable shift. With no moved block: `dx = dy = 0`, `speed = 0`, `direction = null`.
7. **Change** (only with `input.baseline`). `changeField(readField(frame), baseline ? readField(baseline.pixels) : null, noiseFloor)`, then `summarizeChange(change, { minValidFraction, changeSteps: mapping.changeSteps, contourLevels: [] })`. `shift = (index − (n − 1) / 2) / ((n − 1) / 2)`, where `index` is the step's place in `changeSteps` and `n` is its count. A baseline image of another size throws `"The baseline image must be the same size as the frame."`. Without a baseline, `change` is `null`.
8. **Reference.** `reference = previous ? (previous.reference ?? previous.stats.position) : stats.position`. It stays the same along a run. Use `previous.reference ?? previous.stats.position`, not a new value, so the run keeps its first position.
9. **Confidence.** Lattice samples (9 per cell) read at `colourTolerance`, and the same samples read at `STRICT_COLOUR_TOLERANCE`. `confidence = strict ÷ readable`, 0 when nothing is readable. Picture mode: opaque samples ÷ all samples.

### The stream and the worker (`worker.ts`, `protocol.ts`, `index.ts`)

```ts
type FeatureRequest = { id: number; stream: string; reset?: boolean; bitmap: ImageBitmap; input: ExtractInput }
type FeatureResponse = { id: number; features: FrameFeatures } | { id: number; error: string }
```
- The worker keeps `Map<stream, FrameFeatures>`. Each request passes the stream's last features as `previous`, then stores the result. `reset: true` clears the stream first (playback restarted, or a new data set).
- `extractInWorker` closes the bitmap after posting it (transfer it with `postMessage(…, [bitmap])`). Without `Worker` or `OffscreenCanvas` (jsdom, old browsers), it runs `extractFeatures` on the main thread with the same stream rules. The result is the same.
- Pixels from a bitmap: `pixelsFromBitmap` uses `OffscreenCanvas` and `getImageData` as `readPixels` does (`pixels.ts`).

## Reuse

- `Pixels`, `valueAtPixel` (`src/analysis/analyze.ts`).
- `readField`, `MIN_LATTICE_SAMPLES` (`src/analysis/field.ts`).
- `changeField`, `summarizeChange`, `stepFor` (`src/analysis/change.ts`).
- `traceContours`, `pickContours` (`src/analysis/contour.ts`).
- `median` (`src/analysis/median.ts`).
- `ChangeSummary`, `Contour`, `ValueField` (`src/analysis/types.ts`).
- `readPixels`, `rememberLast` (`src/analysis/pixels.ts`); `decodePng` (`src/analysis/png.ts`) in tests only.
- `installFakeWorker` (`src/test/fakes.ts`).
- Do not add a second pixel reader, a second median or a second contour tracer.

## Touches

- New: `src/analysis/features/**` (all files listed above), including tests and `src/analysis/features/__golden__/features.json`.
- Do not edit `analyze.ts`, `field.ts`, `change.ts`, `contour.ts` or `worker.ts`. If one of them is missing an export you need, post on `docs/AGENT-BOARD.md` for the team leader.

## Steps

1. Read `src/analysis/field.ts`, `change.ts`, `contour.ts`, `analyze.ts` (`valueAtPixel`) and `score.ts`. Write `types.ts` first, exactly as above, and commit it alone.
2. Write `bitmap.ts`, `hotspots.ts` (with `trackHotspots`), `edges.ts`, `motion.ts`, then `extract.ts`. Each step has its own unit test before the next.
3. Write `protocol.ts`, `worker.ts`, `index.ts` (worker path and main-thread path).
4. Write the golden test (see Tests). Run `npx vitest run -u src/analysis/features/golden.test.ts` once, then read the diff of `__golden__/features.json` before you commit it.
5. Run the checks. Record the time to extract one 800 × 400 frame in Result (on this laptop, in jsdom it is only indicative).

## Tests

Tests sit next to the code. Use the fixture and the synthetic sets, read with `decodePng`, as `src/data/change-regression.test.ts` does.

- **Uniform frame.** Every cell at the middle legend value: `median` equals that value, `position` 0.5, one histogram band at 1, no hot spots, `edges.density` 0, `motion` null on the first frame.
- **Warm square.** A 6 × 4 cell square at the top of the legend, on a uniform field: one `high` hot spot, `cells` 24, centroid within 0.01 of the square's centre, `areaShare` 24 ÷ 2048.
- **Tracking.** The square moved east by 2 cells: the same id (`h1`), `motion.dx` 2, `dy` 0, `speed` 2, `direction` 0.
- **Land.** A frame with fewer readable cells than `minValidFraction`: `median`, `position` null; no hot spots; `strongest` null.
- **Picture mode.** A grey left-to-right ramp: `position` rises from west to east, the histogram has `PICTURE_BANDS` entries.
- **Determinism.** The same input twice gives `toEqual` features (grid bytes included).
- **Golden.** `src/analysis/features/golden.test.ts` runs the fixture, `synthetic-ocean`, `synthetic-globe` and `synthetic-change` (all frames, with `previous` carried), and records per frame: the stats, the histogram, the hot spots (ids, cells, centroids), the edge density, the motion, the change step, the confidence, and an FNV-1a hash of the grid's `values` bytes. Any change to the maths shows in the diff.
- **Worker.** With `installFakeWorker`, two frames on one stream: the second request carries the first's features as `previous`; `resetStream` makes the next request start fresh. Without a Worker the main-thread path gives the same features.
- **Boundary.** `src/boundary.test.ts` already covers `analysis/**`. Nothing in `features/` may call `fetch` or import `assistant`.

## Guardrails

- The same input always gives the same features (no `Math.random`, no `Date`, no hash-order dependence).
- Nothing data-set-specific in `src/`: no names, units or dates from a data set. The golden file is the only place a data set is named.
- No model. No network. Pixels come in through the caller.
- Features are numbers; words come later (SN10).

## Done when

- `extractFeatures` returns every field above for data and picture mode, and for a frame with a baseline.
- Hot spot ids stay the same across the tracked frames of a test sequence, and a new spot gets a new id.
- The golden file exists.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data                          # only if public/data/ changed (it should not)
```

## Out of scope

- Sound, the ruleset and words (SN03, SN10).
- Reading video (SN06). This ticket takes a bitmap; it does not decode video.
- Motion across more than one step, or across dates that are far apart. The speed is per step, whatever the step is.
- The synthetic data sets that prove the motion and hot-spot answers (SN02).

## Result

Not started.

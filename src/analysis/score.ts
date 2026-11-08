// Sound pipeline v2 (docs/PLAN.md §5.9): one frame and its baseline in, one `Score` out. Pure, so a test and the worker run the same code.

import type { ColorScale, MapArea } from '../data'
import type { Pixels } from './analyze'
import { changeField, smoothField, summarizeChange } from './change'
import { pickContours, traceContours } from './contour'
import { readField } from './field'
import type { ChangeMapping, Score, ValueField } from './types'

/** Cells across the map: 2° cells for a global map. Contours on a coarser grid are staircases. */
export const CHANGE_COLS = 180
const MIN_ROWS = 20
const MAX_ROWS = 180

/** Rows that keep cells near-square: 90 for a 2:1 global map. */
export function changeRows(widthPx: number, heightPx: number, area: MapArea): number {
  const rows = Math.round((CHANGE_COLS * (area.y1 - area.y0) * heightPx) / ((area.x1 - area.x0) * widthPx))
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, rows))
}

export type ScoreInput = { frameId: string; colorScale: ColorScale; mapping: ChangeMapping; area: MapArea; noiseFloor: number }

/**
 * Smoothing evens out single-cell noise so the lines are not jagged, but `smoothField` also fills a NaN cell that has readable
 * neighbours. A line must never cross land, cloud or labels, so the cells that could not be read stay unreadable.
 */
function smoothKeepingGaps(change: ValueField): ValueField {
  const smooth = smoothField(change)
  const values = smooth.values.map((v, i) => (Number.isNaN(change.values[i]) ? NaN : v))
  return { ...smooth, values }
}

/**
 * `baseline` null means an anomaly product: the frame already is the change. The summary reads the raw change; the contours trace the
 * smoothed one, the longest line at each of `mapping.contourLevels`. With too little readable data (`"insufficient"`) there are no lines.
 */
export function scorePixels(pixels: Pixels, baseline: Pixels | null, input: ScoreInput): Score {
  const { colorScale, mapping, area } = input
  if (baseline && (baseline.width !== pixels.width || baseline.height !== pixels.height)) {
    throw new Error('The baseline image must be the same size as the frame.')
  }
  const rows = changeRows(pixels.width, pixels.height, area)
  const frameField = readField(pixels, colorScale, area, CHANGE_COLS, rows)
  const baselineField = baseline ? readField(baseline, colorScale, area, CHANGE_COLS, rows) : null
  const change = changeField(frameField, baselineField, input.noiseFloor)
  const summary = summarizeChange(change, mapping)
  if (summary.step === 'insufficient') return { frameId: input.frameId, change: summary, contours: [] }
  const smoothed = smoothKeepingGaps(change)
  const contours = pickContours(mapping.contourLevels.flatMap(level => traceContours(smoothed, level.value)))
  return { frameId: input.frameId, change: summary, contours }
}

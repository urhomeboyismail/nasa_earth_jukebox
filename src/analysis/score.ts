// Sound pipeline v2 (docs/PLAN.md §5.9): one frame and its baseline in, one `Score` out. Pure, so a test and the worker run the same code.

import type { ColorScale, MapArea } from '../data'
import type { Pixels } from './analyze'
import { changeField, summarizeChange } from './change'
import { readField } from './field'
import type { ChangeMapping, Score } from './types'

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

/** `baseline` null means an anomaly product: the frame already is the change. `contours` stays empty until T113 traces them. */
export function scorePixels(pixels: Pixels, baseline: Pixels | null, input: ScoreInput): Score {
  const { colorScale, mapping, area } = input
  if (baseline && (baseline.width !== pixels.width || baseline.height !== pixels.height)) {
    throw new Error('The baseline image must be the same size as the frame.')
  }
  const rows = changeRows(pixels.width, pixels.height, area)
  const frameField = readField(pixels, colorScale, area, CHANGE_COLS, rows)
  const baselineField = baseline ? readField(baseline, colorScale, area, CHANGE_COLS, rows) : null
  const change = changeField(frameField, baselineField, input.noiseFloor)
  return { frameId: input.frameId, change: summarizeChange(change, mapping), contours: [] }
}

// The explorer's probe (docs/PLAN.md §6.3 "Explore", ticket SN09): the value under the cursor or finger as one continuous tone, and a slope cue
// that brightens the tone where the values rise towards the neighbouring cells. Pure: the same grid and cell always give the same tone.

import type { FrameGrid } from '../analysis'
import { elevationForPoint, panForPoint } from '../audio/pan'
import type { HeldTone } from '../audio/ensemble/types'
import type { ColorScale } from '../data'
import { snapToScale } from './presets'
import type { Preset } from './types'

/** C3: the lowest value of the legend. */
export const PROBE_LOW_MIDI = 48
/** Three octaves: the highest value of the legend is C6. */
export const PROBE_SPAN = 36
export const PROBE_LEVEL = 0.6
/** A neighbour a quarter of the legend's range higher is a full slope. */
export const SLOPE_SCALE = 0.25

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** The legend's range, last stop minus first. */
function rangeOf(colorScale: ColorScale): { first: number; span: number } {
  const { stops } = colorScale
  const first = stops[0]?.value ?? 0
  const last = stops[stops.length - 1]?.value ?? first
  return { first, span: last - first }
}

/** The value of a cell, or null when the cell is off the grid or has no value. */
function valueAt(grid: FrameGrid, col: number, row: number): number | null {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null
  const value = grid.cells[row * grid.cols + col]?.value
  return value === null || value === undefined || !Number.isFinite(value) ? null : value
}

/**
 * −1 to +1: the mean over the cell's readable neighbours (up, down, left, right) of how much higher each one is, a quarter of the legend's range
 * counting as a full slope. Positive when the values rise around the cell. 0 for a cell with no value or no readable neighbour.
 */
export function slopeAt(colorScale: ColorScale, grid: FrameGrid, col: number, row: number): number {
  const here = valueAt(grid, col, row)
  const { span } = rangeOf(colorScale)
  if (here === null || span <= 0) return 0
  const around = [valueAt(grid, col, row - 1), valueAt(grid, col, row + 1), valueAt(grid, col - 1, row), valueAt(grid, col + 1, row)]
    .filter((value): value is number => value !== null)
  if (!around.length) return 0
  const mean = around.reduce((sum, value) => sum + (value - here) / (span * SLOPE_SCALE), 0) / around.length
  return clamp(mean, -1, 1)
}

/**
 * The tone for one cell: pitch from the value along the legend, snapped to the preset's scale over three octaves; pan and height from the cell's
 * place on the grid; brightness from the slope (0.5 when flat). `null` for a cell with no value: the caller plays the dropout cue instead.
 */
export function probeTone(colorScale: ColorScale, grid: FrameGrid, col: number, row: number, preset: Preset): HeldTone | null {
  const value = valueAt(grid, col, row)
  if (value === null) return null
  const { first, span } = rangeOf(colorScale)
  const position = span > 0 ? clamp((value - first) / span, 0, 1) : 0
  return {
    midi: snapToScale(PROBE_LOW_MIDI + position * PROBE_SPAN, preset, PROBE_LOW_MIDI, PROBE_LOW_MIDI + PROBE_SPAN),
    level: PROBE_LEVEL,
    pan: panForPoint((col + 0.5) / grid.cols),
    elevation: elevationForPoint((row + 0.5) / grid.rows),
    brightness: 0.5 + slopeAt(colorScale, grid, col, row) / 2,
  }
}

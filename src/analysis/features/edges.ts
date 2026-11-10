// Edges (docs/PLAN.md §6.3): how busy a frame is, and the longest line where it crosses its own median.
// Pure. Reads the contour tracer the change maps use; there is no second one.

import type { MapArea } from '../../data'
import { pickContours, traceContours } from '../contour'
import type { Contour } from '../types'
import { EDGE_STEP } from './types'

/**
 * `position` is the frame's cells as 0 to 1 across the legend (NaN = cannot be read). `density` is the share of the horizontal and
 * vertical neighbour pairs, both readable, that differ by more than EDGE_STEP (0 when there is no such pair). `strongest` is the longest
 * line where the position crosses `medianPosition`, or null when that is null or there is no line.
 */
export function edgeSummary(
  grid: { cols: number; rows: number; position: Float32Array },
  area: MapArea,
  medianPosition: number | null,
): { density: number; strongest: Contour | null } {
  const { cols, rows, position } = grid
  let pairs = 0
  let edges = 0
  const compare = (a: number, b: number) => {
    if (Number.isNaN(a) || Number.isNaN(b)) return
    pairs++
    if (Math.abs(a - b) > EDGE_STEP) edges++
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const here = position[row * cols + col]
      if (col + 1 < cols) compare(here, position[row * cols + col + 1])
      if (row + 1 < rows) compare(here, position[(row + 1) * cols + col])
    }
  }
  const strongest = medianPosition === null
    ? null
    : (pickContours(traceContours({ cols, rows, area, values: position }, medianPosition), 1)[0] ?? null)
  return { density: pairs ? edges / pairs : 0, strongest }
}

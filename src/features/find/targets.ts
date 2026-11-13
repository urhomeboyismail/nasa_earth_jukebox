// What the find game asks for (ticket IX04), on the sound map's grid. Pure, from one frame's features (SN01), so any data set gives targets and the same
// frame always gives the same ones. The levels are difficulty, never data: nothing here names a data set.

import type { FrameFeatures } from '../../analysis/features/types'
import type { MapArea } from '../../data'
import { cellOfFraction } from '../../interaction/notes'

/** `highest`: the highest value on the map. `edge`: the middle of the longest line where the value crosses its median. `spot`: the largest hot spot. */
export type TargetKind = 'highest' | 'edge' | 'spot'
export type Target = { kind: TargetKind; col: number; row: number; position: number }
export type Targets = Record<TargetKind, Target | null>
export type Level = 1 | 2 | 3

export const LEVELS: readonly Level[] = [1, 2, 3]
/** Level 1 is the highest place; level 2 adds the edge; level 3 adds the largest hot spot. A target the frame does not have is left out. */
const LEVEL_KINDS: Record<Level, TargetKind[]> = { 1: ['highest'], 2: ['highest', 'edge'], 3: ['highest', 'edge', 'spot'] }

type Shape = Pick<FrameFeatures, 'grid' | 'edges' | 'hotspots'>

/** The middle of a feature-grid cell as a fraction of the whole image. */
const cellCentre = (features: Shape, col: number, row: number, area: MapArea) => ({
  x: area.x0 + ((col + 0.5) / features.grid.cols) * (area.x1 - area.x0),
  y: area.y0 + ((row + 0.5) / features.grid.rows) * (area.y1 - area.y0),
})

/**
 * The targets of one frame on a sound map of `cols` × `rows` over `area`. The highest place is the first cell (row by row, from the north-west) with the
 * largest readable value; a frame with no readable cell has none. The edge is the middle point of `edges.strongest`. The spot is the centroid of the
 * largest hot spot. SN01's change summary has no places, so the largest hot spot stands for "the biggest change".
 */
export function targetsFor(features: Shape, cols: number, rows: number, area: MapArea): Targets {
  const { values, position } = features.grid
  let best = -1
  for (let i = 0; i < values.length; i++) if (!Number.isNaN(values[i]) && (best < 0 || values[i] > values[best])) best = i
  const highest = best < 0 ? null : (() => {
    const centre = cellCentre(features, best % features.grid.cols, Math.floor(best / features.grid.cols), area)
    return { kind: 'highest' as const, ...cellOfFraction(centre.x, centre.y, area, cols, rows), position: Number.isNaN(position[best]) ? 0.5 : position[best] }
  })()

  const line = features.edges.strongest?.points ?? []
  const middle = line[Math.floor(line.length / 2)]
  const edge = middle ? { kind: 'edge' as const, ...cellOfFraction(middle.x, middle.y, area, cols, rows), position: 0.5 } : null

  const largest = [...features.hotspots].sort((a, b) => b.cells - a.cells)[0]
  const spot = largest ? { kind: 'spot' as const, ...cellOfFraction(largest.centroid.x, largest.centroid.y, area, cols, rows), position: largest.peakPosition } : null

  return { highest, edge, spot }
}

/** The targets of a level, in order. */
export function levelTargets(targets: Targets, level: Level): Target[] {
  return LEVEL_KINDS[level].flatMap(kind => (targets[kind] ? [targets[kind]] : []))
}

/** How far the cursor is from a target, in cells: the larger of the two steps (Chebyshev). */
export const distanceTo = (cursor: { col: number; row: number }, target: { col: number; row: number }) =>
  Math.max(Math.abs(cursor.col - target.col), Math.abs(cursor.row - target.row))

/** A target is found within this many cells. */
export const FOUND_WITHIN = 1

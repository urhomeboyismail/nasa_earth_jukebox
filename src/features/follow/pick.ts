// Which hot spot to follow (ticket IX03). Pure: useFollow.ts keeps the choice. A spot is found by its track id (SN01), never by a place name.

import { FEATURE_COLS, FEATURE_ROWS, type FrameFeatures, type Hotspot } from '../../analysis/features/types'
import type { MapArea } from '../../data'

/** A point as 0 to 1 fractions of the whole image, like a hot spot's centroid. */
export type Point = { x: number; y: number }

/** The frame's hot spots, largest first. Equal sizes keep the extractor's order, so the same frame always gives the same order. */
export function orderedHotspots(features: Pick<FrameFeatures, 'hotspots'>): Hotspot[] {
  return features.hotspots.map((spot, i) => ({ spot, i })).sort((a, b) => b.spot.cells - a.spot.cells || a.i - b.i).map(({ spot }) => spot)
}

/**
 * The spot under `cursor`, or the largest when the cursor is on none. A spot covers about `cells` of the extractor's grid, so the cursor is on it when it is
 * within that many cells' radius of the centroid (and half a cell, for the cell the cursor itself fills). Null when the frame has no hot spot.
 */
export function pickHotspot(features: Pick<FrameFeatures, 'hotspots'>, cursor: Point | null, area: MapArea): Hotspot | null {
  const ordered = orderedHotspots(features)
  if (ordered.length === 0) return null
  if (cursor) {
    const inCells = (p: Point) => ({ col: ((p.x - area.x0) / (area.x1 - area.x0)) * FEATURE_COLS, row: ((p.y - area.y0) / (area.y1 - area.y0)) * FEATURE_ROWS })
    const at = inCells(cursor)
    let best: { spot: Hotspot; distance: number } | null = null
    for (const spot of ordered) {
      const centre = inCells(spot.centroid)
      const distance = Math.hypot(centre.col - at.col, centre.row - at.row)
      if (distance <= Math.sqrt(spot.cells / Math.PI) + 0.5 && (!best || distance < best.distance)) best = { spot, distance }
    }
    if (best) return best.spot
  }
  return ordered[0]
}

/** The next or previous spot after `currentId`, largest first, wrapping round. With no current spot (or one not in this frame), next is the largest and previous the smallest. */
export function stepHotspot(features: Pick<FrameFeatures, 'hotspots'>, currentId: string | null, step: 'next' | 'previous'): Hotspot | null {
  const ordered = orderedHotspots(features)
  if (ordered.length === 0) return null
  const at = ordered.findIndex(spot => spot.id === currentId)
  if (at < 0) return step === 'next' ? ordered[0] : ordered[ordered.length - 1]
  return ordered[(at + (step === 'next' ? 1 : -1) + ordered.length) % ordered.length]
}

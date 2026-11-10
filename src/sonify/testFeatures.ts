// Hand-made `FrameFeatures` for the ruleset's tests. Not shipped: only test files import this, and `index.ts` does not export it.

import type { Band, FrameFeatures, Hotspot } from '../analysis/features/types'
import type { ChangeSummary, Contour } from '../analysis/types'

export function spot(id: string, band: Band, x: number, y: number, areaShare = 0.02, peakPosition = band === 'high' ? 1 : 0): Hotspot {
  return { id, band, centroid: { x, y }, cells: Math.round(areaShare * 2048), areaShare, peak: peakPosition * 30, peakPosition }
}

/** A line from west to east at the given heights: one point per x. */
export function line(xs: number[], y = 0.5): Contour {
  return { level: 0.5, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false, points: xs.map(x => ({ x, y, turn: 0, front: 1 })) }
}

export type FeatureOptions = {
  frameId?: string
  date?: string
  /** The median as 0 to 1 across the legend; null = cannot be read. Default 0.5. */
  position?: number | null
  histogram?: number[]
  hotspots?: Hotspot[]
  density?: number
  strongest?: Contour | null
  motion?: { dx: number; dy: number; speed: number } | null
  change?: (ChangeSummary & { shift: number | null }) | null
  reference?: number | null
}

export function features(o: FeatureOptions = {}): FrameFeatures {
  const position = o.position === undefined ? 0.5 : o.position
  const motion = o.motion === undefined ? null : o.motion
  return {
    frameId: o.frameId ?? 'f1',
    date: o.date ?? '2026-01-15',
    mode: 'data',
    grid: { cols: 0, rows: 0, values: new Float32Array(0), position: new Float32Array(0) },
    stats: { validShare: position === null ? 0 : 1, median: position === null ? null : position * 30, position, iqr: position === null ? null : 0, min: null, max: null },
    histogram: o.histogram ?? (position === null ? [0, 0, 0] : [0, 1, 0]),
    hotspots: o.hotspots ?? [],
    edges: { density: o.density ?? 0, strongest: o.strongest ?? null },
    motion: motion && { ...motion, direction: motion.speed === 0 ? null : Math.atan2(-motion.dy, motion.dx), changedShare: 0.5 },
    change: o.change ?? null,
    reference: o.reference === undefined ? position : o.reference,
    confidence: 1,
  }
}

export function change(shift: number | null, step = 'normal'): NonNullable<FeatureOptions['change']> {
  return { step, shareAbove: [], validFraction: 1, shift }
}

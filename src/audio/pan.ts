// Stereo panning values: west is the left ear, east is the right (docs/PLAN.md F13).
// The engine already accepts a `pan` from -1 to 1 on playCategory and on sequence steps; callers pass these.

import type { Region } from '../data'

const clamp = (value: number) => Math.min(1, Math.max(-1, value))

/** Where a point sits across the image: x = 0 (west edge) gives -1, x = 1 (east edge) gives +1. */
export function panForPoint(x: number): number {
  if (!Number.isFinite(x)) return 0
  return clamp(x * 2 - 1)
}

/** The pan for a region: the middle of its sample points across the image. An empty region gives 0 (centre). */
export function panFor(region: Pick<Region, 'points'>): number {
  const { points } = region
  if (!points.length) return 0
  const xs = points.map(point => point.x)
  return panForPoint((Math.min(...xs) + Math.max(...xs)) / 2)
}

// The path Echo flies on the guided tour (docs/tickets/JB05-tour-flight-path.md). Pure: points in, an SVG path and a resting place out.

export type Point = { x: number; y: number }
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number }

/** How big Echo is on the tour (px) and how far it stays from the control it points at. */
export const TOUR_ECHO_SIZE = 64
export const TOUR_GAP = 12

const round = (n: number) => Math.round(n * 100) / 100

/**
 * An SVG path `d`: a smooth cubic curve through every point (Catmull-Rom turned into Bézier segments). One point gives a bare move,
 * none gives an empty string.
 */
export function flightPath(points: Point[]): string {
  if (points.length === 0) return ''
  const first = points[0]
  let d = `M${round(first.x)} ${round(first.y)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p2.x)} ${round(p2.y)}`
  }
  return d
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high))

/**
 * Where Echo's centre rests: beside the target, on the side with more room, and always inside the viewport.
 * `side` is the side of the target Echo is on.
 */
export function anchorFor(target: Box, viewport: { w: number; h: number }): Point & { side: 'left' | 'right' } {
  const half = TOUR_ECHO_SIZE / 2
  const middle = target.left + target.width / 2
  const side = middle > viewport.w / 2 ? 'left' : 'right'
  const x = side === 'left' ? target.left - TOUR_GAP - half : target.right + TOUR_GAP + half
  const y = target.top + target.height / 2
  return {
    x: clamp(x, half, Math.max(half, viewport.w - half)),
    y: clamp(y, half, Math.max(half, viewport.h - half)),
    side,
  }
}

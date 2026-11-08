// Sound pipeline v2 (docs/PLAN.md §5.9): the line where the change crosses a fixed level, by marching squares.
// Pure and deterministic: no randomness, no hash-order dependence, no imports beyond types.
//
// The field's values sit on a grid of vertices (the field's cell centres). A marching-squares "cell" is the square between four
// neighbouring vertices. One rule decides everything: **a vertex is above the level when its value is ≥ level.**

import type { Contour, ContourPoint, ValueField } from './types'

/** Points per line after resampling. */
export const CONTOUR_POINTS = 64

// Edge ids: the edge going east from vertex (r, c) is (r * cols + c) * 2, the edge going south is that + 1.
// Each cell's segment runs between two of its edges, directed so that the **above side is on the left** as seen on the map (north up).
// With every segment directed alike, segments join head to tail with no choices, so a line always has the same direction and order.
const CASES: Record<number, string[]> = { // bits: top-left 8, top-right 4, bottom-right 2, bottom-left 1; T R B L = the cell's edges
  1: ['BL'], 2: ['RB'], 3: ['RL'], 4: ['TR'], 6: ['TB'], 7: ['TL'], 8: ['LT'], 9: ['BT'], 11: ['RT'], 12: ['LR'], 13: ['BR'], 14: ['LB'],
}
// A saddle (opposite corners above) is resolved by the average of the four corners: above the level joins the above corners.
const SADDLE_JOINED: Record<number, string[]> = { 5: ['TL', 'BR'], 10: ['RT', 'LB'] }
const SADDLE_SPLIT: Record<number, string[]> = { 5: ['TR', 'BL'], 10: ['LT', 'RB'] }

type Segment = { from: number; to: number; front: number }

/** The lines where `field` crosses `level`: open lines first, then closed ones, each group in row-major order from the north-west. */
export function traceContours(field: ValueField, level: number): Contour[] {
  const { cols, rows, values } = field
  const above = (i: number) => values[i] >= level

  const segments: Segment[] = []
  const cellExists = (r: number, c: number) => r >= 0 && c >= 0 && r < rows - 1 && c < cols - 1
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c, tr = tl + 1, bl = tl + cols, br = bl + 1
      const corners = [values[tl], values[tr], values[br], values[bl]]
      if (corners.some(Number.isNaN)) continue // a cell with any NaN corner gives no segment
      const index = (above(tl) ? 8 : 0) | (above(tr) ? 4 : 0) | (above(br) ? 2 : 0) | (above(bl) ? 1 : 0)
      let pairs = CASES[index]
      if (index === 5 || index === 10) {
        const centreAbove = (corners[0] + corners[1] + corners[2] + corners[3]) / 4 >= level
        pairs = centreAbove ? SADDLE_JOINED[index] : SADDLE_SPLIT[index]
      }
      if (!pairs) continue // all four corners on the same side
      const edge: Record<string, number> = { T: tl * 2, B: bl * 2, L: tl * 2 + 1, R: tr * 2 + 1 }
      // Gradient at the centre of the cell, in value per cell.
      const front = Math.hypot((values[tr] - values[tl] + values[br] - values[bl]) / 2, (values[bl] - values[tl] + values[br] - values[tr]) / 2)
      for (const pair of pairs) segments.push({ from: edge[pair[0]], to: edge[pair[1]], front })
    }
  }

  const startsAt = new Map<number, number>() // edge → the segment that leaves it
  const arrivesAt = new Set<number>()
  segments.forEach((s, i) => {
    startsAt.set(s.from, i)
    arrivesAt.add(s.to)
  })

  const used = new Array<boolean>(segments.length).fill(false)
  const lines: { edges: number[]; fronts: number[]; closed: boolean }[] = []
  const walk = (first: number, closed: boolean) => {
    const edges = [segments[first].from]
    const fronts: number[] = []
    let current: number | undefined = first
    while (current !== undefined && !used[current]) {
      used[current] = true
      edges.push(segments[current].to)
      fronts.push(segments[current].front)
      current = startsAt.get(segments[current].to)
    }
    if (closed) edges.pop() // it came back to where it began
    lines.push({ edges, fronts, closed })
  }
  segments.forEach((s, i) => { if (!used[i] && !arrivesAt.has(s.from)) walk(i, false) })
  segments.forEach((_, i) => { if (!used[i]) walk(i, true) })

  /** Where the line crosses an edge, in vertex units (x across, y down). */
  const crossing = (edge: number) => {
    const vertex = edge >> 1
    const vertical = edge & 1
    const a = values[vertex]
    const b = values[vertical ? vertex + cols : vertex + 1]
    const t = (level - a) / (b - a)
    const r = Math.floor(vertex / cols), c = vertex % cols
    return vertical ? { x: c, y: r + t } : { x: c + t, y: r }
  }
  /** An edge's neighbouring cells that exist: two means the cell on the far side gave no segment because it has a NaN corner. */
  const neighbours = (edge: number) => {
    const vertex = edge >> 1
    const r = Math.floor(vertex / cols), c = vertex % cols
    return (edge & 1 ? [[r, c - 1], [r, c]] : [[r - 1, c], [r, c]]).filter(([cr, cc]) => cellExists(cr, cc)).length
  }

  return lines.map(({ edges, fronts, closed }) => {
    const n = edges.length
    const xy = edges.map(crossing)
    // A vertex of the line takes the mean steepness of the segments that meet there.
    const vertexFront = edges.map((_, k) => {
      const before = k > 0 ? fronts[k - 1] : closed ? fronts[fronts.length - 1] : undefined
      const after = k < fronts.length ? fronts[k] : undefined
      return before === undefined ? after! : after === undefined ? before : (before + after) / 2
    })
    const brokenStart = !closed && neighbours(edges[0]) === 2
    const brokenEnd = !closed && neighbours(edges[n - 1]) === 2
    return { level, closed, brokenEnds: Number(brokenStart) + Number(brokenEnd), brokenStart, brokenEnd, points: resample(xy, vertexFront, closed, field) }
  })
}

function resample(xy: { x: number; y: number }[], front: number[], closed: boolean, field: ValueField): ContourPoint[] {
  const path = closed ? [...xy, xy[0]] : xy
  const fronts = closed ? [...front, front[0]] : front
  const cumulative = [0]
  for (let k = 1; k < path.length; k++) cumulative.push(cumulative[k - 1] + Math.hypot(path[k].x - path[k - 1].x, path[k].y - path[k - 1].y))
  const length = cumulative[cumulative.length - 1]

  const samples: { x: number; y: number; front: number }[] = []
  let k = 1
  for (let i = 0; i < CONTOUR_POINTS; i++) {
    const s = (i * length) / (closed ? CONTOUR_POINTS : CONTOUR_POINTS - 1)
    while (k < path.length - 1 && cumulative[k] < s) k++
    const span = cumulative[k] - cumulative[k - 1]
    const t = span > 0 ? Math.min(1, Math.max(0, (s - cumulative[k - 1]) / span)) : 0
    samples.push({
      x: path[k - 1].x + (path[k].x - path[k - 1].x) * t,
      y: path[k - 1].y + (path[k].y - path[k - 1].y) * t,
      front: fronts[k - 1] + (fronts[k] - fronts[k - 1]) * t,
    })
  }

  const { cols, rows, area } = field
  return samples.map((p, i) => {
    const prev = samples[i === 0 ? (closed ? samples.length - 1 : 0) : i - 1]
    const next = samples[i === samples.length - 1 ? (closed ? 0 : i) : i + 1]
    // Positive = a left turn as seen on the map (north up); y grows downwards here, so the cross product is negated.
    const ax = p.x - prev.x, ay = p.y - prev.y, bx = next.x - p.x, by = next.y - p.y
    const turn = (ax === 0 && ay === 0) || (bx === 0 && by === 0) ? 0 : Math.atan2(-(ax * by - ay * bx), ax * bx + ay * by)
    return {
      x: area.x0 + ((p.x + 0.5) / cols) * (area.x1 - area.x0),
      y: area.y0 + ((p.y + 0.5) / rows) * (area.y1 - area.y0),
      turn,
      front: p.front,
    }
  })
}

const lengthOf = (c: Contour) => {
  let sum = 0
  for (let i = 1; i < c.points.length; i++) sum += Math.hypot(c.points[i].x - c.points[i - 1].x, c.points[i].y - c.points[i - 1].y)
  if (c.closed && c.points.length > 1) sum += Math.hypot(c.points[0].x - c.points[c.points.length - 1].x, c.points[0].y - c.points[c.points.length - 1].y)
  return sum
}

/** The longest line of each level (`perLevel` of them), so the sound never jumps between separate puddles. Ties go to the one found first. Levels keep the order they first appear in. */
export function pickContours(contours: Contour[], perLevel = 1): Contour[] {
  const levels: number[] = []
  for (const c of contours) if (!levels.includes(c.level)) levels.push(c.level)
  return levels.flatMap(level => {
    const ranked = contours.filter(c => c.level === level).map(contour => ({ contour, length: Math.round(lengthOf(contour) * 1e9) })) // rounded, so rounding noise cannot break a tie
    // Array.prototype.sort is stable, so equal lengths keep the order they were found in.
    return ranked.sort((a, b) => b.length - a.length).slice(0, perLevel).map(r => r.contour)
  })
}

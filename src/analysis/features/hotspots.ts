// Hot spots (docs/PLAN.md §6.3): the connected regions in the top and bottom bands of a frame, and the same spot followed from frame to frame.
// Pure and deterministic: cells are visited in row-major order, ties are broken by position, nothing depends on hash order.

import type { MapArea } from '../../data'
import { HOTSPOT_MIN_CELLS, HOTSPOTS_KEPT, TRACK_DISTANCE, type Band, type Hotspot } from './types'

type Grid = { cols: number; rows: number; values: Float32Array; position: Float32Array }

/** Id of a spot that has not been tracked yet. `findHotspots` leaves it; `trackHotspots` replaces it. */
export const UNTRACKED_ID = ''

const NEIGHBOURS = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const

/**
 * The 4-connected groups of cells in each band that have at least HOTSPOT_MIN_CELLS cells, largest first (ties: north, then west),
 * at most HOTSPOTS_KEPT. `bandOf(cell)` gives 'high', 'low' or null for each cell index (row-major); a cell that cannot be read
 * (NaN) is never in a band. The grid is read, not copied. Ids are left as UNTRACKED_ID.
 */
export function findHotspots(grid: Grid, area: MapArea, bandOf: (cell: number) => Band | null): Hotspot[] {
  const { cols, rows, values, position } = grid
  const total = cols * rows
  // 0 = no band, 1 = high, 2 = low. Each cell is asked once.
  const bands = new Uint8Array(total)
  for (let cell = 0; cell < total; cell++) {
    if (Number.isNaN(values[cell])) continue
    const band = bandOf(cell)
    bands[cell] = band === 'high' ? 1 : band === 'low' ? 2 : 0
  }

  const spots: Hotspot[] = []
  const seen = new Uint8Array(total)
  for (let start = 0; start < total; start++) {
    const code = bands[start]
    if (!code || seen[start]) continue
    // Flood fill. The order of visiting does not change the sums below.
    const stack = [start]
    seen[start] = 1
    let cells = 0
    let sumCol = 0
    let sumRow = 0
    let best = start
    while (stack.length) {
      const cell = stack.pop()!
      const col = cell % cols
      const row = (cell - col) / cols
      cells++
      sumCol += col + 0.5
      sumRow += row + 0.5
      // The strongest cell: the largest value in the high band, the smallest in the low band; the first in row-major order wins a tie.
      const better = code === 1 ? values[cell] > values[best] : values[cell] < values[best]
      if (better || (values[cell] === values[best] && cell < best)) best = cell
      for (const [dc, dr] of NEIGHBOURS) {
        const c = col + dc
        const r = row + dr
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue
        const next = r * cols + c
        if (bands[next] === code && !seen[next]) {
          seen[next] = 1
          stack.push(next)
        }
      }
    }
    if (cells < HOTSPOT_MIN_CELLS) continue
    spots.push({
      id: UNTRACKED_ID,
      band: code === 1 ? 'high' : 'low',
      centroid: {
        x: area.x0 + (sumCol / cells / cols) * (area.x1 - area.x0),
        y: area.y0 + (sumRow / cells / rows) * (area.y1 - area.y0),
      },
      cells,
      areaShare: cells / total,
      peak: values[best],
      peakPosition: position[best],
    })
  }
  spots.sort((a, b) => b.cells - a.cells || a.centroid.y - b.centroid.y || a.centroid.x - b.centroid.x)
  return spots.slice(0, HOTSPOTS_KEPT)
}

const idNumber = (id: string) => {
  const match = /^h(\d+)$/.exec(id)
  return match ? Number(match[1]) : 0
}

/** The highest hot-spot number among `spots` (0 when there are none or none has a numbered id). */
export function highestSerial(spots: Hotspot[]): number {
  return spots.reduce((highest, spot) => Math.max(highest, idNumber(spot.id)), 0)
}

export type TrackOptions = {
  /** The highest number issued so far in the stream. Default: the highest among `previous`. */
  serial?: number
  /** Image height ÷ image width, so a distance up the map counts as it looks. Default 1. */
  aspect?: number
}

/**
 * Gives each spot the id of the same spot in the previous frame: the nearest one with the same band whose centroid is within
 * TRACK_DISTANCE of the image width. Greedy: the closest pairs first, each previous spot used once, ties by previous order and then
 * current order. A spot with no match gets the next number (`h{serial + 1}`, in the order given), so an id is never issued twice.
 * The order of `current` is kept.
 */
export function trackHotspots(previous: Hotspot[], current: Hotspot[], options: TrackOptions = {}): Hotspot[] {
  const aspect = options.aspect ?? 1
  const pairs: { before: number; now: number; distance: number }[] = []
  previous.forEach((before, i) => {
    current.forEach((now, j) => {
      if (before.band !== now.band) return
      const distance = Math.hypot(now.centroid.x - before.centroid.x, (now.centroid.y - before.centroid.y) * aspect)
      if (distance <= TRACK_DISTANCE) pairs.push({ before: i, now: j, distance })
    })
  })
  pairs.sort((a, b) => a.distance - b.distance || a.before - b.before || a.now - b.now)

  const ids = new Array<string | null>(current.length).fill(null)
  const used = new Set<number>()
  for (const { before, now } of pairs) {
    if (ids[now] !== null || used.has(before)) continue
    ids[now] = previous[before].id
    used.add(before)
  }
  let serial = Math.max(options.serial ?? 0, highestSerial(previous))
  return current.map((spot, j) => ({ ...spot, id: ids[j] ?? `h${++serial}` }))
}

// Motion (docs/PLAN.md §6.3): how the picture moved between two frames, by block matching. Pure and deterministic.
//
// The grid is cut into blocks of MOTION_BLOCK_COLS × MOTION_BLOCK_ROWS cells. For each block every shift within MOTION_SEARCH cells is tried:
// the current cell (x, y) is compared with the previous cell (x − dx, y − dy), so a pattern that moved east by two cells gives dx = 2.

import { MOTION_BLOCK_COLS, MOTION_BLOCK_ROWS, MOTION_MIN_GAIN, MOTION_SEARCH, type Motion } from './types'

/** Scores closer than this are the same score (rounding noise from Float32 positions must not decide a tie). */
const SAME_SCORE = 1e-9

const STILL: Motion = { dx: 0, dy: 0, speed: 0, direction: null, changedShare: 0 }

type Shift = { dx: number; dy: number; score: number }

/** Every shift of the search window, in the order that breaks ties: the smaller |dx| + |dy|, then the smaller dy, then the smaller dx. */
const SHIFTS: { dx: number; dy: number }[] = []
for (let dy = -MOTION_SEARCH; dy <= MOTION_SEARCH; dy++) {
  for (let dx = -MOTION_SEARCH; dx <= MOTION_SEARCH; dx++) SHIFTS.push({ dx, dy })
}
SHIFTS.sort((a, b) => Math.abs(a.dx) + Math.abs(a.dy) - (Math.abs(b.dx) + Math.abs(b.dy)) || a.dy - b.dy || a.dx - b.dx)

/**
 * `previous` and `current` are `position` arrays (0 to 1, NaN = cannot be read) of a `cols` × `rows` grid. A shift counts only where both
 * cells are readable, and needs at least half the block's cells. A block has moved when its best shift is not (0, 0) and beats (0, 0) by
 * MOTION_MIN_GAIN. `dx` and `dy` are the means over the moved blocks (cells per step); `changedShare` is the moved blocks over the blocks
 * that could be read. No moved block: no motion.
 */
export function estimateMotion(previous: Float32Array, current: Float32Array, cols: number, rows: number): Motion {
  const blockCols = Math.floor(cols / MOTION_BLOCK_COLS)
  const blockRows = Math.floor(rows / MOTION_BLOCK_ROWS)
  const needed = (MOTION_BLOCK_COLS * MOTION_BLOCK_ROWS) / 2
  let readable = 0
  let moved = 0
  let sumDx = 0
  let sumDy = 0

  for (let by = 0; by < blockRows; by++) {
    for (let bx = 0; bx < blockCols; bx++) {
      let best: Shift | null = null
      let still: Shift | null = null
      for (const { dx, dy } of SHIFTS) {
        let pairs = 0
        let total = 0
        for (let y = by * MOTION_BLOCK_ROWS; y < (by + 1) * MOTION_BLOCK_ROWS; y++) {
          const py = y - dy
          if (py < 0 || py >= rows) continue
          for (let x = bx * MOTION_BLOCK_COLS; x < (bx + 1) * MOTION_BLOCK_COLS; x++) {
            const px = x - dx
            if (px < 0 || px >= cols) continue
            const now = current[y * cols + x]
            const before = previous[py * cols + px]
            if (Number.isNaN(now) || Number.isNaN(before)) continue
            pairs++
            total += Math.abs(now - before)
          }
        }
        if (pairs < needed) continue
        const shift = { dx, dy, score: total / pairs }
        if (dx === 0 && dy === 0) still = shift
        // SHIFTS is in tie-break order, so only a clearly lower score replaces the best so far.
        if (!best || shift.score < best.score - SAME_SCORE) best = shift
      }
      if (!best) continue
      readable++
      if (still && (best.dx !== 0 || best.dy !== 0) && still.score - best.score >= MOTION_MIN_GAIN) {
        moved++
        sumDx += best.dx
        sumDy += best.dy
      }
    }
  }

  if (!moved) return { ...STILL }
  const dx = sumDx / moved
  const dy = sumDy / moved
  const speed = Math.hypot(dx, dy)
  return { dx, dy, speed, direction: speed === 0 ? null : Math.atan2(0 - dy, dx), changedShare: moved / readable }
}

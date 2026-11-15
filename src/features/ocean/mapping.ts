// EIC06 T4: how an ocean track sounds. Pure functions, no Tone and no DOM.

import type { GridCell } from './schema'

/** The JSON has two steps a second of video. */
export const STEPS_PER_SECOND = 2

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

/** The step on screen at a video time: floor(currentTime × 2), kept inside the timeline. */
export function stepAt(currentTime: number, steps: number): number {
  if (!Number.isFinite(currentTime) || steps < 1) return 0
  return Math.min(steps - 1, Math.max(0, Math.floor(currentTime * STEPS_PER_SECOND)))
}

/** Low-pass cutoff: exponential from `lo` (cold, muffled) to `hi` (hot, bright), so equal steps of warmth sound equal. */
export function cutoffFor(sstNorm: number, [lo, hi]: readonly [number, number]): number {
  return lo * (hi / lo) ** clamp01(sstNorm)
}

/** Major pentatonic degrees, in semitones: no note clashes with the one before it. */
const PENTATONIC = [0, 2, 4, 7, 9]

/** Every pentatonic note from `lo` up to `hi`, in Hz, with `lo` as the root. */
export function scaleNotes([lo, hi]: readonly [number, number]): number[] {
  const notes: number[] = []
  for (let octave = 0; ; octave++) {
    for (const semi of PENTATONIC) {
      const f = lo * 2 ** (octave + semi / 12)
      if (f > hi * 1.0001) return notes
      notes.push(f)
    }
  }
}

/** The scale note for a warmth: cold is the lowest note in the range, hot the highest. */
export function pitchFor(sstNorm: number, range: readonly [number, number]): number {
  const notes = scaleNotes(range)
  return notes[Math.round(clamp01(sstNorm) * (notes.length - 1))]
}

/** The pulse (tremolo) rate in Hz: a slow 0.5 Hz throb for still water up to 6 Hz for the fastest currents. */
export const pulseRateFor = (velocityNorm: number) => 0.5 + 5.5 * clamp01(velocityNorm)

/** How much of the chorus (the stereo swirl) is heard: a little always, most of it in strong eddies. */
export const swirlFor = (vorticityNorm: number) => 0.1 + 0.8 * clamp01(vorticityNorm)

/** Left edge -1, right edge +1. */
export const panFor = (col: number, cols: number) => (cols > 1 ? (clamp01(col / (cols - 1)) * 2 - 1) : 0)

export type Cursor = { col: number; row: number }

/** The grid cell under a point of a box `width` × `height` (row 0 at the top). */
export function cellAt(x: number, y: number, width: number, height: number, rows: number, cols: number): Cursor {
  const col = Math.min(cols - 1, Math.max(0, Math.floor((x / width) * cols)))
  const row = Math.min(rows - 1, Math.max(0, Math.floor((y / height) * rows)))
  return { col: Number.isFinite(col) ? col : 0, row: Number.isFinite(row) ? row : 0 }
}

/** spatial_grid[row][col], or null outside the grid, where there is no ocean, or when the step has no grid. */
export function gridLookup(grid: GridCell[][] | null, { row, col }: Cursor): GridCell {
  return grid?.[row]?.[col] ?? null
}

/** Moves the reticle by one cell for an arrow key, staying inside the grid. Null for any other key. */
export function moveCursor(cursor: Cursor, key: string, rows: number, cols: number): Cursor | null {
  const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const d = delta[key]
  if (!d) return null
  return { col: Math.min(cols - 1, Math.max(0, cursor.col + d[0])), row: Math.min(rows - 1, Math.max(0, cursor.row + d[1])) }
}

/** The calibration's 0 to 1 back in degrees Celsius. */
export const celsiusFor = (norm: number, minC: number, maxC: number) => minC + clamp01(norm) * (maxC - minC)

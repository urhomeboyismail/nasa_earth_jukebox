// Scan (docs/PLAN.md §6.3, ticket SN08): one frame swept from west to east so its shape can be heard. Each column of the grid becomes a short chord;
// the rows are grouped into SCAN_BANDS bands, north is high, and the band's value sets the loudness and the brightness. Pure and deterministic:
// the same features and preset always give the same plan. The caller plays the plan (src/features/player/Scan.tsx).

import type { FrameFeatures } from '../analysis/features/types'
import { elevationForPoint, panForPoint } from '../audio/pan'
import { snapToScale } from './presets'
import type { Preset } from './types'

/** Rows are grouped into 8 bands (of 4 cells in the 64 × 32 grid). */
export const SCAN_BANDS = 8
/** 64 columns: about 5.1 s. */
export const SCAN_MS_PER_COLUMN = 80
/** C3: the lowest band. */
export const SCAN_LOW_MIDI = 48
/** Up to C5: two octaves. */
export const SCAN_SPAN = 24
/** A note sounds a little longer than its column, so the columns run into each other. */
export const SCAN_NOTE_SECONDS = (SCAN_MS_PER_COLUMN / 1000) * 1.5
export const SCAN_MIN_LEVEL = 0.15

export type ScanNote = { midi: number; level: number; pan: number; elevation: number; brightness: number; seconds: number }

export type ScanColumn = {
  column: number
  atMs: number
  /** Silent when nothing in the column can be read; the caller plays the dropout cue then. */
  dropout: boolean
  notes: ScanNote[]
}

/** The middle value of a list, or null when it is empty. */
function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** The note of a band, the same at every frame: band 0 is the north and the highest. */
export function bandMidi(band: number, preset: Preset): number {
  const raw = SCAN_LOW_MIDI + Math.round(((SCAN_BANDS - 1 - band) * SCAN_SPAN) / (SCAN_BANDS - 1))
  return snapToScale(raw, preset, SCAN_LOW_MIDI, SCAN_LOW_MIDI + SCAN_SPAN)
}

export function scanPlan(features: FrameFeatures, preset: Preset, msPerColumn: number = SCAN_MS_PER_COLUMN): ScanColumn[] {
  const { cols, rows, position } = features.grid
  const rowsPerBand = rows / SCAN_BANDS
  const notes = Array.from({ length: SCAN_BANDS }, (_, band) => bandMidi(band, preset))
  const seconds = (msPerColumn / 1000) * 1.5
  const plan: ScanColumn[] = []
  for (let column = 0; column < cols; column++) {
    const pan = panForPoint((column + 0.5) / cols)
    const chord: ScanNote[] = []
    for (let band = 0; band < SCAN_BANDS; band++) {
      const readable: number[] = []
      for (let row = Math.round(band * rowsPerBand); row < Math.round((band + 1) * rowsPerBand); row++) {
        const value = position[row * cols + column]
        if (Number.isFinite(value)) readable.push(value)
      }
      const value = median(readable)
      if (value === null) continue
      const clamped = Math.min(1, Math.max(0, value))
      chord.push({
        midi: notes[band],
        level: SCAN_MIN_LEVEL + (1 - SCAN_MIN_LEVEL) * clamped,
        pan,
        elevation: elevationForPoint(((band + 0.5) * rowsPerBand) / rows),
        brightness: clamped,
        seconds,
      })
    }
    plan.push({ column, atMs: column * msPerColumn, dropout: chord.length === 0, notes: chord })
  }
  return plan
}

/** The column the line is on, `elapsedMs` after the scan began; null before it began, and after its last column. */
export function columnAt(elapsedMs: number, columns: number, msPerColumn: number = SCAN_MS_PER_COLUMN): number | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null
  const column = Math.floor(elapsedMs / msPerColumn)
  return column < columns ? column : null
}

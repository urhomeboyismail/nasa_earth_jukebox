// Made-up frames with known answers for the feature tests. Not shipped: only test files import this.
// A frame is 64 × 32 cells of CELL_PX × CELL_PX pixels each, so every cell is one colour and the 3 × 3 lattice always lands inside it.
// Values 0 to 10 on a blue-to-red legend; grey is land.

import type { ColorScale, RGB, SoundMapping } from '../../data'
import type { Pixels } from '../analyze'
import { FEATURE_COLS, FEATURE_ROWS, type ExtractInput } from './types'

export const CELL_PX = 10
export const SCENE_WIDTH = FEATURE_COLS * CELL_PX
export const SCENE_HEIGHT = FEATURE_ROWS * CELL_PX

export const SCALE: ColorScale = {
  stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 10, rgb: [255, 0, 0] }],
  noData: [[128, 128, 128]],
  maxColorDistance: 30,
}

export const MAPPING: SoundMapping = {
  scale: 'major',
  summary: 'median',
  minValidFraction: 0.5,
  categories: [
    { id: 'cold', label: 'Cold', range: [0, 3], note: 'C3' },
    { id: 'mild', label: 'Mild', range: [3, 7], note: 'E4' },
    { id: 'warm', label: 'Warm', range: [7, 10], note: 'G5' },
  ],
  tick: { note: 'C4', durationMs: 100 },
  missingCue: { type: 'noise', durationMs: 200 },
  changeSteps: [
    { id: 'much-below', label: 'Much below', range: [-Infinity, -1], note: 'C3' },
    { id: 'below', label: 'Below', range: [-1, -0.25], note: 'D3' },
    { id: 'normal', label: 'Normal', range: [-0.25, 0.25], note: 'E3' },
    { id: 'above', label: 'Above', range: [0.25, 1], note: 'G3' },
    { id: 'much-above', label: 'Much above', range: [1, Infinity], note: 'C4' },
  ],
}

export const WHOLE: ExtractInput['area'] = { x0: 0, y0: 0, x1: 1, y1: 1 }

/** The pixel colour of a value on SCALE. */
export function colourOf(value: number): RGB {
  const t = Math.min(1, Math.max(0, value / 10))
  return [Math.round(255 * t), 0, Math.round(255 * (1 - t))]
}

export const LAND: RGB = [128, 128, 128]

/** What one cell holds: a value on SCALE, `'land'` (grey), or an exact colour. */
export type CellFill = number | 'land' | RGB

/** Paints the whole frame, cell by cell. Every pixel is fully opaque. */
export function paint(cell: (col: number, row: number) => CellFill): Pixels {
  const data = new Uint8ClampedArray(SCENE_WIDTH * SCENE_HEIGHT * 4)
  for (let row = 0; row < FEATURE_ROWS; row++) {
    for (let col = 0; col < FEATURE_COLS; col++) {
      const fill = cell(col, row)
      const rgb = typeof fill === 'number' ? colourOf(fill) : fill === 'land' ? LAND : fill
      for (let y = row * CELL_PX; y < (row + 1) * CELL_PX; y++) {
        for (let x = col * CELL_PX; x < (col + 1) * CELL_PX; x++) data.set([rgb[0], rgb[1], rgb[2], 255], (y * SCENE_WIDTH + x) * 4)
      }
    }
  }
  return { data, width: SCENE_WIDTH, height: SCENE_HEIGHT }
}

/** A field of one value with a rectangle of another: `square` is [firstCol, firstRow, cols, rows]. */
export function withSquare(base: number, square: [number, number, number, number], value: number): Pixels {
  const [c0, r0, w, h] = square
  return paint((col, row) => (col >= c0 && col < c0 + w && row >= r0 && row < r0 + h ? value : base))
}

export function inputFor(overrides: Partial<ExtractInput> = {}): ExtractInput {
  return { frameId: 'f1', date: '2026-01-01', mode: 'data', colorScale: SCALE, mapping: MAPPING, area: WHOLE, ...overrides }
}

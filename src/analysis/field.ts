// Sound pipeline v2 (docs/PLAN.md §5.9): the image as a grid of values, one per cell, NaN where nothing can be read.
// Pure: no DOM, no randomness, no imports beyond the pixel reader every other analysis uses.

import type { ColorScale, MapArea } from '../data'
import { valueAtPixel, type Pixels } from './analyze'
import { median } from './median'
import type { ValueField } from './types'

export type { ValueField }

/** Where in a cell, as fractions of its width and height, the 3 × 3 lattice of samples sits (the same lattice as the sound grid). */
const LATTICE = [1 / 6, 1 / 2, 5 / 6]
/** A cell needs a strict majority of its nine samples, so a coastline cell is not a value taken from one stray pixel. */
export const MIN_LATTICE_SAMPLES = 5

/** Each cell is the median of a 3 × 3 lattice read through `valueAtPixel`, so a field cell, a grid cell and a region never disagree about a pixel. */
export function readField(pixels: Pixels, colorScale: ColorScale, area: MapArea, cols: number, rows: number): ValueField {
  const { width, height } = pixels
  const values = new Float32Array(cols * rows).fill(NaN)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const samples: number[] = []
      for (const fy of LATTICE) {
        for (const fx of LATTICE) {
          const x = area.x0 + ((col + fx) / cols) * (area.x1 - area.x0)
          const y = area.y0 + ((row + fy) / rows) * (area.y1 - area.y0)
          const value = valueAtPixel(pixels, Math.floor(x * width), Math.floor(y * height), colorScale)
          if (value !== null) samples.push(value)
        }
      }
      if (samples.length >= MIN_LATTICE_SAMPLES) values[row * cols + col] = median(samples)
    }
  }
  return { cols, rows, area, values }
}

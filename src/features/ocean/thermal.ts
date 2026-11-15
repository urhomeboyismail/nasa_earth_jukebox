// The numbers behind CanvasGridVisualizer: the thermal colours, and a track step's grid turned into smooth fields of temperature and flow.
// Pure functions, no DOM.

import type { GridCell, OceanCalibration } from './schema'

export type Rgb = readonly [number, number, number]

export const THERMAL_MIN_C = 0
export const THERMAL_MAX_C = 32

/**
 * Temperature to colour: deep blue at 0 °C, green at 20 °C, red at 32 °C and above. A cyan and a yellow sit between them, so the middle
 * reads as a thermal map and not a muddy blend.
 */
export const THERMAL_STOPS: readonly (readonly [number, Rgb])[] = [
  [0, [11, 35, 120]],
  [10, [31, 140, 210]],
  [20, [46, 170, 70]],
  [26, [240, 210, 40]],
  [32, [210, 30, 30]],
]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function thermalRgb(celsius: number): Rgb {
  const c = Number.isFinite(celsius) ? clamp(celsius, THERMAL_MIN_C, THERMAL_MAX_C) : THERMAL_MIN_C
  for (let i = 1; i < THERMAL_STOPS.length; i++) {
    const [hiC, hi] = THERMAL_STOPS[i]
    if (c > hiC) continue
    const [loC, lo] = THERMAL_STOPS[i - 1]
    const t = (c - loC) / (hiC - loC)
    return [lerp(lo[0], hi[0], t), lerp(lo[1], hi[1], t), lerp(lo[2], hi[2], t)]
  }
  return THERMAL_STOPS[THERMAL_STOPS.length - 1][1]
}

/** The same colours as a CSS gradient, for the scale under the map. */
export const thermalGradient = () =>
  `linear-gradient(to right, ${THERMAL_STOPS.map(([c, [r, g, b]]) => `rgb(${r} ${g} ${b}) ${(c / THERMAL_MAX_C) * 100}%`).join(', ')})`

/** One step's grid as numbers: temperature in °C, and the flow's pull in a box 1 wide and 1 tall (x to the east, y down), per cell. */
export type Field = { rows: number; cols: number; celsius: Float32Array; u: Float32Array; v: Float32Array }

/**
 * The calibration turns a cell's 0 to 1 back into degrees. A cell's third value, when there is one, is where the flow comes from as a turn
 * (0 from the north, 0.25 from the east), so the flow itself goes the opposite way. A cell with no reading takes the grid's mean
 * temperature and has no flow, and so does a cell with no third value.
 */
export function fieldOf(grid: GridCell[][], { temp_min_c: lo, temp_max_c: hi }: Pick<OceanCalibration, 'temp_min_c' | 'temp_max_c'>): Field {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const celsius = new Float32Array(rows * cols)
  const u = new Float32Array(rows * cols)
  const v = new Float32Array(rows * cols)
  const known = grid.flat().filter((cell): cell is NonNullable<GridCell> => cell !== null)
  const fallback = known.length ? lo + (known.reduce((sum, cell) => sum + cell[0], 0) / known.length) * (hi - lo) : lo
  grid.forEach((row, r) => row.forEach((cell, c) => {
    const i = r * cols + c
    if (!cell) { celsius[i] = fallback; return }
    celsius[i] = lo + cell[0] * (hi - lo)
    if (cell.length < 3) return
    const from = cell[2] * 2 * Math.PI
    u[i] = -Math.sin(from) * cell[1]
    v[i] = Math.cos(from) * cell[1]
  }))
  return { rows, cols, celsius, u, v }
}

/** `a` moving towards `b` by `t` (0 to 1), cell by cell. Fields of different shapes cannot be mixed, so `a` stays. */
export function mixFields(a: Field, b: Field, t: number): Field {
  if (a.rows !== b.rows || a.cols !== b.cols) return a
  const mix = (x: Float32Array, y: Float32Array) => x.map((value, i) => lerp(value, y[i], t))
  return { rows: a.rows, cols: a.cols, celsius: mix(a.celsius, b.celsius), u: mix(a.u, b.u), v: mix(a.v, b.v) }
}

/** A value at a point of the unit box, blended smoothly between the four nearest cell centres. */
export function sampleField(values: Float32Array, rows: number, cols: number, x: number, y: number): number {
  const gx = clamp(x * cols - 0.5, 0, cols - 1)
  const gy = clamp(y * rows - 0.5, 0, rows - 1)
  const c0 = Math.floor(gx)
  const r0 = Math.floor(gy)
  const c1 = Math.min(cols - 1, c0 + 1)
  const r1 = Math.min(rows - 1, r0 + 1)
  const fx = gx - c0
  const fy = gy - r0
  const top = lerp(values[r0 * cols + c0], values[r0 * cols + c1], fx)
  const bottom = lerp(values[r1 * cols + c0], values[r1 * cols + c1], fx)
  return lerp(top, bottom, fy)
}

// Sound pipeline v2 (docs/PLAN.md §5.9): how far a frame is from its baseline, and which step that is.
// Pure: same input, same output; NaN means "cannot be read" and never turns into a number by accident.

import { median } from './median'
import type { ChangeMapping, ChangeSummary, ValueField } from './types'

export type { ChangeMapping, ChangeSummary }

/**
 * frame − baseline. NaN if either cell is NaN; a change smaller than `noiseFloor` is legend rounding, so it is 0.
 * No baseline (an anomaly product): the frame is already the change, passed through unchanged.
 */
export function changeField(frame: ValueField, baseline: ValueField | null, noiseFloor: number): ValueField {
  if (baseline === null) return frame
  if (baseline.cols !== frame.cols || baseline.rows !== frame.rows) throw new Error('The baseline field must be the same size as the frame field.')
  const values = new Float32Array(frame.values.length)
  for (let i = 0; i < values.length; i++) {
    const diff = frame.values[i] - baseline.values[i] // NaN in either gives NaN
    values[i] = Math.abs(diff) < noiseFloor ? 0 : diff
  }
  return { ...frame, values }
}

/** A 3 × 3 median that skips NaN cells. A cell with no readable neighbours (itself included) stays NaN. */
export function smoothField(field: ValueField): ValueField {
  const { cols, rows, values } = field
  const out = new Float32Array(values.length)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const near: number[] = []
      for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
        for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
          const v = values[r * cols + c]
          if (!Number.isNaN(v)) near.push(v)
        }
      }
      out[row * cols + col] = near.length ? median(near) : NaN
    }
  }
  return { ...field, values: out }
}

/** The step whose range holds `value`. A value on a shared edge goes to the step above (the rule `categoryFor` uses); outside every range, to the nearest end. */
export function stepFor(value: number, steps: ChangeMapping['changeSteps']): string {
  const found = steps.find(s => value >= s.range[0] && value < s.range[1])
  if (found) return found.id
  return (value < steps[0].range[0] ? steps[0] : steps[steps.length - 1]).id
}

/** The median change over readable cells, its step, and the share of readable cells at or above each contour level. Too few readable cells gives "insufficient", never "normal". */
export function summarizeChange(change: ValueField, mapping: ChangeMapping): ChangeSummary {
  const valid: number[] = []
  for (const v of change.values) if (!Number.isNaN(v)) valid.push(v)
  const validFraction = change.values.length ? valid.length / change.values.length : 0
  const shareAbove = mapping.contourLevels.map(level => (valid.length ? valid.filter(v => v >= level.value).length / valid.length : 0))
  if (!valid.length || validFraction < mapping.minValidFraction) return { step: 'insufficient', shareAbove, validFraction }
  const medianChange = median(valid)
  return { step: stepFor(medianChange, mapping.changeSteps), medianChange, shareAbove, validFraction }
}

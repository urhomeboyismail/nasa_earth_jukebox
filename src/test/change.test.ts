import { describe, expect, it } from 'vitest'
import { changeField, smoothField, summarizeChange, type ChangeMapping } from '../analysis/change'
import { readField, type ValueField } from '../analysis/field'
import type { ColorScale } from '../data'

const area = { x0: 0, y0: 0, x1: 1, y1: 1 }
const field = (cols: number, rows: number, v: number[]): ValueField => ({ cols, rows, area, values: Float32Array.from(v) })
const mapping: ChangeMapping = {
  minValidFraction: 0.5,
  changeSteps: [
    { id: 'much-below', range: [-Infinity, -1] },
    { id: 'below', range: [-1, -0.25] },
    { id: 'normal', range: [-0.25, 0.25] },
    { id: 'above', range: [0.25, 1] },
    { id: 'much-above', range: [1, Infinity] },
  ],
  contourLevels: [{ value: 1 }, { value: 2 }],
}

describe('changeField', () => {
  it('subtracts the baseline, gives NaN if either cell is NaN, and snaps small changes to 0', () => {
    const out = changeField(field(4, 1, [5, NaN, 3, 2.1]), field(4, 1, [3, 3, NaN, 2]), 0.5)
    expect(out.values[0]).toBe(2)
    expect(out.values[1]).toBeNaN()
    expect(out.values[2]).toBeNaN()
    expect(out.values[3]).toBe(0)
  })
  it('keeps a change exactly at the noise floor', () => {
    expect(changeField(field(1, 1, [1.5]), field(1, 1, [1]), 0.5).values[0]).toBe(0.5)
  })
  it('passes the frame through when there is no baseline', () => {
    const frame = field(2, 1, [0.1, NaN])
    expect(changeField(frame, null, 0.5)).toBe(frame)
  })
  it('is deterministic and does not touch its inputs', () => {
    const frame = field(3, 1, [1, 2, NaN])
    const base = field(3, 1, [0, 0, 0])
    const a = changeField(frame, base, 0.1)
    expect(Array.from(changeField(frame, base, 0.1).values)).toEqual(Array.from(a.values))
    expect(Array.from(frame.values)).toEqual([1, 2, NaN])
  })
})

describe('smoothField', () => {
  it('takes the 3 × 3 median, which ignores a single spike', () => {
    const v = new Array(9).fill(1)
    v[4] = 100
    expect(smoothField(field(3, 3, v)).values[4]).toBe(1)
  })
  it('skips NaN neighbours and fills a NaN cell that has readable neighbours', () => {
    const out = smoothField(field(3, 1, [2, NaN, 4]))
    expect(out.values[1]).toBe(3)
  })
  it('leaves a cell with no readable neighbours as NaN', () => {
    const v = new Array(25).fill(NaN)
    v[0] = 7
    expect(smoothField(field(5, 5, v)).values[24]).toBeNaN()
  })
})

describe('summarizeChange', () => {
  it('reports the median, its step and the validFraction, ignoring NaN', () => {
    const s = summarizeChange(field(5, 1, [1.2, 1.4, 3, NaN, 1.3]), mapping)
    expect(s.medianChange).toBeCloseTo(1.35)
    expect(s.step).toBe('much-above')
    expect(s.validFraction).toBe(0.8)
    expect(s.shareAbove).toEqual([1, 0.25])
  })
  it('sends a value on a step boundary to the step above', () => {
    expect(summarizeChange(field(1, 1, [0.25]), mapping).step).toBe('above')
    expect(summarizeChange(field(1, 1, [-0.25]), mapping).step).toBe('normal')
  })
  it('is "insufficient", never "normal", with too few readable cells', () => {
    const s = summarizeChange(field(4, 1, [0, NaN, NaN, NaN]), mapping)
    expect(s.step).toBe('insufficient')
    expect(s.medianChange).toBeUndefined()
    expect(summarizeChange(field(2, 1, [NaN, NaN]), mapping).step).toBe('insufficient')
  })
  it('answers at exactly minValidFraction', () => {
    expect(summarizeChange(field(2, 1, [0, NaN]), mapping).step).toBe('normal')
  })
})

describe('readField', () => {
  const scale: ColorScale = {
    stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 10, rgb: [255, 0, 0] }],
    noData: [[128, 128, 128]],
    maxColorDistance: 30,
  } as ColorScale
  const image = (w: number, h: number, paint: (x: number, y: number) => number[]) => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set([...paint(x, y), 255], (y * w + x) * 4)
    return { data, width: w, height: h }
  }
  it('reads each cell as the median of its lattice, NaN for no-data and off-scale colors', () => {
    const f = readField(image(6, 3, x => (x < 2 ? [0, 0, 255] : x < 4 ? [128, 128, 128] : [0, 255, 0])), scale, area, 3, 1)
    expect(f.values[0]).toBeCloseTo(0, 0)
    expect(f.values[1]).toBeNaN()
    expect(f.values[2]).toBeNaN()
  })
  it('gives the same field twice', () => {
    const px = image(6, 3, x => [x * 40, 0, 255 - x * 40])
    expect(Array.from(readField(px, scale, area, 3, 1).values)).toEqual(Array.from(readField(px, scale, area, 3, 1).values))
  })
})

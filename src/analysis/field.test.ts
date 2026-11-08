import { describe, expect, it } from 'vitest'
import type { ColorScale } from '../data'
import { readField } from './field'

const area = { x0: 0, y0: 0, x1: 1, y1: 1 }

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

describe('readField lattice rule', () => {
  const scale: ColorScale = { stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 10, rgb: [255, 0, 0] }], noData: [[128, 128, 128]], maxColorDistance: 30 }
  // One cell of 6 × 6 pixels: the lattice samples pixels 1, 3 and 5 in each direction. Grey out the first `grey` columns of samples.
  const cell = (greySamples: number) => {
    const data = new Uint8ClampedArray(6 * 6 * 4)
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const sampleIndex = [1, 3, 5].indexOf(y) * 3 + [1, 3, 5].indexOf(x)
      const grey = sampleIndex >= 0 && [1, 3, 5].includes(x) && [1, 3, 5].includes(y) && sampleIndex < greySamples
      data.set(grey ? [128, 128, 128, 255] : [0, 0, 255, 255], (y * 6 + x) * 4)
    }
    return { data, width: 6, height: 6 }
  }
  it('gives a value with five of nine samples readable and NaN with four', () => {
    expect(readField(cell(4), scale, area, 1, 1).values[0]).toBeCloseTo(0, 0)
    expect(readField(cell(5), scale, area, 1, 1).values[0]).toBeNaN()
  })
})

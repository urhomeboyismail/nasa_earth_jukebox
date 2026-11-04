import { describe, expect, it } from 'vitest'
import type { ColorScale, Frame, Region, RGB, SoundMapping } from '../data'
import { analyzePixels, type Pixels } from './analyze'

const colorScale: ColorScale = {
  stops: [
    { value: 0, rgb: [0, 0, 255] },
    { value: 15, rgb: [255, 255, 0] },
    { value: 30, rgb: [255, 0, 0] },
  ],
  noData: [[128, 128, 128]],
  maxColorDistance: 40,
}

const mapping: SoundMapping = {
  scale: 'C major pentatonic',
  summary: 'median',
  minValidFraction: 0.5,
  categories: [
    { id: 'cold', label: 'Cold', range: [0, 6], note: 'C4' },
    { id: 'cool', label: 'Cool', range: [6, 12], note: 'D4' },
    { id: 'mild', label: 'Mild', range: [12, 18], note: 'E4' },
    { id: 'warm', label: 'Warm', range: [18, 24], note: 'G4' },
    { id: 'hot', label: 'Hot', range: [24, 30], note: 'A4' },
  ],
  tick: { note: 'C6', durationMs: 60 },
  missingCue: { type: 'noise', durationMs: 300 },
}

const frame: Frame = { id: 'f', date: '2024-01-15', image: 'f.png', width: 4, height: 1, altText: '' }

/** One region point per pixel of a row, so pixel i is sampled by point i. */
const region: Region = {
  id: 'r',
  name: 'r',
  description: '',
  points: Array.from({ length: 4 }, (_, i) => ({ x: (i + 0.5) / 4, y: 0.5 })),
}

function row(colors: RGB[]): Pixels {
  const data = new Uint8ClampedArray(colors.length * 4)
  colors.forEach((c, i) => data.set([...c, 255], i * 4))
  return { data, width: colors.length, height: 1 }
}

const run = (colors: RGB[], r: Region = region) => analyzePixels(row(colors), frame, r, colorScale, mapping)

const BLUE: RGB = [0, 0, 255]
const YELLOW: RGB = [255, 255, 0]
const RED: RGB = [255, 0, 0]
const GREY: RGB = [128, 128, 128]

describe('analyzePixels', () => {
  it('reads an exact stop color as that stop', () => {
    expect(run([BLUE, BLUE, BLUE, BLUE])).toMatchObject({ medianValue: 0, category: 'cold', sampled: 4, valid: 4 })
    expect(run([YELLOW, YELLOW, YELLOW, YELLOW])).toMatchObject({ medianValue: 15, category: 'mild' })
    expect(run([RED, RED, RED, RED])).toMatchObject({ medianValue: 30, category: 'hot' })
  })

  it('interpolates a color between two stops', () => {
    // Blue→yellow is 15 units; (51, 51, 204) is a fifth of the way along, so 3. (The exact midpoint would
    // round to the grey no-data color, so it is not used.)
    const fifth: RGB = [51, 51, 204]
    expect(run([fifth, fifth, fifth, fifth])).toMatchObject({ medianValue: 3, category: 'cold' })
    const twoThirds: RGB = [255, 170, 0] // a third of the way from yellow to red (green 255→0), so 20
    expect(run([twoThirds, twoThirds, twoThirds, twoThirds]).medianValue).toBeCloseTo(15 + 15 / 3, 5)
  })

  it('skips no-data pixels', () => {
    const result = run([GREY, BLUE, BLUE, BLUE])
    expect(result).toMatchObject({ sampled: 4, valid: 3, medianValue: 0, category: 'cold' })
  })

  it('skips fully transparent pixels', () => {
    const pixels = row([BLUE, BLUE, BLUE, BLUE])
    ;(pixels.data as Uint8ClampedArray)[3] = 0
    expect(analyzePixels(pixels, frame, region, colorScale, mapping)).toMatchObject({ valid: 3 })
  })

  it('skips unmatched colors instead of guessing', () => {
    const green: RGB = [0, 255, 0]
    const result = run([green, BLUE, BLUE, BLUE])
    expect(result).toMatchObject({ sampled: 4, valid: 3, category: 'cold' })
  })

  it('returns "insufficient" below minValidFraction, and answers at exactly the fraction', () => {
    const below = run([GREY, GREY, GREY, BLUE])
    expect(below).toMatchObject({ valid: 1, category: 'insufficient' })
    expect(below.medianValue).toBeUndefined()
    expect(run([GREY, GREY, BLUE, BLUE])).toMatchObject({ valid: 2, category: 'cold' })
  })

  it('is insufficient when no pixel is valid', () => {
    expect(run([GREY, GREY, GREY, GREY])).toMatchObject({ valid: 0, category: 'insufficient' })
  })

  it('averages the two middle values for an even number of samples', () => {
    // 0, 0, 15, 15 → median 7.5
    expect(run([BLUE, BLUE, YELLOW, YELLOW])).toMatchObject({ medianValue: 7.5, category: 'cool' })
  })

  it('takes the median, so one outlier does not move the answer', () => {
    expect(run([BLUE, BLUE, BLUE, RED])).toMatchObject({ medianValue: 0, category: 'cold' })
  })

  it('puts a value on a shared range edge in the warmer category', () => {
    const at12: RGB = [204, 204, 51] // 0.8 of the way from blue to yellow, so exactly 12
    expect(run([at12, at12, at12, at12])).toMatchObject({ category: 'mild' })
  })

  it('gives the same output for the same input', () => {
    const colors: RGB[] = [BLUE, YELLOW, GREY, RED]
    expect(run(colors)).toEqual(run(colors))
  })

  it('samples the pixel at (x × width, y × height)', () => {
    const grid: Pixels = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([...BLUE, 255, ...RED, 255, ...YELLOW, 255, ...YELLOW, 255]),
    }
    const topRight: Region = { ...region, points: [{ x: 0.99, y: 0.1 }] }
    expect(analyzePixels(grid, frame, topRight, colorScale, mapping)).toMatchObject({ medianValue: 30, category: 'hot' })
    const bottomLeft: Region = { ...region, points: [{ x: 0.1, y: 0.99 }] }
    expect(analyzePixels(grid, frame, bottomLeft, colorScale, mapping)).toMatchObject({ medianValue: 15 })
  })

  it('keeps points at the very edge (x or y = 1) inside the image', () => {
    const edge: Region = { ...region, points: [{ x: 1, y: 1 }] }
    expect(analyzePixels(row([BLUE, BLUE, BLUE, RED]), frame, edge, colorScale, mapping)).toMatchObject({ category: 'hot' })
  })
})

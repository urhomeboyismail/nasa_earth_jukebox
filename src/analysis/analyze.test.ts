import { describe, expect, it } from 'vitest'
import type { ColorScale, Frame, Region, RGB, SoundMapping } from '../data'
import { analyzePixels, gridFromPixels, gridRows, valueAtPixel, type Pixels } from './analyze'

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

describe('valueAtPixel', () => {
  const pixels = row([BLUE, GREY, RED, [0, 255, 0]])

  it('reads a color as its value on the scale', () => {
    expect(valueAtPixel(pixels, 0, 0, colorScale)).toBe(0)
    expect(valueAtPixel(pixels, 2, 0, colorScale)).toBe(30)
  })

  it('gives null for no-data, unmatched and transparent pixels', () => {
    expect(valueAtPixel(pixels, 1, 0, colorScale)).toBeNull()
    expect(valueAtPixel(pixels, 3, 0, colorScale)).toBeNull()
    ;(pixels.data as Uint8ClampedArray)[3] = 0
    expect(valueAtPixel(pixels, 0, 0, colorScale)).toBeNull()
  })

  it('keeps a pixel outside the image inside it', () => {
    expect(valueAtPixel(row([BLUE, RED]), 99, 99, colorScale)).toBe(30)
    expect(valueAtPixel(row([BLUE, RED]), -5, -5, colorScale)).toBe(0)
  })
})

describe('category shares', () => {
  it('gives the fraction of the valid points in each category, and sums to 1', () => {
    // cold, cold, hot, grey: three valid points, two of them cold
    const result = run([BLUE, BLUE, RED, GREY])
    expect(result.shares).toEqual({ cold: 2 / 3, cool: 0, mild: 0, warm: 0, hot: 1 / 3 })
    expect(Object.values(result.shares!).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('splits a region that spans categories, even when the median is one of them', () => {
    expect(run([BLUE, BLUE, BLUE, RED]).shares).toMatchObject({ cold: 0.75, hot: 0.25 })
  })

  it('leaves shares out when nothing is valid or there are too few valid points', () => {
    expect(run([GREY, GREY, GREY, GREY]).shares).toBeUndefined()
    expect(run([GREY, GREY, GREY, BLUE]).shares).toBeUndefined()
  })
})

describe('gridRows', () => {
  it('keeps cells near square: 24 columns across the area, between 6 and 16 rows', () => {
    expect(gridRows(800, 400)).toBe(12)
    expect(gridRows(1200, 600, { x0: 0, y0: 0, x1: 1, y1: 0.88 })).toBe(11)
    expect(gridRows(800, 40)).toBe(6)
    expect(gridRows(100, 400)).toBe(16)
  })
})

describe('gridFromPixels', () => {
  /** A picture `width` × `height` px whose color at each pixel comes from `colorAt`. */
  function picture(width: number, height: number, colorAt: (x: number, y: number) => RGB): Pixels {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set([...colorAt(x, y), 255], (y * width + x) * 4)
    return { data, width, height }
  }
  const at = (grid: ReturnType<typeof gridFromPixels>, col: number, r: number) => grid.cells[r * grid.cols + col]

  it('reads a two-color image as two categories in the right cells', () => {
    const grid = gridFromPixels(picture(48, 24, x => (x < 24 ? BLUE : RED)), frame, colorScale, mapping)
    expect(grid).toMatchObject({ frameId: 'f', cols: 24, rows: 12, area: { x0: 0, y0: 0, x1: 1, y1: 1 } })
    expect(grid.cells).toHaveLength(24 * 12)
    for (let r = 0; r < grid.rows; r++) {
      expect(at(grid, 0, r)).toEqual({ value: 0, category: 'cold' })
      expect(at(grid, 11, r)).toEqual({ value: 0, category: 'cold' })
      expect(at(grid, 12, r)).toEqual({ value: 30, category: 'hot' })
      expect(at(grid, 23, r)).toEqual({ value: 30, category: 'hot' })
    }
  })

  it('puts row 0 at the top', () => {
    const grid = gridFromPixels(picture(48, 24, (_x, y) => (y < 12 ? BLUE : RED)), frame, colorScale, mapping)
    expect(at(grid, 5, 0).category).toBe('cold')
    expect(at(grid, 5, grid.rows - 1).category).toBe('hot')
  })

  it('marks a no-data band "insufficient" with no value, never as a low one', () => {
    const grid = gridFromPixels(picture(48, 24, (_x, y) => (y >= 20 ? GREY : BLUE)), frame, colorScale, mapping)
    for (let c = 0; c < grid.cols; c++) {
      expect(at(grid, c, grid.rows - 1)).toEqual({ value: null, category: 'insufficient' })
      expect(at(grid, c, 0).category).toBe('cold')
    }
  })

  it('needs minValidFraction of the nine samples: five of nine is enough, four is not', () => {
    // 144 × 72 px gives 6 px cells, so the first cell's 3 × 3 lattice lands on x and y in {1, 3, 5}. Only the first `valid`
    // of those nine pixels are blue; the rest of the cell is grey.
    const lattice = [1, 3, 5].flatMap(y => [1, 3, 5].map(x => `${x},${y}`))
    const firstCell = (valid: number) => {
      const blue = new Set(lattice.slice(0, valid))
      return gridFromPixels(picture(144, 72, (x, y) => (x < 6 && y < 6 && !blue.has(`${x},${y}`) ? GREY : BLUE)), frame, colorScale, mapping)
    }
    expect(at(firstCell(5), 0, 0)).toEqual({ value: 0, category: 'cold' })
    expect(at(firstCell(4), 0, 0)).toEqual({ value: null, category: 'insufficient' })
  })

  it('reads only the area it is given, so a legend strip is left out', () => {
    const image = picture(48, 24, (_x, y) => (y >= 12 ? GREY : BLUE))
    const grid = gridFromPixels(image, frame, colorScale, mapping, { x0: 0, y0: 0, x1: 1, y1: 0.5 })
    expect(grid.area).toEqual({ x0: 0, y0: 0, x1: 1, y1: 0.5 })
    expect(grid.rows).toBe(6)
    expect(grid.cells.every(cell => cell.category === 'cold')).toBe(true)
  })

  it('maps the cells of an area to that part of the image', () => {
    const image = picture(48, 24, x => (x < 36 ? BLUE : RED))
    const grid = gridFromPixels(image, frame, colorScale, mapping, { x0: 0.5, y0: 0, x1: 1, y1: 1 })
    // The area starts at x = 24 and is 24 px wide, so one pixel per cell. Blue runs to x = 35, which is cell 11.
    expect(at(grid, 11, 0).category).toBe('cold')
    expect(at(grid, 12, 0).category).toBe('hot')
  })

  it('gives the same output for the same input', () => {
    const image = picture(48, 24, (x, y) => ((x + y) % 5 === 0 ? GREY : x < 24 ? BLUE : RED))
    expect(gridFromPixels(image, frame, colorScale, mapping)).toEqual(gridFromPixels(image, frame, colorScale, mapping))
  })
})

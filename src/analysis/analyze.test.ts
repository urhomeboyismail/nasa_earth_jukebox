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

/** Standard HSV to RGB (hue in degrees, saturation and value 0 to 1), to build awkward colors without writing channel numbers. */
function hsvToRgb(h: number, s: number, v: number): RGB {
  const sector = (((h % 360) + 360) % 360) / 60
  const chroma = v * s
  const x = chroma * (1 - Math.abs((sector % 2) - 1))
  const [r, g, b] = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]][Math.floor(sector) % 6]
  const m = v - chroma
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

/** A legend that keeps away from the grey axis: blue, cyan, yellow, red. Greys, black and white are far from its line. */
const rainbow: ColorScale = {
  stops: [
    { value: 0, rgb: [0, 0, 255] },
    { value: 10, rgb: [0, 255, 255] },
    { value: 20, rgb: [255, 255, 0] },
    { value: 30, rgb: [255, 0, 0] },
  ],
  noData: [],
  maxColorDistance: 40,
}

const valueOf = (rgb: RGB, scale: ColorScale = colorScale, alpha = 255) =>
  valueAtPixel({ data: new Uint8ClampedArray([...rgb, alpha]), width: 1, height: 1 }, 0, 0, scale)

describe('reading a color: edge cases', () => {
  it('gives each stop its own value from its exact color', () => {
    for (const stop of colorScale.stops) expect(valueOf(stop.rgb)).toBe(stop.value)
  })

  it('gives the mean of two stops for the color halfway between them', () => {
    const pair: ColorScale = { stops: [{ value: 10, rgb: [200, 0, 0] }, { value: 20, rgb: [0, 0, 200] }], noData: [[0, 255, 0]], maxColorDistance: 40 }
    expect(valueOf([100, 0, 100], pair)).toBe(15)
  })

  it('keeps the category when each channel of a stop color is off by up to 3 (compression jitter)', () => {
    const categoryOf = (rgb: RGB) => analyzePixels(row([rgb, rgb, rgb, rgb]), frame, region, colorScale, mapping).category
    for (const stop of colorScale.stops) {
      for (const dr of [-3, 0, 3]) for (const dg of [-3, 0, 3]) for (const db of [-3, 0, 3]) {
        const jittered: RGB = [stop.rgb[0] + dr, stop.rgb[1] + dg, stop.rgb[2] + db]
        expect(categoryOf(jittered), `${jittered}`).toBe(categoryOf(stop.rgb))
      }
    }
  })

  it('reads a color at maxColorDistance from the legend, and not one step further', () => {
    // Beyond the red end the nearest point on the line is red itself, so moving the red channel down by n is n away.
    const max = colorScale.maxColorDistance
    expect(valueOf([255 - (max - 1), 0, 0])).toBe(30)
    expect(valueOf([255 - max, 0, 0])).toBe(30)
    expect(valueOf([255 - (max + 1), 0, 0])).toBeNull()
  })

  it('treats hue 0 and hue 360 as the same color', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual(hsvToRgb(360, 1, 1))
    expect(valueOf(hsvToRgb(0, 1, 1), rainbow)).toBe(30)
    expect(valueOf(hsvToRgb(360, 1, 1), rainbow)).toBe(valueOf(hsvToRgb(0, 1, 1), rainbow))
  })

  it('cannot read any grey from black to white (saturation 0), unless the legend has that grey', () => {
    for (let level = 0; level <= 255; level += 5) expect(valueOf(hsvToRgb(0, 0, level / 255), rainbow), `grey ${level}`).toBeNull()
    const greyLegend: ColorScale = { stops: [{ value: 0, rgb: [0, 0, 0] }, { value: 10, rgb: [255, 255, 255] }], noData: [], maxColorDistance: 40 }
    expect(valueOf(hsvToRgb(0, 0, 0.5), greyLegend)).toBeCloseTo(5, 0)
  })

  it('cannot read black (value 0) of any hue, such as coastlines and text', () => {
    for (const hue of [0, 60, 120, 180, 240, 300]) expect(valueOf(hsvToRgb(hue, 1, 0), rainbow)).toBeNull()
  })

  it('cannot read a pale color between two legend colors (low saturation)', () => {
    // Hue 30 sits between red (0) and yellow (60) on the legend, but washed out it is nearer to white than to either.
    expect(valueOf(hsvToRgb(30, 0.1, 0.8), rainbow)).toBeNull()
    expect(valueOf(hsvToRgb(30, 0.15, 0.9), rainbow)).toBeNull()
  })

  it('gives a color equally near two parts of a legend that doubles back the part listed first, every time', () => {
    // Rule (see matchScale): the part listed first wins a tie, because a later part must be strictly nearer.
    const hairpin: ColorScale = {
      stops: [
        { value: 0, rgb: [0, 0, 0] },
        { value: 10, rgb: [200, 0, 0] },
        { value: 20, rgb: [200, 20, 0] },
        { value: 30, rgb: [0, 20, 0] },
      ],
      noData: [],
      maxColorDistance: 40,
    }
    const between: RGB = [100, 10, 0] // 10 from the way out (value 5) and 10 from the way back (value 25)
    for (let i = 0; i < 3; i++) expect(valueOf(between, hairpin)).toBe(5)
  })

  it('reads only fully opaque pixels: alpha 0 to 254 (soft edges) is unreadable, 255 is read', () => {
    expect(valueOf(BLUE, colorScale, 255)).toBe(0)
    for (const alpha of [0, 1, 128, 254]) expect(valueOf(BLUE, colorScale, alpha), `alpha ${alpha}`).toBeNull()
  })

  it('puts a value exactly on a category edge in the warmer category, and a value beyond the ends in the nearest end', () => {
    const wide: ColorScale = { stops: [{ value: -15, rgb: [0, 0, 255] }, { value: 36, rgb: [255, 0, 0] }], noData: [], maxColorDistance: 40 }
    const category = (rgb: RGB) => analyzePixels(row([rgb, rgb, rgb, rgb]), frame, region, wide, mapping)
    // 5 per unit of value, so every value used here is exact
    const at = (value: number): RGB => { const r = (value + 15) * 5; return [r, 0, 255 - r] }
    expect(category(at(6))).toMatchObject({ medianValue: 6, category: 'cool' }) // on the edge of cold and cool
    expect(category(at(24))).toMatchObject({ medianValue: 24, category: 'hot' })
    expect(category(at(30))).toMatchObject({ medianValue: 30, category: 'hot' }) // the top edge of the last range
    expect(category(at(0))).toMatchObject({ medianValue: 0, category: 'cold' })
    expect(category(at(-15))).toMatchObject({ medianValue: -15, category: 'cold' }) // below the first range
    expect(category(at(36))).toMatchObject({ medianValue: 36, category: 'hot' }) // above the last range
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

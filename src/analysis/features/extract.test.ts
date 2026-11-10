import { describe, expect, it } from 'vitest'
import type { Pixels } from '../analyze'
import { readField } from '../field'
import { extractFeatures } from './extract'
import { CELL_PX, inputFor, LAND, paint, SCALE, SCENE_HEIGHT, SCENE_WIDTH, WHOLE, withSquare } from './testScenes'
import { FEATURE_COLS, FEATURE_ROWS, HOTSPOT_MIN_CELLS, LIVE_COLOUR_TOLERANCE, PICTURE_BANDS } from './types'

const CELLS = FEATURE_COLS * FEATURE_ROWS

describe('extractFeatures: a uniform frame', () => {
  const features = extractFeatures(paint(() => 5), inputFor())

  it('reads the middle of the legend', () => {
    expect(features.grid.cols).toBe(FEATURE_COLS)
    expect(features.grid.rows).toBe(FEATURE_ROWS)
    expect(features.grid.values).toHaveLength(CELLS)
    expect(features.stats.validShare).toBe(1)
    expect(features.stats.median).toBeCloseTo(5, 5)
    expect(features.stats.position).toBeCloseTo(0.5, 5)
    expect(features.stats.iqr).toBeCloseTo(0, 5)
    expect(features.reference).toBeCloseTo(0.5, 5)
  })

  it('has one band, no hot spots, no edges and no motion', () => {
    expect(features.histogram).toEqual([0, 1, 0])
    expect(features.hotspots).toEqual([])
    expect(features.edges).toEqual({ density: 0, strongest: null })
    expect(features.motion).toBeNull()
    expect(features.change).toBeNull()
    expect(features.confidence).toBe(1)
  })

  it('carries the frame id, date and mode through', () => {
    expect(features).toMatchObject({ frameId: 'f1', date: '2026-01-01', mode: 'data' })
  })
})

describe('extractFeatures: a warm square', () => {
  // 6 × 4 cells at the top of the legend, on a uniform field.
  const features = extractFeatures(withSquare(5, [20, 10, 6, 4], 10), inputFor())

  it('finds one high hot spot', () => {
    expect(features.hotspots).toHaveLength(1)
    const [spot] = features.hotspots
    expect(spot).toMatchObject({ id: 'h1', band: 'high', cells: 24 })
    expect(spot.areaShare).toBeCloseTo(24 / CELLS, 10)
    expect(spot.centroid.x).toBeCloseTo((20 + 3) / FEATURE_COLS, 2)
    expect(spot.centroid.y).toBeCloseTo((10 + 2) / FEATURE_ROWS, 2)
    expect(spot.peak).toBeCloseTo(10, 5)
    expect(spot.peakPosition).toBeCloseTo(1, 5)
  })

  it('puts the square in the top band and the rest in the middle one', () => {
    expect(features.histogram[0]).toBe(0)
    expect(features.histogram[2]).toBeCloseTo(24 / CELLS, 10)
    expect(features.histogram[1]).toBeCloseTo(1 - 24 / CELLS, 10)
    expect(features.histogram.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('reports the maximum at the first cell of the square', () => {
    expect(features.stats.max?.value).toBeCloseTo(10, 5)
    expect(features.stats.max?.x).toBeCloseTo(20.5 / FEATURE_COLS, 10)
    expect(features.stats.max?.y).toBeCloseTo(10.5 / FEATURE_ROWS, 10)
    expect(features.stats.min?.value).toBeCloseTo(5, 5)
  })

  it('counts the square as edges', () => {
    // 2 × (6 + 4) cells border the square on the inside of each pair: 20 horizontal and vertical pairs differ.
    expect(features.edges.density).toBeCloseTo(20 / (63 * 32 + 64 * 31), 10)
  })

  it('finds the line where a two-level picture crosses its median', () => {
    // Cells at the median count as above it (the contour rule), so a plateau with a small square has no crossing; a 40/60 split does.
    const split = extractFeatures(paint(col => (col < 26 ? 3 : 7)), inputFor())
    expect(split.edges.strongest).not.toBeNull()
    expect(split.edges.strongest!.closed).toBe(false)
    for (const p of split.edges.strongest!.points) expect(p.x).toBeCloseTo(25.5 / FEATURE_COLS + 0.5 / FEATURE_COLS, 1)
    expect(features.edges.strongest).toBeNull()
  })

  it('drops a group that is too small', () => {
    const small = extractFeatures(withSquare(5, [20, 10, 1, HOTSPOT_MIN_CELLS - 1], 10), inputFor())
    expect(small.hotspots).toEqual([])
  })
})

describe('extractFeatures: a low spot', () => {
  it('finds a cold square and reports its lowest cell as the peak', () => {
    const features = extractFeatures(withSquare(5, [4, 20, 5, 4], 0), inputFor())
    expect(features.hotspots).toHaveLength(1)
    expect(features.hotspots[0]).toMatchObject({ band: 'low', cells: 20 })
    expect(features.hotspots[0].peak).toBeCloseTo(0, 5)
    expect(features.hotspots[0].peakPosition).toBeCloseTo(0, 5)
  })
})

describe('extractFeatures: following a frame with the one before', () => {
  const first = extractFeatures(withSquare(5, [20, 10, 6, 4], 10), inputFor({ frameId: 'a' }))
  const second = extractFeatures(withSquare(5, [22, 10, 6, 4], 10), inputFor({ frameId: 'b' }), first)

  it('keeps the id of a spot that moved', () => {
    expect(second.hotspots.map(h => h.id)).toEqual(['h1'])
  })

  it('measures the motion east, in cells', () => {
    expect(second.motion).not.toBeNull()
    expect(second.motion!.dx).toBeCloseTo(2, 10)
    expect(second.motion!.dy).toBeCloseTo(0, 10)
    expect(second.motion!.speed).toBeCloseTo(2, 10)
    expect(second.motion!.direction).toBeCloseTo(0, 10)
    expect(second.motion!.changedShare).toBeGreaterThan(0)
  })

  it('keeps the first reference of the run', () => {
    const warmer = extractFeatures(paint(() => 9), inputFor({ frameId: 'c' }), second)
    expect(warmer.reference).toBeCloseTo(first.reference!, 10)
    expect(warmer.stats.position).toBeCloseTo(0.9, 2) // 9 on the legend, rounded to 8-bit colour
  })

  it('gives a new spot a new id, and never issues an id twice', () => {
    // Frame 2 has the old spot (h1) and a new one (h2). Frame 3 has only the old one. Frame 4 has a new one: h3, not h2 again.
    const twoSpots = (c: number) => paint((col, row) => (col >= c && col < c + 6 && row >= 10 && row < 14) || (col >= 4 && col < 8 && row >= 24 && row < 28) ? 10 : 5)
    const f2 = extractFeatures(twoSpots(20), inputFor(), first)
    expect(f2.hotspots.map(h => h.id).sort()).toEqual(['h1', 'h2'])
    const f3 = extractFeatures(withSquare(5, [20, 10, 6, 4], 10), inputFor(), f2)
    expect(f3.hotspots.map(h => h.id)).toEqual(['h1'])
    const f4 = extractFeatures(twoSpots(20), inputFor(), f3)
    expect(f4.hotspots.map(h => h.id).sort()).toEqual(['h1', 'h3'])
    expect(f4.hotspotSerial).toBe(3)
  })

  it('has no motion when the previous frame had nothing readable', () => {
    const blank = extractFeatures(paint(() => 'land'), inputFor())
    expect(extractFeatures(paint(() => 5), inputFor(), blank).motion).toBeNull()
  })

  it('ignores a previous frame of the other mode', () => {
    const picture = extractFeatures(paint(() => 5), inputFor({ mode: 'picture' }))
    const data = extractFeatures(paint(() => 5), inputFor(), picture)
    expect(data.motion).toBeNull()
    expect(data.reference).toBeCloseTo(0.5, 5)
  })
})

describe('extractFeatures: land', () => {
  it('has no median when too few cells can be read, and never reads land as a low value', () => {
    // 70% of the columns are land: 30% readable, minValidFraction is 0.5.
    const features = extractFeatures(paint(col => (col >= 20 ? 'land' : 5)), inputFor())
    expect(features.stats.validShare).toBeCloseTo(20 / 64, 10)
    expect(features.stats).toMatchObject({ median: null, position: null, iqr: null, min: null, max: null })
    expect(features.hotspots).toEqual([])
    expect(features.edges.strongest).toBeNull()
    expect(features.histogram).toEqual([0, 1, 0])
    expect(features.grid.values[FEATURE_COLS - 1]).toBeNaN()
    expect(features.grid.position[FEATURE_COLS - 1]).toBeNaN()
  })

  it('gives zeros when nothing can be read', () => {
    const features = extractFeatures(paint(() => 'land'), inputFor())
    expect(features.stats.validShare).toBe(0)
    expect(features.histogram).toEqual([0, 0, 0])
    expect(features.confidence).toBe(0)
    expect(features.reference).toBeNull()
  })

  it('reads a frame with a little land normally', () => {
    const features = extractFeatures(paint(col => (col >= 60 ? 'land' : 5)), inputFor())
    expect(features.stats.median).toBeCloseTo(5, 5)
    expect(features.stats.validShare).toBeCloseTo(60 / 64, 10)
  })
})

describe('extractFeatures: picture mode', () => {
  // A grey ramp, dark in the west and bright in the east.
  const ramp = paint(col => { const g = Math.round((255 * col) / (FEATURE_COLS - 1)); return [g, g, g] })
  const features = extractFeatures(ramp, inputFor({ mode: 'picture' }))

  it('follows brightness from west to east', () => {
    expect(features.mode).toBe('picture')
    expect(features.grid.position[0]).toBeCloseTo(0, 5)
    expect(features.grid.position[FEATURE_COLS - 1]).toBeCloseTo(1, 5)
    for (let col = 1; col < FEATURE_COLS; col++) expect(features.grid.position[col]).toBeGreaterThan(features.grid.position[col - 1])
    expect(features.grid.values[10]).toBeCloseTo(features.grid.position[10], 10)
  })

  it('has PICTURE_BANDS bands that sum to 1', () => {
    expect(features.histogram).toHaveLength(PICTURE_BANDS)
    expect(features.histogram.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(features.stats.position).toBeCloseTo(0.5, 1)
  })

  it('finds a bright spot and a dark spot', () => {
    expect(features.hotspots.map(h => h.band).sort()).toEqual(['high', 'low'])
    const high = features.hotspots.find(h => h.band === 'high')!
    expect(high.centroid.x).toBeGreaterThan(0.8)
    expect(high.peakPosition).toBeCloseTo(1, 2)
  })

  it('reads the brightness of colour, not the legend, and ignores the legend and the baseline', () => {
    const red = paint(() => [255, 0, 0])
    const f = extractFeatures(red, inputFor({ mode: 'picture', colorScale: { ...SCALE, stops: [] }, baseline: { pixels: red, noiseFloor: 0 } }))
    expect(f.stats.median).toBeCloseTo(0.2126, 4)
    expect(f.change).toBeNull()
  })

  it('cannot read a pixel that is not fully opaque, and confidence is the opaque share', () => {
    const half: Pixels = { data: new Uint8ClampedArray(ramp.data), width: ramp.width, height: ramp.height }
    // Make the east half see-through.
    for (let y = 0; y < SCENE_HEIGHT; y++) for (let x = SCENE_WIDTH / 2; x < SCENE_WIDTH; x++) (half.data as Uint8ClampedArray)[(y * SCENE_WIDTH + x) * 4 + 3] = 100
    const f = extractFeatures(half, inputFor({ mode: 'picture' }))
    expect(f.stats.validShare).toBeCloseTo(0.5, 10)
    expect(f.confidence).toBeCloseTo(0.5, 10)
    expect(f.grid.position[FEATURE_COLS - 1]).toBeNaN()
  })
})

describe('extractFeatures: confidence and live colour', () => {
  /** Value 5 is (128, 0, 128); moving a colour along green moves it straight away from the legend by that many units. */
  const off = (distance: number) => paint(() => [128, distance, 128])

  it('is 1 for colours exactly on the legend', () => {
    expect(extractFeatures(off(0), inputFor()).confidence).toBe(1)
  })

  it('drops when colours are off the legend but still read', () => {
    const f = extractFeatures(off(20), inputFor())
    expect(f.stats.validShare).toBe(1)
    expect(f.confidence).toBe(0)
  })

  it('is half when half the picture is off the legend', () => {
    const f = extractFeatures(paint(col => (col < 32 ? [128, 0, 128] : [128, 20, 128])), inputFor())
    expect(f.confidence).toBeCloseTo(0.5, 10)
  })

  it('reads nothing a data frame would not read, unless it is live video', () => {
    const shifted = off(40) // beyond maxColorDistance (30) but inside LIVE_COLOUR_TOLERANCE × 30 = 45
    expect(extractFeatures(shifted, inputFor()).stats.validShare).toBe(0)
    const live = extractFeatures(shifted, inputFor({ colourTolerance: LIVE_COLOUR_TOLERANCE }))
    expect(live.stats.validShare).toBe(1)
    expect(live.stats.median).toBeCloseTo(5, 5)
    expect(live.confidence).toBe(0)
  })

  it('samples the same 3 × 3 lattice readField does', () => {
    // Only the nine lattice pixels of each cell are on the legend; everything else is land. A different lattice would read less than all of them.
    const lattice = new Set([1, 5, 8]) // floor(CELL_PX × (1/6, 1/2, 5/6))
    const sparse = paint(() => 'land')
    const data = sparse.data as Uint8ClampedArray
    for (let y = 0; y < SCENE_HEIGHT; y++) {
      for (let x = 0; x < SCENE_WIDTH; x++) {
        if (lattice.has(y % CELL_PX) && lattice.has(x % CELL_PX)) data.set([128, 0, 128, 255], (y * SCENE_WIDTH + x) * 4)
      }
    }
    expect(LAND).toEqual([128, 128, 128])
    const f = extractFeatures(sparse, inputFor())
    expect(f.stats.validShare).toBe(1)
    expect(f.confidence).toBe(1)
    expect(Array.from(f.grid.values)).toEqual(Array.from(readField(sparse, SCALE, WHOLE, FEATURE_COLS, FEATURE_ROWS).values))
  })
})

describe('extractFeatures: change from a baseline', () => {
  const frame = paint(() => 7)

  it('names the step and gives a shift from -1 to +1', () => {
    const f = extractFeatures(frame, inputFor({ baseline: { pixels: paint(() => 5), noiseFloor: 0.1 } }))
    expect(f.change?.step).toBe('much-above')
    expect(f.change?.shift).toBe(1)
    expect(f.change?.medianChange).toBeCloseTo(2, 5)
    const below = extractFeatures(paint(() => 3), inputFor({ baseline: { pixels: paint(() => 5), noiseFloor: 0.1 } }))
    expect(below.change).toMatchObject({ step: 'much-below', shift: -1 })
  })

  it('is at the middle step, shift 0, when nothing changed or the change is under the noise floor', () => {
    expect(extractFeatures(frame, inputFor({ baseline: { pixels: paint(() => 7), noiseFloor: 0.1 } })).change).toMatchObject({ step: 'normal', shift: 0 })
    expect(extractFeatures(frame, inputFor({ baseline: { pixels: paint(() => 6.9), noiseFloor: 0.5 } })).change).toMatchObject({ step: 'normal', shift: 0 })
  })

  it('treats the frame as the change when the baseline is an anomaly product (pixels null)', () => {
    const f = extractFeatures(paint(() => 0.5), inputFor({ baseline: { pixels: null, noiseFloor: 0 } }))
    expect(f.change?.step).toBe('above')
    expect(f.change?.shift).toBeCloseTo(0.5, 10)
  })

  it('is insufficient, with no shift, when too little is readable', () => {
    const mostlyLand = paint(col => (col < 20 ? 7 : 'land'))
    const f = extractFeatures(mostlyLand, inputFor({ baseline: { pixels: paint(() => 5), noiseFloor: 0 } }))
    expect(f.change).toMatchObject({ step: 'insufficient', shift: null })
  })

  it('is null without a baseline, and without change steps', () => {
    expect(extractFeatures(frame, inputFor()).change).toBeNull()
    const noSteps = { ...inputFor().mapping, changeSteps: undefined }
    expect(extractFeatures(frame, inputFor({ mapping: noSteps, baseline: { pixels: paint(() => 5), noiseFloor: 0 } })).change).toBeNull()
  })

  it('throws for a baseline picture of another size', () => {
    const small: Pixels = { data: new Uint8ClampedArray(4), width: 1, height: 1 }
    expect(() => extractFeatures(frame, inputFor({ baseline: { pixels: small, noiseFloor: 0 } }))).toThrow('The baseline image must be the same size as the frame.')
  })
})

describe('extractFeatures: area and determinism', () => {
  it('reads only the map area, and reports places as fractions of the whole image', () => {
    // The right half is the map; a legend bar on the left is a colour that is not on the scale.
    const picture = paint(col => (col < 32 ? [0, 255, 0] : 5))
    const f = extractFeatures(picture, inputFor({ area: { x0: 0.5, y0: 0, x1: 1, y1: 1 } }))
    expect(f.stats.validShare).toBe(1)
    expect(f.stats.min!.x).toBeGreaterThan(0.5)
    expect(f.stats.min!.x).toBeCloseTo(0.5 + 0.5 / FEATURE_COLS / 2, 10)
  })

  it('gives the same features for the same input, grid bytes included', () => {
    const run = () => extractFeatures(withSquare(5, [20, 10, 6, 4], 10), inputFor(), extractFeatures(withSquare(5, [18, 10, 6, 4], 10), inputFor()))
    expect(run()).toEqual(run())
    expect(Array.from(new Uint8Array(run().grid.values.buffer))).toEqual(Array.from(new Uint8Array(run().grid.values.buffer)))
  })

  it('does not change the pixels or the previous features it was given', () => {
    const pixels = withSquare(5, [20, 10, 6, 4], 10)
    const copy = Uint8ClampedArray.from(pixels.data as Uint8ClampedArray)
    const previous = extractFeatures(pixels, inputFor())
    // Typed arrays are written out as lists (NaN as null), so the comparison does not depend on which realm made them.
    const written = () => JSON.stringify(previous, (_key, value) => (ArrayBuffer.isView(value) ? Array.from(value as Float32Array) : value))
    const snapshot = written()
    extractFeatures(pixels, inputFor(), previous)
    expect(Array.from(pixels.data as Uint8ClampedArray)).toEqual(Array.from(copy))
    expect(written()).toBe(snapshot)
  })
})

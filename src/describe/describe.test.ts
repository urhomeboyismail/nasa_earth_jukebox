import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import globe from '../../public/data/synthetic-globe/manifest.json'
import type { ChangeVisualization, Contour, FrameAnalysis, FrameGrid, GridCell, Score } from '../analysis'
import { analyzePixels, gridFromPixels } from '../analysis/analyze'
import { decodePng } from '../analysis/png'
import type { CategoryId, Visualization } from '../data'
import { describeCell, describeChange, describeContour, describeFrame, describeSequence, describeSweep } from '.'

// The globe has twelve monthly frames of 2024, five categories (cold, cool, mild, warm, hot) and a region called
// "North-east patch": the data the sentences in ticket T69 are written for.
const visualization = globe as unknown as Visualization
const { frames } = visualization
const region = visualization.regions[0]

type Spec = CategoryId | 'insufficient'
/** One result per month, each given a category; its value is the middle of the category's range. */
function resultsFor(categories: Spec[], overrides: Record<number, Partial<FrameAnalysis>> = {}): FrameAnalysis[] {
  return categories.map((category, i) => {
    const range = visualization.mapping.categories.find(c => c.id === category)?.range
    const base: FrameAnalysis = category === 'insufficient'
      ? { frameId: frames[i].id, regionId: region.id, sampled: 30, valid: 12, category }
      : { frameId: frames[i].id, regionId: region.id, sampled: 30, valid: 30, category, medianValue: range && (range[0] + range[1]) / 2 }
    return { ...base, ...overrides[i] }
  })
}

const YEAR: Spec[] = ['cool', 'cool', 'cool', 'warm', 'mild', 'mild', 'hot', 'hot', 'warm', 'insufficient', 'mild', 'mild']

const readFileBytes = (path: string) => readFileSync(resolve(fileURLToPath(import.meta.url), '../../..', path))

describe('describeFrame', () => {
  it('describes a date, its readable points, its change and its shares', () => {
    const results = resultsFor(['cool', 'cool', 'warm'], {
      2: { medianValue: 21.4, valid: 28, shares: { cold: 0, cool: 0, mild: 0.2, warm: 0.7, hot: 0.1 } },
    })
    expect(describeFrame(visualization, results, 2)).toBe(
      'March 2024. North-east patch: warm, about 21 °C. 28 of 30 points could be read. Up two steps from February (cool). Mostly warm (70%), some mild (20%) and hot (10%).',
    )
  })

  it('says "First date." for the first, "Same as" for no change and "Down" for a fall', () => {
    const results = resultsFor(['mild', 'mild', 'cool'])
    expect(describeFrame(visualization, results, 0)).toContain('First date.')
    expect(describeFrame(visualization, results, 1)).toContain('Same as January.')
    expect(describeFrame(visualization, results, 2)).toContain('Down one step from February (mild).')
  })

  it('describes a date with too little data, and says what it plays', () => {
    expect(describeFrame(visualization, resultsFor(YEAR), 9)).toBe(
      'October 2024. North-east patch: not enough data. Only 12 of 30 points could be read (land, cloud or labels), so this date plays the hiss, not a note.',
    )
    const none = resultsFor(['cool', 'insufficient'], { 1: { valid: 0 } })
    expect(describeFrame(visualization, none, 1)).toContain('None of the 30 points could be read')
  })

  it('compares with the last date that has data, across a gap, and says when there is none', () => {
    expect(describeFrame(visualization, resultsFor(YEAR), 10)).toContain('Down one step from September (warm).')
    const gapFirst = resultsFor(['insufficient', 'cool'])
    expect(describeFrame(visualization, gapFirst, 1)).toContain('First date with data.')
  })

  it('lists only shares of at least 10%, to the nearest 10%', () => {
    const shares = { cold: 0, cool: 0.04, mild: 0.14, warm: 0.82, hot: 0 }
    const text = describeFrame(visualization, resultsFor(['warm'], { 0: { shares } }), 0)
    expect(text).toContain('Mostly warm (80%), some mild (10%).')
    expect(text).not.toContain('cool (')
  })

  it('says "Split between" when no category has half, "All" when one has everything, and nothing without shares', () => {
    const split = describeFrame(visualization, resultsFor(['mild'], { 0: { shares: { cold: 0, cool: 0, mild: 0.4, warm: 0.3, hot: 0.3 } } }), 0)
    expect(split).toContain('Split between mild (40%), warm (30%) and hot (30%).')
    const all = describeFrame(visualization, resultsFor(['mild'], { 0: { shares: { cold: 0, cool: 0, mild: 1, warm: 0, hot: 0 } } }), 0)
    expect(all).toContain('All mild.')
    expect(describeFrame(visualization, resultsFor(['mild']), 0)).not.toMatch(/Mostly|Split|All /)
  })

  it('gives nothing for a date that is not there', () => {
    expect(describeFrame(visualization, resultsFor(YEAR), 99)).toBe('')
    expect(describeFrame(visualization, [], 0)).toBe('')
  })

  it('writes dates at the level the data set needs: months for monthly frames', () => {
    const text = describeFrame(visualization, resultsFor(YEAR), 4)
    expect(text.startsWith('May 2024.')).toBe(true)
  })
})

describe('describeSequence', () => {
  it('describes a whole year: ends, extremes, the biggest change and the gap', () => {
    expect(describeSequence(visualization, resultsFor(YEAR))).toBe(
      '12 dates, January to December 2024, in the north-east patch. It starts cool and ends mild. Warmest: hot, in July and August. Coolest: cool, in January, February and March. Biggest change: up two steps, from March (cool) to April (warm). Not enough data in October.',
    )
  })

  it('counts dates instead of listing more than three in one item', () => {
    const text = describeSequence(visualization, resultsFor(['cool', 'cool', 'cool', 'cool', 'hot', 'insufficient', 'insufficient', 'insufficient', 'insufficient']))
    expect(text).toContain('Coolest: cool, on 4 dates.')
    expect(text).toContain('Not enough data on 4 dates.')
    expect(text).toContain('Warmest: hot, in May.')
  })

  it('says it starts and ends the same, and that nothing changed, when every date is alike', () => {
    expect(describeSequence(visualization, resultsFor(['cool', 'cool', 'cool']))).toBe(
      '3 dates, January to March 2024, in the north-east patch. It starts and ends cool. Every date with data is cool, so there is no change.',
    )
  })

  it('names the first of two equal biggest changes, and a fall as down', () => {
    const text = describeSequence(visualization, resultsFor(['hot', 'mild', 'hot']))
    expect(text).toContain('Biggest change: down two steps, from January (hot) to February (mild).')
  })

  it('handles one date, no data at all, and no dates', () => {
    expect(describeSequence(visualization, resultsFor(['mild']))).toBe(
      '1 date, January 2024, in the north-east patch. It starts and ends mild. Every date with data is mild, so there is no change.',
    )
    expect(describeSequence(visualization, resultsFor(['insufficient', 'insufficient']))).toBe(
      '2 dates, January to February 2024, in the north-east patch. No date had enough data.',
    )
    expect(describeSequence(visualization, [])).toBe('There are no dates.')
  })

  it('keeps a region name with capitals of its own, and gives both years across a year end', () => {
    const arctic = { ...visualization, regions: [{ ...region, name: 'Arctic Ocean' }] }
    expect(describeSequence(arctic, resultsFor(['cool', 'warm']))).toContain('in the Arctic Ocean.')
    const fix = fixture as unknown as Visualization
    const results: FrameAnalysis[] = fix.frames.map((f, i) => ({
      frameId: f.id, regionId: fix.regions[0].id, sampled: 9, valid: i === 3 ? 0 : 9, category: (['cold', 'mild', 'hot', 'insufficient'] as const)[i],
    }))
    const text = describeSequence(fix, results)
    expect(text).toContain('4 dates, January 2024 to March 2025, in the ')
    expect(text).toContain('It starts cold and ends hot.')
    expect(text).toContain('Biggest change: up two steps, from January 2024 (cold) to July 2024 (mild).')
    expect(text).toContain('Not enough data in March 2025.')
  })
})

/** A 24 × 11 grid, every cell without data except the ones given as "col,row". */
function gridOf(cells: Record<string, GridCell> = {}, cols = 24, rows = 11): FrameGrid {
  const out: GridCell[] = Array.from({ length: cols * rows }, (_, i) => cells[`${i % cols},${Math.floor(i / cols)}`] ?? { value: null, category: 'insufficient' })
  return { frameId: frames[0].id, cols, rows, area: { x0: 0, y0: 0, x1: 1, y1: 0.88 }, cells: out }
}

describe('describeCell', () => {
  const grid = gridOf({ '18,2': { value: 21.4, category: 'warm' } })

  it('says the category, the value and where the cell is', () => {
    expect(describeCell(visualization, grid, 18, 2)).toBe('Warm, about 21 °C, north-east (column 19 of 24, row 3 of 11).')
  })

  it('says a cell without data has none, and never gives it a value', () => {
    expect(describeCell(visualization, grid, 18, 3)).toBe('Not enough data (land, cloud or labels), north-east (column 19 of 24, row 4 of 11).')
  })

  it('splits the map into thirds each way for the compass word', () => {
    const word = (col: number, row: number) => /, ([a-z-]+) \(column/.exec(describeCell(visualization, grid, col, row))![1]
    expect([[0, 0], [12, 0], [23, 0], [0, 5], [12, 5], [23, 5], [0, 10], [12, 10], [23, 10]].map(([c, r]) => word(c, r))).toEqual([
      'north-west', 'north', 'north-east', 'west', 'centre', 'east', 'south-west', 'south', 'south-east',
    ])
  })

  it('says so for a cell outside the map', () => {
    for (const [col, row] of [[-1, 0], [24, 0], [0, 11], [1.5, 0]]) expect(describeCell(visualization, grid, col, row)).toBe('That is outside the map.')
  })
})

describe('describeSweep', () => {
  // Row 2: land for 4 cells, cool for 6, mild for 8, warm for 6.
  const row: GridCell[] = [
    ...Array<GridCell>(4).fill({ value: null, category: 'insufficient' }),
    ...Array<GridCell>(6).fill({ value: 8, category: 'cool' }),
    ...Array<GridCell>(8).fill({ value: 14, category: 'mild' }),
    ...Array<GridCell>(6).fill({ value: 20, category: 'warm' }),
  ]
  const cells = Object.fromEntries(row.map((cell, col) => [`${col},2`, cell]))
  const grid = gridOf(cells)

  it('collapses a row into runs, west to east', () => {
    expect(describeSweep(visualization, grid, { kind: 'row', index: 2 })).toBe('Row 3, west to east: not enough data for 4 cells, cool for 6, mild for 8, warm for 6.')
  })

  it('reads a column north to south, and says "cell" only on the first run', () => {
    expect(describeSweep(visualization, grid, { kind: 'column', index: 4 })).toBe(
      'Column 5, north to south: not enough data for 2 cells, cool for 1, not enough data for 8.',
    )
  })

  it('says so for a row or column that is not there', () => {
    expect(describeSweep(visualization, grid, { kind: 'row', index: 11 })).toBe('There is no row 12.')
    expect(describeSweep(visualization, grid, { kind: 'column', index: -1 })).toBe('There is no column 0.')
  })
})

describe('on the real synthetic-globe frames', () => {
  const read = (image: string) => decodePng(readFileBytes(`public/data/synthetic-globe/${image}`))
  const pixels = read(frames[0].image)
  const grid = gridFromPixels(pixels, frames[0], visualization.colorScale, visualization.mapping, visualization.mapArea)

  it('describes a sweep across the map with land in it, and its runs add up to the row', () => {
    const text = describeSweep(visualization, grid, { kind: 'row', index: Math.floor(grid.rows / 2) })
    expect(text).toMatch(/^Row \d+, west to east: /)
    expect(text).toContain('not enough data for')
    const total = [...text.matchAll(/ for (\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0)
    expect(total).toBe(grid.cols)
  })

  it('describes a date read from its picture', () => {
    const results = frames.map(frame => analyzePixels(read(frame.image), frame, region, visualization.colorScale, visualization.mapping))
    const text = describeFrame(visualization, results, 0)
    expect(text).toMatch(/^January 2024\. North-east patch: [a-z]+, about \d+ °C\. 30 of 30 points could be read\. First date\./)
    expect(describeFrame(visualization, results, 9)).toContain('not enough data')
  })
})

describe('determinism', () => {
  it('gives the same words for the same input, every time', () => {
    const results = resultsFor(YEAR, { 4: { shares: { cold: 0, cool: 0, mild: 0.6, warm: 0.4, hot: 0 } } })
    const grid = gridOf({ '3,3': { value: 9, category: 'cool' } })
    for (let i = 0; i < results.length; i++) expect(describeFrame(visualization, results, i)).toBe(describeFrame(visualization, results, i))
    expect(describeSequence(visualization, results)).toBe(describeSequence(visualization, results))
    expect(describeCell(visualization, grid, 3, 3)).toBe(describeCell(visualization, grid, 3, 3))
    expect(describeSweep(visualization, grid, { kind: 'row', index: 3 })).toBe(describeSweep(visualization, grid, { kind: 'row', index: 3 }))
  })
})

describe('concise detail (F19)', () => {
  const concise = { detail: 'concise' } as const
  const cellGrid = gridOf({ '18,2': { value: 21.4, category: 'warm' } })
  const rowCells: GridCell[] = [
    ...Array<GridCell>(4).fill({ value: null, category: 'insufficient' }),
    ...Array<GridCell>(6).fill({ value: 8, category: 'cool' }),
    ...Array<GridCell>(14).fill({ value: 14, category: 'mild' }),
  ]
  const lineGrid = gridOf(Object.fromEntries(rowCells.map((cell, col) => [`${col},2`, cell])))

  it('describes a cell as its label, rounded value and place: "Warm, 21 °C, north-east."', () => {
    expect(describeCell(visualization, cellGrid, 18, 2, concise)).toBe('Warm, 21 °C, north-east.')
    expect(describeCell(visualization, cellGrid, 18, 3, concise)).toBe('Not enough data, north-east.')
    expect(describeCell(visualization, cellGrid, 99, 3, concise)).toBe('That is outside the map.')
  })

  it('describes a date as its month, label, value and change: "March: warm, 21 °C, up two steps."', () => {
    const results = resultsFor(['cool', 'cool', 'warm', 'insufficient', 'warm', 'cool'], { 2: { medianValue: 21.4 } })
    expect(describeFrame(visualization, results, 0, concise)).toBe('January: cool, 9 °C, first date.')
    expect(describeFrame(visualization, results, 1, concise)).toBe('February: cool, 9 °C, same.')
    expect(describeFrame(visualization, results, 2, concise)).toBe('March: warm, 21 °C, up two steps.')
    expect(describeFrame(visualization, results, 3, concise)).toBe('April: not enough data.')
    expect(describeFrame(visualization, results, 5, concise)).toBe('June: cool, 9 °C, down two steps.')
  })

  it('compares with the last date that has data, so a gap does not hide a change', () => {
    const results = resultsFor(['cool', 'insufficient', 'cool', 'warm'])
    expect(describeFrame(visualization, results, 2, concise)).toBe('March: cool, 9 °C, same.')
  })

  it('leaves out the value when there is none, and the year only when it is one year', () => {
    const results = resultsFor(['cool', 'warm'], { 1: { medianValue: undefined } })
    expect(describeFrame(visualization, results, 1, concise)).toBe('February: warm, up two steps.')
    const spread: Visualization = { ...visualization, frames: frames.map((frame, i) => ({ ...frame, date: i === 11 ? '2025-12-15' : frame.date })) }
    expect(describeFrame(spread, resultsFor(['cool', 'cool']), 0, concise)).toBe('January 2024: cool, 9 °C, first date.')
  })

  it('describes a row as its runs: "Row 3: not enough data 4, cool 6, mild 14."', () => {
    expect(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }, concise)).toBe('Row 3: not enough data 4, cool 6, mild 14.')
    expect(describeSweep(visualization, lineGrid, { kind: 'row', index: 40 }, concise)).toBe('There is no row 41.')
  })

  it('is shorter than the rich text for every one of them', () => {
    const results = resultsFor(YEAR)
    expect(describeFrame(visualization, results, 3, concise).length).toBeLessThan(describeFrame(visualization, results, 3).length)
    expect(describeCell(visualization, cellGrid, 18, 2, concise).length).toBeLessThan(describeCell(visualization, cellGrid, 18, 2).length)
    expect(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }, concise).length).toBeLessThan(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }).length)
  })

  it('leaves every existing call exactly as it was: rich is the default', () => {
    const results = resultsFor(YEAR)
    expect(describeFrame(visualization, results, 3, { detail: 'rich' })).toBe(describeFrame(visualization, results, 3))
    expect(describeFrame(visualization, results, 3, {})).toBe(describeFrame(visualization, results, 3))
    expect(describeCell(visualization, cellGrid, 18, 2, { detail: 'rich' })).toBe('Warm, about 21 °C, north-east (column 19 of 24, row 3 of 11).')
    expect(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }, { detail: 'rich' })).toBe(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }))
  })

  it('gives the same words for the same input, every time', () => {
    const results = resultsFor(YEAR)
    for (let i = 0; i < results.length; i++) expect(describeFrame(visualization, results, i, concise)).toBe(describeFrame(visualization, results, i, concise))
    expect(describeCell(visualization, cellGrid, 18, 2, concise)).toBe(describeCell(visualization, cellGrid, 18, 2, concise))
    expect(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }, concise)).toBe(describeSweep(visualization, lineGrid, { kind: 'row', index: 2 }, concise))
  })
})

// ---- describeChange and describeContour (T115) ----

const changeSteps = [
  { id: 'much-below', range: [-Infinity, -2] as [number, number] },
  { id: 'below', range: [-2, -0.5] as [number, number] },
  { id: 'near-normal', range: [-0.5, 0.5] as [number, number] },
  { id: 'above', range: [0.5, 2] as [number, number] },
  { id: 'much-above', range: [2, Infinity] as [number, number] },
]
const contourLevels = [{ value: 1 }, { value: 2 }]
type Baseline = NonNullable<ChangeVisualization['baseline']>
const withBaseline = (baseline: Baseline): ChangeVisualization =>
  ({ ...(visualization as unknown as ChangeVisualization), baseline, mapping: { ...visualization.mapping, changeSteps, contourLevels } })
const climatology = withBaseline({ kind: 'climatology', label: 'the 1991 to 2020 average', noiseFloor: 0.2 })
const referenceDate = withBaseline({ kind: 'reference-date', frameId: frames[0].id, label: 'January 2024', noiseFloor: 0.2 })
const anomalyProduct = withBaseline({ kind: 'anomaly-product' })

const score = (over: Partial<Score['change']> = {}): Score => ({
  frameId: frames[5].id, contours: [], change: { step: 'above', medianChange: 0.8, shareAbove: [0.42, 0.04], validFraction: 0.9, ...over },
})
const line = (points: [number, number][], over: Partial<Contour> = {}): Contour => ({
  level: 1, closed: false, brokenEnds: 0, brokenStart: false, brokenEnd: false,
  points: points.map(([x, y]) => ({ x, y, turn: 0, front: 1 })), ...over,
})

describe('describeChange', () => {
  it('says the step, the change and what it is measured against, then the share of the map', () => {
    expect(describeChange(climatology, score())).toBe(
      'Above: +0.8 °C compared with the 1991 to 2020 average. About 40% of the readable map is at least +1 °C.',
    )
  })

  it('keeps only the step and the change at the concise level', () => {
    expect(describeChange(climatology, score(), { detail: 'concise' })).toBe('Above: +0.8 °C compared with the 1991 to 2020 average.')
  })

  it('always says "change since <date>" for a reference date, and never "normal" or "anomaly"', () => {
    const text = describeChange(referenceDate, score())
    expect(text).toContain('Change since January 2024: +0.8 °C (above).')
    expect(text).not.toMatch(/anomal|normal/i)
    expect(describeChange(referenceDate, score(), { detail: 'concise' })).toBe('Change since January 2024: +0.8 °C (above).')
  })

  it('says "anomaly" for an anomaly product, and only there or for a climatology', () => {
    expect(describeChange(anomalyProduct, score())).toMatch(/^Above: \+0\.8 °C anomaly\./)
    for (const v of [referenceDate]) expect(describeChange(v, score({ step: 'much-below', medianChange: -2.4 }))).not.toMatch(/anomal/i)
  })

  it('writes a fall with a minus sign and a step in words', () => {
    expect(describeChange(referenceDate, score({ step: 'much-below', medianChange: -2.4, shareAbove: [0, 0] }), { detail: 'concise' }))
      .toBe('Change since January 2024: −2.4 °C (much below).')
  })

  it('says there is not enough data, and why', () => {
    const insufficient = score({ step: 'insufficient', medianChange: undefined, validFraction: 0.2 })
    expect(describeChange(climatology, insufficient)).toBe(
      'Change compared with the 1991 to 2020 average: not enough data. Only 20% of the map could be read (land, cloud or labels), so there is no change to report.',
    )
    expect(describeChange(climatology, insufficient, { detail: 'concise' })).toBe('Change: not enough data.')
  })

  it('leaves the share out when no level covers a tenth of the map', () => {
    expect(describeChange(climatology, score({ shareAbove: [0.05, 0] }))).toBe('Above: +0.8 °C compared with the 1991 to 2020 average.')
  })

  it('says there is nothing to describe for a data set with no baseline', () => {
    expect(describeChange(visualization as unknown as ChangeVisualization, score())).toMatch(/no baseline/)
  })

  it('is the same for the same input', () => {
    expect(describeChange(climatology, score())).toBe(describeChange(climatology, score()))
  })
})

describe('describeContour', () => {
  it('says where an open line runs and how wide it is, in compass sectors', () => {
    expect(describeContour(climatology, line([[0.1, 0.1], [0.3, 0.3], [0.5, 0.5]]))).toBe(
      'A +1 °C line runs from the north-west to the centre, about a third of the map wide.',
    )
  })

  it('names a closed line by the sector it circles', () => {
    expect(describeContour(climatology, line([[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6]], { closed: true }))).toBe(
      'A +1 °C line circles the centre, about a third of the map wide.',
    )
  })

  it('says when a line stops where there is no data', () => {
    expect(describeContour(climatology, line([[0.1, 0.1], [0.9, 0.9]], { brokenEnds: 1, brokenEnd: true }))).toBe(
      'A +1 °C line runs from the north-west to the south-east, most of the map wide. It stops where the map has no data.',
    )
  })

  it('is short at the concise level', () => {
    expect(describeContour(climatology, line([[0.1, 0.1], [0.5, 0.5]]), { detail: 'concise' })).toBe('+1 °C line, north-west to centre.')
  })

  it('writes the level of a line below normal with a minus sign', () => {
    expect(describeContour(referenceDate, line([[0.1, 0.5], [0.3, 0.5]], { level: -1 }))).toContain('A −1 °C line')
  })

  it('never names a sea or a country, and never says "anomaly" for a reference date', () => {
    const text = describeContour(referenceDate, line([[0.1, 0.1], [0.8, 0.8]]))
    expect(text).not.toMatch(/ocean|sea|anomal/i)
  })
})

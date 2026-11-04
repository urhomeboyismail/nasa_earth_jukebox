import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { analyzeGrid, type FrameGrid } from '.'

const { frames, colorScale, mapping } = fixture as Visualization
const ids = mapping.categories.map(category => category.id)
const rankOf = (cell: FrameGrid['cells'][number]) => ids.indexOf(cell.category as string)
const rowOf = (grid: FrameGrid, row: number) => grid.cells.slice(row * grid.cols, (row + 1) * grid.cols)

describe('analyzeGrid (stub until T65)', () => {
  it('describes its own shape: 24 columns, 12 rows, one cell each, for the frame asked about', async () => {
    const grid = await analyzeGrid(frames[0], colorScale, mapping)
    expect(grid).toMatchObject({ frameId: frames[0].id, cols: 24, rows: 12 })
    expect(grid.cells).toHaveLength(24 * 12)
  })

  it('covers the whole image unless told which area to read', async () => {
    expect((await analyzeGrid(frames[0], colorScale, mapping)).area).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
    const area = { x0: 0, y0: 0, x1: 1, y1: 0.88 }
    expect((await analyzeGrid(frames[0], colorScale, mapping, area)).area).toEqual(area)
  })

  it('runs from the coolest category in the west to the warmest in the east, row by row', async () => {
    const grid = await analyzeGrid(frames[0], colorScale, mapping)
    for (let row = 0; row < grid.rows; row++) {
      const readable = rowOf(grid, row).filter(cell => cell.category !== 'insufficient')
      expect(readable[0].category).toBe(ids[0])
      expect(readable[readable.length - 1].category).toBe(ids[ids.length - 1])
      readable.forEach((cell, i) => i > 0 && expect(rankOf(cell)).toBeGreaterThanOrEqual(rankOf(readable[i - 1])))
    }
  })

  it('leaves the last two columns without data, and never gives them a value', async () => {
    const grid = await analyzeGrid(frames[0], colorScale, mapping)
    for (let row = 0; row < grid.rows; row++) {
      const cells = rowOf(grid, row)
      expect(cells.slice(-2)).toEqual([{ value: null, category: 'insufficient' }, { value: null, category: 'insufficient' }])
      expect(cells.slice(0, -2).every(cell => cell.category !== 'insufficient' && typeof cell.value === 'number')).toBe(true)
    }
  })

  it('gives each cell a value inside its own category', async () => {
    const grid = await analyzeGrid(frames[0], colorScale, mapping)
    for (const cell of grid.cells.filter(c => c.category !== 'insufficient')) {
      const category = mapping.categories.find(c => c.id === cell.category)!
      expect(cell.value).toBeGreaterThanOrEqual(category.range[0])
      expect(cell.value).toBeLessThanOrEqual(category.range[1])
    }
  })

  it('gives the same result every time', async () => {
    expect(await analyzeGrid(frames[2], colorScale, mapping)).toEqual(await analyzeGrid(frames[2], colorScale, mapping))
  })
})

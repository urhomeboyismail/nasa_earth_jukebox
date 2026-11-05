// The known-frames check from PLAN.md §9, on the real image files: every frame of the synthetic data sets, decoded from its
// PNG, must give the category, count and median that its expected.json says. This is also a check that the
// scripts, the manifests and the analysis agree about colors.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { Visualization } from '../data'
import { analyzePixels, gridFromPixels } from './analyze'
import { decodePng } from './png'

type Expected = { frameId: string; regionId: string; sampled: number; valid: number; medianValue: number | null; category: string }

// Colors are stored as 8-bit channels, so a value comes back up to about 0.03 degrees away from the one drawn. The ticket's 0.01
// is tighter than one color step allows. 0.05 is still far below the 0.75 degree margin the scripts keep from category edges.
const MEDIAN_TOLERANCE = 0.05

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const readJson = <T>(id: string, file: string) => JSON.parse(readFileSync(`${dataDir}/${id}/${file}`, 'utf8')) as T
const readFrame = (id: string, image: string) => decodePng(readFileSync(`${dataDir}/${id}/${image}`))

describe.each(['synthetic-ocean', 'synthetic-globe'])('%s: every frame gives the category it should', id => {
  const visualization = readJson<Visualization>(id, 'manifest.json')
  const { frames: expected } = readJson<{ frames: Expected[] }>(id, 'expected.json')
  const { colorScale, mapping } = visualization

  it('has an expected result for every frame and region', () => {
    expect(expected).toHaveLength(visualization.frames.length * visualization.regions.length)
  })

  it.each(expected.map(e => [`${e.frameId} · ${e.regionId}`, e] as const))('%s', (_name, want) => {
    const frame = visualization.frames.find(f => f.id === want.frameId)!
    const region = visualization.regions.find(r => r.id === want.regionId)!
    const pixels = readFrame(id, frame.image)
    expect(pixels).toMatchObject({ width: frame.width, height: frame.height })

    const got = analyzePixels(pixels, frame, region, colorScale, mapping)
    expect(got).toMatchObject({ sampled: want.sampled, valid: want.valid, category: want.category })
    if (want.medianValue === null) expect(got.medianValue).toBeUndefined()
    else expect(Math.abs(got.medianValue! - want.medianValue)).toBeLessThanOrEqual(MEDIAN_TOLERANCE)
  })
})

describe('the sound map of the synthetic globe', () => {
  const id = 'synthetic-globe'
  const visualization = readJson<Visualization>(id, 'manifest.json')
  const { colorScale, mapping, mapArea } = visualization
  const frame = visualization.frames[0]
  const grid = gridFromPixels(readFrame(id, frame.image), frame, colorScale, mapping, mapArea)
  const rowCells = (row: number) => grid.cells.slice(row * grid.cols, (row + 1) * grid.cols)
  const rank = (category: string) => mapping.categories.findIndex(c => c.id === category)

  it('leaves out the legend bar, so the grid is a little wider than tall', () => {
    expect(grid).toMatchObject({ cols: 24, rows: 11, area: mapArea })
  })

  it('is warm near the equator and cold towards the top and bottom edges', () => {
    const readable = (row: number) => rowCells(row).filter(cell => cell.value !== null)
    const mean = (row: number) => readable(row).reduce((sum, cell) => sum + cell.value!, 0) / readable(row).length
    const middle = Math.floor(grid.rows / 2)
    expect(mean(middle)).toBeGreaterThan(mean(0) + 10)
    expect(mean(middle)).toBeGreaterThan(mean(grid.rows - 1) + 10)
    expect(rowCells(middle).some(cell => rank(cell.category) >= rank('warm'))).toBe(true)
  })

  it('is insufficient over land, with no value, and never a cold reading', () => {
    const land = grid.cells.filter(cell => cell.category === 'insufficient')
    expect(land.length).toBeGreaterThan(grid.cells.length / 10)
    expect(land.every(cell => cell.value === null)).toBe(true)
  })

  it('gives the same grid every time', () => {
    expect(gridFromPixels(readFrame(id, frame.image), frame, colorScale, mapping, mapArea)).toEqual(grid)
  })
})

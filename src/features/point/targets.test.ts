import { describe, expect, it } from 'vitest'
import type { Hotspot } from '../../analysis/features/types'
import fixture from '../../../public/data/fixture/manifest.json'
import { visualizationSchema } from '../../data/schema'
import { COMPASS_PLACES, compassPoint, nextOffline, offlineOrder, pointText, resolveTarget } from './targets'

const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const spot = (id: string, cells: number, x: number, y: number, band: Hotspot['band'] = 'high'): Hotspot => ({
  id, band, centroid: { x, y }, cells, areaShare: cells / 2048, peak: 30, peakPosition: 0.9,
})
const SPOTS = [spot('h1', 40, 0.8, 0.2), spot('h2', 90, 0.1, 0.9, 'low'), spot('h3', 60, 0.5, 0.5)]
// The fixture's own category words: its warmest category names a 'high' spot, its coolest a 'low' one.
const words = visualizationSchema.parse(fixture)
const highWord = words.mapping.categories[words.mapping.categories.length - 1].label.toLowerCase()
const lowWord = words.mapping.categories[0].label.toLowerCase()

describe('resolveTarget', () => {
  it('gives a hot spot its centroid and the cell under it', () => {
    expect(resolveTarget('h1', SPOTS, WHOLE, 10, 5)).toEqual({ x: 0.8, y: 0.2, cell: { col: 8, row: 1 }, spot: SPOTS[0] })
  })

  it('puts each compass place in the middle of its third of the map', () => {
    const cells = COMPASS_PLACES.map(place => resolveTarget(place, [], WHOLE, 9, 9)?.cell)
    expect(cells).toEqual([
      { col: 1, row: 1 }, { col: 4, row: 1 }, { col: 7, row: 1 },
      { col: 1, row: 4 }, { col: 4, row: 4 }, { col: 7, row: 4 },
      { col: 1, row: 7 }, { col: 4, row: 7 }, { col: 7, row: 7 },
    ])
  })

  it('places a compass point inside the map area, not the whole image', () => {
    const area = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.5 }
    expect(compassPoint('centre', area)).toEqual({ x: 0.5, y: 0.30000000000000004 })
    expect(compassPoint('north-west', area).x).toBeCloseTo(0.3)
    expect(resolveTarget('south-east', [], area, 6, 6)?.cell).toEqual({ col: 5, row: 5 })
  })

  it('gives null for an unknown id or place, so nothing plays', () => {
    expect(resolveTarget('h9', SPOTS, WHOLE, 10, 5)).toBeNull()
    expect(resolveTarget('up', SPOTS, WHOLE, 10, 5)).toBeNull()
    expect(resolveTarget('', [], WHOLE, 10, 5)).toBeNull()
  })
})

describe('the offline order', () => {
  it('visits the hot spots by size, largest first, then the centre, and wraps', () => {
    const order = offlineOrder(SPOTS)
    expect(order).toEqual(['h2', 'h3', 'h1', 'centre'])
    const visited: string[] = []
    let last: string | null = null
    for (let press = 0; press < 6; press++) { last = nextOffline(order, last); visited.push(last) }
    expect(visited).toEqual(['h2', 'h3', 'h1', 'centre', 'h2', 'h3'])
  })

  it('is just the centre when the date has no hot spot', () => {
    expect(offlineOrder([])).toEqual(['centre'])
    expect(nextOffline(['centre'], 'centre')).toBe('centre')
  })

  it('starts again from the first when the last place is not in this order', () => {
    expect(nextOffline(['h2', 'centre'], 'north-east')).toBe('h2')
  })
})

describe('pointText', () => {
  it('ranks a spot among the spots of its band, in the data set\'s own words, and says where it is', () => {
    const at = (id: string) => pointText(resolveTarget(id, SPOTS, WHOLE, 10, 5)!, id, SPOTS, words)
    expect(at('h3')).toBe(`Pointing at the largest ${highWord} area, centre.`)
    expect(at('h1')).toBe(`Pointing at the second-largest ${highWord} area, north-east.`)
    expect(at('h2')).toBe(`Pointing at the largest ${lowWord} area, south-west.`)
  })

  it('names a compass place as it is', () => {
    expect(pointText(resolveTarget('centre', [], WHOLE, 10, 5)!, 'centre', [], words)).toBe('Pointing at the centre of the map.')
    expect(pointText(resolveTarget('north-east', [], WHOLE, 10, 5)!, 'north-east', [], words)).toBe('Pointing at the north-east of the map.')
  })
})

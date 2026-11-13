import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { ColorScale, RGB } from '../data'
import { colourAt } from './colourAt'

// The fixture's scale: blue at 0, yellow at 15, red at 30. The expected values are what colourAt returned before VIS3
// removed its cast, so they must not change.
const scale: ColorScale = {
  stops: fixture.colorScale.stops.map(stop => ({ value: stop.value, rgb: [stop.rgb[0], stop.rgb[1], stop.rgb[2]] })),
  noData: [],
  maxColorDistance: fixture.colorScale.maxColorDistance,
}

describe('colourAt', () => {
  it.each<[number, RGB]>([
    [0, [0, 0, 255]],
    [15, [255, 255, 0]],
    [30, [255, 0, 0]],
  ])('gives the stop colour at a stop (%d)', (value, rgb) => {
    expect(colourAt(scale, value)).toEqual(rgb)
  })

  it.each<[number, RGB]>([
    [7.5, [128, 128, 128]],
    [5, [85, 85, 170]],
    [22.5, [255, 128, 0]],
    [29, [255, 17, 0]],
  ])('blends the two stops around %d, rounding each channel', (value, rgb) => {
    expect(colourAt(scale, value)).toEqual(rgb)
  })

  it('gives the end colours beyond the legend', () => {
    expect(colourAt(scale, -100)).toEqual([0, 0, 255])
    expect(colourAt(scale, 1e6)).toEqual([255, 0, 0])
  })

  it('does not depend on the order of the stops', () => {
    const shuffled: ColorScale = { ...scale, stops: [scale.stops[2], scale.stops[0], scale.stops[1]] }
    expect(colourAt(shuffled, 22.5)).toEqual([255, 128, 0])
  })

  it('returns three channels', () => {
    expect(colourAt(scale, 12)).toHaveLength(3)
  })
})

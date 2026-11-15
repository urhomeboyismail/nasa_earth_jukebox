import { describe, expect, it } from 'vitest'
import type { Pixels } from '../../analysis/analyze'
import { altFor, musicFramesFor, visualizationInputFor } from './liveImages'
import type { ImageLegend } from './mascotQuery'

// A made-up data legend: cold blue to warm red, four stops.
const legend: ImageLegend = {
  kind: 'data',
  unit: '°C',
  stops: [
    { value: 0, rgb: [0, 0, 255] },
    { value: 10, rgb: [0, 255, 255] },
    { value: 20, rgb: [255, 255, 0] },
    { value: 30, rgb: [255, 0, 0] },
  ],
}
const picture: ImageLegend = { kind: 'picture' }

/** A 64 × 32 picture of one colour. */
function filled(rgba: [number, number, number, number]): Pixels {
  const width = 64
  const height = 32
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i)
  return { data, width, height }
}

const loader = (byUrl: Record<string, Pixels>) => async (url: string) => {
  const found = byUrl[url]
  if (!found) throw new Error('not found')
  return found
}
const image = (url: string, date = '2026-06-01') => ({ date, url })

describe('visualizationInputFor', () => {
  it('data: decodes through the stops, five equal bands over their span, and reads a mostly-land picture', () => {
    const input = visualizationInputFor(legend)
    expect(input.mode).toBe('data')
    expect(input.colorScale).toEqual({ stops: legend.kind === 'data' ? legend.stops : [], noData: [], maxColorDistance: 40 })
    expect(input.mapping.categories.map(c => c.range)).toEqual([[0, 6], [6, 12], [12, 18], [18, 24], [24, 30]])
    expect(input.mapping.minValidFraction).toBe(0.3)
    expect(input.area).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
  })

  it('picture: reads brightness', () => {
    expect(visualizationInputFor(picture).mode).toBe('picture')
  })
})

describe('musicFramesFor', () => {
  it('in data mode a warm picture plays a higher melody than a cold one', async () => {
    const load = loader({ cold: filled([0, 0, 255, 255]), warm: filled([255, 0, 0, 255]) })
    const [cold] = await musicFramesFor([image('cold')], legend, load)
    const [warm] = await musicFramesFor([image('warm')], legend, load)
    expect(cold.frame.melody?.midi).toBeLessThan(warm.frame.melody?.midi ?? 0)
    expect([cold.loaded, warm.loaded]).toEqual([true, true])
  })

  it('a fully transparent picture (all land) is a dropout, and one that did not load is a dropout marked not loaded', async () => {
    const load = loader({ land: filled([0, 0, 0, 0]), sea: filled([255, 255, 0, 255]) })
    const frames = await musicFramesFor([image('sea'), image('land', '2026-06-02'), image('missing', '2026-06-03')], legend, load)
    expect(frames.map(f => [f.frame.dropout, f.loaded])).toEqual([[false, true], [true, true], [true, false]])
    expect(frames.map(f => f.frame.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })

  it('in picture mode a bright picture plays higher than a dark one', async () => {
    const load = loader({ dark: filled([20, 20, 20, 255]), bright: filled([240, 240, 240, 255]) })
    const [dark] = await musicFramesFor([image('dark')], picture, load)
    const [bright] = await musicFramesFor([image('bright')], picture, load)
    expect(dark.frame.dropout).toBe(false)
    expect(dark.frame.melody?.midi).toBeLessThan(bright.frame.melody?.midi ?? 0)
  })

  it('the same pictures always give the same music', async () => {
    const load = loader({ a: filled([0, 255, 255, 255]), b: filled([255, 0, 0, 255]) })
    const run = () => musicFramesFor([image('a'), image('b', '2026-06-02')], legend, load)
    expect(await run()).toEqual(await run())
  })
})

describe('altFor', () => {
  const area: [number, number, number, number] = [47.4, -19, 47.6, -18.8]
  it('says the kind, the date and the area, from a template', () => {
    expect(altFor({ legend, area }, '2026-09-26')).toBe('Map of values in °C on 26 September 2026, 47.4° to 47.6°, -19° to -18.8°.')
    expect(altFor({ legend: picture, area }, '2026-09-26')).toBe('Satellite picture on 26 September 2026, 47.4° to 47.6°, -19° to -18.8°.')
  })
})

import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import { checkCatalogEntry, checkDataset, describeProblem } from './check'
import type { Visualization } from './types'

const valid = () => structuredClone(fixture) as unknown as Visualization

/** A PNG file's bytes, enough for the header checks (the pixel data is a placeholder). */
function png(width: number, height: number, { depth = 8, colorType = 2, interlace = 0 } = {}): Uint8Array {
  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header.set([depth, colorType, 0, 0, interlace], 8)
  const chunk = (name: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length)
    new DataView(out.buffer).setUint32(0, body.length)
    out.set([...name].map(c => c.charCodeAt(0)), 4)
    out.set(body, 8)
    return out
  }
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', new Uint8Array(1)), chunk('IEND', new Uint8Array())]
  return Uint8Array.from(parts.flatMap(part => [...part]))
}

/** Every frame is a PNG of exactly the size its manifest states, unless the test says otherwise. */
const filesFor = (v: Visualization, overrides: Record<string, Uint8Array | null> = {}) => (image: string) => {
  const override = overrides[image]
  if (override === null) throw new Error('ENOENT')
  if (override) return override
  const frame = v.frames.find(f => f.image === image)!
  return png(frame.width, frame.height)
}

/** The problems after a change to a copy of the fixture, as the lines the check prints. */
function problemsAfter(change: (v: any) => void, overrides: Record<string, Uint8Array | null> = {}): string[] {
  const v: any = valid()
  change(v)
  return checkDataset(v, filesFor(v, overrides)).map(describeProblem)
}

describe('checkDataset', () => {
  it('finds nothing wrong with the fixture', () => {
    const v = valid()
    expect(checkDataset(v, filesFor(v))).toEqual([])
  })

  it('names the file and field when a PNG is not the size the manifest says', () => {
    const v = valid()
    const image = v.frames[1].image
    expect(problemsAfter(() => {}, { [image]: png(400, 100) })).toEqual([
      `public/data/fixture/manifest.json: frames.1.width: is ${v.frames[1].width} but "${image}" is 400 pixels wide`,
    ])
    expect(problemsAfter(() => {}, { [image]: png(v.frames[1].width, 50) })).toEqual([
      `public/data/fixture/manifest.json: frames.1.height: is ${v.frames[1].height} but "${image}" is 50 pixels high`,
    ])
  })

  it('names the frame whose image file is missing', () => {
    const image = valid().frames[2].image
    expect(problemsAfter(() => {}, { [image]: null })).toEqual([
      `public/data/fixture/manifest.json: frames.2.image: there is no file "${image}" in public/data/fixture/`,
    ])
  })

  it('rejects a PNG that is not 8-bit RGB or RGBA, is interlaced, or is not a PNG at all', () => {
    const image = valid().frames[0].image
    const one = (bytes: Uint8Array) => problemsAfter(() => {}, { [image]: bytes })[0]
    expect(one(png(200, 100, { depth: 16 }))).toMatch(/frames\.0\.image: ".*" is a 16-bit PNG/)
    expect(one(png(200, 100, { colorType: 3 }))).toMatch(/frames\.0\.image: ".*" has PNG colour type 3/)
    expect(one(png(200, 100, { interlace: 1 }))).toMatch(/frames\.0\.image: ".*" is an interlaced PNG/)
    expect(one(new Uint8Array([1, 2, 3]))).toMatch(/frames\.0\.image: ".*" is not a PNG file/)
    expect(problemsAfter(() => {}, { [image]: png(200, 100, { colorType: 6 }) })).toEqual([])
  })

  it('rejects a date used twice', () => {
    expect(problemsAfter(v => { v.frames[1].date = v.frames[0].date })).toEqual([
      'public/data/fixture/manifest.json: frames.1.date: 2024-01-15 is used twice (also by "2024-01-15"); each date appears once',
    ])
  })

  it('rejects frames that are not in date order', () => {
    expect(problemsAfter(v => v.frames.reverse())[0]).toBe(
      'public/data/fixture/manifest.json: frames.1.date: 2024-12-15 is earlier than 2025-03-15 in "2025-03-15"; frames go in date order, oldest first',
    )
  })

  it('rejects a legend stop that does not read back as its own value', () => {
    // The warmest stop is given the coldest stop's colour, so the legend doubles back on itself.
    const lines = problemsAfter(v => { v.colorScale.stops[2].rgb = [0, 0, 255] })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^public\/data\/fixture\/manifest\.json: colorScale\.stops\.2\.rgb: \[0,0,255\] reads as 0, not the stop's value 30; the legend and the analysis disagree$/)
  })

  it('rejects a legend stop whose colour is read as missing data', () => {
    expect(problemsAfter(v => { v.colorScale.noData = [[0, 0, 250]] }).some(line => /colorScale\.stops\.0: the stop's own colour \[0,0,255\] is read as missing data/.test(line))).toBe(true)
  })

  it('rejects a no-data colour that lies on the legend line', () => {
    const lines = problemsAfter(v => { v.colorScale.noData = [[127, 127, 127]] })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^public\/data\/fixture\/manifest\.json: colorScale\.noData\.0: \[127,127,127\] lies within maxColorDistance \(40\) of the legend's colour line, at value 7\.\d+; land or labels/)
  })

  it('rejects categories that stop short of the legend at either end', () => {
    expect(problemsAfter(v => { v.mapping.categories[0].range = [2, 6] })).toEqual([
      "public/data/fixture/manifest.json: mapping.categories.0.range: starts at 2, above the legend's lowest value 0; the categories must cover the whole legend",
    ])
    expect(problemsAfter(v => { v.mapping.categories[4].range = [24, 28] })).toEqual([
      "public/data/fixture/manifest.json: mapping.categories.4.range: ends at 28, below the legend's highest value 30; the categories must cover the whole legend",
    ])
  })

  it('names every field that still contains TODO', () => {
    const lines = problemsAfter(v => {
      v.source.credit = 'TODO: from the source page'
      v.regions[0].name = 'Somewhere TODO'
      v.frames[2].altText = 'TODO'
    })
    expect([...lines].sort()).toEqual([
      'public/data/fixture/manifest.json: regions.0.name: still contains TODO ("Somewhere TODO"); replace it with the real text from the source',
      'public/data/fixture/manifest.json: source.credit: still contains TODO ("TODO: from the source page"); replace it with the real text from the source',
      'public/data/fixture/manifest.json: frames.2.altText: still contains TODO ("TODO"); replace it with the real text from the source',
    ].sort())
  })
})

describe('checkCatalogEntry', () => {
  it('accepts a finished entry and names the field of one with TODO left', () => {
    expect(checkCatalogEntry({ id: 'x', title: 'X', summary: 'Done.' })).toEqual([])
    expect(checkCatalogEntry({ id: 'x', title: 'TODO: title', summary: 'Done.' }).map(describeProblem)).toEqual([
      'public/data/index.json: title: still contains TODO ("TODO: title"); replace it with the real text',
    ])
  })
})

import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import { checkCatalogEntry, checkDataset, describeProblem, legendRounding } from './check'
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

// ---- Baselines (v2, T111) ----

/** A real, decodable 8-bit RGB PNG (the checksums are left as zeros; the readers do not look at them). `colour` gives each pixel. */
function realPng(width: number, height: number, colour: (x: number, y: number) => [number, number, number]): Uint8Array {
  const raw = new Uint8Array((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) raw.set(colour(x, y), y * (width * 3 + 1) + 1 + x * 3) // each row starts with filter type 0
  }
  const header = new Uint8Array(13)
  new DataView(header.buffer).setUint32(0, width)
  new DataView(header.buffer).setUint32(4, height)
  header.set([8, 2, 0, 0, 0], 8)
  const chunk = (name: string, body: Uint8Array) => {
    const out = new Uint8Array(12 + body.length)
    new DataView(out.buffer).setUint32(0, body.length)
    out.set([...name].map(c => c.charCodeAt(0)), 4)
    out.set(body, 8)
    return out
  }
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]
  return Uint8Array.from(parts.flatMap(part => [...part]))
}

const YELLOW: [number, number, number] = [255, 255, 0] // the fixture legend's value 15
const LAND: [number, number, number] = [200, 200, 200] // the fixture's no-data grey

const climatology = (v: any, noiseFloor = 0.2) => {
  v.baseline = { kind: 'climatology', label: 'the made-up normal', noiseFloor }
  v.frames.forEach((f: any) => { f.baselineImage = `baselines/${f.date}.png` })
}

/** Every baseline is a good picture of the frame's size unless the test says otherwise. */
const baselineFiles = (v: Visualization, overrides: Record<string, Uint8Array | null> = {}) => (image: string) => {
  if (image in overrides) {
    if (overrides[image] === null) throw new Error('ENOENT')
    return overrides[image]!
  }
  const frame = v.frames.find(f => f.image === image || f.baselineImage === image)!
  return image === frame.image ? png(frame.width, frame.height) : realPng(frame.width, frame.height, () => YELLOW)
}

function baselineProblems(change: (v: any) => void, overrides: Record<string, Uint8Array | null> = {}): string[] {
  const v: any = valid()
  change(v)
  return checkDataset(v, baselineFiles(v, overrides)).map(describeProblem)
}

describe('legendRounding', () => {
  it('is the largest change in value per unit of colour distance along any segment', () => {
    // First segment: 10 degrees over 100 colour steps is 0.1. Second: 4 degrees over 20 steps is 0.2, the worst.
    const stops = [{ value: 0, rgb: [0, 0, 0] as [number, number, number] }, { value: 10, rgb: [100, 0, 0] as [number, number, number] }, { value: 14, rgb: [100, 20, 0] as [number, number, number] }]
    expect(legendRounding(stops)).toBeCloseTo(4 / 20, 6) // the second segment: 4 degrees over 20 colour steps
  })

  it('skips a segment where the colour does not change', () => {
    expect(legendRounding([{ value: 0, rgb: [5, 5, 5] }, { value: 9, rgb: [5, 5, 5] }])).toBe(0)
  })

  it('is 15 / 255 for the fixture, whose yellow-to-red segment is the steepest', () => {
    expect(legendRounding(valid().colorScale.stops)).toBeCloseTo(15 / 255, 6)
  })
})

describe('checkDataset: baselines (v2)', () => {
  it('finds nothing wrong with a climatology whose baseline images fit', () => {
    expect(baselineProblems(v => climatology(v))).toEqual([])
  })

  it('does nothing for a data set with no baseline', () => {
    expect(baselineProblems(() => {})).toEqual([])
  })

  it('rejects a baseline image of another size, and says it is never resampled', () => {
    const v: any = valid()
    climatology(v)
    const name = v.frames[1].baselineImage
    const lines = baselineProblems(climatology, { [name]: realPng(100, 50, () => YELLOW) })
    expect(lines).toEqual([
      `public/data/fixture/manifest.json: frames.1.baselineImage: "${name}" is 100 x 50 pixels but frame "${v.frames[1].id}" is 200 x 100; a baseline must be exactly the same size as its frame (it is never resampled), so make it again at the frame's size`,
    ])
  })

  it('names the frame whose baseline file is missing', () => {
    const v: any = valid()
    climatology(v)
    const name = v.frames[3].baselineImage
    expect(baselineProblems(climatology, { [name]: null })).toEqual([
      `public/data/fixture/manifest.json: frames.3.baselineImage: there is no file "${name}" in public/data/fixture/`,
    ])
  })

  it('rejects a baseline that is not a readable PNG', () => {
    const v: any = valid()
    climatology(v)
    const name = v.frames[0].baselineImage
    expect(baselineProblems(climatology, { [name]: new Uint8Array([1, 2, 3]) })[0]).toMatch(/frames\.0\.baselineImage: ".*" is not a PNG file/)
    // A file with a good header but no real picture data.
    expect(baselineProblems(climatology, { [name]: png(200, 100) })[0]).toMatch(/frames\.0\.baselineImage: ".*" could not be read: /)
  })

  it('rejects a baseline that mostly does not read through the legend', () => {
    const v: any = valid()
    climatology(v)
    const name = v.frames[2].baselineImage
    // Grey land everywhere: nothing reads, so the share is 0%.
    expect(baselineProblems(climatology, { [name]: realPng(200, 100, () => LAND) })).toEqual([
      `public/data/fixture/manifest.json: frames.2.baselineImage: only 0% of the map area in "${name}" reads through the legend, but at least 50% is needed; it may use a different legend or a different map area from its frame`,
    ])
    // Half land, half readable: exactly the share the data set allows.
    expect(baselineProblems(climatology, { [name]: realPng(200, 100, x => (x < 100 ? LAND : YELLOW)) })).toEqual([])
    // Only the map area counts: land outside it does not matter.
    expect(baselineProblems(v2 => { climatology(v2); v2.mapArea = { x0: 0, y0: 0, x1: 1, y1: 0.5 } }, { [name]: realPng(200, 100, (_, y) => (y < 50 ? YELLOW : LAND)) })).toEqual([])
  })

  it('rejects a noise floor below twice the legend rounding, and says what it should be', () => {
    expect(baselineProblems(v => climatology(v, 0.1))).toEqual([
      'public/data/fixture/manifest.json: baseline.noiseFloor: is 0.1 but must be at least 0.12, twice the legend\'s rounding (0.059 °C per colour step); a smaller floor would turn legend rounding into change',
    ])
    expect(baselineProblems(v => climatology(v, 0.118))).toEqual([]) // 2 x 15/255 = 0.1176
  })

  it('applies the noise floor rule to a reference date too, and needs no images for it', () => {
    const referenceDate = (floor: number) => (v: any) => { v.baseline = { kind: 'reference-date', frameId: v.frames[0].id, label: 'January 2024', noiseFloor: floor } }
    expect(baselineProblems(referenceDate(0.3))).toEqual([])
    expect(baselineProblems(referenceDate(0.05))[0]).toMatch(/baseline\.noiseFloor: is 0\.05 but must be at least 0\.12/)
  })

  it('wants an anomaly product to have a legend that goes below and above 0', () => {
    const anomaly = (v: any) => { v.baseline = { kind: 'anomaly-product' } }
    expect(baselineProblems(anomaly)).toEqual([
      'public/data/fixture/manifest.json: colorScale.stops: run from 0 to 30, which does not span both signs; an anomaly product shows a change from normal, so its legend must go below and above 0. If the legend shows a temperature, use a climatology or a reference date',
    ])
    // Shifting the legend to -15 .. 15 makes it a change; the category ranges still cover it.
    expect(baselineProblems(v => {
      anomaly(v)
      v.colorScale.stops.forEach((stop: any) => { stop.value -= 15 })
      v.mapping.categories.forEach((c: any) => { c.range = c.range.map((n: number) => n - 15) })
    })).toEqual([])
  })
})

describe('checkDataset: the video (SN05)', () => {
  const SRC = 'video/fixture.mp4'
  /** The first bytes of an MP4: a box of 32 bytes whose type is ftyp, brand isom. Enough for the check, which never decodes the video. */
  const mp4 = Uint8Array.from([0, 0, 0, 32, ...[...'ftypisom'].map(c => c.charCodeAt(0)), 0, 0, 2, 0])
  const withVideo = (v: any) => { v.video = { src: SRC, fps: 12, firstFrameDate: v.frames[0].date, frameStepDays: 1 } }

  it('finds nothing wrong with an MP4 that is there', () => {
    expect(problemsAfter(withVideo, { [SRC]: mp4 })).toEqual([])
  })

  it('names video.src when the file is missing', () => {
    expect(problemsAfter(withVideo, { [SRC]: null })).toEqual([
      'public/data/fixture/manifest.json: video.src: there is no file "video/fixture.mp4" in public/data/fixture/',
    ])
  })

  it('names video.src when the file is not an MP4', () => {
    const notMp4 = 'public/data/fixture/manifest.json: video.src: "video/fixture.mp4" is not an MP4 file (no ftyp box); convert it to H.264 MP4 (scripts/eic_ingest.py, EIC01)'
    expect(problemsAfter(withVideo, { [SRC]: png(10, 10) })).toEqual([notMp4])
    expect(problemsAfter(withVideo, { [SRC]: new Uint8Array(3) })).toEqual([notMp4])
  })
})

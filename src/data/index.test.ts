import { afterEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import { DataError, loadCatalog, loadVisualization } from '.'

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input)))))
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

describe('loadCatalog', () => {
  it('returns the list from index.json', async () => {
    mockFetch(url => (url.endsWith('/data/index.json') ? json([{ id: 'fixture', title: 'T', summary: 'S' }]) : json({}, 404)))
    expect(await loadCatalog()).toEqual([{ id: 'fixture', title: 'T', summary: 'S' }])
  })

  it('names the file when it is not a list', async () => {
    mockFetch(() => json({ nope: true }))
    await expect(loadCatalog()).rejects.toThrow(/index\.json: must be a list/)
  })
})

describe('loadVisualization', () => {
  it('resolves frame images to full URLs', async () => {
    mockFetch(url => (url.endsWith('/data/fixture/manifest.json') ? json(fixture) : json({}, 404)))
    const loaded = await loadVisualization('fixture')
    expect(loaded.frames[0].image).toBe('/data/fixture/frames/2024-01-15.png')
    expect(loaded.frames).toHaveLength(fixture.frames.length)
  })

  it('resolves a frame\'s baselineImage to a full URL too, so the analysis reads the data set\'s folder and not the page\'s', async () => {
    const withBaseline = {
      ...fixture,
      baseline: { kind: 'climatology', label: 'the normal for each month', noiseFloor: 0.2 },
      frames: fixture.frames.map(frame => ({ ...frame, baselineImage: `baselines/${frame.date}.png` })),
      mapping: {
        ...fixture.mapping,
        changeSteps: [
          { id: 'below', label: 'Below normal', range: [-50, -0.25], note: 'C3' },
          { id: 'normal', label: 'Near normal', range: [-0.25, 0.25], note: 'E3' },
          { id: 'above', label: 'Above normal', range: [0.25, 50], note: 'G3' },
        ],
        contourLevels: [{ value: 1, note: 'C5' }],
      },
    }
    mockFetch(url => (url.endsWith('/data/fixture/manifest.json') ? json(withBaseline) : json({}, 404)))
    const loaded = await loadVisualization('fixture')
    expect(loaded.frames[0].baselineImage).toBe('/data/fixture/baselines/2024-01-15.png')
    expect(loaded.frames[0].image).toBe('/data/fixture/frames/2024-01-15.png')
  })

  it('leaves a data set without baselines alone: no baselineImage appears', async () => {
    mockFetch(url => (url.endsWith('/data/fixture/manifest.json') ? json(fixture) : json({}, 404)))
    const loaded = await loadVisualization('fixture')
    expect('baselineImage' in loaded.frames[0]).toBe(false)
    expect(loaded.baseline).toBeUndefined()
  })

  it('throws DataError for a missing file, bad JSON or no frames', async () => {
    mockFetch(() => json({}, 404))
    await expect(loadVisualization('gone')).rejects.toBeInstanceOf(DataError)
    await expect(loadVisualization('gone')).rejects.toThrow('gone/manifest.json: could not be found (HTTP 404).')

    mockFetch(() => new Response('{not json'))
    await expect(loadVisualization('broken')).rejects.toThrow('broken/manifest.json: is not valid JSON.')

    mockFetch(() => json({ ...fixture, frames: [] }))
    await expect(loadVisualization('empty')).rejects.toThrow('empty/manifest.json: frames: needs at least one frame')
  })

  it('throws DataError when the download fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    await expect(loadVisualization('fixture')).rejects.toThrow(/could not be downloaded/)
  })
})

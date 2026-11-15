import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { indexSchema, loadOceanIndex, loadOceanTrack, trackSchema } from './schema'

const read = (path: string): unknown => JSON.parse(readFileSync(`public${path}`, 'utf8'))
const index = indexSchema.parse(read('/data/json_output/index.json'))

afterEach(() => vi.unstubAllGlobals())

describe('the ocean track files', () => {
  it('the index lists the six ECCO2 video tracks and the Meteomatics weather track, and every track file it names passes the schema', () => {
    expect(index.datasets).toHaveLength(7)
    for (const entry of index.datasets) {
      const track = trackSchema.parse(read(entry.data_url))
      expect(track.dataset_id).toBe(entry.dataset_id)
      expect(track.timeline.length).toBeGreaterThan(track.visual_assets.video_url ? 100 : 40)
      expect(track.timeline[0].spatial_grid).toHaveLength(8)
      expect(track.timeline[0].spatial_grid?.[0]).toHaveLength(16)
    }
  })

  it('rejects a track with a value out of range, a missing field or a reversed range', () => {
    const good = trackSchema.parse(read(index.datasets[0].data_url))
    const [first, ...rest] = good.timeline
    const hot = first.metrics && { ...first, metrics: { ...first.metrics, sst_normalized: 1.5 } }
    expect(trackSchema.safeParse({ ...good, timeline: [hot, ...rest] }).success).toBe(false)
    expect(trackSchema.safeParse({ ...good, visual_assets: { ...good.visual_assets, aspect_ratio: undefined } }).success).toBe(false)
    expect(trackSchema.safeParse({ ...good, calibration: { ...good.calibration, filter_cutoff_hz: [3500, 250] } }).success).toBe(false)
    expect(indexSchema.safeParse({ datasets: [] }).success).toBe(false)
  })

  it('a track made of numbers has no video, three values in a cell, and decodes to the Mauritius weather', () => {
    const entry = index.datasets.find(d => d.dataset_id === 'meteomatics_mauritius_weather')!
    const track = trackSchema.parse(read(entry.data_url))
    expect(entry.category).toBe('atmosphere')
    expect(entry.poster_url).toBeUndefined()
    expect(track.visual_assets.video_url).toBeUndefined()
    expect(track.timeline).toHaveLength(48)
    expect(track.timeline.map(s => s.time_sec).slice(0, 3)).toEqual([0, 0.5, 1])
    const cell = track.timeline[0].spatial_grid?.[0]?.[0]
    expect(cell).toHaveLength(3)
    expect(track.timeline.every(s => s.accessibility_text.length > 0)).toBe(true)
    expect(track.timeline.some(s => s.echo_callout)).toBe(true)
  })

  it('a cell may be two values or three, never one, and a video track still needs its aspect ratio', () => {
    const good = trackSchema.parse(read(index.datasets[0].data_url))
    const withCell = (cell: unknown) => trackSchema.safeParse({ ...good, timeline: [{ ...good.timeline[0], spatial_grid: [[cell]] }] }).success
    expect(withCell([0.5, 0.5])).toBe(true)
    expect(withCell([0.5, 0.5, 0.25])).toBe(true)
    expect(withCell([0.5])).toBe(false)
    expect(withCell([0.5, 0.5, 1.5])).toBe(false)
  })

  it('the loaders fetch and check, and throw on bad data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ datasets: 'nope' }))))
    await expect(loadOceanIndex()).rejects.toThrow(/index\.json/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(loadOceanTrack('/data/json_output/x.json')).rejects.toThrow(/404/)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read(index.datasets[1].data_url)))))
    await expect(loadOceanTrack(index.datasets[1].data_url)).resolves.toMatchObject({ dataset_id: index.datasets[1].dataset_id })
  })
})

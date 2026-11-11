import { describe, expect, it, vi } from 'vitest'
import type { CatalogEntry, Visualization } from '../../data'
import { renderPlaylist } from './renderPlaylist'
import type { RenderOutput } from './renderSequence'

const entries: CatalogEntry[] = [
  { id: 'one', title: 'One', summary: '' },
  { id: 'two', title: 'Two', summary: '' },
  { id: 'three', title: 'Three', summary: '' },
]

const load = async (id: string) => ({ id, title: id.toUpperCase() }) as Visualization
const output = (v: Visualization): RenderOutput => ({ id: v.id, title: v.title, wav: new Blob(['w']), vtt: 'WEBVTT\n', sidecar: '{}\n', seconds: 2.5 })

describe('renderPlaylist', () => {
  it('renders in catalogue order and reports progress before each one', async () => {
    const events: string[] = []
    const render = vi.fn(async (v: Visualization) => { events.push(`render ${v.id}`); return output(v) })
    const result = await renderPlaylist(entries, { onProgress: message => events.push(message) }, { load, render })
    expect(events).toEqual([
      'Rendering 1 of 3: One.', 'render one',
      'Rendering 2 of 3: Two.', 'render two',
      'Rendering 3 of 3: Three.', 'render three',
    ])
    expect(result.outputs.map(o => o.id)).toEqual(['one', 'two', 'three'])
  })

  it('never renders two at once', async () => {
    let running = 0
    let most = 0
    const render = async (v: Visualization) => {
      running++
      most = Math.max(most, running)
      await new Promise(resolve => setTimeout(resolve, 1))
      running--
      return output(v)
    }
    await renderPlaylist(entries, {}, { load, render })
    expect(most).toBe(1)
  })

  it('lists a data set that fails with its message, and still renders the rest', async () => {
    const render = async (v: Visualization) => {
      if (v.id === 'two') throw new Error('The picture for 2024-02-01 could not be read.')
      return output(v)
    }
    const result = await renderPlaylist(entries, {}, { load, render })
    expect(result.outputs.map(o => o.id)).toEqual(['one', 'three'])
    expect(JSON.parse(result.playlist).items).toEqual([
      { id: 'one', title: 'ONE', file: 'one.wav', seconds: 2.5 },
      { id: 'two', title: 'Two', error: 'The picture for 2024-02-01 could not be read.' },
      { id: 'three', title: 'THREE', file: 'three.wav', seconds: 2.5 },
    ])
  })

  it('also lists a data set whose manifest cannot be loaded', async () => {
    const failingLoad = async (id: string) => {
      if (id === 'one') throw new Error('one/manifest.json: could not be found (HTTP 404).')
      return load(id)
    }
    const result = await renderPlaylist(entries, {}, { load: failingLoad, render: async v => output(v) })
    expect(result.items[0]).toEqual({ id: 'one', title: 'One', error: 'one/manifest.json: could not be found (HTTP 404).' })
    expect(result.outputs).toHaveLength(2)
  })

  it('writes playlist.json with no time stamp, the same every time', async () => {
    const render = async (v: Visualization) => output(v)
    const first = await renderPlaylist(entries, {}, { load, render })
    const second = await renderPlaylist(entries, {}, { load, render })
    expect(second.playlist).toBe(first.playlist)
    expect(first.playlist).not.toMatch(/time|date|host/i)
  })
})

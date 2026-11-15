import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import { expectNoA11yViolations } from '../../test/a11y'
import { Crate } from './Crate'
import { clearManifests, createPreview, type PreviewHooks } from './preview'

// Tone and the worker are not in jsdom, so the preview is a stand-in the test drives by hand. preview.test.ts tests the real one.
vi.mock('./preview', async importOriginal => ({
  ...(await importOriginal<typeof import('./preview')>()),
  createPreview: vi.fn((_visualization: unknown, hooks: PreviewHooks) => ({ start: vi.fn(async () => {}), stop: vi.fn(() => hooks.onEnd()) })),
}))

const CATALOG = [
  { id: 'fixture', title: 'Fixture ocean', summary: 'Four test frames.' },
  { id: 'practice-storm', title: 'Practice storm', summary: 'A made-up storm.' },
]

/** Cache Storage, kept in a map of URLs. */
function fakeCaches() {
  const stored = new Map<string, true>()
  const cache = {
    add: vi.fn(async (url: string) => { stored.set(new URL(url, location.href).href, true) }),
    delete: vi.fn(async (key: string | Request) => stored.delete(typeof key === 'string' ? new URL(key, location.href).href : key.url)),
    keys: async () => [...stored.keys()].map(url => ({ url }) as Request),
  }
  return { stored, cache, api: { open: async () => cache } }
}

let caches: ReturnType<typeof fakeCaches>

beforeEach(() => {
  localStorage.clear()
  clearManifests()
  vi.mocked(createPreview).mockClear()
  caches = fakeCaches()
  vi.stubGlobal('caches', caches.api)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.endsWith('index.json') ? CATALOG : url.endsWith('fixture/manifest.json') ? fixture : null
    return body ? new Response(JSON.stringify(body)) : new Response('', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

const mount = () => ({ user: userEvent.setup(), ...render(<Crate currentId="fixture" />, { wrapper: AnnouncerProvider }) })
const sleeves = async () => within(await screen.findByRole('list', { name: 'Data sets' })).getAllByRole('listitem')

describe('the crate', () => {
  it('lists every data set, each opening on Listen', async () => {
    mount()
    const items = await sleeves()
    expect(items.map(item => within(item).getByRole('heading').textContent)).toEqual(['Fixture ocean', 'Practice storm'])
    expect(screen.getByRole('link', { name: 'Open in Listen: Practice storm' })).toHaveAttribute('href', '#listen?data=practice-storm')
  })

  it('filters as you type and says how many are left', async () => {
    const { user } = mount()
    await sleeves()
    await user.type(screen.getByRole('searchbox', { name: 'Search data sets' }), 'storm')
    expect(await sleeves()).toHaveLength(1)
    expect(screen.getByText('1 data set')).toBeInTheDocument()
  })

  it('saves every file of a data set, shows it as saved, filters to it and removes it', async () => {
    const { user } = mount()
    await sleeves()
    await user.click(screen.getByRole('button', { name: 'Save Fixture ocean for offline' }))
    expect(await screen.findByText('Saved on this device')).toBeInTheDocument()
    const urls = [...caches.stored.keys()]
    expect(urls.some(url => url.endsWith('/data/fixture/manifest.json'))).toBe(true)
    expect(urls.filter(url => url.endsWith('.png'))).toHaveLength(fixture.frames.length)

    await user.click(screen.getByRole('checkbox', { name: 'Saved on this device only' }))
    expect((await sleeves()).map(item => within(item).getByRole('heading').textContent)).toEqual(['Fixture ocean'])

    await user.click(screen.getByRole('button', { name: 'Remove Fixture ocean from this device' }))
    expect(caches.stored.size).toBe(0)
  })

  it('takes back a half-saved data set and says why', async () => {
    caches.cache.add.mockImplementationOnce(async () => {}).mockRejectedValueOnce(new Error('network'))
    const { user } = mount()
    await sleeves()
    await user.click(screen.getByRole('button', { name: 'Save Fixture ocean for offline' }))
    expect(await screen.findByText(/could not be saved. The files could not be downloaded/)).toBeInTheDocument()
    expect(caches.stored.size).toBe(0)
  })

  it('offers the data sets opened lately', async () => {
    localStorage.setItem('earth-jukebox:recent', JSON.stringify(['practice-storm']))
    mount()
    const recent = await screen.findByRole('navigation', { name: 'Continue where you left off' })
    expect(within(recent).getByRole('link', { name: 'Practice storm' })).toHaveAttribute('href', '#listen?data=practice-storm')
  })

  it('hides saving where the browser cannot', async () => {
    vi.stubGlobal('caches', undefined)
    mount()
    await sleeves()
    expect(screen.queryByRole('button', { name: /for offline/ })).toBeNull()
  })

  it('has no accessibility violations', async () => {
    const { container } = mount()
    await sleeves()
    await expectNoA11yViolations(container)
  })

  it('paints each record from its own manifest and gives it a date count', async () => {
    mount()
    const [fixtureItem, stormItem] = await sleeves()
    expect(await within(fixtureItem).findByText(`${fixture.frames.length} dates`)).toBeInTheDocument()
    expect(fixtureItem.style.getPropertyValue('--disc')).toMatch(/^conic-gradient\(/)
    expect(fixtureItem.style.getPropertyValue('--accent')).not.toBe('')
    // The storm's manifest cannot be read here: a plain disc, no date count, and nothing breaks.
    expect(within(stormItem).queryByText(/dates?$/)).toBeNull()
    expect(stormItem.style.getPropertyValue('--disc')).toBe('')
  })

  it('keeps the disc out of the accessibility tree', async () => {
    mount()
    const [item] = await sleeves()
    expect(item.querySelector('.crate__disc')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('the 10-second preview', () => {
  const play = (title: string) => screen.getByRole('button', { name: `Play 10 seconds of ${title}` })
  /** What the shared live region and the page's other status lines say now. */
  const said = () => screen.getAllByRole('status').map(node => node.textContent).join(' | ')
  const hooksOf = (index: number) => vi.mocked(createPreview).mock.calls[index][1]

  async function ready() {
    const view = mount()
    const [item] = await sleeves()
    await within(item).findByText(`${fixture.frames.length} dates`)
    return view
  }

  it('says Preparing…, then Stop preview, and announces the start and the end', async () => {
    const { user } = await ready()
    await user.click(play('Fixture ocean'))
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeInTheDocument()
    expect(createPreview).toHaveBeenCalledTimes(1)
    expect(said()).toContain('Preview of Fixture ocean, 10 seconds.')

    act(() => hooksOf(0).onPlaying())
    expect(screen.getByRole('button', { name: 'Stop preview' })).toBeInTheDocument()

    act(() => hooksOf(0).onEnd())
    expect(screen.getByRole('button', { name: 'Play 10 seconds of Fixture ocean' })).toBeInTheDocument()
    await waitFor(() => expect(said()).toContain('Preview ended.'))
  })

  it('starts from a key press, since the buttons are real buttons', async () => {
    const { user } = await ready()
    play('Fixture ocean').focus()
    await user.keyboard('{Enter}')
    expect(createPreview).toHaveBeenCalledTimes(1)
  })

  it('stops when Stop preview is pressed', async () => {
    const { user } = await ready()
    await user.click(play('Fixture ocean'))
    act(() => hooksOf(0).onPlaying())
    await user.click(screen.getByRole('button', { name: 'Stop preview' }))
    expect(screen.getByRole('button', { name: 'Play 10 seconds of Fixture ocean' })).toBeInTheDocument()
    await waitFor(() => expect(said()).toContain('Preview ended.'))
  })

  it('stops the first preview when a second one starts', async () => {
    const { user } = await ready()
    await user.click(play('Fixture ocean'))
    act(() => hooksOf(0).onPlaying())
    const first = vi.mocked(createPreview).mock.results[0].value
    // The storm's manifest cannot be read in this test, so it is started once it can be.
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('practice-storm/manifest.json') ? new Response(JSON.stringify(fixture)) : new Response('', { status: 404 }))))
    await user.click(play('Practice storm'))
    await waitFor(() => expect(createPreview).toHaveBeenCalledTimes(2))
    expect(first.stop).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('button', { name: /Preparing…|Stop preview/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Play 10 seconds of Fixture ocean' })).toBeInTheDocument()
  })

  it('stops when the crate leaves the page', async () => {
    const { user, unmount } = await ready()
    await user.click(play('Fixture ocean'))
    act(() => hooksOf(0).onPlaying())
    const preview = vi.mocked(createPreview).mock.results[0].value
    unmount()
    expect(preview.stop).toHaveBeenCalledTimes(1)
  })

  it('says why when the preview could not play', async () => {
    const { user } = await ready()
    await user.click(play('Fixture ocean'))
    act(() => hooksOf(0).onEnd(new Error('The browser has not allowed sound.')))
    expect(await screen.findByText(/Fixture ocean could not be previewed. The browser has not allowed sound./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play 10 seconds of Fixture ocean' })).toBeInTheDocument()
  })

  it('does not start any sound before a press', async () => {
    await ready()
    expect(createPreview).not.toHaveBeenCalled()
  })

  it('has no accessibility violations while a preview is playing', async () => {
    const { user, container } = await ready()
    await user.click(play('Fixture ocean'))
    act(() => hooksOf(0).onPlaying())
    await expectNoA11yViolations(container)
  })
})

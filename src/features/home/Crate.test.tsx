import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import { expectNoA11yViolations } from '../../test/a11y'
import { Crate } from './Crate'

const CATALOG = [
  { id: 'fixture', title: 'Fixture ocean', summary: 'Four test frames.' },
  { id: 'synthetic-storm', title: 'Synthetic storm', summary: 'A made-up storm.' },
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
    expect(items.map(item => within(item).getByRole('heading').textContent)).toEqual(['Fixture ocean', 'Synthetic storm'])
    expect(screen.getByRole('link', { name: 'Open Synthetic storm' })).toHaveAttribute('href', '#listen?data=synthetic-storm')
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
    localStorage.setItem('earth-jukebox:recent', JSON.stringify(['synthetic-storm']))
    mount()
    const recent = await screen.findByRole('navigation', { name: 'Continue where you left off' })
    expect(within(recent).getByRole('link', { name: 'Synthetic storm' })).toHaveAttribute('href', '#listen?data=synthetic-storm')
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
})

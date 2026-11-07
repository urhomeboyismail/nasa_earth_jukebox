import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../public/data/index.json'
import fixture from '../public/data/fixture/manifest.json'
import synthetic from '../public/data/synthetic-ocean/manifest.json'
import App from './App'

// The real analysis decodes images, which jsdom cannot do; the Player's own tests cover that path with the same mock.
vi.mock('./analysis', () => ({
  analyzeAll: async (frames: { id: string }[]) => frames.map(frame => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: 'cold' })),
}))

beforeEach(() => {
  window.location.hash = ''
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/data/index.json') ? catalog
      : url.endsWith('/data/fixture/manifest.json') ? fixture
      : url.endsWith('/data/synthetic-ocean/manifest.json') ? synthetic
      : null
    return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('App shell', () => {
  it('loads the first visualization and shows it on each page', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Listen' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Listen' })).toHaveFocus()
    expect(await screen.findByRole('button', { name: 'Play' })).toBeEnabled()
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveAttribute('max', '3')

    await userEvent.click(screen.getByRole('button', { name: 'Learn the sounds' }))
    expect(screen.getByText(/Cold, Cool, Mild, Warm, Hot/)).toBeInTheDocument()
  })

  it('keeps the page in the URL hash', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Compare two dates' }))
    expect(window.location.hash).toBe('#compare')
    expect(screen.getByRole('heading', { level: 1, name: 'Compare two dates' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compare two dates' })).toHaveAttribute('aria-current', 'page')
  })

  it('opens the page named by the hash on load, without moving focus', () => {
    window.location.hash = '#about'
    render(<App />)
    const heading = screen.getByRole('heading', { level: 1, name: 'About the data' })
    expect(heading).toBeInTheDocument()
    expect(heading).not.toHaveFocus()
  })

  it('opens #compare?test=1 on the Compare page', () => {
    window.location.hash = '#compare?test=1'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Compare two dates' })).toBeInTheDocument()
  })

  it('follows back and forward', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Listen' }))
    await userEvent.click(screen.getByRole('button', { name: 'About the data' }))
    expect(screen.getByRole('heading', { level: 1, name: 'About the data' })).toBeInTheDocument()
    window.history.back()
    expect(await screen.findByRole('heading', { level: 1, name: 'Listen' })).toHaveFocus()
    window.history.forward()
    expect(await screen.findByRole('heading', { level: 1, name: 'About the data' })).toBeInTheDocument()
  })

  it('sends an unknown hash to Home and tidies the address', async () => {
    window.location.hash = '#nope'
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Home' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.hash).toBe('#home'))
  })

  it('reacts when the hash is edited by hand', async () => {
    render(<App />)
    act(() => { window.location.hash = '#learn' })
    expect(await screen.findByRole('heading', { level: 1, name: 'Learn the sounds' })).toBeInTheDocument()
  })

  it('says so when the data cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 500 }))))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('index.json: could not be found (HTTP 500).')
  })
})

describe('Choosing a data set', () => {
  const picker = () => screen.findByRole('combobox', { name: 'Data set' })

  it('offers every data set, starting on the first', async () => {
    render(<App />)
    const select = await picker()
    expect(select).toHaveValue('fixture')
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Fixture ocean', 'Synthetic ocean', 'Synthetic globe (made-up practice data)', 'Synthetic change (made-up practice data)'])
  })

  it('switches data set, shows it on the page, and keeps the choice in the address', async () => {
    render(<App />)
    await userEvent.selectOptions(await picker(), 'Synthetic ocean')
    expect(await screen.findByText(/Now playing from: Synthetic ocean/)).toBeInTheDocument()
    expect(window.location.hash).toBe('#home?data=synthetic-ocean')
    expect(screen.getByRole('combobox', { name: 'Data set' })).toHaveValue('synthetic-ocean')
  })

  it('keeps the choice when moving between pages', async () => {
    render(<App />)
    await userEvent.selectOptions(await picker(), 'Synthetic ocean')
    await screen.findByText(/Now playing from: Synthetic ocean/)
    await userEvent.click(screen.getByRole('button', { name: 'Listen' }))
    expect(window.location.hash).toBe('#listen?data=synthetic-ocean')
    expect(await screen.findByRole('button', { name: 'Play' })).toBeEnabled()
    expect(screen.getByRole('slider', { name: 'Date' })).toHaveAttribute('max', '11')
  })

  it('opens the data set named in the address', async () => {
    window.location.hash = '#about?data=synthetic-ocean'
    render(<App />)
    expect(await screen.findByText(/12 dates/)).toBeInTheDocument()
    expect(await picker()).toHaveValue('synthetic-ocean')
  })

  it('shows the first data set, and says so, when the address names one that does not exist', async () => {
    // As if the page was opened on this address: setting location.hash would queue a late hashchange event.
    window.history.replaceState(null, '', '#home?data=nope')
    render(<App />)
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('The data set “nope” was not found, so this shows “Fixture ocean” instead.')
    expect(await picker()).toHaveValue('fixture')
    await waitFor(() => expect(window.location.hash).toBe('#home?data=fixture'))
  })

  it('follows back and forward between data sets', async () => {
    render(<App />)
    await userEvent.selectOptions(await picker(), 'Synthetic ocean')
    await screen.findByText(/Now playing from: Synthetic ocean/)
    window.history.back()
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    window.history.forward()
    expect(await screen.findByText(/Now playing from: Synthetic ocean/)).toBeInTheDocument()
  })

  it('says so when the chosen data set cannot be loaded, and lets you choose another', async () => {
    window.location.hash = '#home?data=synthetic-ocean'
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/data/index.json') ? catalog : url.endsWith('/data/fixture/manifest.json') ? fixture : null
      return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
    }))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('synthetic-ocean/manifest.json: could not be found (HTTP 404).')
    await userEvent.selectOptions(await picker(), 'Fixture ocean')
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not offer a choice in listening-test mode, so nobody switches data in the middle of a test', async () => {
    window.location.hash = '#compare?test=1'
    render(<App />)
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(1))
    expect(screen.queryByRole('combobox', { name: 'Data set' })).toBeNull()
  })

  it('does not offer a choice when there is only one data set', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/data/index.json') ? [catalog[0]] : url.endsWith('/data/fixture/manifest.json') ? fixture : null
      return Promise.resolve(new Response(JSON.stringify(body), { status: body ? 200 : 404 }))
    }))
    render(<App />)
    expect(await screen.findByText(/Now playing from: Fixture ocean/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Data set' })).toBeNull()
  })

  it('leaves the address clean when nothing was chosen', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Compare two dates' }))
    expect(window.location.hash).toBe('#compare')
  })
})

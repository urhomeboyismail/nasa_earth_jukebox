import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import catalog from '../public/data/index.json'
import fixture from '../public/data/fixture/manifest.json'
import App from './App'

// The real analysis decodes images, which jsdom cannot do; the Player's own tests cover that path with the same mock.
vi.mock('./analysis', () => ({
  analyzeAll: async (frames: { id: string }[]) => frames.map(frame => ({ frameId: frame.id, regionId: 'centre', sampled: 9, valid: 9, category: 'cold' })),
}))

beforeEach(() => {
  window.location.hash = ''
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    const body = url.endsWith('/data/index.json') ? catalog : url.endsWith('/data/fixture/manifest.json') ? fixture : null
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

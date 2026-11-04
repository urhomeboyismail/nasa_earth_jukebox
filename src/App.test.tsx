import { render, screen } from '@testing-library/react'
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

  it('says so when the data cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('', { status: 500 }))))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('index.json: could not be found (HTTP 500).')
  })
})

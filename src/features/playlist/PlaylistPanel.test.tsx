import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectNoA11yViolations } from '../../test/a11y'
import type { Visualization } from '../../data'
import { PlaylistPanel } from './PlaylistPanel'
import type { RenderOutput } from './renderSequence'

const catalog = [{ id: 'alpha', title: 'Alpha sea', summary: '' }, { id: 'beta', title: 'Beta sea', summary: '' }]
const output = (v: Visualization): RenderOutput => ({ id: v.id, title: v.title, wav: new Blob(['w']), vtt: 'WEBVTT\n', sidecar: '{}\n', seconds: 3 })
const load = async (id: string) => ({ id, title: id === 'alpha' ? 'Alpha sea' : 'Beta sea' }) as Visualization

const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL
const revoke = vi.fn()
let urlCounter = 0

beforeEach(() => {
  urlCounter = 0
  revoke.mockClear()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => catalog })))
  URL.createObjectURL = () => `blob:test/${urlCounter++}`
  URL.revokeObjectURL = revoke
})

afterEach(() => {
  vi.unstubAllGlobals()
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
})

describe('PlaylistPanel', () => {
  it('has a button and makes nothing until it is pressed', async () => {
    const { container } = render(<PlaylistPanel deps={{ load, render: async v => output(v) }} />)
    expect(screen.getByRole('button', { name: 'Render the playlist' })).toBeEnabled()
    expect(screen.queryByRole('link')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    await expectNoA11yViolations(container)
  })

  it('is disabled and shows its progress while it runs', async () => {
    let finish: () => void = () => {}
    const gate = new Promise<void>(resolve => { finish = resolve })
    render(<PlaylistPanel deps={{ load, render: async v => { await gate; return output(v) } }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Render the playlist' }))
    expect(screen.getByRole('button', { name: 'Render the playlist' })).toBeDisabled()
    expect(await screen.findByText('Rendering 1 of 2: Alpha sea.')).toBeInTheDocument()
    finish()
    await screen.findByRole('link', { name: 'Download Alpha sea as a WAV file' })
    expect(screen.getByRole('button', { name: 'Render the playlist' })).toBeEnabled()
  })

  it('offers each file as a link named in words, and the playlist', async () => {
    const { container } = render(<PlaylistPanel deps={{ load, render: async v => output(v) }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Render the playlist' }))
    const wav = await screen.findByRole('link', { name: 'Download Beta sea as a WAV file' })
    expect(wav).toHaveAttribute('download', 'beta.wav')
    expect(screen.getByRole('link', { name: 'Download Alpha sea as a captions file' })).toHaveAttribute('download', 'alpha.vtt')
    expect(screen.getByRole('link', { name: 'Download Alpha sea as a JSON file' })).toHaveAttribute('download', 'alpha.json')
    expect(screen.getByRole('link', { name: 'Download the playlist as a JSON file' })).toHaveAttribute('download', 'playlist.json')
    await expectNoA11yViolations(container)
  })

  it('says which data set failed and still offers the others', async () => {
    render(<PlaylistPanel deps={{ load, render: async v => { if (v.id === 'alpha') throw new Error('The picture could not be read.'); return output(v) } }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Render the playlist' }))
    expect(await screen.findByText('Alpha sea: The picture could not be read.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download Beta sea as a WAV file' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Download Alpha sea as a WAV file' })).toBeNull()
  })

  it('says so when the catalogue cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    render(<PlaylistPanel deps={{ load, render: async v => output(v) }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Render the playlist' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be rendered/)
    expect(screen.getByRole('button', { name: 'Render the playlist' })).toBeEnabled()
  })

  it('frees the download links when it goes away', async () => {
    const { unmount } = render(<PlaylistPanel deps={{ load, render: async v => output(v) }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Render the playlist' }))
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(7))
    unmount()
    expect(revoke).toHaveBeenCalledTimes(7)
  })
})

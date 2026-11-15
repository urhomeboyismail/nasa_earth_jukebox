import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mur from '../../../public/data/mur-sst-mauritius/manifest.json'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import type { MusicFrame } from '../../sonify'
import { features } from '../../sonify/testFeatures'
import { expectNoA11yViolations } from '../../test/a11y'
import { createFakeEnsemble, type FakeEnsemble } from '../player/symphonyTestSupport'
import { Fusion } from './Fusion'
import { frameOn, overlap } from './fusionDates'

const fakes = vi.hoisted(() => ({
  ensemble: null as FakeEnsemble | null,
  /** The reading (0 to 1) of a deck on a date, for the scan that finds the shared moments. */
  reading: (_deck: string, _date: string): number => 0.5,
  sources: [] as { options: { onFrame: (frame: unknown) => void; visualization: { frames: { date: string }[] } }; start: () => void }[],
}))

vi.mock('../../audio/ensemble/useEnsemble', () => ({
  useEnsemble: () => ({ ensemble: fakes.ensemble!.ensemble, status: 'off', start: () => fakes.ensemble!.ensemble.start() }),
}))
vi.mock('../../analysis/video/frameSequence', () => ({
  FrameSequenceSource: class {
    options: { onFrame: (frame: unknown) => void; visualization: { frames: { date: string }[] } }
    start = vi.fn()
    stop = vi.fn()
    dispose = vi.fn()
    constructor(options: never) { this.options = options; fakes.sources.push(this) }
  },
}))
vi.mock('../../analysis/video/readFrame', () => ({ readFrameFeatures: async (v: { id: string }, frame: { date: string }) => features({ date: frame.date, position: fakes.reading(v.id, frame.date) }) }))

const base = mur as Visualization
// A second deck on the same dates, so the two overlap.
const b: Visualization = { ...base, id: 'mur-copy', title: 'Mauritius copy' }
const a: Visualization = { ...base, pairsWith: [{ id: b.id, note: 'Both cover the same ten-day dates, so each date of one lines up with the same date of the other.' }] }
const [first, , peak, quiet, split] = a.frames.map(f => f.date)

beforeEach(() => {
  fakes.ensemble = createFakeEnsemble()
  fakes.sources = []
  // Both decks peak high on the third date and are one high, one low on the fifth; every other date is in the middle.
  fakes.reading = (deck, date) => (date === peak ? 1 : date === split ? (deck === a.id ? 1 : 0) : 0.5)
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.endsWith('index.json') ? [{ id: b.id, title: b.title, summary: '' }] : url.includes(`${b.id}/manifest.json`) ? b : null
    return body ? new Response(JSON.stringify(body)) : new Response('', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

const mount = (v: Visualization = a) => ({ user: userEvent.setup(), ...render(<Fusion visualization={v} />, { wrapper: AnnouncerProvider }) })

describe('overlap', () => {
  it('keeps the dates both data sets cover, and nothing when they share none', () => {
    const later = { ...b, frames: b.frames.map(f => ({ ...f, date: f.date.replace('2023', '2030') })) }
    expect(overlap(a, b).a).toHaveLength(a.frames.length)
    expect(overlap(a, later)).toEqual({ a: [], b: [] })
    expect(frameOn(b.frames, '2023-02-17').date).toBe('2023-02-12')
  })
})

describe('Compare: two data sets', () => {
  it('says so when the manifest pairs this data set with nothing', () => {
    mount(fixture as Visualization)
    expect(screen.getByText(/No data sets are paired with this one yet/)).toBeInTheDocument()
  })

  it('offers the paired data set as deck B with the reason, and the shared dates', async () => {
    mount()
    expect(await screen.findByText(new RegExp(`Linked time: the ${a.frames.length} dates`))).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Deck B' })).toHaveValue(b.id)
    expect(screen.getByText(/Why these two: Both cover the same ten-day dates/)).toBeInTheDocument()
  })

  it('plays both as one piece: each frame of A with B\'s frame for that date, the deck named in the caption', async () => {
    const { user } = mount()
    await screen.findByText(/Linked time/)
    await user.click(screen.getByRole('button', { name: 'Play both' }))
    const source = fakes.sources.at(-1)!
    expect(source.start).toHaveBeenCalled()
    await act(async () => { source.options.onFrame({ features: features({ position: 0.2 }), date: first, confidence: 1 }) })
    const applied = vi.mocked(fakes.ensemble!.ensemble.apply).mock.calls.at(-1)![0] as MusicFrame
    expect(applied.summary).toMatch(/^A: .* B: /)
    expect(applied.bass).not.toBeNull()
    expect(screen.getByText(/^A: /)).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    const { container } = mount()
    await screen.findByText(/Linked time/)
    await expectNoA11yViolations(container)
  })

  describe('shared moments (UI09)', () => {
    const frame = (date: string) => ({ features: features({ position: 0.5, date }), date, confidence: 1 })

    async function play() {
      const view = mount()
      await screen.findByText(/Linked time/)
      await view.user.click(screen.getByRole('button', { name: 'Play both' }))
      return { ...view, source: fakes.sources.at(-1)! }
    }

    it('sounds a major chord and shows one caption when both decks peak together', async () => {
      const { source } = await play()
      await waitFor(async () => {
        await act(async () => { source.options.onFrame(frame(peak)) })
        expect(fakes.ensemble!.ensemble.playNotes).toHaveBeenCalled()
      })
      const notes = vi.mocked(fakes.ensemble!.ensemble.playNotes).mock.calls[0][0]
      expect(notes.map((n: { midi: number }) => n.midi)).toEqual([60, 64, 67])
      // One sentence in the strip under the decks, and the same one announced.
      expect(document.querySelector('.fusion__moment')).toHaveTextContent(/Both high together: A's .* and B's /)
      expect(screen.getAllByText(/Both high together/)).toHaveLength(2)
    })

    it('adds the minor second and says so when one deck is high and the other low', async () => {
      const { source } = await play()
      await waitFor(async () => {
        await act(async () => { source.options.onFrame(frame(split)) })
        expect(fakes.ensemble!.ensemble.playNotes).toHaveBeenCalled()
      })
      expect(vi.mocked(fakes.ensemble!.ensemble.playNotes).mock.calls[0][0]).toHaveLength(4)
      expect(document.querySelector('.fusion__moment')).toHaveTextContent(/One high and one low/)
    })

    it('stays quiet on dates that are not shared moments', async () => {
      const { source } = await play()
      await act(async () => { source.options.onFrame(frame(quiet)) })
      expect(fakes.ensemble!.ensemble.playNotes).not.toHaveBeenCalled()
      expect(screen.getByText(/None yet/)).toBeInTheDocument()
    })

    it('turns the chord and the caption off with Mark moments', async () => {
      const { user, source } = await play()
      const toggle = screen.getByRole('button', { name: 'Mark moments' })
      expect(toggle).toHaveAttribute('aria-pressed', 'true')
      await user.click(toggle)
      expect(toggle).toHaveAttribute('aria-pressed', 'false')
      await act(async () => { source.options.onFrame(frame(peak)) })
      expect(fakes.ensemble!.ensemble.playNotes).not.toHaveBeenCalled()
      expect(screen.getByText('Off.')).toBeInTheDocument()
    })
  })
})

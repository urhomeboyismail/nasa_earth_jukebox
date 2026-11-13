import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import globe from '../../../public/data/synthetic-globe/manifest.json'
import change from '../../../public/data/synthetic-change/manifest.json'
import fixture from '../../../public/data/fixture/manifest.json'
import { AnnouncerProvider } from '../../components'
import type { Visualization } from '../../data'
import type { MusicFrame } from '../../sonify'
import { features } from '../../sonify/testFeatures'
import { expectNoA11yViolations } from '../../test/a11y'
import { createFakeEnsemble, type FakeEnsemble } from '../player/symphonyTestSupport'
import { Fusion } from './Fusion'
import { frameOn, overlap } from './fusion'

const fakes = vi.hoisted(() => ({
  ensemble: null as FakeEnsemble | null,
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
vi.mock('../../analysis/video/readFrame', () => ({ readFrameFeatures: async () => features({ position: 0.9 }) }))

const a = globe as Visualization
const b = change as Visualization

beforeEach(() => {
  fakes.ensemble = createFakeEnsemble()
  fakes.sources = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const body = url.endsWith('index.json') ? [{ id: b.id, title: b.title, summary: '' }] : url.includes(`${b.id}/manifest.json`) ? b : null
    return body ? new Response(JSON.stringify(body)) : new Response('', { status: 404 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

const mount = (v: Visualization = a) => ({ user: userEvent.setup(), ...render(<Fusion visualization={v} />, { wrapper: AnnouncerProvider }) })

describe('overlap', () => {
  it('keeps the dates both data sets cover, and nothing when they share none', () => {
    const later = { ...b, frames: b.frames.map(f => ({ ...f, date: f.date.replace('2024', '2030') })) }
    expect(overlap(a, b).a).toHaveLength(a.frames.length)
    expect(overlap(a, later)).toEqual({ a: [], b: [] })
    expect(frameOn(b.frames, '2024-03-20').date).toBe('2024-03-15')
  })
})

describe('Compare: two data sets', () => {
  it('says so when the manifest pairs this data set with nothing', () => {
    mount(fixture as Visualization)
    expect(screen.getByText(/No data sets are paired with this one yet/)).toBeInTheDocument()
  })

  it('offers the paired data set as deck B with the reason, and the shared dates', async () => {
    mount()
    expect(await screen.findByText(/Linked time: the 12 dates/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Deck B' })).toHaveValue(b.id)
    expect(screen.getByText(/Why these two: Both are made-up monthly practice frames/)).toBeInTheDocument()
  })

  it('plays both as one piece: each frame of A with B\'s frame for that date, the deck named in the caption', async () => {
    const { user } = mount()
    await screen.findByText(/Linked time/)
    await user.click(screen.getByRole('button', { name: 'Play both' }))
    const source = fakes.sources.at(-1)!
    expect(source.start).toHaveBeenCalled()
    await act(async () => { source.options.onFrame({ features: features({ position: 0.2 }), date: '2024-01-15', confidence: 1 }) })
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
})

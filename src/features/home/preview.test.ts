import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import { controlledExtract, instantExtract, stubBitmaps, tinyPixels } from '../../analysis/video/testSupport'
import { resetStream } from '../../analysis/features'
import { STOP_FADE_S } from '../../audio/ensemble'
import { resetAudioPrefs, saveAudioPrefs } from '../../audio/prefs'
import type { Visualization } from '../../data'
import { createFakeEnsemble } from '../player/symphonyTestSupport'
import { clearManifests, createPreview, loadManifest, PREVIEW_SECONDS, PREVIEW_SPEED, PREVIEW_TAIL_MS, type PreviewDeps } from './preview'
import { SEQUENCE_STEP_MS } from '../../analysis/video/clock'

vi.mock('../../analysis/features', async importOriginal => ({ ...(await importOriginal<typeof import('../../analysis/features')>()), resetStream: vi.fn() }))

const STEP = SEQUENCE_STEP_MS[PREVIEW_SPEED]
const fixtureViz = fixture as Visualization

/** The fixture's first frame repeated on `count` days, so there are far more frames than ten seconds can hold. */
function manyFrames(count: number): Visualization {
  const start = Date.UTC(2024, 0, 1)
  const frames = Array.from({ length: count }, (_, index) => ({
    ...fixtureViz.frames[0],
    id: `frame-${index}`,
    date: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
  }))
  return { ...fixtureViz, frames }
}

function setup(visualization: Visualization = fixtureViz, extra: Partial<PreviewDeps> = {}) {
  const fake = createFakeEnsemble()
  const bitmaps = stubBitmaps()
  const extract = instantExtract()
  const onPlaying = vi.fn()
  const onEnd = vi.fn()
  const preview = createPreview(visualization, { onPlaying, onEnd }, {
    ensemble: fake.ensemble,
    extract: extract.extract,
    loadPixels: async () => tinyPixels(),
    loadBitmap: async () => bitmaps.create() as unknown as ImageBitmap,
    ...extra,
  })
  return { preview, fake, extract, onPlaying, onEnd }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetAudioPrefs()
  vi.mocked(resetStream).mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the Crate preview', () => {
  it('starts the sound, reads the first checked frame at once and plays it', async () => {
    const { preview, fake, extract, onPlaying } = setup()
    expect(fake.ensemble.start).not.toHaveBeenCalled()
    void preview.start()
    await flush()
    expect(fake.ensemble.start).toHaveBeenCalledTimes(1)
    expect(extract.calls.map(call => call.input.date)).toEqual([fixtureViz.frames[0].date])
    expect(fake.ensemble.apply).toHaveBeenCalledTimes(1)
    expect(onPlaying).toHaveBeenCalledTimes(1)
  })

  it('reads the frames at Fast speed, in date order', async () => {
    const { preview, fake, extract } = setup()
    void preview.start()
    await flush()
    await vi.advanceTimersByTimeAsync(STEP - 1)
    expect(fake.ensemble.apply).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fake.ensemble.apply).toHaveBeenCalledTimes(2)
    const dates = extract.calls.map(call => call.input.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('plays only the first frames and ends by ten seconds', async () => {
    const { preview, fake, extract, onEnd } = setup(manyFrames(60))
    void preview.start()
    await flush()
    await vi.advanceTimersByTimeAsync(PREVIEW_SECONDS * 1000 - 1)
    expect(onEnd).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(undefined)
    expect(fake.ensemble.stop).toHaveBeenCalledTimes(1)
    // Ten seconds of half-second steps is at most twenty frames, not the sixty there are.
    expect(extract.calls.length).toBeLessThanOrEqual(PREVIEW_SECONDS * 1000 / STEP + 1)
    expect(extract.calls.length).toBeLessThan(60)
    const reads = extract.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(extract.calls).toHaveLength(reads)
  })

  it('ends a little after the last frame when the data set has fewer than ten seconds of frames', async () => {
    const { preview, fake, onEnd } = setup()
    void preview.start()
    await flush()
    await vi.advanceTimersByTimeAsync(STEP * fixtureViz.frames.length)
    expect(fake.ensemble.apply).toHaveBeenCalledTimes(fixtureViz.frames.length)
    await vi.advanceTimersByTimeAsync(PREVIEW_TAIL_MS)
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(fake.ensemble.stop).toHaveBeenCalled()
  })

  it('disposes the ensemble once the fade-out is over, and only once', async () => {
    const { preview, fake, onEnd } = setup()
    void preview.start()
    await flush()
    preview.stop()
    preview.stop()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(fake.ensemble.stop).toHaveBeenCalledTimes(1)
    expect(fake.ensemble.dispose).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync((STOP_FADE_S + 0.1) * 1000)
    expect(fake.ensemble.dispose).toHaveBeenCalledTimes(1)
  })

  it('stops reading frames when it is stopped', async () => {
    const { preview, extract } = setup(manyFrames(60))
    void preview.start()
    await flush()
    preview.stop()
    const reads = extract.calls.length
    await vi.advanceTimersByTimeAsync(5000)
    expect(extract.calls).toHaveLength(reads)
  })

  it('makes no sound when stopped while the sound engine was still loading', async () => {
    const fake = createFakeEnsemble()
    let release: () => void = () => {}
    fake.ensemble.start.mockImplementation(() => new Promise<void>(resolve => { release = () => resolve() }))
    const { preview, extract, onEnd, onPlaying } = setup(fixtureViz, { ensemble: fake.ensemble })
    void preview.start()
    await flush()
    preview.stop()
    release()
    await flush()
    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onPlaying).not.toHaveBeenCalled()
    expect(extract.calls).toHaveLength(0)
    expect(fake.ensemble.apply).not.toHaveBeenCalled()
  })

  it('is not "playing" until the first frame has been read', async () => {
    const controlled = controlledExtract()
    const { preview, onPlaying, fake } = setup(fixtureViz, { extract: controlled.extract })
    void preview.start()
    await flush()
    expect(fake.ensemble.start).toHaveBeenCalled()
    expect(onPlaying).not.toHaveBeenCalled()
    controlled.pending[0].resolve()
    await flush()
    expect(onPlaying).toHaveBeenCalledTimes(1)
  })

  it('counts the ten seconds from the first sound, not from the click', async () => {
    const controlled = controlledExtract()
    const { preview, onEnd } = setup(manyFrames(60), { extract: controlled.extract })
    void preview.start()
    await vi.advanceTimersByTimeAsync(4000)
    controlled.pending[0].resolve()
    await flush()
    await vi.advanceTimersByTimeAsync(PREVIEW_SECONDS * 1000 - 1)
    expect(onEnd).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('ends with the reason when the sound engine will not start', async () => {
    const fake = createFakeEnsemble()
    fake.ensemble.start.mockRejectedValue(new Error('no audio'))
    const { preview, onEnd } = setup(fixtureViz, { ensemble: fake.ensemble })
    await preview.start()
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ message: 'no audio' }))
  })

  it('ends with a message when the browser keeps the sound off', async () => {
    const fake = createFakeEnsemble()
    fake.control.startsAs = 'suspended'
    const { preview, onEnd, extract } = setup(fixtureViz, { ensemble: fake.ensemble })
    await preview.start()
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('not allowed sound') }))
    expect(extract.calls).toHaveLength(0)
  })

  it('ends with the reason when a picture cannot be read', async () => {
    const { preview, onEnd } = setup(fixtureViz, { extract: async () => { throw new Error('bad picture') } })
    void preview.start()
    await flush()
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ message: 'bad picture' }))
  })

  it('plays the listener\'s own mix: bass, muted voices and the data set\'s own voices only', async () => {
    saveAudioPrefs({ bassDb: 3, muted: ['rhythm'] })
    const viz: Visualization = { ...fixtureViz, sonification: { preset: 'major', voices: ['melody', 'rhythm', 'bass'] } }
    const { preview, fake } = setup(viz)
    void preview.start()
    await flush()
    expect(fake.ensemble.setBass).toHaveBeenCalledWith(3)
    const muted = (voice: string) => fake.ensemble.mute.mock.calls.find(call => call[0] === voice)?.[1]
    expect(muted('rhythm')).toBe(true)
    expect(muted('melody')).toBe(false)
    expect(muted('hotspots')).toBe(true)
  })
})

describe('loadManifest', () => {
  afterEach(() => clearManifests())

  it('fetches a data set once for every reader', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(fixture)))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([loadManifest('fixture'), loadManifest('fixture')])
    expect(a).toBe(b)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('tries again after a failure', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadManifest('fixture')).rejects.toThrow()
    await expect(loadManifest('fixture')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

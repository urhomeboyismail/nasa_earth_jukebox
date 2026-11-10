import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import syntheticChange from '../../../public/data/synthetic-change/manifest.json'
import type { Visualization, VideoSpec } from '../../data'
import { LIVE_COLOUR_TOLERANCE } from '../features/types'
import { resetStream } from '../features'
import { VIDEO_START_TIMEOUT_MS } from './clock'
import { LiveSource } from './liveSource'
import type { Extract, LiveFrame, LiveSourceOptions, SourceStatus } from './types'
import { asVideo, controlledExtract, FakeVideo, FakeVideoWithoutCallback, instantExtract, stubAnimationFrames, stubBitmaps, tinyPixels } from './testSupport'

vi.mock('../features', async importOriginal => ({ ...(await importOriginal<typeof import('../features')>()), resetStream: vi.fn() }))

const SPEC: VideoSpec = { src: 'video/x.mp4', fps: 10, firstFrameDate: '2026-03-01', frameStepDays: 1 }
/** The fixture with a video, or (null) without one. */
const viz = (video: VideoSpec | null = SPEC): Visualization => ({ ...(fixture as Visualization), video: video ?? undefined })

type Statuses = [SourceStatus, string | undefined][]

type Extra = Partial<Omit<LiveSourceOptions, 'video'>>

/** A source on a fake video (with requestVideoFrameCallback unless the test gives one without). The fake comes back with its own type. */
function setup<V extends FakeVideo | FakeVideoWithoutCallback = FakeVideo>(options: Extra & { video?: V } = {}) {
  // The one cast: a test that gives no video gets the default one, which is a FakeVideo.
  const video = (options.video ?? new FakeVideo()) as V
  const frames: LiveFrame[] = []
  const statuses: Statuses = []
  const bitmaps = stubBitmaps()
  const { video: _given, ...rest } = options
  void _given
  const source = new LiveSource({
    visualization: viz(),
    extract: instantExtract().extract,
    loadPixels: async () => tinyPixels(),
    loadBitmap: async () => bitmaps.create() as unknown as ImageBitmap,
    ...rest,
    video: asVideo(video),
    onFrame: frame => frames.push(frame),
    onStatus: (status, reason) => statuses.push([status, reason]),
  })
  return { source, video, frames, statuses, bitmaps }
}

const flush = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(resetStream).mockClear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('dates', () => {
  it('maps a media time to the video frame and its date: 1.0 s at 10 fps is frame 10, ten days after the first', async () => {
    const { source, video, frames } = setup()
    source.start()
    video.present(0, 1.0)
    await flush()
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ videoIndex: 10, mediaTime: 1.0, date: '2026-03-11' })
    source.dispose()
  })

  it('rounds a time that is a little early to its own frame: 0.04 s at 25 fps is frame 1', async () => {
    const { source, video, frames } = setup({ visualization: viz({ ...SPEC, fps: 25 }) })
    source.start()
    video.present(0, 0.04)
    await flush()
    expect(frames[0]).toMatchObject({ videoIndex: 1, date: '2026-03-02' })
    source.dispose()
  })

  it('steps the date by the video\'s frameStepDays', async () => {
    const { source, video, frames } = setup({ visualization: viz({ ...SPEC, frameStepDays: 30 }) })
    source.start()
    video.present(0, 0.3)
    await flush()
    expect(frames[0].date).toBe('2026-05-30')
    source.dispose()
  })

  it('shows a date that is not one of the checked frames, without calling it missing', async () => {
    const { source, video, frames, statuses } = setup()
    source.start()
    video.present(0, 0.7)
    await flush()
    expect(frames[0].date).toBe('2026-03-08')
    expect(statuses.every(([, reason]) => reason === undefined)).toBe(true)
    source.dispose()
  })
})

describe('the reading', () => {
  it('asks the extractor for the live stream with the wider video colour tolerance and the frame\'s date', async () => {
    const live = instantExtract()
    const { source, video, bitmaps } = setup({ extract: live.extract })
    source.start()
    video.present(0, 0.2)
    await flush()
    expect(live.calls).toHaveLength(1)
    expect(live.calls[0].stream).toBe('live')
    expect(live.calls[0].bitmap).toBe(bitmaps.made[0])
    expect(live.calls[0].input).toMatchObject({ frameId: '2026-03-03', date: '2026-03-03', mode: 'data', colourTolerance: LIVE_COLOUR_TOLERANCE })
    expect(live.calls[0].input.area).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 })
    expect(bitmaps.create).toHaveBeenCalledWith(expect.anything(), { colorSpaceConversion: 'none' })
    source.dispose()
  })

  it('uses the data set\'s map area', async () => {
    const live = instantExtract()
    const { source, video } = setup({ extract: live.extract, visualization: { ...viz(), mapArea: { x0: 0, y0: 0, x1: 1, y1: 0.88 } } })
    source.start()
    video.present(0, 0)
    await flush()
    expect(live.calls[0].input.area.y1).toBe(0.88)
    source.dispose()
  })

  it('reports the confidence it was given, and the features', async () => {
    const { source, video, frames } = setup({ extract: instantExtract(0.84).extract })
    source.start()
    video.present(0, 0)
    await flush()
    expect(frames[0].confidence).toBe(0.84)
    expect(frames[0].features.confidence).toBe(0.84)
    source.dispose()
  })

  it('says "video" when the first frame shows, and not before', async () => {
    const { source, video, statuses } = setup()
    source.start()
    expect(statuses).toEqual([])
    video.present(0, 0)
    await flush()
    expect(statuses).toEqual([['video', undefined]])
    source.dispose()
  })

  it('starts the video from the Play click and from nowhere else', () => {
    const { source, video } = setup()
    expect(video.play).not.toHaveBeenCalled()
    expect(video.waiting).toBe(0)
    source.start()
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(video.waiting).toBe(1)
    source.dispose()
  })
})

describe('the normal, when the data set has one', () => {
  const climatology = (): Visualization => ({ ...(syntheticChange as unknown as Visualization), video: { ...SPEC, firstFrameDate: '2024-08-15' } })

  it('is read from the checked files for the frame of the same date', async () => {
    const live = instantExtract()
    const loaded: string[] = []
    const { source, video } = setup({ visualization: climatology(), extract: live.extract, loadPixels: async url => { loaded.push(url); return tinyPixels() } })
    source.start()
    video.present(0, 0)
    await flush()
    expect(loaded).toEqual(['baselines/2024-08-15.png'])
    expect(live.calls[0].input.baseline?.pixels).not.toBeNull()
    expect(live.calls[0].input.baseline?.noiseFloor).toBe(0.2)
    source.dispose()
  })

  it('is left out for a date with no checked frame, so there is no change to report', async () => {
    const live = instantExtract()
    const { source, video } = setup({ visualization: climatology(), extract: live.extract })
    source.start()
    video.present(0, 0.1)
    await flush()
    expect(live.calls[0].input.date).toBe('2024-08-16')
    expect(live.calls[0].input.baseline).toBeUndefined()
    source.dispose()
  })

  it('is left out when its picture is a different size from the video\'s, since the two cannot be compared', async () => {
    const live = instantExtract()
    const { source, video } = setup({ visualization: climatology(), extract: live.extract, loadPixels: async () => tinyPixels(640, 360) })
    source.start()
    video.present(0, 0)
    await flush()
    expect(live.calls[0].input.baseline).toBeUndefined()
    source.dispose()
  })

  it('is not asked for at all by a data set without one', async () => {
    const loaded: string[] = []
    const { source, video } = setup({ loadPixels: async url => { loaded.push(url); return tinyPixels() } })
    source.start()
    video.present(0, 0)
    await flush()
    expect(loaded).toEqual([])
    source.dispose()
  })
})

describe('dropping frames, never queueing them', () => {
  it('reads one frame while a reading is pending and drops the rest, counting them', async () => {
    const live = controlledExtract()
    const { source, video, bitmaps, frames } = setup({ extract: live.extract })
    source.start()
    video.present(0, 0)
    await flush()
    expect(live.calls).toHaveLength(1)
    for (let i = 1; i <= 4; i++) {
      video.present(i * 100, i * 0.1)
      await flush()
    }
    expect(live.calls).toHaveLength(1)
    expect(source.dropped).toBe(4)
    // A dropped frame never gets a bitmap, so there is nothing to leave open.
    expect(bitmaps.create).toHaveBeenCalledTimes(1)
    live.pending[0].resolve()
    await flush()
    expect(frames).toHaveLength(1)
    source.dispose()
  })

  it('does not replay a dropped frame once the reading is done', async () => {
    const live = controlledExtract()
    const { source, video, frames } = setup({ extract: live.extract })
    source.start()
    video.present(0, 0)
    await flush()
    video.present(100, 0.1)
    await flush()
    live.pending[0].resolve()
    await flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(live.calls).toHaveLength(1)
    expect(frames).toHaveLength(1)
    source.dispose()
  })

  it('reads again after a reading finished', async () => {
    const live = instantExtract()
    const { source, video, frames } = setup({ extract: live.extract })
    source.start()
    video.present(0, 0)
    await flush()
    video.present(100, 0.1)
    await flush()
    expect(frames.map(f => f.videoIndex)).toEqual([0, 1])
    expect(source.dropped).toBe(0)
    source.dispose()
  })

  it('caps the rate at 20 a second: a frame 10 ms after the last is dropped, one 60 ms after is read', async () => {
    const live = instantExtract()
    const { source, video, frames } = setup({ extract: live.extract })
    source.start()
    video.present(1000, 0)
    await flush()
    video.present(1010, 0.01)
    await flush()
    expect(frames).toHaveLength(1)
    video.present(1060, 0.06)
    await flush()
    expect(frames).toHaveLength(2)
    // The cap is not back-pressure.
    expect(source.dropped).toBe(0)
    source.dispose()
  })

  it('leaves no bitmap open when the source stops with a reading in flight', async () => {
    const live = controlledExtract()
    const { source, video, bitmaps, frames } = setup({ extract: live.extract })
    source.start()
    video.present(0, 0)
    await flush()
    source.stop()
    live.pending[0].resolve()
    await flush()
    expect(bitmaps.made).toHaveLength(1)
    expect(frames).toHaveLength(0)
  })
})

describe('without requestVideoFrameCallback', () => {
  it('reads on the animation frame, and only when the video\'s time has moved', async () => {
    const frames = stubAnimationFrames()
    const video = new FakeVideoWithoutCallback()
    const live = instantExtract()
    const { source, frames: got } = setup({ video, extract: live.extract })
    source.start()
    video.paused = false
    video.currentTime = 0.5
    frames.tick(0)
    await flush()
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({ mediaTime: 0.5, videoIndex: 5, date: '2026-03-06' })
    // Same time on the next animation frame: nothing new.
    frames.tick(100)
    await flush()
    expect(got).toHaveLength(1)
    video.currentTime = 0.6
    frames.tick(200)
    await flush()
    expect(got).toHaveLength(2)
    expect(live.calls).toHaveLength(2)
    source.dispose()
  })

  it('does nothing while the video is paused, and stops looking when the source stops', async () => {
    const frames = stubAnimationFrames()
    const video = new FakeVideoWithoutCallback()
    const { source, frames: got } = setup({ video })
    source.start()
    video.paused = true // start() played it; the listener pauses it from the video's own controls
    video.currentTime = 1
    frames.tick(0)
    await flush()
    expect(got).toHaveLength(0)
    source.stop()
    expect(frames.waiting).toBe(0)
  })

  it('drops frames while a reading is pending here too', async () => {
    const frames = stubAnimationFrames()
    const video = new FakeVideoWithoutCallback()
    const live = controlledExtract()
    const { source } = setup({ video, extract: live.extract })
    source.start()
    video.paused = false
    for (let i = 0; i < 4; i++) {
      video.currentTime = i * 0.1
      frames.tick(i * 100)
      await flush()
    }
    expect(live.calls).toHaveLength(1)
    expect(source.dropped).toBe(3)
    source.dispose()
  })
})

describe('falling back to the checked frames', () => {
  it('does so, and says why in a sentence, when the video has not produced a frame in time', async () => {
    const live = instantExtract()
    const { source, video, statuses } = setup({ extract: live.extract })
    source.start()
    await vi.advanceTimersByTimeAsync(VIDEO_START_TIMEOUT_MS - 1)
    expect(statuses).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(statuses).toEqual([['frames', 'The video did not start, so the checked frames are used.']])
    expect(video.pause).toHaveBeenCalled()
    await flush()
    expect(live.calls.map(c => c.stream)).toEqual(['frames'])
    expect(live.calls[0].input).toMatchObject({ colourTolerance: 1, date: '2024-01-15' })
    source.dispose()
  })

  it('does so at once when the video fires an error', async () => {
    const { source, video, statuses, frames } = setup()
    source.start()
    video.fire('error')
    await flush()
    expect(statuses).toEqual([['frames', 'The video could not be played, so the checked frames are used.']])
    expect(frames[0]).toMatchObject({ videoIndex: null, mediaTime: null, date: '2024-01-15' })
    source.dispose()
  })

  it('does so when the browser will not play the video', async () => {
    const video = new FakeVideo()
    video.play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')))
    const { source, statuses } = setup({ video })
    source.start()
    await flush()
    expect(statuses).toEqual([['frames', 'The browser would not play the video, so the checked frames are used.']])
    source.dispose()
  })

  it('does so when the data set has no video', async () => {
    const { source, statuses, frames, video } = setup({ visualization: viz(null) })
    source.start()
    await flush()
    expect(statuses).toEqual([['frames', 'This data set has no video, so the checked frames are used.']])
    expect(video.play).not.toHaveBeenCalled()
    expect(frames).toHaveLength(1)
    source.dispose()
  })

  it('does so when a reading fails, and says what went wrong', async () => {
    const { source, video, statuses } = setup({ extract: async () => { throw new Error('The feature worker stopped.') } })
    source.start()
    video.present(0, 0)
    await flush()
    expect(statuses[1]).toEqual(['frames', 'The live reading failed (The feature worker stopped.), so the checked frames are used.'])
    source.dispose()
  })

  it('carries on from the date the video had reached', async () => {
    const live = instantExtract()
    // The checked frames are 2024-01-15, 2024-07-15, 2024-12-15 and 2025-03-15; the video had reached 2024-08-01.
    const { source, video } = setup({ extract: live.extract, visualization: viz({ ...SPEC, firstFrameDate: '2024-08-01' }) })
    source.start()
    video.present(0, 0)
    await flush()
    video.fire('error')
    await flush()
    expect(live.calls.filter(c => c.stream === 'frames').map(c => c.input.date)).toEqual(['2024-12-15'])
    source.dispose()
  })

  it('does not fall back when the video does produce a frame in time', async () => {
    const { source, video, statuses } = setup()
    source.start()
    await vi.advanceTimersByTimeAsync(VIDEO_START_TIMEOUT_MS - 100)
    video.present(0, 0)
    await flush()
    await vi.advanceTimersByTimeAsync(VIDEO_START_TIMEOUT_MS)
    expect(statuses.map(([s]) => s)).toEqual(['video'])
    source.dispose()
  })

  it('stops and starts the checked frames like the live ones', async () => {
    const { source, statuses } = setup({ visualization: viz(null) })
    source.start()
    await flush()
    source.stop()
    expect(statuses.at(-1)).toEqual(['stopped', undefined])
    source.start()
    expect(statuses.at(-1)).toEqual(['frames', 'This data set has no video, so the checked frames are used.'])
    source.dispose()
  })
})

describe('confidence', () => {
  it('raises a reason when a reading is below 0.6, once, and clears it when the colours come back', async () => {
    let confidence = 0.4
    const extract: Extract = async (stream, bitmap, input) => ({ ...(await instantExtract().extract(stream, bitmap, input)), confidence })
    const { source, video, statuses } = setup({ extract })
    source.start()
    video.present(0, 0)
    await flush()
    video.present(100, 0.1)
    await flush()
    expect(statuses).toEqual([['video', undefined], ['video', 'Colours from the video are a little off; readings may be less exact.']])
    confidence = 0.9
    video.present(200, 0.2)
    await flush()
    expect(statuses.at(-1)).toEqual(['video', undefined])
    expect(statuses).toHaveLength(3)
    source.dispose()
  })
})

describe('a frame with nothing readable in it', () => {
  it('does not say the colours are off: confidence 0 there means there was nothing to read', async () => {
    const extract: Extract = async (stream, bitmap, input) => {
      const base = await instantExtract().extract(stream, bitmap, input)
      return { ...base, confidence: 0, stats: { ...base.stats, validShare: 0 } }
    }
    const { source, video, statuses } = setup({ extract })
    source.start()
    video.present(0, 0)
    await flush()
    video.present(100, 0.1)
    await flush()
    expect(statuses).toEqual([['video', undefined]])
    source.dispose()
  })
})

describe('time that goes back', () => {
  it('starts the stream again, since the frame before it is not the frame it follows', async () => {
    const { source, video } = setup()
    source.start()
    video.present(0, 2.0)
    await flush()
    expect(resetStream).not.toHaveBeenCalled()
    video.present(100, 0.5)
    await flush()
    expect(resetStream).toHaveBeenCalledWith('live')
    source.dispose()
  })
})

describe('stop and dispose', () => {
  it('stop pauses the video and the reading, says "stopped", and the next start() carries on', async () => {
    const { source, video, statuses, frames } = setup()
    source.start()
    video.present(0, 0)
    await flush()
    source.stop()
    expect(video.pause).toHaveBeenCalled()
    expect(video.waiting).toBe(0)
    expect(statuses.at(-1)).toEqual(['stopped', undefined])
    video.present(100, 0.1)
    await flush()
    expect(frames).toHaveLength(1)
    source.start()
    expect(video.play).toHaveBeenCalledTimes(2)
    video.present(200, 0.2)
    await flush()
    expect(frames.map(f => f.videoIndex)).toEqual([0, 2])
    source.dispose()
  })

  it('stop and start are harmless when repeated', () => {
    const { source, video } = setup()
    source.stop()
    source.start()
    source.start()
    expect(video.play).toHaveBeenCalledTimes(1)
    source.stop()
    source.stop()
    expect(video.pause).toHaveBeenCalledTimes(1)
    source.dispose()
  })

  it('dispose closes the bitmap in flight and removes the listeners, and nothing is called back afterwards', async () => {
    const live = controlledExtract()
    const { source, video, frames, statuses, bitmaps } = setup({ extract: live.extract })
    source.start()
    expect(video.listenerCount('error')).toBe(1)
    video.present(0, 0)
    await flush()
    const before = statuses.length
    source.dispose()
    expect(bitmaps.made[0].close).toHaveBeenCalled()
    expect(video.listenerCount('error')).toBe(0)
    expect(video.waiting).toBe(0)
    live.pending[0].resolve()
    await flush()
    video.present(100, 0.1)
    video.fire('error')
    await vi.advanceTimersByTimeAsync(VIDEO_START_TIMEOUT_MS * 2)
    expect(frames).toHaveLength(0)
    expect(statuses).toHaveLength(before)
  })

  it('dispose cancels the start timeout, so a disposed source never falls back', async () => {
    const { source, statuses } = setup()
    source.start()
    source.dispose()
    await vi.advanceTimersByTimeAsync(VIDEO_START_TIMEOUT_MS * 2)
    expect(statuses).toEqual([])
  })

  it('dispose closes a bitmap that arrives after it', async () => {
    const { source, video, bitmaps } = setup()
    source.start()
    video.present(0, 0)
    source.dispose()
    await flush()
    expect(bitmaps.made.every(b => b.close.mock.calls.length > 0)).toBe(true)
  })

  it('does nothing after dispose, whatever it is asked', () => {
    const { source, video } = setup()
    source.dispose()
    source.start()
    source.seek(3)
    source.stop()
    expect(video.play).not.toHaveBeenCalled()
  })
})

describe('seek', () => {
  it('moves the video to a frame\'s time and starts the stream again', () => {
    const { source, video } = setup()
    source.seek(25)
    expect(video.currentTime).toBeCloseTo(2.5, 10)
    expect(resetStream).toHaveBeenCalledWith('live')
    source.dispose()
  })
})

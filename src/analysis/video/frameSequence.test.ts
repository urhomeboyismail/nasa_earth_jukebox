import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import syntheticChange from '../../../public/data/synthetic-change/manifest.json'
import type { Visualization } from '../../data'
import { resetStream } from '../features'
import { SEQUENCE_STEP_MS } from './clock'
import { FrameSequenceSource } from './frameSequence'
import type { FrameSequenceOptions, LiveFrame, SourceStatus } from './types'
import { controlledExtract, instantExtract, stubBitmaps, tinyPixels } from './testSupport'

vi.mock('../features', async importOriginal => ({ ...(await importOriginal<typeof import('../features')>()), resetStream: vi.fn() }))

const viz = fixture as Visualization
const DATES = ['2024-01-15', '2024-07-15', '2024-12-15', '2025-03-15']

function setup(options: Partial<FrameSequenceOptions> = {}) {
  const frames: LiveFrame[] = []
  const statuses: [SourceStatus, string | undefined][] = []
  const bitmaps = stubBitmaps()
  const source = new FrameSequenceSource({
    visualization: viz,
    extract: instantExtract().extract,
    loadPixels: async () => tinyPixels(),
    loadBitmap: async () => bitmaps.create() as unknown as ImageBitmap,
    ...options,
    onFrame: frame => frames.push(frame),
    onStatus: (status, reason) => statuses.push([status, reason]),
  })
  return { source, frames, statuses, bitmaps }
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

describe('stepping through the checked frames', () => {
  it('reads the first frame at once and then one a step, in date order', async () => {
    const { source, frames } = setup()
    source.start()
    await flush()
    expect(frames.map(f => f.date)).toEqual([DATES[0]])
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal - 1)
    expect(frames).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(frames.map(f => f.date)).toEqual(DATES.slice(0, 2))
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 2)
    expect(frames.map(f => f.date)).toEqual(DATES)
    source.dispose()
  })

  it('reports no video index and no media time, and the confidence it was given', async () => {
    const { source, frames } = setup({ extract: instantExtract(0.7).extract })
    source.start()
    await flush()
    expect(frames[0]).toMatchObject({ videoIndex: null, mediaTime: null, confidence: 0.7 })
    source.dispose()
  })

  it('reads even a data set whose frames are listed out of order in date order', async () => {
    const shuffled = { ...viz, frames: [...viz.frames].reverse() }
    const { source, frames } = setup({ visualization: shuffled })
    source.start()
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 3)
    expect(frames.map(f => f.date)).toEqual(DATES)
    source.dispose()
  })

  it('uses the step time of the speed it is given', async () => {
    const { source, frames } = setup({ step: 'fast' })
    source.start()
    await flush()
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.fast)
    expect(frames).toHaveLength(2)
    source.dispose()
  })

  it('says "frames" when it starts, with the reason it was given', async () => {
    const { source, statuses } = setup({ reason: 'Because.' })
    source.start()
    await flush()
    expect(statuses[0]).toEqual(['frames', 'Because.'])
    source.dispose()
  })

  it('stops after the last frame and says the frames have ended', async () => {
    const { source, statuses } = setup()
    source.start()
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 6)
    expect(statuses.at(-1)).toEqual(['stopped', 'The checked frames have ended.'])
  })
})

describe('the reading', () => {
  it('asks for the frames stream with the plain colour tolerance and the frame\'s own id and date', async () => {
    const live = instantExtract()
    const { source } = setup({ extract: live.extract })
    source.start()
    await flush()
    expect(live.calls[0].stream).toBe('frames')
    expect(live.calls[0].input).toMatchObject({ frameId: viz.frames[0].id, date: DATES[0], mode: 'data', colourTolerance: 1 })
    expect(live.calls[0].input.baseline).toBeUndefined()
    source.dispose()
  })

  it('reads the frame\'s own normal when the data set has one', async () => {
    const loaded: string[] = []
    const live = instantExtract()
    const climatology = syntheticChange as unknown as Visualization
    const { source } = setup({ visualization: climatology, extract: live.extract, loadPixels: async url => { loaded.push(url); return tinyPixels() } })
    source.start()
    await flush()
    expect(loaded).toEqual([climatology.frames[0].baselineImage])
    expect(live.calls[0].input.baseline?.noiseFloor).toBe(0.2)
    source.dispose()
  })

  it('draws a PNG into a bitmap with its colours left as they are, when nothing else is given', async () => {
    class FakeImageData {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data
        this.width = width
        this.height = height
      }
    }
    vi.stubGlobal('ImageData', FakeImageData)
    const create = vi.fn(async () => ({ width: 2, height: 1, close: vi.fn() }))
    vi.stubGlobal('createImageBitmap', create)
    const live = instantExtract()
    const frames: LiveFrame[] = []
    const source = new FrameSequenceSource({ visualization: viz, extract: live.extract, loadPixels: async () => tinyPixels(2, 1), onFrame: f => frames.push(f), onStatus: () => {} })
    source.start()
    await flush()
    expect(create).toHaveBeenCalledTimes(1)
    const [image, options] = create.mock.calls[0] as unknown as [FakeImageData, object]
    expect([image.width, image.height, image.data.length]).toEqual([2, 1, 8])
    expect(options).toEqual({ premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    source.dispose()
  })
})

describe('no queue', () => {
  it('does not read the next frame until the last one has finished, however long that takes', async () => {
    const live = controlledExtract()
    const { source, frames } = setup({ extract: live.extract })
    source.start()
    await flush()
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 5)
    expect(live.calls).toHaveLength(1)
    live.pending[0].resolve()
    await flush()
    expect(frames).toHaveLength(1)
    source.dispose()
  })

  it('skips the steps a slow reading overran instead of falling behind', async () => {
    const live = controlledExtract()
    const { source, frames } = setup({ extract: live.extract })
    source.start()
    await flush()
    // The first reading takes two and a half steps: the next frame is the one the clock has reached, not the one after.
    await vi.advanceTimersByTimeAsync(2500)
    live.pending[0].resolve()
    await flush()
    await vi.advanceTimersByTimeAsync(499)
    expect(live.calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(live.calls).toHaveLength(2)
    expect(live.calls[1].input.date).toBe(DATES[3])
    live.pending[1].resolve()
    await flush()
    expect(frames.map(f => f.date)).toEqual([DATES[0], DATES[3]])
    source.dispose()
  })
})

describe('starting from a date, seeking, stopping', () => {
  it('starts at the first checked frame on or after the date it is given', async () => {
    const { source, frames } = setup()
    source.start('2024-08-01')
    await flush()
    expect(frames[0].date).toBe('2024-12-15')
    source.dispose()
  })

  it('starts at the first frame for a date before them all, and at the first again for one after them all', async () => {
    const a = setup()
    a.source.start('1999-01-01')
    await flush()
    expect(a.frames[0].date).toBe(DATES[0])
    a.source.dispose()
    const b = setup()
    b.source.start('2099-01-01')
    await flush()
    expect(b.frames[0].date).toBe(DATES[0])
    b.source.dispose()
  })

  it('seek reads the frame at that index now and carries on from it; the stream starts again', async () => {
    const { source, frames } = setup()
    source.start()
    await flush()
    source.seek(2)
    await flush()
    expect(frames.map(f => f.date)).toEqual([DATES[0], DATES[2]])
    expect(resetStream).toHaveBeenCalledWith('frames')
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal)
    expect(frames.at(-1)!.date).toBe(DATES[3])
    source.dispose()
  })

  it('seek clamps to the frames there are', async () => {
    const { source, frames } = setup()
    source.start()
    await flush()
    source.seek(99)
    await flush()
    source.seek(-5)
    await flush()
    expect(frames.map(f => f.date)).toEqual([DATES[0], DATES[3], DATES[0]])
    source.dispose()
  })

  it('seek while stopped moves the place without reading, and start continues from it', async () => {
    const { source, frames } = setup()
    source.seek(2)
    await flush()
    expect(frames).toHaveLength(0)
    source.start()
    await flush()
    expect(frames[0].date).toBe(DATES[2])
    source.dispose()
  })

  it('a seek during a reading drops that reading\'s result', async () => {
    const live = controlledExtract()
    const { source, frames } = setup({ extract: live.extract })
    source.start()
    await flush()
    source.seek(2)
    await flush()
    live.pending[0].resolve()
    live.pending[1].resolve()
    await flush()
    expect(frames.map(f => f.date)).toEqual([DATES[2]])
    source.dispose()
  })

  it('stop ends the stepping, ignores a reading that finishes late, says "stopped", and start continues with the next frame', async () => {
    const live = controlledExtract()
    const { source, frames, statuses } = setup({ extract: live.extract })
    source.start()
    await flush()
    live.pending[0].resolve()
    await flush()
    source.stop()
    expect(statuses.at(-1)).toEqual(['stopped', undefined])
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 3)
    expect(live.calls).toHaveLength(1)
    source.start()
    await flush()
    expect(live.calls).toHaveLength(2)
    expect(live.calls[1].input.date).toBe(DATES[1])
    live.pending[1].resolve()
    await flush()
    expect(frames.map(f => f.date)).toEqual([DATES[0], DATES[1]])
    source.dispose()
  })

  it('stop mid-reading throws the reading away', async () => {
    const live = controlledExtract()
    const { source, frames } = setup({ extract: live.extract })
    source.start()
    await flush()
    source.stop()
    live.pending[0].resolve()
    await flush()
    expect(frames).toHaveLength(0)
  })

  it('start twice is one start', async () => {
    const live = instantExtract()
    const { source } = setup({ extract: live.extract })
    source.start()
    source.start()
    await flush()
    expect(live.calls).toHaveLength(1)
    source.dispose()
  })
})

describe('failure and dispose', () => {
  it('says "error" with the message when a reading fails, and stops', async () => {
    const { source, statuses } = setup({ extract: async () => { throw new Error('The feature worker stopped.') } })
    source.start()
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 3)
    expect(statuses.at(-1)).toEqual(['error', 'The feature worker stopped.'])
    expect(statuses.filter(([s]) => s === 'error')).toHaveLength(1)
  })

  it('does nothing after dispose, and throws away a reading that finishes after it', async () => {
    const live = controlledExtract()
    const { source, frames, statuses } = setup({ extract: live.extract })
    source.start()
    await flush()
    const before = statuses.length
    source.dispose()
    live.pending[0].resolve()
    await flush()
    source.start()
    source.seek(1)
    await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * 3)
    expect(frames).toHaveLength(0)
    expect(statuses).toHaveLength(before)
    expect(live.calls).toHaveLength(1)
  })

  it('closes a bitmap that arrives after dispose', async () => {
    const { source, bitmaps } = setup()
    source.start()
    source.dispose()
    await flush()
    expect(bitmaps.made.every(b => b.close.mock.calls.length > 0)).toBe(true)
  })
})

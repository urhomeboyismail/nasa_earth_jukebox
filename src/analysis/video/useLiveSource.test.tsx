import { act, renderHook } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../public/data/fixture/manifest.json'
import type { Visualization } from '../../data'
import { asVideo, FakeVideo, stubBitmaps } from './testSupport'
import type { LiveFrame } from './types'
import { useLiveSource } from './useLiveSource'

// The worker and the PNG loader are not available in jsdom, so the hook is tested against stand-ins for both.
vi.mock('../features', async importOriginal => {
  const { features } = await import('../../sonify/testFeatures')
  return {
    ...(await importOriginal<typeof import('../features')>()),
    resetStream: vi.fn(),
    extractInWorker: vi.fn(async (_stream: string, _bitmap: unknown, input: { frameId: string; date: string }) => ({ ...features({ frameId: input.frameId, date: input.date }), confidence: 1 })),
  }
})
vi.mock('../pixels', async importOriginal => ({
  ...(await importOriginal<typeof import('../pixels')>()),
  readPixels: vi.fn(async () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
}))

const viz: Visualization = { ...(fixture as Visualization), video: { src: 'video/x.mp4', fps: 10, firstFrameDate: '2026-03-01', frameStepDays: 1 } }

beforeEach(() => {
  stubBitmaps()
  vi.stubGlobal('ImageData', class {
    data: Uint8ClampedArray
    width: number
    height: number
    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data
      this.width = width
      this.height = height
    }
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

/** Lets the hook's deferred disposal run. */
const flush = () => act(async () => { await Promise.resolve() })

function mount(video: FakeVideo | null, visualization: Visualization | null = viz, strict = false) {
  const onFrame = vi.fn<(frame: LiveFrame) => void>()
  const hook = renderHook(
    (props: { video: HTMLVideoElement | null; visualization: Visualization | null; onFrame: (frame: LiveFrame) => void }) => useLiveSource(props),
    { initialProps: { video: video && asVideo(video), visualization, onFrame }, ...(strict && { wrapper: StrictMode }) },
  )
  return { ...hook, onFrame, video }
}

describe('useLiveSource', () => {
  it('is idle, and does nothing when asked to start, until it has a video and a data set', () => {
    const { result } = mount(null)
    expect(result.current.status).toBe('idle')
    act(() => result.current.start())
    act(() => result.current.stop())
    act(() => result.current.seek(3))
    expect(result.current.status).toBe('idle')
    const none = mount(new FakeVideo(), null)
    act(() => none.result.current.start())
    expect(none.result.current.status).toBe('idle')
  })

  it('does not touch the video until start() is called', () => {
    const video = new FakeVideo()
    mount(video)
    expect(video.play).not.toHaveBeenCalled()
    expect(video.waiting).toBe(0)
  })

  it('starts the video from start(), and follows the status', async () => {
    const video = new FakeVideo()
    const { result } = mount(video)
    act(() => result.current.start())
    expect(video.play).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('idle')
    await act(async () => { video.present(0, 0) })
    expect(result.current.status).toBe('video')
    act(() => result.current.stop())
    expect(result.current.status).toBe('stopped')
    expect(video.pause).toHaveBeenCalled()
  })

  it('says why when it falls back to the checked frames', async () => {
    const video = new FakeVideo()
    const { result } = mount(video)
    act(() => result.current.start())
    await act(async () => { video.fire('error') })
    expect(result.current.status).toBe('frames')
    expect(result.current.reason).toBe('The video could not be played, so the checked frames are used.')
  })

  it('calls the newest onFrame, not the one it started with', async () => {
    const video = new FakeVideo()
    const { result, rerender, onFrame } = mount(video)
    act(() => result.current.start())
    const newer = vi.fn<(frame: LiveFrame) => void>()
    rerender({ video: asVideo(video), visualization: viz, onFrame: newer })
    await act(async () => { video.fire('error') })
    await vi.waitFor(() => expect(newer).toHaveBeenCalled())
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('keeps one source across renders', () => {
    const video = new FakeVideo()
    const { result, rerender, onFrame } = mount(video)
    const start = result.current.start
    rerender({ video: asVideo(video), visualization: viz, onFrame })
    expect(result.current.start).toBe(start)
  })

  it('disposes the source when the component goes away: the video is paused and its listener is gone', async () => {
    const video = new FakeVideo()
    const { result, unmount } = mount(video)
    act(() => result.current.start())
    expect(video.listenerCount('error')).toBe(1)
    unmount()
    await flush()
    expect(video.listenerCount('error')).toBe(0)
    expect(video.pause).toHaveBeenCalled()
    expect(video.waiting).toBe(0)
  })

  it('makes a new source, with a fresh status, for a new data set, and disposes the old one', async () => {
    const video = new FakeVideo()
    const { result, rerender, onFrame } = mount(video)
    act(() => result.current.start())
    await act(async () => { video.present(0, 0) })
    expect(result.current.status).toBe('video')
    rerender({ video: asVideo(video), visualization: { ...viz, id: 'another' }, onFrame })
    await flush()
    expect(result.current.status).toBe('idle')
    expect(video.listenerCount('error')).toBe(0)
  })

  it('survives StrictMode mounting, unmounting and mounting again: the source still works', async () => {
    const video = new FakeVideo()
    const { result, unmount } = mount(video, viz, true)
    await flush()
    act(() => result.current.start())
    await act(async () => { video.present(0, 0) })
    expect(result.current.status).toBe('video')
    unmount()
    await flush()
    expect(video.listenerCount('error')).toBe(0)
  })
})

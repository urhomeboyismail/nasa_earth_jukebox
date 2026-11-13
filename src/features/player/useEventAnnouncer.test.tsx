import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FrameFeatures } from '../../analysis/features/types'
import { AnnouncerContext } from '../../components/announcerContext'
import type { Visualization } from '../../data'
import { subscribeDataEvents } from '../mascot/dataEvents'
import { features, spot } from '../../sonify/testFeatures'
import { useEventAnnouncer } from './useEventAnnouncer'

const words = { mapping: { categories: [{ id: 'a', label: 'Cold', range: [0, 1], note: 'C4' }, { id: 'b', label: 'Warm', range: [1, 2], note: 'D4' }] } as unknown as Visualization['mapping'] }

function Probe({ frame }: { frame: FrameFeatures | null }) {
  useEventAnnouncer(frame, words)
  return null
}

describe('useEventAnnouncer', () => {
  const announce = vi.fn()
  const show = (frame: FrameFeatures | null) => (
    <AnnouncerContext.Provider value={announce}><Probe frame={frame} /></AnnouncerContext.Provider>
  )

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    announce.mockClear()
  })
  afterEach(() => vi.useRealTimers())

  it('announces nothing for the first frame, then the event between two frames, as busy', () => {
    const { rerender } = render(show(features({ hotspots: [] })))
    expect(announce).not.toHaveBeenCalled()
    rerender(show(features({ hotspots: [spot('h1', 'high', 0.8, 0.2)] })))
    expect(announce).toHaveBeenCalledOnce()
    expect(announce).toHaveBeenCalledWith('A new warm area appeared in the north-east.', { busy: true })
  })

  it('holds a second event that comes within the gap, and makes one after it', () => {
    const { rerender } = render(show(features({ hotspots: [] })))
    rerender(show(features({ hotspots: [spot('h1', 'high', 0.8, 0.2)] })))
    vi.setSystemTime(1000)
    rerender(show(features({ hotspots: [spot('h1', 'high', 0.8, 0.2), spot('h2', 'low', 0.2, 0.8)] })))
    expect(announce).toHaveBeenCalledOnce()
    vi.setSystemTime(5000)
    rerender(show(features({ hotspots: [spot('h1', 'high', 0.8, 0.2)] })))
    expect(announce).toHaveBeenLastCalledWith('The cold area in the south-west has gone.', { busy: true })
  })

  it('forgets the last frame when playing stops, so the next run starts quiet', () => {
    const { rerender } = render(show(features({ hotspots: [] })))
    rerender(show(null))
    vi.setSystemTime(10_000)
    rerender(show(features({ hotspots: [spot('h1', 'high', 0.8, 0.2)] })))
    expect(announce).not.toHaveBeenCalled()
  })

  it('publishes the events of each frame for Echo, and an empty list when playing stops', () => {
    const seen: string[][] = []
    const stop = subscribeDataEvents(events => seen.push(events.map(event => `${event.kind}: ${event.sentence}`)))
    const { rerender } = render(show(features({ hotspots: [] })))
    rerender(show(features({ hotspots: [spot('h1', 'high', 0.8, 0.2)] })))
    rerender(show(null))
    stop()
    expect(seen).toEqual([[], ['appeared: A new warm area appeared in the north-east.'], []])
  })
})

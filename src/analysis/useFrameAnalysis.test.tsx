import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { useFrameAnalysis } from './useFrameAnalysis'

const visualization = fixture as Visualization
const region = visualization.regions[0]
const analyzeAll = vi.hoisted(() => vi.fn())
vi.mock('.', () => ({ analyzeAll }))

const results = (tag: string) => visualization.frames.map(frame => ({ frameId: frame.id, regionId: tag, sampled: 9, valid: 9, category: 'mild' }))
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => { analyzeAll.mockReset() })

describe('useFrameAnalysis', () => {
  it('has no results until the frames are read, then has them', async () => {
    analyzeAll.mockResolvedValue(results('a'))
    const { result } = renderHook(() => useFrameAnalysis(visualization, region))
    expect(result.current).toEqual({ results: null, error: '' })
    await waitFor(() => expect(result.current.results).toEqual(results('a')))
    expect(analyzeAll).toHaveBeenCalledWith(visualization.frames, region, visualization.colorScale, visualization.mapping)
  })

  it('also passes the data set when the change is wanted', async () => {
    analyzeAll.mockResolvedValue(results('a'))
    renderHook(() => useFrameAnalysis(visualization, region, { withChange: true }))
    await waitFor(() => expect(analyzeAll).toHaveBeenCalled())
    expect(analyzeAll).toHaveBeenCalledWith(visualization.frames, region, visualization.colorScale, visualization.mapping, visualization)
  })

  it('drops a result that arrives after the inputs changed', async () => {
    const first = deferred<unknown>()
    analyzeAll.mockReturnValueOnce(first.promise).mockResolvedValueOnce(results('second'))
    const { result, rerender } = renderHook(({ withChange }) => useFrameAnalysis(visualization, region, { withChange }), { initialProps: { withChange: false } })
    rerender({ withChange: true })
    await waitFor(() => expect(result.current.results).toEqual(results('second')))
    first.resolve(results('first'))
    await Promise.resolve()
    expect(result.current.results).toEqual(results('second'))
  })

  it('drops a result that arrives after the page left', async () => {
    const pending = deferred<unknown>()
    analyzeAll.mockReturnValue(pending.promise)
    const { result, unmount } = renderHook(() => useFrameAnalysis(visualization, region))
    unmount()
    pending.resolve(results('late'))
    await Promise.resolve()
    expect(result.current.results).toBeNull()
  })

  it('reports an error as text', async () => {
    analyzeAll.mockRejectedValue(new Error('The picture could not be read'))
    const { result } = renderHook(() => useFrameAnalysis(visualization, region))
    await waitFor(() => expect(result.current.error).toBe('The picture could not be read'))
    expect(result.current.results).toBeNull()
  })
})

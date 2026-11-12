import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BOOST_FULL, BOOST_START, RETRO_MS, thrustFor, useScrollVelocity } from './useScrollVelocity'

describe('thrustFor', () => {
  it('is 0 below the start, 1 at and above full, and rises in between', () => {
    expect(thrustFor(0)).toBe(0)
    expect(thrustFor(BOOST_START)).toBe(0)
    expect(thrustFor(BOOST_FULL)).toBe(1)
    expect(thrustFor(BOOST_FULL * 4)).toBe(1)
    let last = 0
    for (let speed = BOOST_START; speed <= BOOST_FULL; speed += 0.1) {
      const value = thrustFor(speed)
      expect(value).toBeGreaterThanOrEqual(last)
      last = value
    }
    expect(thrustFor((BOOST_START + BOOST_FULL) / 2)).toBeCloseTo(0.5)
  })
})

describe('useScrollVelocity', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextFrame: number
  let y: number

  /** Scrolls to a new position and lets one frame run. */
  const scrollTo = (to: number) => {
    y = to
    act(() => { window.dispatchEvent(new Event('scroll')) })
    act(() => { const due = [...frames.values()]; frames.clear(); due.forEach(callback => callback(performance.now())) })
  }
  const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

  function stubReducedMotion(reduce: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduce && query.includes('reduce'), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }))
  }

  beforeEach(() => {
    vi.useFakeTimers()
    frames = new Map()
    nextFrame = 1
    y = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(nextFrame, callback); return nextFrame++ })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y })
    stubReducedMotion(false)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); Reflect.deleteProperty(window, 'scrollY') })

  it('starts idle', () => {
    const { result } = renderHook(() => useScrollVelocity())
    expect(result.current).toEqual({ motion: 'idle', thrust: 0 })
  })

  it('boosts on the next frame of a fast scroll, with thrust growing with the speed', () => {
    const { result } = renderHook(() => useScrollVelocity())
    scrollTo(60) // 60 px in one 16 ms frame: 3.75 px per ms
    expect(result.current).toEqual({ motion: 'boosting', thrust: 1 })
    wait(16)
    scrollTo(120 + 0) // 60 px in 16 ms again
    expect(result.current.motion).toBe('boosting')
    wait(16)
    scrollTo(120 + 16) // 16 px in 16 ms: 1 px per ms
    expect(result.current.motion).toBe('boosting')
    expect(result.current.thrust).toBeGreaterThan(0)
    expect(result.current.thrust).toBeLessThan(1)
  })

  it('gives a retro-burn after a fast stop, then idle after 400 ms', () => {
    const { result } = renderHook(() => useScrollVelocity())
    scrollTo(100)
    wait(16)
    scrollTo(200)
    wait(120) // no scroll event for 120 ms: stopped
    expect(result.current.motion).toBe('retro')
    wait(RETRO_MS - 1)
    expect(result.current.motion).toBe('retro')
    wait(1)
    expect(result.current).toEqual({ motion: 'idle', thrust: 0 })
  })

  it('goes straight to idle after a slow scroll stops, with no retro-burn', () => {
    const { result } = renderHook(() => useScrollVelocity())
    scrollTo(5) // 5 px in 16 ms: about 0.3 px per ms
    expect(result.current.motion).toBe('idle')
    wait(130)
    expect(result.current.motion).toBe('idle')
  })

  it('stays idle and adds no listener under reduced motion', () => {
    stubReducedMotion(true)
    const add = vi.spyOn(window, 'addEventListener')
    const { result } = renderHook(() => useScrollVelocity())
    expect(add.mock.calls.some(([type]) => type === 'scroll')).toBe(false)
    scrollTo(500)
    expect(result.current).toEqual({ motion: 'idle', thrust: 0 })
  })

  it('removes the listener and cancels the frame on unmount', () => {
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useScrollVelocity())
    y = 80
    act(() => { window.dispatchEvent(new Event('scroll')) })
    expect(frames.size).toBe(1)
    unmount()
    expect(remove.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(frames.size).toBe(0)
  })

  it('never calls preventDefault on a scroll', () => {
    renderHook(() => useScrollVelocity())
    const event = new Event('scroll', { cancelable: true })
    const prevent = vi.spyOn(event, 'preventDefault')
    act(() => { window.dispatchEvent(event) })
    expect(prevent).not.toHaveBeenCalled()
  })
})

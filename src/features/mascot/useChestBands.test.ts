import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { publishContext } from '../../assistant/context'
import { setLevelSource } from '../../audio/level'
import { FakeAnalyserNode } from '../../test/fakes'
import type { RobotCompanionElement } from '../../types/robot-companion'
import { CHEST_BARS, CHEST_READ_MS, useChestBands } from './useChestBands'

let reduced = false
let changeListeners: (() => void)[] = []
let analyser: FakeAnalyserNode
let reads: ReturnType<typeof vi.spyOn>

const robot = () => ({ setChestBands: vi.fn() })
const host = (el: ReturnType<typeof robot>) => ({ current: el as unknown as RobotCompanionElement })
const lastBands = (el: ReturnType<typeof robot>) => el.setChestBands.mock.calls.at(-1)?.[0]
const setHidden = (hidden: boolean) => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible')
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  reduced = false
  changeListeners = []
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query.includes('reduce') && reduced },
    addEventListener: (_: string, listener: () => void) => changeListeners.push(listener),
    removeEventListener: (_: string, listener: () => void) => { changeListeners = changeListeners.filter(item => item !== listener) },
  }))
  analyser = new FakeAnalyserNode()
  analyser.fftSize = 256
  analyser.frequency = Array.from({ length: 128 }, () => 255)
  setLevelSource(analyser as unknown as AnalyserNode)
  reads = vi.spyOn(analyser, 'getByteFrequencyData')
  publishContext('player', { playing: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setLevelSource(null)
  publishContext('player', { playing: false })
})

describe('useChestBands', () => {
  it('does nothing until the robot is ready', () => {
    const el = robot()
    renderHook(() => useChestBands(host(el), false))
    act(() => { publishContext('player', { playing: true }); vi.advanceTimersByTime(500) })
    expect(el.setChestBands).not.toHaveBeenCalled()
    expect(reads).not.toHaveBeenCalled()
  })

  it('rests the bars flat and reads nothing while paused', () => {
    const el = robot()
    renderHook(() => useChestBands(host(el), true))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(reads).not.toHaveBeenCalled()
    expect(lastBands(el)).toBeNull()
  })

  it('reads the real level while playing, about 30 times a second, and rests when it stops', () => {
    const el = robot()
    renderHook(() => useChestBands(host(el), true))
    act(() => { publishContext('player', { playing: true }) })
    act(() => { vi.advanceTimersByTime(1000) })
    const count = reads.mock.calls.length
    expect(count).toBeGreaterThanOrEqual(25)
    expect(count).toBeLessThanOrEqual(31)
    expect(1000 / CHEST_READ_MS).toBeLessThanOrEqual(30)
    expect(lastBands(el)).toEqual(new Array(CHEST_BARS).fill(1))
    act(() => { publishContext('player', { playing: false }) })
    expect(lastBands(el)).toBeNull()
    reads.mockClear()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(reads).not.toHaveBeenCalled()
  })

  it('makes no reads under reduced motion, even while playing', () => {
    reduced = true
    const el = robot()
    renderHook(() => useChestBands(host(el), true))
    act(() => { publishContext('player', { playing: true }); vi.advanceTimersByTime(1000) })
    expect(reads).not.toHaveBeenCalled()
    expect(lastBands(el)).toBeNull()
  })

  it('stops when reduced motion is switched on mid-play', () => {
    const el = robot()
    renderHook(() => useChestBands(host(el), true))
    act(() => { publishContext('player', { playing: true }); vi.advanceTimersByTime(200) })
    expect(reads).toHaveBeenCalled()
    reduced = true
    act(() => { changeListeners.forEach(listener => listener()) })
    reads.mockClear()
    act(() => { vi.advanceTimersByTime(500) })
    expect(reads).not.toHaveBeenCalled()
    expect(lastBands(el)).toBeNull()
  })

  it('stops reading when the tab is hidden, and carries on when it is shown', () => {
    const el = robot()
    renderHook(() => useChestBands(host(el), true))
    act(() => { publishContext('player', { playing: true }); vi.advanceTimersByTime(200) })
    act(() => setHidden(true))
    reads.mockClear()
    act(() => { vi.advanceTimersByTime(500) })
    expect(reads).not.toHaveBeenCalled()
    expect(lastBands(el)).toBeNull()
    act(() => setHidden(false))
    act(() => { vi.advanceTimersByTime(200) })
    expect(reads).toHaveBeenCalled()
  })

  it('stops, and leaves the bars flat, when it unmounts', () => {
    const el = robot()
    const { unmount } = renderHook(() => useChestBands(host(el), true))
    act(() => { publishContext('player', { playing: true }); vi.advanceTimersByTime(200) })
    unmount()
    reads.mockClear()
    act(() => { vi.advanceTimersByTime(500) })
    expect(reads).not.toHaveBeenCalled()
    expect(lastBands(el)).toBeNull()
  })
})

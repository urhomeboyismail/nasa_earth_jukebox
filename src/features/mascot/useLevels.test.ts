import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAudioContext } from '../../test/fakes'
import { useLevels } from './useLevels'

// Tone, replaced by a stand-in whose analyser answers with what the test sets. `toneLoaded` counts how often the module is evaluated.
const { context, destination, toneLoaded } = vi.hoisted(() => ({
  context: { analysers: [] as { frequency: number[]; waveform: number[] }[], createAnalyser: undefined as unknown },
  destination: { connected: [] as unknown[], connect: undefined as unknown, disconnect: undefined as unknown },
  toneLoaded: { count: 0 },
}))
vi.mock('tone', () => {
  toneLoaded.count++
  const real = new FakeAudioContext()
  destination.connect = (node: unknown) => { destination.connected.push(node); return node }
  destination.disconnect = (node: unknown) => { destination.connected = destination.connected.filter(item => item !== node) }
  return {
    getContext: () => ({ createAnalyser: () => { const node = real.createAnalyser(); context.analysers.push(node); return node } }),
    getDestination: () => destination,
  }
})

describe('useLevels', () => {
  let frames: Map<number, FrameRequestCallback>
  let nextFrame: number
  let clock: number
  const runFrame = (advance: number) => act(() => {
    clock += advance
    const due = [...frames.values()]
    frames.clear()
    due.forEach(callback => callback(clock))
  })
  const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve() })

  beforeEach(() => {
    frames = new Map()
    nextFrame = 1
    clock = 1000
    context.analysers = []
    destination.connected = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(nextFrame, callback); return nextFrame++ })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id) })
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('does nothing while it is not active: no frame, no Tone, no analyser', async () => {
    const before = toneLoaded.count
    const { result } = renderHook(() => useLevels(false))
    await settle()
    expect(frames.size).toBe(0)
    expect(context.analysers).toHaveLength(0)
    expect(toneLoaded.count).toBe(before)
    expect(result.current).toEqual({ levels: null, loudness: 0 })
  })

  it('follows the sound while active, at most 30 times a second', async () => {
    const { result } = renderHook(() => useLevels(true))
    await settle()
    expect(context.analysers).toHaveLength(1)
    context.analysers[0].frequency = new Array(128).fill(150)
    context.analysers[0].waveform = new Array(256).fill(255)
    runFrame(40)
    expect(Array.from(result.current.levels ?? [])).toEqual([150, 150, 150, 150])
    expect(result.current.loudness).toBeGreaterThan(0.9)
    context.analysers[0].frequency = new Array(128).fill(10)
    runFrame(10) // 10 ms later: too soon
    expect(Array.from(result.current.levels ?? [])).toEqual([150, 150, 150, 150])
    runFrame(30)
    expect(Array.from(result.current.levels ?? [])).toEqual([10, 10, 10, 10])
  })

  it('stops, lets go of the destination and rests when it turns inactive', async () => {
    const { result, rerender } = renderHook(({ on }) => useLevels(on), { initialProps: { on: true } })
    await settle()
    runFrame(40)
    expect(destination.connected).toHaveLength(1)
    rerender({ on: false })
    expect(frames.size).toBe(0)
    expect(destination.connected).toHaveLength(0)
    expect(result.current).toEqual({ levels: null, loudness: 0 })
  })

  it('reads once a second, with no frame loop, under reduced motion', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    const { result } = renderHook(() => useLevels(true))
    await settle()
    expect(frames.size).toBe(0)
    context.analysers[0].frequency = new Array(128).fill(70)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(Array.from(result.current.levels ?? [])).toEqual([70, 70, 70, 70])
    context.analysers[0].frequency = new Array(128).fill(30)
    act(() => { vi.advanceTimersByTime(500) })
    expect(Array.from(result.current.levels ?? [])).toEqual([70, 70, 70, 70])
    act(() => { vi.advanceTimersByTime(500) })
    expect(Array.from(result.current.levels ?? [])).toEqual([30, 30, 30, 30])
  })

  it('does not attach if it was turned off before Tone arrived', async () => {
    const { rerender } = renderHook(({ on }) => useLevels(on), { initialProps: { on: true } })
    rerender({ on: false })
    await settle()
    expect(context.analysers).toHaveLength(0)
  })
})

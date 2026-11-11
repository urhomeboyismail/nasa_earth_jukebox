import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FrameGrid } from '../../analysis'
import { INTERACTIVE_LOOKAHEAD_S } from '../../audio/ensemble/constants'
import type { EnsembleStatus, HeldTone } from '../../audio/ensemble/types'
import type { ColorScale } from '../../data'
import { PRESETS } from '../../sonify/presets'
import { probeTone } from '../../sonify/probe'
import { KEY_TONE_MS, createProbeAudio, useProbeSettings, type ProbeMap } from './probeAudio'

const scale: ColorScale = { stops: [{ value: 0, rgb: [0, 0, 255] }, { value: 40, rgb: [255, 0, 0] }], noData: [], maxColorDistance: 30 }
/** One row: rising from west to east, then two cells with no data. */
const VALUES = [0, 10, 20, 30, 40, null, null]
const grid: FrameGrid = {
  frameId: 'f', cols: VALUES.length, rows: 1, area: { x0: 0, y0: 0, x1: 1, y1: 1 },
  cells: VALUES.map(value => ({ value, category: value === null ? 'insufficient' : 'mild' })),
}
const EMPTY = 5

/** A recording ensemble with its own audio clock, which runs with the fake timers. */
function fakeEnsemble(status: EnsembleStatus = 'on') {
  let state = status
  let resolveStart: () => void = () => {}
  const ensemble = {
    hold: vi.fn<(tone: HeldTone | null, atTime?: number) => void>(),
    playDropout: vi.fn<(atTime?: number) => void>(),
    now: vi.fn(() => Date.now() / 1000),
    status: vi.fn(() => state),
    start: vi.fn(() => new Promise<void>(resolve => { resolveStart = () => { state = 'on'; resolve() } })),
  }
  return { ensemble, finishStart: () => resolveStart() }
}

let map: ProbeMap | null
function setup(status: EnsembleStatus = 'on') {
  const fake = fakeEnsemble(status)
  const probe = createProbeAudio(fake.ensemble, PRESETS.major, () => Date.now())
  probe.setMap(map)
  return { ...fake, probe }
}
const tonesHeld = (hold: ReturnType<typeof fakeEnsemble>['ensemble']['hold']) => hold.mock.calls.map(([tone]) => tone)

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 })
  map = { grid, colorScale: scale, slopeCue: true }
})
afterEach(() => { vi.useRealTimers(); localStorage.clear() })

describe('the throttle', () => {
  it('sends the first move at once and the latest one at the end of the gap', () => {
    const { ensemble, probe } = setup()
    probe.point(0, 0)
    expect(ensemble.hold).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10)
    probe.point(1, 0)
    vi.advanceTimersByTime(10)
    probe.point(2, 0)
    expect(ensemble.hold).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(30)
    expect(ensemble.hold).toHaveBeenCalledTimes(2)
    expect(ensemble.hold.mock.calls[1][0]).toEqual(probeTone(scale, grid, 2, 0, PRESETS.major))
  })

  it('never sends more than 20 tones in any second of moves 10 ms apart', () => {
    const { ensemble, probe } = setup()
    const sentAt: number[] = []
    ensemble.hold.mockImplementation(() => { sentAt.push(Date.now()) })
    for (let ms = 0; ms < 3000; ms += 10) {
      probe.point((ms / 10) % 5, 0)
      vi.advanceTimersByTime(10)
    }
    // Any 21 tones in a row span at least a second.
    for (let i = 0; i + 20 < sentAt.length; i++) expect(sentAt[i + 20] - sentAt[i]).toBeGreaterThanOrEqual(1000)
    expect(sentAt.length).toBeGreaterThanOrEqual(59)
  })

  it('asks for each tone within 50 ms of the audio clock', () => {
    const { ensemble, probe } = setup()
    for (let ms = 0; ms < 300; ms += 7) {
      probe.point((ms / 7) % 5, 0)
      vi.advanceTimersByTime(7)
    }
    probe.leave()
    expect(ensemble.hold.mock.calls.length).toBeGreaterThan(2)
    // The fake audio clock is the fake wall clock, so `now()` at the moment of each call is what Date.now() was then.
    for (const [index, [, atTime]] of ensemble.hold.mock.calls.entries()) {
      const now = ensemble.now.mock.results[index]?.value as number
      expect(atTime! - now).toBeLessThanOrEqual(0.05)
      expect(atTime! - now).toBeCloseTo(INTERACTIVE_LOOKAHEAD_S)
    }
  })
})

describe('the tone', () => {
  it('is the probe tone of the cell, brighter towards the warmer side', () => {
    const { ensemble, probe } = setup()
    // The west end: its only neighbour is warmer.
    probe.point(0, 0)
    const tone = ensemble.hold.mock.calls[0][0]!
    expect(tone).toEqual(probeTone(scale, grid, 0, 0, PRESETS.major))
    expect(tone.brightness).toBeGreaterThan(0.5)
  })

  it('keeps an even brightness when the slope cue is off', () => {
    map = { grid, colorScale: scale, slopeCue: false }
    const { ensemble, probe } = setup()
    probe.point(0, 0)
    expect(ensemble.hold.mock.calls[0][0]!.brightness).toBe(0.5)
  })

  it('does nothing before the map has been read', () => {
    map = null
    const { ensemble, probe } = setup()
    probe.point(1, 0)
    probe.key(1, 0)
    expect(ensemble.hold).not.toHaveBeenCalled()
    expect(ensemble.playDropout).not.toHaveBeenCalled()
  })
})

describe('the dropout cue', () => {
  it('plays once on entering the empty area, and not again while the pointer stays in it', () => {
    const { ensemble, probe } = setup()
    probe.point(4, 0)
    probe.point(EMPTY, 0)
    expect(ensemble.playDropout).toHaveBeenCalledTimes(1)
    probe.point(EMPTY, 0)
    vi.advanceTimersByTime(100)
    probe.point(EMPTY + 1, 0)
    expect(ensemble.playDropout).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    // The tone was released for the empty cell.
    expect(tonesHeld(ensemble.hold).at(-1)).toBeNull()
    // Out and back in again is a new entry.
    probe.point(4, 0)
    probe.point(EMPTY, 0)
    expect(ensemble.playDropout).toHaveBeenCalledTimes(2)
  })

  it('plays for each key press on an empty cell', () => {
    const { ensemble, probe } = setup()
    probe.key(EMPTY, 0)
    probe.key(EMPTY, 0)
    expect(ensemble.playDropout).toHaveBeenCalledTimes(2)
  })
})

describe('the release', () => {
  it('stops the tone at once on leave (pointer up, leaving the map, Escape), even with a tone waiting', () => {
    const { ensemble, probe } = setup()
    probe.point(0, 0)
    probe.point(1, 0)
    probe.leave()
    expect(tonesHeld(ensemble.hold)).toEqual([probeTone(scale, grid, 0, 0, PRESETS.major), null])
    vi.advanceTimersByTime(200)
    expect(ensemble.hold).toHaveBeenCalledTimes(2)
  })
})

describe('the arrow keys', () => {
  it('hold the tone for 300 ms, then release it', () => {
    const { ensemble, probe } = setup()
    probe.key(2, 0)
    vi.advanceTimersByTime(KEY_TONE_MS - 1)
    expect(tonesHeld(ensemble.hold)).toEqual([probeTone(scale, grid, 2, 0, PRESETS.major)])
    vi.advanceTimersByTime(1)
    expect(tonesHeld(ensemble.hold)).toEqual([probeTone(scale, grid, 2, 0, PRESETS.major), null])
  })

  it('extend the tone when another key comes in time, with one release at the end', () => {
    const { ensemble, probe } = setup()
    probe.key(2, 0)
    vi.advanceTimersByTime(200)
    probe.key(3, 0)
    vi.advanceTimersByTime(200)
    expect(tonesHeld(ensemble.hold)).not.toContain(null)
    vi.advanceTimersByTime(100)
    expect(tonesHeld(ensemble.hold)).toEqual([probeTone(scale, grid, 2, 0, PRESETS.major), probeTone(scale, grid, 3, 0, PRESETS.major), null])
  })
})

describe('starting the sound', () => {
  it('starts the ensemble once, and sends the tone held meanwhile when it has started', async () => {
    const { ensemble, probe, finishStart } = setup('off')
    probe.start()
    probe.start()
    expect(ensemble.start).toHaveBeenCalledTimes(1)
    probe.point(1, 0)
    ensemble.hold.mockClear()
    vi.advanceTimersByTime(10)
    finishStart()
    await vi.advanceTimersByTimeAsync(0)
    expect(tonesHeld(ensemble.hold)).toEqual([probeTone(scale, grid, 1, 0, PRESETS.major)])
  })

  it('does not start a sound that is already on', () => {
    const { ensemble, probe } = setup('on')
    probe.start()
    expect(ensemble.start).not.toHaveBeenCalled()
  })

  it('does not send a tone that was released while the sound was starting', async () => {
    const { ensemble, probe, finishStart } = setup('off')
    probe.start()
    probe.point(1, 0)
    probe.leave()
    ensemble.hold.mockClear()
    finishStart()
    await vi.advanceTimersByTimeAsync(0)
    expect(ensemble.hold).not.toHaveBeenCalled()
  })
})

describe('the stored choices', () => {
  it('start with the tone off for a data set without a sonification block, and on with one; the slope cue on', () => {
    expect(renderHook(() => useProbeSettings(false)).result.current).toMatchObject({ tone: false, slopeCue: true })
    expect(renderHook(() => useProbeSettings(true)).result.current).toMatchObject({ tone: true, slopeCue: true })
  })

  it('remember a choice, which then wins over the default', () => {
    const { result } = renderHook(() => useProbeSettings(true))
    act(() => result.current.setTone(false))
    act(() => result.current.setSlopeCue(false))
    expect(result.current).toMatchObject({ tone: false, slopeCue: false })
    expect(renderHook(() => useProbeSettings(true)).result.current).toMatchObject({ tone: false, slopeCue: false })
    localStorage.setItem('earth-jukebox:explore-tone', 'on')
    expect(renderHook(() => useProbeSettings(false)).result.current.tone).toBe(true)
  })

  it('still work when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const { result } = renderHook(() => useProbeSettings(true))
    expect(result.current.tone).toBe(true)
    act(() => result.current.setTone(false))
    expect(result.current.tone).toBe(false)
    vi.restoreAllMocks()
  })
})

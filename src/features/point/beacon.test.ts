import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BEACON_GAP_MS, BEACON_LEVEL, playBeacon } from './beacon'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('playBeacon', () => {
  it('plays three pings 300 ms apart, the first at once', () => {
    const ensemble = { playNotes: vi.fn() }
    playBeacon(ensemble, { midi: 72, x: 0.75, y: 0.25 })
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(BEACON_GAP_MS - 1)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(BEACON_GAP_MS)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(BEACON_GAP_MS * 5)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(3)
  })

  it('pans each ping east or west and raises it north or south, all three the same', () => {
    const ensemble = { playNotes: vi.fn() }
    playBeacon(ensemble, { midi: 72, x: 0.75, y: 0.25 })
    vi.runAllTimers()
    const notes = ensemble.playNotes.mock.calls.map(call => call[0])
    expect(notes[0]).toEqual([{ midi: 72, pan: 0.5, elevation: 0.5, level: BEACON_LEVEL, seconds: 0.15 }])
    expect(notes[1]).toEqual(notes[0])
    expect(notes[2]).toEqual(notes[0])
    // One note per ping, at the ensemble's own time (no time given): the first is immediate.
    expect(ensemble.playNotes.mock.calls.every(call => call.length === 1)).toBe(true)
  })

  it('stops the pings still to come', () => {
    const ensemble = { playNotes: vi.fn() }
    const stop = playBeacon(ensemble, { midi: 60, x: 0, y: 1 })
    vi.advanceTimersByTime(BEACON_GAP_MS)
    stop()
    vi.runAllTimers()
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(ensemble.playNotes.mock.calls[0][0][0]).toMatchObject({ pan: -1, elevation: -1 })
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTimerClock } from './timerClock'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function make(duration = 10, loop = false) {
  const onTick = vi.fn()
  const onPause = vi.fn()
  return { clock: createTimerClock({ duration, loop: () => loop, onTick, onPause }), onTick, onPause }
}

describe('the timer clock, a stand-in for a video', () => {
  it('starts at 0, and runs at the playback rate', async () => {
    const { clock } = make()
    expect(clock.currentTime).toBe(0)
    await clock.play()
    vi.advanceTimersByTime(1000)
    expect(clock.currentTime).toBeCloseTo(1, 1)
    clock.playbackRate = 2
    vi.advanceTimersByTime(1000)
    expect(clock.currentTime).toBeCloseTo(3, 1)
  })

  it('ticks about ten times a second while it runs', async () => {
    const { clock, onTick } = make()
    await clock.play()
    vi.advanceTimersByTime(1000)
    expect(onTick.mock.calls.length).toBeGreaterThanOrEqual(8)
    expect(onTick.mock.calls.length).toBeLessThanOrEqual(12)
  })

  it('stops at the end and says so once', async () => {
    const { clock, onPause, onTick } = make(1)
    await clock.play()
    vi.advanceTimersByTime(3000)
    expect(clock.currentTime).toBe(1)
    expect(onPause).toHaveBeenCalledTimes(1)
    const ticks = onTick.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(onTick).toHaveBeenCalledTimes(ticks)
  })

  it('wraps to the start at the end when asked to loop, and does not stop', async () => {
    const { clock, onPause } = make(1, true)
    await clock.play()
    vi.advanceTimersByTime(1500)
    expect(clock.currentTime).toBeCloseTo(0.5, 1)
    expect(onPause).not.toHaveBeenCalled()
  })

  it('pauses on request, says so once, and pausing a stopped clock says nothing', async () => {
    const { clock, onPause } = make()
    await clock.play()
    vi.advanceTimersByTime(500)
    clock.pause()
    const at = clock.currentTime
    vi.advanceTimersByTime(500)
    expect(clock.currentTime).toBe(at)
    clock.pause()
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  it('can be set to a time, kept between 0 and the end', () => {
    const { clock } = make(10)
    clock.currentTime = 4
    expect(clock.currentTime).toBe(4)
    clock.currentTime = 99
    expect(clock.currentTime).toBe(10)
    clock.currentTime = -3
    expect(clock.currentTime).toBe(0)
  })

  it('plays again from the start when played at the end', async () => {
    const { clock } = make(1)
    await clock.play()
    vi.advanceTimersByTime(2000)
    await clock.play()
    vi.advanceTimersByTime(100)
    expect(clock.currentTime).toBeGreaterThan(0)
    expect(clock.currentTime).toBeLessThan(0.3)
  })

  it('goes quiet when taken down, without saying it paused', async () => {
    const { clock, onPause, onTick } = make()
    await clock.play()
    clock.dispose()
    onTick.mockClear()
    vi.advanceTimersByTime(1000)
    expect(onTick).not.toHaveBeenCalled()
    expect(onPause).not.toHaveBeenCalled()
  })
})

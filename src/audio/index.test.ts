import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { createSoundEngine, type SequenceStep } from '.'

const mapping = (fixture as Visualization).mapping
const steps: SequenceStep[] = [
  { category: 'cold', atMs: 0 },
  { category: 'mild', atMs: 1000 },
  { category: 'insufficient', atMs: 2000 },
]

describe('stub sound engine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })
  afterEach(() => vi.useRealTimers())

  it('ignores playback until unlocked', () => {
    const engine = createSoundEngine(mapping)
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    vi.advanceTimersByTime(5000)
    expect(onStep).not.toHaveBeenCalled()
    expect(engine.isPlaying()).toBe(false)
  })

  it('fires onStep in order at each step time, then stops playing', async () => {
    const engine = createSoundEngine(mapping)
    await engine.unlock()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    vi.advanceTimersByTime(0)
    expect(onStep.mock.calls).toEqual([[0]])
    vi.advanceTimersByTime(1000)
    expect(onStep.mock.calls).toEqual([[0], [1]])
    vi.advanceTimersByTime(1000)
    expect(onStep.mock.calls).toEqual([[0], [1], [2]])
    expect(engine.isPlaying()).toBe(false)
  })

  it('pauses and resumes from the next step that has not sounded', async () => {
    const engine = createSoundEngine(mapping)
    await engine.unlock()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    vi.advanceTimersByTime(500)
    engine.pause()
    expect(engine.isPlaying()).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(onStep.mock.calls).toEqual([[0]])
    engine.resume()
    expect(engine.isPlaying()).toBe(true)
    vi.advanceTimersByTime(500)
    expect(onStep.mock.calls).toEqual([[0], [1]])
    vi.advanceTimersByTime(1000)
    expect(onStep.mock.calls).toEqual([[0], [1], [2]])
  })

  it('stop and duck halt playback; duck does not resume on its own', async () => {
    const engine = createSoundEngine(mapping)
    await engine.unlock()
    const onStep = vi.fn()
    engine.playSequence(steps, onStep)
    vi.advanceTimersByTime(0)
    engine.duck()
    engine.unduck()
    vi.advanceTimersByTime(5000)
    expect(onStep).toHaveBeenCalledTimes(1)
    engine.resume()
    engine.stop()
    vi.advanceTimersByTime(5000)
    expect(onStep).toHaveBeenCalledTimes(1)
  })

  it('keeps volume between 0 and 1 and reports WAV export as not built', async () => {
    const engine = createSoundEngine(mapping)
    expect(() => engine.setVolume(3)).not.toThrow()
    await expect(engine.renderToWav(steps)).rejects.toThrow(/T08/)
  })
})

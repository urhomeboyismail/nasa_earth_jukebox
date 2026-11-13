import { afterEach, describe, expect, it, vi } from 'vitest'
import { SPEECH_GAP_MS, createSpeechGate, registerSpeechStopper, stopSpeech } from './speech'

afterEach(() => vi.unstubAllGlobals())

describe('createSpeechGate', () => {
  it('allows the first, drops what comes inside the gap, and allows again after it', () => {
    const gate = createSpeechGate()
    expect(gate.allow(0)).toBe(true)
    expect(gate.allow(SPEECH_GAP_MS - 1)).toBe(false)
    expect(gate.allow(SPEECH_GAP_MS)).toBe(true)
  })

  it('does not count a dropped sentence, so it is never queued', () => {
    const gate = createSpeechGate(4000)
    gate.allow(0)
    gate.allow(3000)
    expect(gate.allow(4000)).toBe(true)
  })

  it('is not held shut by a clock that went backwards', () => {
    const gate = createSpeechGate()
    gate.allow(100_000)
    expect(gate.allow(0)).toBe(true)
  })
})

describe('stopSpeech', () => {
  it('cancels the browser’s speech and runs every registered stopper', () => {
    const cancel = vi.fn()
    vi.stubGlobal('speechSynthesis', { cancel })
    const a = vi.fn()
    const b = vi.fn()
    const offA = registerSpeechStopper(a)
    const offB = registerSpeechStopper(b)
    stopSpeech()
    expect(cancel).toHaveBeenCalledOnce()
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
    offA()
    stopSpeech()
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledTimes(2)
    offB()
  })

  it('works where there is no speech synthesis', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    expect(() => stopSpeech()).not.toThrow()
  })
})

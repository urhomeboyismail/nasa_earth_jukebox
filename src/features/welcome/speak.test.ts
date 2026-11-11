import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DUCK_LINEAR, duck } from '../../audio/duck'
import { hush, speak } from './speak'

type Utterance = { text: string; onend?: () => void; onerror?: () => void }
let spoken: Utterance[]

beforeEach(() => {
  duck.reset()
  spoken = []
  vi.stubGlobal('speechSynthesis', { speak: (u: Utterance) => spoken.push(u), cancel: vi.fn() })
  vi.stubGlobal('SpeechSynthesisUtterance', class { text: string; constructor(text: string) { this.text = text } })
})
afterEach(() => {
  hush()
  duck.reset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('speak', () => {
  it('ducks while it speaks and resolves on the utterance end', async () => {
    const done = vi.fn()
    void speak('Hello').then(done)
    expect(duck.target()).toBe(DUCK_LINEAR)
    await Promise.resolve()
    expect(done).not.toHaveBeenCalled()
    spoken[0].onend?.()
    await Promise.resolve()
    expect(done).toHaveBeenCalled()
    expect(duck.target()).toBe(1)
  })

  it('resolves on an error too, and only ends its duck once', async () => {
    const first = speak('One')
    spoken[0].onerror?.()
    await first
    spoken[0].onend?.()
    expect(duck.target()).toBe(1)
    duck.begin('guide')
    spoken[0].onend?.()
    expect(duck.target()).toBe(DUCK_LINEAR)
  })

  it('hush() ends the duck and resolves a pending speech', async () => {
    const pending = speak('Long text')
    hush()
    await pending
    expect(duck.target()).toBe(1)
  })

  it('a new speech replaces the old one without leaving a duck behind', async () => {
    const first = speak('One')
    void speak('Two')
    await first
    expect(duck.target()).toBe(DUCK_LINEAR)
    spoken[1].onend?.()
    expect(duck.target()).toBe(1)
  })

  it('resolves after a fallback when the browser never sends an end', async () => {
    vi.useFakeTimers()
    const pending = speak('Stuck')
    await vi.advanceTimersByTimeAsync(20000)
    await pending
    expect(duck.target()).toBe(1)
  })

  it('resolves at once, with no duck, where there is no speech', async () => {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(window, 'speechSynthesis')
    await speak('Nobody hears this')
    expect(duck.target()).toBe(1)
  })
})

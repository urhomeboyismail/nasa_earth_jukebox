import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRecognition } from '../test/fakes'
import { listenForWake, recognitionCtor, RESTART_MS, RETRY_MS, wakeQuery } from './wakeWord'

const latest = () => FakeRecognition.instances.at(-1)!

describe('wakeQuery', () => {
  it.each([
    ['hey echo', ''],
    ['Hey Echo', ''],
    ['heyy echo', ''],
    ['hey, echo!', ''],
    ['okay echo', ''],
    ['hey eco', ''],
    ['heyecho', ''],
    ['Hey Echo what was the lowest value', 'what was the lowest value'],
    ['so um hey echo, play the next date', 'play the next date'],
  ])('hears %j and the question %j', (text, question) => {
    expect(wakeQuery(text)).toBe(question)
  })

  it.each(['echo', 'hello there', 'they echoed it', 'hey echolocation'])('does not wake on %j', text => {
    expect(wakeQuery(text)).toBeNull()
  })
})

describe('recognitionCtor', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('is null where the browser has no speech recognition, and finds the prefixed one', () => {
    expect(recognitionCtor()).toBeNull()
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    expect(recognitionCtor()).toBe(FakeRecognition)
  })
})

describe('listenForWake', () => {
  beforeEach(() => { FakeRecognition.instances = []; vi.useFakeTimers() })
  afterEach(() => vi.useRealTimers())

  const listen = () => {
    const onWake = vi.fn()
    const onBlocked = vi.fn()
    const listener = listenForWake(FakeRecognition, { lang: 'en', onWake, onBlocked })
    return { listener, onWake, onBlocked }
  }

  it('listens continuously in the language given, final results only', () => {
    listen()
    expect(latest()).toMatchObject({ continuous: true, interimResults: false, lang: 'en', started: 1 })
  })

  it('wakes on the phrase with the question after it, and lets go of the microphone first', () => {
    const { onWake } = listen()
    latest().say('what time is it')
    latest().say('hey echo is any data missing', false)
    expect(onWake).not.toHaveBeenCalled()
    const recognition = latest()
    recognition.say('hey echo is any data missing')
    expect(recognition.aborted).toBe(true)
    expect(onWake).toHaveBeenCalledWith('is any data missing')
    vi.advanceTimersByTime(60_000)
    expect(FakeRecognition.instances).toHaveLength(1) // Not started again.
  })

  it('starts again after the recogniser stops by itself, and backs off after errors', () => {
    listen()
    latest().stop()
    vi.advanceTimersByTime(RESTART_MS - 1)
    expect(FakeRecognition.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeRecognition.instances).toHaveLength(2)
    latest().fail('network')
    vi.advanceTimersByTime(RETRY_MS[0] - 1)
    expect(FakeRecognition.instances).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(FakeRecognition.instances).toHaveLength(3)
    latest().fail('no-speech') // Silence is normal: no back-off added.
    vi.advanceTimersByTime(RETRY_MS[0])
    expect(FakeRecognition.instances).toHaveLength(4)
  })

  it('stops for good when the browser refuses the microphone', () => {
    const { onBlocked } = listen()
    latest().fail('not-allowed')
    expect(onBlocked).toHaveBeenCalledWith('not-allowed')
    vi.advanceTimersByTime(60_000)
    expect(FakeRecognition.instances).toHaveLength(1)
  })

  it('stop() aborts and never starts again', () => {
    const { listener } = listen()
    const recognition = latest()
    listener.stop()
    expect(recognition.aborted).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(FakeRecognition.instances).toHaveLength(1)
  })
})

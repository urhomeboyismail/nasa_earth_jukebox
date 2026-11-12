import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeAudioContext, installFakeAudioContext } from '../test/fakes'
import { INPUT_RATE, OUTPUT_RATE, SpeechPlayer, frameLevel } from './audio'

const pcm = (...samples: number[]) => new Int16Array(samples).buffer

describe('rates', () => {
  it('use the Gemini Live rates', () => {
    expect(INPUT_RATE).toBe(16000)
    expect(OUTPUT_RATE).toBe(24000)
  })
})

describe('frameLevel', () => {
  it('is 0 for silence', () => expect(frameLevel(pcm(0, 0, 0, 0))).toBe(0))
  it('is near 1 for a full-scale sample', () => expect(frameLevel(pcm(-32768))).toBeCloseTo(1, 5))
  it('is a peak, not an average', () => {
    expect(frameLevel(pcm(0, 0, 16384, 0, 0, 0, 0, 0))).toBeCloseTo(0.5, 5)
  })
})

type FakeSource = { started: number[]; stopped: number; onended: (() => void) | null; connect: () => void; start: (when: number) => void; stop: () => void }

// The shared fake has no buffers or buffer sources; this adds just enough for SpeechPlayer.
class PlayerContext extends FakeAudioContext {
  options: unknown
  sources: FakeSource[] = []
  constructor(options?: unknown) { super(); this.options = options }
  createBuffer(_channels: number, length: number, rate: number) {
    const data = new Float32Array(length)
    return { duration: length / rate, getChannelData: () => data }
  }
  createBufferSource() {
    const source: FakeSource = {
      started: [], stopped: 0, onended: null, connect: () => {},
      start(when) { source.started.push(when) },
      stop() { source.stopped++ },
    }
    this.sources.push(source)
    return source
  }
}

describe('SpeechPlayer', () => {
  let audio: ReturnType<typeof installFakeAudioContext>
  beforeEach(() => { audio = installFakeAudioContext(); vi.stubGlobal('AudioContext', PlayerContext) })
  afterEach(() => audio.uninstall())

  const context = () => FakeAudioContext.instances[0] as PlayerContext

  it('creates one context at 24 000 Hz', () => {
    new SpeechPlayer()
    expect(FakeAudioContext.instances).toHaveLength(1)
    expect(context().options).toEqual({ sampleRate: 24000 })
  })

  it('makes one buffer source per chunk, ignores an empty chunk, and reports playing and idle', () => {
    const player = new SpeechPlayer()
    const idle = vi.fn()
    player.onIdle = idle
    player.play(new ArrayBuffer(0))
    expect(context().sources).toHaveLength(0)
    player.play(pcm(0, 1000, -1000, 5))
    expect(context().sources).toHaveLength(1)
    expect(context().sources[0].started).toHaveLength(1)
    expect(player.playing).toBe(true)
    expect(player.busy).toBe(true)
    context().sources[0].onended?.()
    expect(player.playing).toBe(false)
    expect(idle).toHaveBeenCalledTimes(1)
    expect(player.busy).toBe(true) // the echo tail
  })

  it('flush stops the sources and clears the echo tail', () => {
    const player = new SpeechPlayer()
    player.play(pcm(1, 2, 3))
    player.flush()
    expect(context().sources[0].stopped).toBe(1)
    expect(player.playing).toBe(false)
    expect(player.busy).toBe(false)
  })

  it('resumes a suspended context, and close closes it', async () => {
    const player = new SpeechPlayer()
    await player.resume()
    expect(context().state).toBe('running')
    player.close()
    expect(context().state).toBe('closed')
  })
})

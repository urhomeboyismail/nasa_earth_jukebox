import { afterEach, describe, expect, it } from 'vitest'
import { FakeAudioContext } from '../test/fakes'
import { attachLevels, bandsFrom, detachLevels, getLevels, getLoudness, LEVEL_BANDS } from './levels'

/** A stand-in for Tone with just what levels.ts uses: a context that makes analysers, and a destination to tap. */
function fakeTone() {
  const context = new FakeAudioContext()
  const taps: unknown[] = []
  const destination = {
    connected: [] as unknown[],
    connect(node: unknown) { this.connected.push(node); return node },
    disconnect(node: unknown) { this.connected = this.connected.filter(item => item !== node) },
  }
  const tone = { getContext: () => context, getDestination: () => destination }
  return { tone, context, destination, taps }
}

afterEach(() => detachLevels())

describe('bandsFrom', () => {
  it('always returns `bands` values, whatever the input length', () => {
    for (const length of [0, 1, 3, 4, 7, 128, 1024]) expect(bandsFrom(new Uint8Array(length).fill(100), 4)).toHaveLength(4)
    expect(bandsFrom(new Uint8Array(10), 0)).toHaveLength(0)
  })

  it('averages log-spaced bands: narrow at the low end, wide at the high end', () => {
    const freq = new Uint8Array(128)
    freq[0] = 200 // the lowest band is bins 0 to 2
    freq.fill(80, 38) // the top band is bins 38 to 127
    expect(Array.from(bandsFrom(freq, 4))).toEqual([67, 0, 0, 80])
  })

  it('gives the same value in every band for a flat spectrum', () => {
    expect(Array.from(bandsFrom(new Uint8Array(128).fill(90), 4))).toEqual([90, 90, 90, 90])
  })
})

describe('the analyser tap', () => {
  it('reads nothing before it is attached', () => {
    const out = new Uint8Array(LEVEL_BANDS).fill(7)
    expect(getLevels(out)).toBe(false)
    expect(Array.from(out)).toEqual([7, 7, 7, 7])
    expect(getLoudness()).toBe(0)
  })

  it('attaches once: one analyser, fed from the destination and feeding nothing', () => {
    const { tone, context, destination } = fakeTone()
    attachLevels(tone)
    attachLevels(tone)
    expect(context.analysers).toHaveLength(1)
    const [analyser] = context.analysers
    expect(analyser.fftSize).toBe(256)
    expect(destination.connected).toEqual([analyser])
    expect(analyser.connected).toEqual([])
  })

  it('reports band levels and loudness from what the analyser hears', () => {
    const { tone, context } = fakeTone()
    attachLevels(tone)
    const [analyser] = context.analysers
    analyser.frequency = new Array(128).fill(120)
    const out = new Uint8Array(LEVEL_BANDS)
    expect(getLevels(out)).toBe(true)
    expect(Array.from(out)).toEqual([120, 120, 120, 120])
    expect(getLoudness()).toBe(0) // silence is 128 in the time-domain data
    analyser.waveform = new Array(256).fill(255)
    expect(getLoudness()).toBeGreaterThan(0.9)
    expect(getLoudness()).toBeLessThanOrEqual(1)
  })

  it('detaches from the destination, and reads nothing afterwards', () => {
    const { tone, destination } = fakeTone()
    attachLevels(tone)
    detachLevels()
    expect(destination.connected).toEqual([])
    expect(getLevels(new Uint8Array(LEVEL_BANDS))).toBe(false)
    detachLevels()
  })
})

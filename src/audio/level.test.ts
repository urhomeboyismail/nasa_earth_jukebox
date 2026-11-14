import { afterEach, describe, expect, it } from 'vitest'
import { FakeAnalyserNode } from '../test/fakes'
import { hasLevelSource, readBands, setLevelSource } from './level'

const analyser = (fill: (bin: number) => number) => {
  const node = new FakeAnalyserNode()
  node.fftSize = 256
  node.frequency = Array.from({ length: node.frequencyBinCount }, (_, bin) => fill(bin))
  return node as unknown as AnalyserNode & FakeAnalyserNode
}

afterEach(() => setLevelSource(null))

describe('readBands', () => {
  it('is all zeros while nothing is tapped', () => {
    expect(hasLevelSource()).toBe(false)
    expect(readBands(6)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('is all zeros for a silent analyser', () => {
    setLevelSource(analyser(() => 0))
    expect(readBands(6)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('is all ones when every bin is at full scale', () => {
    setLevelSource(analyser(() => 255))
    expect(readBands(6)).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('gives each log-spaced band the mean of its own bins, low pitch first', () => {
    // 128 bins, 4 bands: edges 1, 3 (128^¼ = 3.4), 11 (√128), 38, 128.
    setLevelSource(analyser(bin => (bin >= 11 && bin < 38 ? 255 : 0)))
    expect(readBands(4)).toEqual([0, 0, 1, 0])
    setLevelSource(analyser(bin => (bin === 1 || bin === 2 ? 51 : 0)))
    expect(readBands(4)).toEqual([0.2, 0, 0, 0])
  })

  it('leaves out bin 0, the offset', () => {
    setLevelSource(analyser(bin => (bin === 0 ? 255 : 0)))
    expect(readBands(6)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('stays in 0 to 1 for any band count, and returns that many', () => {
    setLevelSource(analyser(bin => (bin * 7) % 256))
    for (const count of [1, 5, 8, 40, 200]) {
      const bands = readBands(count)
      expect(bands).toHaveLength(count)
      for (const level of bands) {
        expect(level).toBeGreaterThanOrEqual(0)
        expect(level).toBeLessThanOrEqual(1)
      }
    }
    expect(readBands(0)).toEqual([])
  })

  it('goes back to zeros when the source is removed', () => {
    setLevelSource(analyser(() => 255))
    setLevelSource(null)
    expect(readBands(3)).toEqual([0, 0, 0])
  })
})

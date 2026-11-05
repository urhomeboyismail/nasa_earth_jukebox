import { describe, expect, it } from 'vitest'
import { SCENE_MAPPING, SCENE_SCALE, SCENE_SIZE, scene } from '../test/changeScene'
import { analyzePixels } from './analyze'
import { changeRows, CHANGE_COLS, scorePixels, type ScoreInput } from './score'

const area = { x0: 0, y0: 0, x1: 1, y1: 1 }
const input: ScoreInput = { frameId: 'f', colorScale: SCENE_SCALE, mapping: SCENE_MAPPING, area, noiseFloor: 0.2 }

describe('scorePixels', () => {
  it('uses 180 × 90 cells for a global 2:1 map', () => {
    expect(CHANGE_COLS).toBe(180)
    expect(changeRows(1920, 960, area)).toBe(90)
  })

  it('season test: a season 4 degrees warmer than its normal is not change; a planted patch is', () => {
    const planted = scorePixels(scene({ season: 4, patch: 1.5 }), scene({ season: 4 }), input)
    const seasonOnly = scorePixels(scene({ season: 4 }), scene({ season: 4 }), input)
    expect(seasonOnly.change.step).toBe('normal')
    expect(seasonOnly.change.medianChange).toBe(0)
    expect(planted.change.step).toBe('much-above')
    expect(planted.change.medianChange).toBeCloseTo(1.5, 1)
    expect(planted.change.shareAbove[0]).toBeCloseTo(0.6, 2)
    expect(planted.change.shareAbove[1]).toBe(0)
    // Against a winter normal the same map would read as a huge warm change: this is the mistake a reference date makes across months.
    expect(scorePixels(scene({ season: 4 }), scene({ season: 0 }), input).change.step).toBe('much-above')
  })

  it('reads an anomaly product as the change itself', () => {
    const s = scorePixels(scene({ season: 0.5 }), null, { ...input, noiseFloor: 0 })
    // No subtraction: the median of the map itself (1 + 0.5 + a slope of 0 to 3).
    expect(s.change.medianChange).toBeCloseTo(3, 0)
    expect(s.change.step).toBe('much-above')
  })

  it('leaves land out and gives "insufficient" when most of the map is unreadable', () => {
    const some = scorePixels(scene({ season: 1.5, landFrom: 300 }), scene({ season: 0, landFrom: 300 }), input)
    expect(some.change.validFraction).toBeCloseTo(300 / 360, 2)
    expect(some.change.step).toBe('much-above')
    const mostly = scorePixels(scene({ season: 1.5, landFrom: 20 }), scene({ season: 0, landFrom: 20 }), input)
    expect(mostly.change.step).toBe('insufficient')
  })

  it('refuses a baseline of another size, and gives the same Score twice', () => {
    expect(() => scorePixels(scene({ season: 0 }), { ...scene({ season: 0 }), width: SCENE_SIZE.width - 1 }, input)).toThrow(/same size/)
    const a = scorePixels(scene({ season: 2, patch: 1.5 }), scene({ season: 2 }), input)
    expect(JSON.stringify(scorePixels(scene({ season: 2, patch: 1.5 }), scene({ season: 2 }), input))).toBe(JSON.stringify(a))
  })
})

describe('the change step of a region', () => {
  const region = { id: 'r', name: 'r', description: '', points: [0.1, 0.3, 0.5, 0.9].flatMap(x => [0.2, 0.5, 0.8].map(y => ({ x, y }))) }
  const frame = { id: 'f', date: '2000-01-01', image: 'f.png', width: 360, height: 180, altText: '' }
  const mapping = { scale: 's', summary: 'median' as const, minValidFraction: 0.5, categories: [{ id: 'all', label: 'All', range: [-100, 100] as [number, number], note: 'C4' }], tick: { note: 'C4', durationMs: 50 }, missingCue: { type: 'noise' as const, durationMs: 50 } }
  const steps = SCENE_MAPPING.changeSteps

  it('adds changeStep and medianChange, and leaves category as it was', () => {
    const plain = analyzePixels(scene({ season: 4, patch: 1.5 }), frame, region, SCENE_SCALE, mapping)
    const withChange = analyzePixels(scene({ season: 4, patch: 1.5 }), frame, region, SCENE_SCALE, mapping, { baseline: scene({ season: 4 }), noiseFloor: 0.2, changeSteps: steps })
    expect(plain.changeStep).toBeUndefined()
    expect(withChange.category).toBe(plain.category)
    expect(withChange.medianValue).toBe(plain.medianValue)
    // Nine of the twelve points sit in the patch (x < 0.6), so the median is the patch's +1.5.
    expect(withChange.medianChange).toBeCloseTo(1.5, 1)
    expect(withChange.changeStep).toBe('much-above')
  })

  it('counts a point only where the frame and its baseline are both readable', () => {
    const r = analyzePixels(scene({ season: 1 }), frame, region, SCENE_SCALE, mapping, { baseline: scene({ season: 0, landFrom: 100 }), noiseFloor: 0.2, changeSteps: steps })
    expect(r.valid).toBe(12)
    expect(r.changeStep).toBe('insufficient')
  })
})

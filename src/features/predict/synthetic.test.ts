// The judge against frames read by the real feature extractor (SN01), on the data sets whose answers are known exactly (SN02), so the question and the
// answer are checked end to end: pixels, tracked hot spots, judge.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../../analysis/features/extract'
import { inputFor, withSquare } from '../../analysis/features/testScenes'
import { FEATURE_COLS, FEATURE_ROWS, type FrameFeatures } from '../../analysis/features/types'
import type { Pixels } from '../../analysis/analyze'
import { visualizationSchema } from '../../data/schema'
import { decodePng } from '../../analysis/png'
import { answerFor, questionsFor, type Question } from './judge'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data')
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }

/** Reads frames in order, so the hot spots keep their ids. */
function chain(frames: Pixels[]): FrameFeatures[] {
  const out: FrameFeatures[] = []
  frames.forEach((pixels, k) => out.push(extractFeatures(pixels, inputFor({ frameId: `f${k}` }), out[k - 1])))
  return out
}

const answer = (kind: Question['kind'], now: FrameFeatures, later: FrameFeatures) => {
  const question = questionsFor(now, later).find(q => q.kind === kind)
  return question ? answerFor(question, now, later) : null
}

describe('predict on scenes with a known warm area', () => {
  const squares = (sizes: number[], step = 0) => chain(sizes.map((s, k) => withSquare(2, [20 + k * step, 10, s, s], 10)))

  it('answers "bigger" for a growing square, "smaller" for a shrinking one and "the same" for a steady one', () => {
    const grow = squares([4, 6, 8])
    const shrink = squares([8, 6, 4])
    const steady = squares([6, 6, 6])
    expect(answer('size', grow[0], grow[2])).toBe('bigger')
    expect(answer('size', shrink[0], shrink[2])).toBe('smaller')
    expect(answer('size', steady[0], steady[2])).toBe('same')
  })

  it('answers the way a square moves, and "stays put" for a move of one cell or less', () => {
    const east = squares([6, 6, 6], 3)
    const still = squares([6, 6, 6], 0)
    expect(answer('direction', east[0], east[2])).toBe('east')
    expect(answer('direction', still[0], still[2])).toBe('still')
  })

  it('offers no question when the warm area is gone two dates later', () => {
    const [now, , later] = chain([withSquare(2, [20, 10, 6, 6], 10), withSquare(2, [20, 10, 6, 6], 10), withSquare(2, [20, 10, 6, 6], 2)])
    expect(questionsFor(now, later)).toEqual([])
  })
})

describe('predict on synthetic-storm (SN02)', () => {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/synthetic-storm/manifest.json`, 'utf8')))
  const expected = JSON.parse(readFileSync(`${dataDir}/synthetic-storm/expected.json`, 'utf8')) as { frames: { hotspots: { name: string; centre: { x: number; y: number } }[] }[] }
  const features: FrameFeatures[] = []
  for (const frame of v.frames) {
    features.push(extractFeatures(decodePng(readFileSync(`${dataDir}/synthetic-storm/${frame.image}`)), {
      frameId: frame.id, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE,
    }, features[features.length - 1]))
  }
  const drawn = (k: number) => expected.frames[k].hotspots.find(h => h.name === 'storm')!.centre

  it('asks about the storm on every date that has two more dates with the storm in them, and answers as it was drawn', () => {
    for (let k = 0; k <= 6; k++) {
      const asked = questionsFor(features[k], features[k + 2])
      expect(asked.map(q => q.kind), `date ${k}`).toEqual(['size', 'direction'])
      // From the drawn centres, in cells: the storm travels south-east, and the answer is the longer way.
      const across = (drawn(k + 2).x - drawn(k).x) * FEATURE_COLS
      const down = (drawn(k + 2).y - drawn(k).y) * FEATURE_ROWS
      expect(across, `date ${k}`).toBeGreaterThan(0)
      expect(down, `date ${k}`).toBeGreaterThan(0)
      expect(answer('direction', features[k], features[k + 2]), `date ${k}`).toBe(Math.abs(across) >= Math.abs(down) ? 'east' : 'south')
    }
  })

  it('asks nothing where the storm is gone, or where there are not two more dates', () => {
    expect(questionsFor(features[7], features[9])).toEqual([])
    expect(questionsFor(features[9], features[9])).toEqual([])
  })

  it('gives the same questions and answers every time', () => {
    expect(questionsFor(features[2], features[4])).toEqual(questionsFor(features[2], features[4]))
  })
})

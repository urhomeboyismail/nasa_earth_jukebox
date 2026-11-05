// Change regression baseline (docs/PLAN.md §5.9, T112). Records the `Score` of made-up scenes with a known answer in
// src/data/__golden__/change.json, so any change to the change maths shows in a diff. Data sets with a baseline are added to
// the golden file when T111 lands `synthetic-change` (a data set in index.json with a `baseline` and no entry here fails the last test).
//
// If this fails, the maths changed. A PR that rewrites change.json must say why, and the team leader approves it. To rewrite it after
// a change you meant to make: `npx vitest run -u src/data/change-regression.test.ts`, then read the diff before you commit it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { scorePixels, type ScoreInput } from '../analysis/score'
import type { Score } from '../analysis/types'
import { scene, SCENE_MAPPING, SCENE_SCALE } from '../test/changeScene'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const area = { x0: 0, y0: 0, x1: 1, y1: 1 }
const input = (frameId: string, noiseFloor = 0.2): ScoreInput => ({ frameId, colorScale: SCENE_SCALE, mapping: SCENE_MAPPING, area, noiseFloor })

const round = (value: number) => Number(value.toFixed(3))
const plain = ({ frameId, change, contours }: Score) => ({
  frameId,
  step: change.step,
  medianChange: change.medianChange === undefined ? null : round(change.medianChange),
  shareAbove: change.shareAbove.map(round),
  validFraction: round(change.validFraction),
  contours: contours.length,
})

/** Each case plays a different part of the rules; the first two are the season test. */
const cases = {
  'january-normal': () => scorePixels(scene({ season: 0 }), scene({ season: 0 }), input('january-normal')),
  'july-season-only': () => scorePixels(scene({ season: 4 }), scene({ season: 4 }), input('july-season-only')),
  'july-planted-patch': () => scorePixels(scene({ season: 4, patch: 1.5 }), scene({ season: 4 }), input('july-planted-patch')),
  'july-cold-patch': () => scorePixels(scene({ season: 4, patch: -1.5 }), scene({ season: 4 }), input('july-cold-patch')),
  'july-against-winter': () => scorePixels(scene({ season: 4 }), scene({ season: 0 }), input('july-against-winter')),
  'land-in-the-east': () => scorePixels(scene({ season: 1.5, landFrom: 300 }), scene({ season: 0, landFrom: 300 }), input('land-in-the-east')),
  'mostly-land': () => scorePixels(scene({ season: 1.5, landFrom: 20 }), scene({ season: 0, landFrom: 20 }), input('mostly-land')),
  'anomaly-product': () => scorePixels(scene({ season: 0 }), null, input('anomaly-product', 0)),
}

const text = JSON.stringify(Object.fromEntries(Object.entries(cases).map(([id, run]) => [id, plain(run())])), null, 2) + '\n'

describe('change regression baseline', () => {
  it('scores the made-up scenes as the committed baseline says', async () => {
    await expect(text).toMatchFileSnapshot('__golden__/change.json')
  })

  it('follows the planted patch and not the season', () => {
    expect(plain(cases['july-season-only']()).step).toBe('normal')
    expect(plain(cases['july-planted-patch']()).step).toBe('much-above')
    expect(plain(cases['july-cold-patch']()).step).toBe('much-below')
  })

  it('gives the same Score every time', () => {
    for (const run of Object.values(cases)) expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('notices when the maths moves', () => {
    const moved = scorePixels(scene({ season: 4, patch: 1.5 }), scene({ season: 4 }), { ...input('july-planted-patch'), mapping: { ...SCENE_MAPPING, contourLevels: [{ value: 1.7 }, { value: 2 }] } })
    expect(JSON.stringify(plain(moved))).not.toBe(JSON.stringify(plain(cases['july-planted-patch']())))
  })

  it('has an entry for every data set in index.json that has a baseline', () => {
    const catalog = JSON.parse(readFileSync(`${dataDir}/index.json`, 'utf8')) as { id: string }[]
    const withBaseline = catalog.filter(({ id }) => 'baseline' in JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
    expect(withBaseline.map(({ id }) => id)).toEqual([]) // T111 adds synthetic-change; then record its Scores here and update this test.
  })
})

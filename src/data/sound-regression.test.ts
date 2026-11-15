// Sound regression baseline (docs/archive/PRE-HACKATHON-TICKETS.md, T88). For each data set in public/data/index.json this records what
// the app plays today: what the analysis reads from every frame, the steps Listen plays (category, pan, height, chord, slide,
// bell), the sound-map grid, and the notes. The result is compared with a committed file in src/data/__golden__/.
//
// If this test fails, a sound changed. A PR that changes a golden file must say why in its description, and the team leader
// approves it. To rewrite the golden files after a change you meant to make: `npx vitest run -u src/data/sound-regression.test.ts`
// (or `npm test -- -u`), then read the diff of src/data/__golden__/ before you commit it.
//
// It covers the three committed data sets only (BASELINED), not every catalog entry: a data set added to index.json (a real one on
// 13 Nov, or a gitignored rehearsal-* one in T91) would otherwise fail `npm run check-data` and get a new golden file written
// without anyone asking. Add an id to BASELINED on purpose, with its golden file, once its sound is agreed.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzePixels, gridFromPixels } from '../analysis/analyze'
import { decodePng } from '../analysis/png'
import { STEP_MS, sequenceSteps } from '../features/player/usePlayer'
import { catalogSchema, visualizationSchema } from './schema'
import type { Visualization } from './types'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const goldenDir = resolve(fileURLToPath(import.meta.url), '../__golden__')
const readJson = (path: string): unknown => JSON.parse(readFileSync(`${dataDir}/${path}`, 'utf8'))

const round = (value: number, places: number) => Number(value.toFixed(places))

/** Everything that decides what is played for one data set, as plain JSON. Rows of the grid are one line each so a diff is readable. */
function baselineFor(v: Visualization) {
  const { colorScale, mapping, mapArea } = v
  const pixelsOf = new Map(v.frames.map(frame => [frame.id, decodePng(readFileSync(`${dataDir}/${v.id}/${frame.image}`))]))

  const analysis = v.regions.map(region => v.frames.map(frame => analyzePixels(pixelsOf.get(frame.id)!, frame, region, colorScale, mapping)))

  return {
    notes: {
      categories: Object.fromEntries(mapping.categories.map(category => [category.id, category.note])),
      missingCue: mapping.missingCue.type,
    },
    regions: v.regions.map((region, r) => ({
      id: region.id,
      frames: analysis[r].map(result => ({
        frame: result.frameId,
        sampled: result.sampled,
        valid: result.valid,
        category: result.category,
        medianValue: result.medianValue === undefined ? null : round(result.medianValue, 2),
        shares: result.shares ? Object.fromEntries(Object.entries(result.shares).map(([id, share]) => [id, round(share, 3)])) : null,
      })),
      // The steps Listen plays for this region, at normal speed (the speed only moves atMs).
      steps: sequenceSteps(analysis[r], region, mapping, 0, v.frames.length - 1, STEP_MS.normal)
        .map(({ category, pan, elevation, pad, glide, bell }, k) => ({
          frame: v.frames[k].id, category, pan, elevation, pad: pad ?? null, glide: glide ?? false, bell: bell ?? false,
        })),
    })),
    grids: v.frames.map(frame => {
      const grid = gridFromPixels(pixelsOf.get(frame.id)!, frame, colorScale, mapping, mapArea)
      return {
        frame: frame.id,
        cols: grid.cols,
        rows: grid.rows,
        cells: Array.from({ length: grid.rows }, (_, row) => grid.cells.slice(row * grid.cols, (row + 1) * grid.cols).map(cell => cell.category).join(' ')),
      }
    }),
  }
}

const toText = (baseline: unknown) => JSON.stringify(baseline, null, 2) + '\n'

const catalog = catalogSchema.parse(readJson('index.json'))
const load = (id: string) => visualizationSchema.parse(readJson(`${id}/manifest.json`)) as Visualization

const BASELINED = ['fixture']

describe('sound regression baseline', () => {
  it('covers the committed data sets', () => {
    expect(catalog.map(entry => entry.id).slice(0, BASELINED.length)).toEqual(BASELINED)
  })

  it.each(BASELINED)('%s sounds the same as the committed baseline', async id => {
    await expect(toText(baselineFor(load(id)))).toMatchFileSnapshot(`__golden__/${id}.json`)
  })

  it('notices when one legend stop of the fixture changes', () => {
    const fixture = load('fixture')
    // Git may check the golden file out with CRLF (core.autocrlf on Windows); toMatchFileSnapshot ignores that, so this does too.
    const golden = readFileSync(`${goldenDir}/fixture.json`, 'utf8').replace(/\r\n/g, '\n')
    expect(toText(baselineFor(fixture))).toBe(golden)

    // The yellow middle stop now means 25 instead of 15, so every read value moves.
    const changed: Visualization = {
      ...fixture,
      colorScale: { ...fixture.colorScale, stops: fixture.colorScale.stops.map((stop, i) => (i === 1 ? { ...stop, value: 25 } : stop)) },
    }
    expect(toText(baselineFor(changed))).not.toBe(golden)
  })
})

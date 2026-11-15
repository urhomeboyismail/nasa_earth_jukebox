// Event-sentence baseline (docs/PLAN.md §6.3, ticket SN10). Reads the frames of the fixture and `mur-sst-mauritius` with the real feature extractor (SN01) and
// records, as text, the events and sentences between each consecutive pair, the markers of the first frame and the sound recipe for each preset in
// __golden__/events.json, so any change to the words shows in a diff.
//
// If this fails, the words changed. A PR that rewrites events.json must say why. To rewrite it after a change you meant to make:
// `npx vitest run -u src/describe/events.golden.test.ts`, then read the diff before you commit it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../analysis/features/extract'
import type { ExtractInput, FrameFeatures } from '../analysis/features/types'
import { decodePng } from '../analysis/png'
import type { Visualization } from '../data'
import { visualizationSchema } from '../data/schema'
import { PRESETS } from '../sonify/presets'
import { describeEvent, eventsBetween } from './events'
import { hotspotMarkers } from './markers'
import { soundRecipe } from './recipe'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const DATA_SETS = ['fixture', 'mur-sst-mauritius']
const FRAMES = 12
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }

function baselineOf(v: Visualization, frame: Visualization['frames'][number], read: (image: string) => ReturnType<typeof decodePng>): ExtractInput['baseline'] {
  const { baseline } = v
  if (!baseline) return undefined
  if (baseline.kind === 'anomaly-product') return { pixels: null, noiseFloor: 0 }
  const normal = baseline.kind === 'climatology' ? frame.baselineImage : v.frames.find(f => f.id === baseline.frameId)?.image
  if (!normal) throw new Error(`${v.id}: no normal picture for ${frame.id}.`)
  return { pixels: read(normal), noiseFloor: baseline.noiseFloor }
}

function load(id: string) {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const read = (image: string) => decodePng(readFileSync(`${dataDir}/${id}/${image}`))
  let previous: FrameFeatures | undefined
  const frames = [...v.frames].sort((a, b) => a.date.localeCompare(b.date)).slice(0, FRAMES).map(frame => {
    previous = extractFeatures(read(frame.image), {
      frameId: `${id}/${frame.id}`, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE, baseline: baselineOf(v, frame, read),
    }, previous)
    return previous
  })
  return { v, frames }
}

const loaded = Object.fromEntries(DATA_SETS.map(id => [id, load(id)]))

function sentences(id: string): string[][] {
  const { v, frames } = loaded[id]
  return frames.slice(1).map((next, i) => eventsBetween(frames[i], next).map(event => describeEvent(event, v)))
}

describe('event words baseline', () => {
  it('writes the same sentences, markers and recipe as the committed baseline', async () => {
    const out = {
      events: Object.fromEntries(DATA_SETS.map(id => [id, sentences(id)])),
      markers: Object.fromEntries(DATA_SETS.map(id => [id, hotspotMarkers(loaded[id].frames[0], loaded[id].v).map(m => m.label)])),
      recipe: Object.fromEntries(Object.entries(PRESETS).map(([id, preset]) => [id, soundRecipe(preset).map(row => `${row.name} (${row.detailLevel}): ${row.drivenBy} ${row.sounds}`)])),
    }
    await expect(JSON.stringify(out, null, 2) + '\n').toMatchFileSnapshot('__golden__/events.json')
  })

  it('gives the same sentences when run again', () => {
    for (const id of DATA_SETS) expect(sentences(id)).toEqual(sentences(id))
  })

  it('finds at least one event in the storm, so the baseline is not empty', () => {
    expect(sentences('mur-sst-mauritius').flat().length).toBeGreaterThan(0)
  })
})

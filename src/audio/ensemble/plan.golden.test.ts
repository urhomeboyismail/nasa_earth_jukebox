// Plan regression baseline (docs/PLAN.md §6.3, ticket SN04). Reads the first twelve frames of the fixture and the Mauritius data set with the real feature
// extractor (SN01), turns them into music (SN03), plans them at `full` and at `calm`, and records the plans in __golden__/plan.json, so any change to what
// sounds shows in a diff. The plan is the part of the ensemble that decides; the Tone calls that follow are covered by voices.test.ts.
//
// If this fails, the plan changed. A PR that rewrites plan.json must say why, and the team leader approves it. To rewrite it after a change you meant
// to make: `npx vitest run -u src/audio/ensemble/plan.golden.test.ts`, then read the diff before you commit it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../../analysis/features/extract'
import type { ExtractInput, FrameFeatures } from '../../analysis/features/types'
import { decodePng } from '../../analysis/png'
import type { Visualization } from '../../data'
import { visualizationSchema } from '../../data/schema'
import type { DetailLevel } from '../../data/sonification'
import { toMusicFrame } from '../../sonify/music'
import { presetFor } from '../../sonify/presets'
import type { MusicFrame } from '../../sonify/types'
import { planFrame, type VoiceAction } from './plan'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data')
const DATA_SETS = ['fixture', 'mur-sst-mauritius']
const DETAILS: DetailLevel[] = ['full', 'calm']
const FRAMES = 12
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }
const NO_MIX = { solo: null, muted: new Set<never>(), brightness: presetFor('major').brightness }

const round = (value: number) => Number(value.toFixed(4))

/** One action as a short list: only the voices that sound are written out in full. */
const plain = (a: VoiceAction) =>
  a.sounding
    ? [a.voice, a.slot, a.midis, round(a.level), round(a.pan), round(a.elevation), a.glide, round(a.brightness), a.id ?? null, a.perBeat ?? null, a.accent ?? null, a.pulseBpm ?? null]
    : [a.voice, a.slot, 'silent']

function baselineOf(v: Visualization, frame: Visualization['frames'][number], read: (image: string) => ReturnType<typeof decodePng>): ExtractInput['baseline'] {
  const { baseline } = v
  if (!baseline) return undefined
  if (baseline.kind === 'anomaly-product') return { pixels: null, noiseFloor: 0 }
  const normal = baseline.kind === 'climatology' ? frame.baselineImage : v.frames.find(f => f.id === baseline.frameId)?.image
  if (!normal) throw new Error(`${v.id}: no normal picture for ${frame.id}.`)
  return { pixels: read(normal), noiseFloor: baseline.noiseFloor }
}

function musicOf(id: string): MusicFrame[] {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const read = (image: string) => decodePng(readFileSync(`${dataDir}/${id}/${image}`))
  let previous: FrameFeatures | undefined
  let prev: MusicFrame | undefined
  return [...v.frames].sort((a, b) => a.date.localeCompare(b.date)).slice(0, FRAMES).map(frame => {
    previous = extractFeatures(read(frame.image), {
      frameId: `${id}/${frame.id}`, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE, baseline: baselineOf(v, frame, read),
    }, previous)
    prev = toMusicFrame(previous, presetFor('major'), prev)
    return prev
  })
}

const music = Object.fromEntries(DATA_SETS.map(id => [id, musicOf(id)]))
const plans = (frames: MusicFrame[], detail: DetailLevel) => frames.map(f => ({ frameId: f.frameId, plan: planFrame(f, detail, NO_MIX).map(plain) }))

describe('plan regression baseline', () => {
  it('plans the first twelve frames of the fixture and the Mauritius data set, at full and at calm, as the committed baseline says', async () => {
    const text = JSON.stringify(
      Object.fromEntries(Object.entries(music).map(([id, frames]) => [id, Object.fromEntries(DETAILS.map(d => [d, plans(frames, d)]))])),
      null, 2,
    ) + '\n'
    await expect(text).toMatchFileSnapshot('__golden__/plan.json')
  })

  it('plans the same thing when run again', () => {
    for (const id of DATA_SETS) for (const d of DETAILS) expect(plans(music[id], d)).toEqual(plans(music[id], d))
  })

  it('never lets calm sound the bass, hot spots, rhythm or motion, on any frame', () => {
    for (const id of DATA_SETS) {
      for (const f of music[id]) {
        const sounding = planFrame(f, 'calm', NO_MIX).filter(a => a.sounding).map(a => a.voice)
        for (const voice of ['bass', 'hotspots', 'rhythm', 'motion']) expect(sounding).not.toContain(voice)
      }
    }
  })

  it('plans a dropout frame as the time pulse alone', () => {
    const dropouts = DATA_SETS.flatMap(id => music[id].filter(f => f.dropout))
    expect(dropouts.length).toBeGreaterThan(0)
    for (const f of dropouts) expect(planFrame(f, 'full', NO_MIX).filter(a => a.sounding).map(a => a.voice)).toEqual(['time'])
  })
})

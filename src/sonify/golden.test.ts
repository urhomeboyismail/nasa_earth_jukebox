// Music regression baseline (docs/PLAN.md §6.3, ticket SN03). Reads the first twelve frames of the fixture and the Mauritius data set with the real
// feature extractor (SN01), turns each into a `MusicFrame` with the `major` and the `pentatonic` presets, and records what it found in
// __golden__/music.json, so any change to the rules shows in a diff.
//
// If this fails, the rules changed. A PR that rewrites music.json must say why, and the team leader approves it. To rewrite it after a change
// you meant to make: `npx vitest run -u src/sonify/golden.test.ts`, then read the diff before you commit it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { extractFeatures } from '../analysis/features/extract'
import type { ExtractInput, FrameFeatures } from '../analysis/features/types'
import { decodePng } from '../analysis/png'
import type { Visualization } from '../data'
import { visualizationSchema } from '../data/schema'
import { VOICE_IDS, type PresetId } from '../data/sonification'
import { isSpaced, toMusicFrame } from './music'
import { presetFor } from './presets'
import type { MusicFrame } from './types'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../public/data')
const DATA_SETS = ['fixture', 'mur-sst-mauritius']
const PRESETS_USED: PresetId[] = ['major', 'pentatonic']
const FRAMES = 12
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }

const round = (value: number) => Number(value.toFixed(4))

function plain(f: MusicFrame) {
  return {
    frameId: f.frameId,
    melody: f.melody && [f.melody.midi, f.melody.glide, round(f.melody.level)],
    harmony: f.harmony && [f.harmony.midis, round(f.harmony.level)],
    bass: f.bass && [f.bass.midi, round(f.bass.level)],
    hotspots: f.hotspots.map(h => [h.id, h.band, h.midi, round(h.pan), round(h.elevation), round(h.level)]),
    rhythm: f.rhythm && [f.rhythm.midis, f.rhythm.perBeat, round(f.rhythm.pan)],
    motion: f.motion && [round(f.motion.openness), round(f.motion.sweep), round(f.motion.level)],
    time: [f.time.accent, f.time.pulseBpm],
    missing: f.missing,
    dropout: f.dropout,
    caption: f.caption,
    summary: f.summary,
  }
}

function baselineOf(v: Visualization, frame: Visualization['frames'][number], read: (image: string) => ReturnType<typeof decodePng>): ExtractInput['baseline'] {
  const { baseline } = v
  if (!baseline) return undefined
  if (baseline.kind === 'anomaly-product') return { pixels: null, noiseFloor: 0 }
  const normal = baseline.kind === 'climatology' ? frame.baselineImage : v.frames.find(f => f.id === baseline.frameId)?.image
  if (!normal) throw new Error(`${v.id}: no normal picture for ${frame.id}.`)
  return { pixels: read(normal), noiseFloor: baseline.noiseFloor }
}

/** The extractor's features for the first frames of a data set, in date order with each frame's features carried to the next. */
function featuresOf(id: string): FrameFeatures[] {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const read = (image: string) => decodePng(readFileSync(`${dataDir}/${id}/${image}`))
  let previous: FrameFeatures | undefined
  return [...v.frames].sort((a, b) => a.date.localeCompare(b.date)).slice(0, FRAMES).map(frame => {
    previous = extractFeatures(read(frame.image), {
      frameId: `${id}/${frame.id}`, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE, baseline: baselineOf(v, frame, read),
    }, previous)
    return previous
  })
}

const features = Object.fromEntries(DATA_SETS.map(id => [id, featuresOf(id)]))

function music(id: string, preset: PresetId): MusicFrame[] {
  let prev: MusicFrame | undefined
  return features[id].map(f => (prev = toMusicFrame(f, presetFor(preset), prev)))
}

const results = Object.fromEntries(DATA_SETS.map(id => [id, Object.fromEntries(PRESETS_USED.map(p => [p, music(id, p)]))]))

describe('music regression baseline', () => {
  it('turns the first twelve frames of the fixture and the Mauritius data set into the committed music', async () => {
    const text = JSON.stringify(
      Object.fromEntries(Object.entries(results).map(([id, byPreset]) => [id, Object.fromEntries(Object.entries(byPreset).map(([p, frames]) => [p, frames.map(plain)]))])),
      null, 2,
    ) + '\n'
    await expect(text).toMatchFileSnapshot('__golden__/music.json')
  })

  it('gives the same music when run again', () => {
    for (const id of DATA_SETS) for (const p of PRESETS_USED) expect(music(id, p).map(plain)).toEqual(results[id][p].map(plain))
  })

  it('has a dropout exactly where the extractor found no median, and plays only the time pulse there', () => {
    for (const id of DATA_SETS) {
      results[id].major.forEach((m, i) => {
        const unreadable = features[id][i].stats.position === null
        expect(m.dropout, `${id} frame ${i}`).toBe(unreadable)
        if (unreadable) {
          expect(m.missing).toEqual(['melody', 'harmony', 'bass'])
          expect([m.melody, m.harmony, m.bass, m.rhythm, m.motion]).toEqual([null, null, null, null, null])
          expect(m.hotspots).toEqual([])
          expect(m.time.level).toBeGreaterThan(0)
        } else {
          expect(m.missing).toEqual([])
          expect(m.melody).not.toBeNull()
        }
      })
    }
    // The golden data does contain both kinds of frame.
    expect(results.fixture.major.some(m => m.dropout)).toBe(true)
  })

  it('has a caption for every voice on every frame, and the same notes in the key of the preset', () => {
    for (const id of DATA_SETS) {
      for (const m of results[id].major) expect(Object.keys(m.caption)).toEqual([...VOICE_IDS])
      for (const m of results[id].pentatonic) {
        const classes = new Set([9, 0, 2, 4, 7])
        for (const note of [m.melody?.midi, m.bass?.midi, ...(m.harmony?.midis ?? []), ...m.hotspots.map(h => h.midi), ...(m.rhythm?.midis ?? [])]) {
          if (note !== undefined) expect(classes.has(note % 12), `${id} ${m.frameId} ${note}`).toBe(true)
        }
      }
    }
  })

  it('plays the arpeggio on the tones of the chord under it, and never a chord with two notes closer than a minor third (SN18)', () => {
    for (const id of DATA_SETS) {
      for (const p of PRESETS_USED) {
        for (const m of results[id][p]) {
          if (!m.harmony) continue
          const chord = new Set(m.harmony.midis.map(note => note % 12))
          for (const note of m.rhythm?.midis ?? []) expect(chord.has(note % 12), `${id} ${p} ${m.frameId} ${note}`).toBe(true)
          expect(isSpaced(m.harmony.midis), `${id} ${p} ${m.frameId}`).toBe(true)
        }
      }
    }
  })

})

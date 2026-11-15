// Feature regression baseline (docs/PLAN.md §6.3, SN01). Runs the extractor over every frame of the fixture and the Mauritius data set,
// in date order with each frame's features carried to the next, and records what it found in __golden__/features.json,
// so any change to the maths shows in a diff.
//
// If this fails, the maths changed. A PR that rewrites features.json must say why, and the team leader approves it. To rewrite it after
// a change you meant to make: `npx vitest run -u src/analysis/features/golden.test.ts`, then read the diff before you commit it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { visualizationSchema } from '../../data/schema'
import type { Visualization } from '../../data'
import { decodePng } from '../png'
import { extractFeatures } from './extract'
import { FEATURE_COLS, FEATURE_ROWS, type ExtractInput, type FrameFeatures } from './types'

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data')
const DATA_SETS = ['fixture', 'mur-sst-mauritius']
const WHOLE = { x0: 0, y0: 0, x1: 1, y1: 1 }

const round = (value: number) => Number(value.toFixed(4))
const orNull = (value: number | null) => (value === null ? null : round(value))

/** FNV-1a over the bytes of the grid's values: any change to a single cell shows. */
function fnv1a(values: Float32Array): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength)
  let hash = 0x811c9dc5
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
  return hash.toString(16).padStart(8, '0')
}

const place = (p: { value: number; x: number; y: number } | null) => (p ? { value: round(p.value), x: round(p.x), y: round(p.y) } : null)

function plain(f: FrameFeatures) {
  return {
    frameId: f.frameId,
    date: f.date,
    stats: { validShare: round(f.stats.validShare), median: orNull(f.stats.median), position: orNull(f.stats.position), iqr: orNull(f.stats.iqr), min: place(f.stats.min), max: place(f.stats.max) },
    histogram: f.histogram.map(round),
    hotspots: f.hotspots.map(h => ({ id: h.id, band: h.band, cells: h.cells, centroid: [round(h.centroid.x), round(h.centroid.y)], peak: round(h.peak), peakPosition: round(h.peakPosition) })),
    edges: { density: round(f.edges.density), strongest: f.edges.strongest ? { level: round(f.edges.strongest.level), closed: f.edges.strongest.closed, points: f.edges.strongest.points.length } : null },
    motion: f.motion && { dx: round(f.motion.dx), dy: round(f.motion.dy), speed: round(f.motion.speed), direction: orNull(f.motion.direction), changedShare: round(f.motion.changedShare) },
    change: f.change && { step: f.change.step, shift: orNull(f.change.shift), medianChange: f.change.medianChange === undefined ? null : round(f.change.medianChange) },
    reference: orNull(f.reference),
    confidence: round(f.confidence),
    grid: fnv1a(f.grid.values),
  }
}

/** The baseline a frame is measured against, as pixels (null: an anomaly product), read from the data set's own files as Listen and Compare read them. */
function baselineOf(v: Visualization, frame: Visualization['frames'][number], read: (image: string) => ReturnType<typeof decodePng>): ExtractInput['baseline'] {
  const { baseline } = v
  if (!baseline) return undefined
  if (baseline.kind === 'anomaly-product') return { pixels: null, noiseFloor: 0 }
  const normal = baseline.kind === 'climatology' ? frame.baselineImage : v.frames.find(f => f.id === baseline.frameId)?.image
  if (!normal) throw new Error(`${v.id}: no normal picture for ${frame.id}.`)
  return { pixels: read(normal), noiseFloor: baseline.noiseFloor }
}

function runDataSet(id: string) {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const read = (image: string) => decodePng(readFileSync(`${dataDir}/${id}/${image}`))
  let previous: FrameFeatures | undefined
  return [...v.frames].sort((a, b) => a.date.localeCompare(b.date)).map(frame => {
    const features = extractFeatures(read(frame.image), {
      frameId: `${id}/${frame.id}`, date: frame.date, mode: 'data', colorScale: v.colorScale, mapping: v.mapping, area: v.mapArea ?? WHOLE, baseline: baselineOf(v, frame, read),
    }, previous)
    previous = features
    return features
  })
}

const results = Object.fromEntries(DATA_SETS.map(id => [id, runDataSet(id)]))

// Reading real pictures takes a few seconds a frame.
describe('feature regression baseline', { timeout: 60_000 }, () => {
  it('reads every frame of the fixture and the Mauritius data set as the committed baseline says', async () => {
    const text = JSON.stringify(Object.fromEntries(Object.entries(results).map(([id, frames]) => [id, frames.map(plain)])), null, 2) + '\n'
    await expect(text).toMatchFileSnapshot('__golden__/features.json')
  })

  it('reads every frame on a 64 × 32 grid, with the readable share and the histogram in step', () => {
    for (const frames of Object.values(results)) {
      for (const f of frames) {
        expect([f.grid.cols, f.grid.rows]).toEqual([FEATURE_COLS, FEATURE_ROWS])
        const total = f.histogram.reduce((a, b) => a + b, 0)
        expect(f.stats.validShare > 0 ? Math.abs(total - 1) < 1e-9 : total === 0).toBe(true)
        expect(f.confidence).toBeGreaterThanOrEqual(0)
        expect(f.confidence).toBeLessThanOrEqual(1)
        if (f === frames[0]) expect(f.motion).toBeNull()
      }
    }
  })

  it('gives the same features when run again, grid bytes included', () => {
    const again = runDataSet('mur-sst-mauritius')
    expect(again.map(plain)).toEqual(results['mur-sst-mauritius'].map(plain))
    expect(again.map(f => Array.from(new Uint8Array(f.grid.values.buffer)))).toEqual(results['mur-sst-mauritius'].map(f => Array.from(new Uint8Array(f.grid.values.buffer))))
  })

  it('measures the change from normal where the data set has a baseline, and not where it has none', () => {
    expect(results['mur-sst-mauritius'].every(f => f.change !== null)).toBe(true)
    expect(results['fixture'].every(f => f.change === null)).toBe(true)
  })

  it('notices when the maths moves', () => {
    const moved = JSON.stringify(results['fixture'].map(f => plain({ ...f, stats: { ...f.stats, median: (f.stats.median ?? 0) + 1 } })))
    expect(moved).not.toBe(JSON.stringify(results['fixture'].map(plain)))
  })
})

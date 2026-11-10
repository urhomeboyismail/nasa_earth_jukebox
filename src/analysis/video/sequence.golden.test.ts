// Sequence regression baseline (docs/PLAN.md §6.3, ticket SN06). Runs the checked-frames path over the fixture and `synthetic-storm` with the real feature
// extractor behind the seam (the worker itself is SN01's), steps through every frame, and records what each `LiveFrame` carries other than the features
// (their own golden file is SN01's): the date, the video fields, the confidence, and the video frame the frame's place in the sequence would be at 10 fps.
//
// If this fails, the sequence path changed. To rewrite it after a change you meant to make:
// `npx vitest run -u src/analysis/video/sequence.golden.test.ts`, then read the diff before you commit it.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { visualizationSchema } from '../../data/schema'
import type { Pixels } from '../analyze'
import { extractFeatures } from '../features/extract'
import type { FrameFeatures } from '../features/types'
import { decodePng } from '../png'
import { SEQUENCE_STEP_MS, videoIndexFor } from './clock'
import { FrameSequenceSource } from './frameSequence'
import type { Extract, LiveFrame } from './types'

vi.mock('../features', async importOriginal => ({ ...(await importOriginal<typeof import('../features')>()), resetStream: vi.fn() }))

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data')
const DATA_SETS = ['fixture', 'synthetic-storm']
const round = (value: number) => Number(value.toFixed(4))

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

/** Steps a data set's checked frames and returns what the source reported, with the features it read. */
async function run(id: string): Promise<LiveFrame[]> {
  const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
  const read = (image: string): Pixels => decodePng(readFileSync(`${dataDir}/${id}/${image}`))
  const pictures = new Map<unknown, Pixels>()
  const streams = new Map<string, FrameFeatures>()
  const extract: Extract = async (stream, bitmap, input) => {
    const features = extractFeatures(pictures.get(bitmap)!, input, streams.get(stream))
    streams.set(stream, features)
    return features
  }
  const frames: LiveFrame[] = []
  const source = new FrameSequenceSource({
    visualization: v,
    extract,
    loadPixels: async url => read(url),
    loadBitmap: async url => {
      const bitmap = { width: 800, height: 400, close: vi.fn() }
      pictures.set(bitmap, read(url))
      return bitmap as unknown as ImageBitmap
    },
    onFrame: frame => frames.push(frame),
    onStatus: () => {},
  })
  source.start()
  await vi.advanceTimersByTimeAsync(SEQUENCE_STEP_MS.normal * (v.frames.length + 1))
  source.dispose()
  return frames
}

const plain = (frame: LiveFrame, index: number) => ({
  date: frame.date,
  videoIndex: frame.videoIndex,
  mediaTime: frame.mediaTime,
  confidence: round(frame.confidence),
  // The video frame this frame would be if the sequence were a 10 fps video: its own place in it.
  videoIndexAt10Fps: videoIndexFor(index / 10, 10),
})

describe('sequence regression baseline', () => {
  it('steps the fixture and the synthetic storm as the committed baseline says', async () => {
    const result = Object.fromEntries(await Promise.all(DATA_SETS.map(async id => [id, (await run(id)).map(plain)] as const)))
    await expect(JSON.stringify(result, null, 2) + '\n').toMatchFileSnapshot('__golden__/sequence.json')
  })

  it('reads every checked frame once, in date order', async () => {
    for (const id of DATA_SETS) {
      const frames = await run(id)
      const v = visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/${id}/manifest.json`, 'utf8')))
      expect(frames.map(f => f.date)).toEqual(v.frames.map(f => f.date).sort())
      expect(frames.every(f => f.videoIndex === null && f.mediaTime === null)).toBe(true)
    }
  })

  it('reads checked frames with full confidence where the colours are on the legend, and none where nothing can be read', async () => {
    const fixtureFrames = await run('fixture')
    expect(fixtureFrames.slice(0, 3).every(f => f.confidence === 1)).toBe(true)
    // The fourth fixture frame is all missing data.
    expect(fixtureFrames[3].confidence).toBe(0)
    const storm = await run('synthetic-storm')
    expect(storm.slice(0, 9).every(f => f.confidence === 1)).toBe(true)
    expect(storm[9].confidence).toBe(0)
  })

  it('numbers the frames by their place, which is what a 10 fps video would call them', async () => {
    const frames = await run('synthetic-storm')
    expect(frames.map((_, i) => plain(frames[i], i).videoIndexAt10Fps)).toEqual(frames.map((_, i) => i))
  })
})

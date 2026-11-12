// Symphony regression baseline (docs/PLAN.md §6.3, ticket SN07). The fixture's first four frames are read with the real feature extractor (SN01), handed to
// `useSymphony` the way the live source would, and the hook plays them on a fake ensemble. The baseline records what the ensemble was asked to play for each
// frame (the MusicFrame, SN03's own golden file covers it alone) and the caption lines the panel would draw, so a change anywhere between the reading and the
// ensemble shows up here.
//
// If this fails, the path from frame to sound changed. To rewrite it after a change you meant to make:
// `npx vitest run -u src/features/player/symphony.golden.test.tsx`, then read the diff before you commit it.

import { act, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { baseInput } from '../../analysis/video/input'
import { extractFeatures } from '../../analysis/features/extract'
import type { FrameFeatures } from '../../analysis/features/types'
import type { Pixels } from '../../analysis/analyze'
import { decodePng } from '../../analysis/png'
import { visualizationSchema } from '../../data/schema'
import { createFakeEnsemble, createFakeSource, withV3, type FakeEnsemble, type FakeSource } from './symphonyTestSupport'
import { useSymphony } from './symphony'

const fakes = vi.hoisted(() => ({ ensemble: null as FakeEnsemble | null, source: null as FakeSource | null }))
vi.mock('../../audio/ensemble/useEnsemble', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useEnsemble: () => {
      const e = fakes.ensemble!
      return { ensemble: e.ensemble, status: useSyncExternalStore(e.subscribe, () => e.status), start: () => e.ensemble.start() }
    },
  }
})
vi.mock('../../analysis/video/useLiveSource', () => ({
  useLiveSource: (options: Parameters<FakeSource['useLiveSource']>[0]) => fakes.source!.useLiveSource(options),
}))

const dataDir = resolve(fileURLToPath(import.meta.url), '../../../../public/data/fixture')
const round = (value: number) => Number(value.toFixed(4))
const rounded = (_key: string, value: unknown) => (typeof value === 'number' ? round(value) : value)

beforeEach(() => {
  fakes.ensemble = createFakeEnsemble()
  fakes.source = createFakeSource()
})

describe('Symphony regression baseline', () => {
  it('plays the first four fixture frames as the committed baseline says', async () => {
    const v = withV3(visualizationSchema.parse(JSON.parse(readFileSync(`${dataDir}/manifest.json`, 'utf8'))))
    const e = fakes.ensemble!
    const s = fakes.source!
    const { result } = renderHook(() => useSymphony(v, null))

    await act(async () => { await result.current.toggle() })
    expect(e.ensemble.start).toHaveBeenCalledTimes(1)

    const frames = [...v.frames].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4)
    let previous: FrameFeatures | undefined
    const record: { date: string; at: number; music: unknown; captions: string[]; summary: string }[] = []
    for (const frame of frames) {
      const pixels: Pixels = decodePng(readFileSync(`${dataDir}/${frame.image}`))
      const features = extractFeatures(pixels, { ...baseInput(v, frame.id, frame.date, 1), baseline: undefined }, previous)
      previous = features
      await act(async () => {
        s.options!.onFrame({ features, date: frame.date, videoIndex: null, mediaTime: null, confidence: features.confidence })
      })
      const [music, at] = e.ensemble.apply.mock.calls[e.ensemble.apply.mock.calls.length - 1]
      record.push({
        date: frame.date,
        at,
        music: { ...music, state: undefined },
        captions: result.current.voices.filter(voice => music.caption[voice] !== '').map(voice => music.caption[voice]),
        summary: music.summary,
      })
    }
    expect(e.ensemble.apply).toHaveBeenCalledTimes(4)
    await expect(JSON.stringify(record, rounded, 2) + '\n').toMatchFileSnapshot('__golden__/symphony.json')
  })
})

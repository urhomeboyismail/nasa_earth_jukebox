// Render regression baseline (docs/PLAN.md §6.3, ticket SN12). Renders the fixture and `synthetic-storm` through the whole pipeline with the test renderer
// (a sine per frame, so no Tone) and records the caption text, the sidecar JSON and the SHA-256 of the WAV in src/sonify/__golden__/render.json.
//
// If this fails, the features, the music, the schedule, the captions or the encoding changed. A PR that rewrites render.json must say why. To rewrite it
// after a change you meant to make: `npx vitest run -u src/features/playlist/golden.test.ts`, then read the diff before you commit it.

import { describe, expect, it } from 'vitest'
import { renderSequence } from './renderSequence'
import { depsFor, manifestOf, sha256Hex } from './testKit'

const DATA_SETS = ['fixture', 'synthetic-storm']

describe('render regression baseline', () => {
  it('renders the fixture and the storm to the committed captions, sidecar and WAV hash', async () => {
    const golden: Record<string, { wavSha256: string; vtt: string; sidecar: unknown }> = {}
    for (const id of DATA_SETS) {
      const out = await renderSequence(manifestOf(id), depsFor(id))
      golden[id] = {
        wavSha256: await sha256Hex(out.wav),
        vtt: out.vtt,
        sidecar: JSON.parse(out.sidecar),
      }
    }
    await expect(`${JSON.stringify(golden, null, 2)}\n`).toMatchFileSnapshot('../../sonify/__golden__/render.json')
  })
})

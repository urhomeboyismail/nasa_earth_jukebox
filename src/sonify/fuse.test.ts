import { describe, expect, it } from 'vitest'
import { VOICE_IDS } from '../data/sonification'
import { FUSION_ROLES, fuseFrames } from './fuse'
import { toMusicFrame } from './music'
import { presetFor } from './presets'
import { features, spot } from './testFeatures'
import { MAX_HOTSPOT_NOTES } from './ranges'

const preset = presetFor('major')
const a = toMusicFrame(features({ position: 0.3, hotspots: [spot('a1', 'high', 0.2, 0.5), spot('a2', 'high', 0.8, 0.5)] }), preset, null)
const b = toMusicFrame(features({ position: 0.8, hotspots: [spot('b1', 'low', 0.5, 0.5)] }), preset, null)

describe('fuseFrames: two data sets as one piece', () => {
  it('gives every voice to exactly one deck, or to both for the hot spots', () => {
    expect(Object.keys(FUSION_ROLES).sort()).toEqual([...VOICE_IDS].sort())
    const fused = fuseFrames(a, b)
    expect(fused.melody?.midi).toBe(a.melody?.midi)
    expect(fused.harmony?.midis).toEqual(a.harmony?.midis)
    expect(fused.bass?.midi).toBe(b.bass?.midi)
    expect(fused.rhythm).toEqual(b.rhythm)
    expect(fused.state).toEqual(a.state)
  })

  it('puts A\'s hot spots on the left and B\'s on the right, taken in turn and capped', () => {
    const fused = fuseFrames(a, b)
    expect(fused.hotspots.length).toBeLessThanOrEqual(MAX_HOTSPOT_NOTES)
    for (const s of fused.hotspots) {
      if (s.id.startsWith('B:')) expect(s.pan).toBeGreaterThanOrEqual(0)
      else expect(s.pan).toBeLessThanOrEqual(0)
    }
    expect(fused.hotspots.map(s => s.id.startsWith('B:'))).toEqual([false, true, false].slice(0, fused.hotspots.length))
  })

  it('names the deck in every caption and in the summary', () => {
    const fused = fuseFrames(a, b)
    for (const voice of VOICE_IDS) if (fused.caption[voice]) expect(fused.caption[voice]).toMatch(/^(A|B): /)
    expect(fused.summary).toBe(`A: ${a.summary} B: ${b.summary}`)
  })

  it('crossfades: 0 is only A, 1 only B, the middle both at full level', () => {
    const onlyA = fuseFrames(a, b, 0)
    expect(onlyA.melody?.level).toBe(a.melody?.level)
    expect(onlyA.bass?.level).toBe(0)
    const onlyB = fuseFrames(a, b, 1)
    expect(onlyB.melody?.level).toBe(0)
    expect(onlyB.bass?.level).toBe(b.bass?.level)
    const both = fuseFrames(a, b, 0.5)
    expect(both.melody?.level).toBe(a.melody?.level)
    expect(both.bass?.level).toBe(b.bass?.level)
  })

  it('plays A alone, with B\'s voices marked missing, until B has been read', () => {
    const fused = fuseFrames(a, null)
    expect(fused.bass).toBeNull()
    expect(fused.rhythm).toBeNull()
    expect(fused.missing).toEqual(expect.arrayContaining(['bass', 'rhythm']))
    expect(fused.summary).toBe(`A: ${a.summary}`)
  })
})

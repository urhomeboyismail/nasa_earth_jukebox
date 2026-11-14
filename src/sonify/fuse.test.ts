import { describe, expect, it } from 'vitest'
import { VOICE_IDS } from '../data/sonification'
import { alignedExtremes, CHORD_DB, FUSION_ROLES, fuseFrames, momentChord, momentSentence, placeWord, sampleOf, type DeckSample } from './fuse'
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

const sample = (values: (number | null)[], at: DeckSample['at'] = null): DeckSample[] => values.map((value, i) => ({ date: `2024-0${i + 1}-15`, value, at }))

describe('alignedExtremes: moments when both decks peak together (UI09)', () => {
  const lowHighMid = [0, 0.5, 1, 0.5]

  it('finds the dates where both decks are in the top or bottom tenth of their own range', () => {
    const found = alignedExtremes(sample([0, 0.5, 1, 0.5]), sample([0.2, 0.5, 0.8, 0.5]))
    expect(found.map(m => [m.dateIndex, m.kind, m.aHigh, m.bHigh])).toEqual([[0, 'together', false, false], [2, 'together', true, true]])
    expect(found[0].date).toBe('2024-01-15')
  })

  it('calls it opposed when one deck is high and the other low', () => {
    const found = alignedExtremes(sample(lowHighMid), sample([1, 0.5, 0, 0.5]))
    expect(found.map(m => [m.dateIndex, m.kind])).toEqual([[0, 'opposed'], [2, 'opposed']])
  })

  it('is empty when nothing is extreme, when a deck is flat, or when a reading is missing', () => {
    expect(alignedExtremes(sample([0.4, 0.5, 0.45, 0.5]), sample([0.5, 0.5, 0.5, 0.5]))).toEqual([])
    expect(alignedExtremes(sample([0, 0.5, 1, 0.5]), sample([null, null, null, null]))).toEqual([])
    expect(alignedExtremes([], [])).toEqual([])
  })

  it('needs the extremes to be in the same place when both decks have one', () => {
    const near = alignedExtremes(sample(lowHighMid, { x: 0.8, y: 0.2 }), sample(lowHighMid, { x: 0.85, y: 0.25 }))
    expect(near.map(m => m.place)).toEqual(['north-east', 'north-east'])
    expect(alignedExtremes(sample(lowHighMid, { x: 0.8, y: 0.2 }), sample(lowHighMid, { x: 0.1, y: 0.9 }))).toEqual([])
  })

  it('gives the same list for the same input', () => {
    const x = sample([0, 0.3, 1, 0.5, 0.9])
    const y = sample([0.1, 0.9, 1, 0.2, 0.95])
    expect(alignedExtremes(x, y)).toEqual(alignedExtremes(x, y))
  })

  it('reads a frame as a sample: the median position and the strongest hot spot', () => {
    const f = sampleOf(features({ date: '2024-02-15', position: 0.9, hotspots: [spot('h1', 'high', 0.7, 0.3)] }))
    expect(f).toEqual({ date: '2024-02-15', value: 0.9, at: { x: 0.7, y: 0.3 } })
    expect(sampleOf(features({ position: null })).value).toBeNull()
  })

  it('names the ninth of the map', () => {
    expect(placeWord({ x: 0, y: 0 })).toBe('north-west')
    expect(placeWord({ x: 0.5, y: 0.5 })).toBe('centre')
    expect(placeWord({ x: 1, y: 1 })).toBe('south-east')
  })
})

describe('momentChord and momentSentence', () => {
  it('is a major triad when together, with a minor second added when opposed', () => {
    expect(momentChord('together', 0).map(n => n.midi)).toEqual([60, 64, 67])
    expect(momentChord('opposed', 2).map(n => n.midi)).toEqual([62, 63, 66, 69])
  })

  it('sits 12 dB under the decks at the crossfader middle, and is silent at either end', () => {
    const notes = momentChord('together', 0, 0.5)
    expect(20 * Math.log10(notes.reduce((sum, n) => sum + n.level, 0))).toBeCloseTo(CHORD_DB, 5)
    expect(momentChord('together', 0, 0)[0].level).toBe(0)
    expect(momentChord('together', 0, 1)[0].level).toBe(0)
    // All the notes at once stay far below the −1 dBFS ceiling.
    expect(momentChord('opposed', 0).reduce((sum, n) => sum + n.level, 0)).toBeLessThan(0.891)
  })

  it('says which deck, which place and which words', () => {
    const words = { name: 'rainfall', highest: 'wettest', lowest: 'driest' }
    const other = { name: 'wind', highest: 'strongest', lowest: 'calmest' }
    const base = { dateIndex: 0, date: '2024-01-15', place: 'north-east' }
    expect(momentSentence({ ...base, kind: 'together', aHigh: true, bHigh: true }, words, other)).toBe("Both high together, north-east: A's rainfall (wettest) and B's wind (strongest).")
    expect(momentSentence({ ...base, place: '', kind: 'opposed', aHigh: false, bHigh: true }, words, other)).toBe("One high and one low: A's rainfall (driest) and B's wind (strongest).")
  })
})

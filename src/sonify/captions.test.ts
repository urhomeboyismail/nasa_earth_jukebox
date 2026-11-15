import { describe, expect, it } from 'vitest'
import { VOICE_IDS } from '../data/sonification'
import { captionsFor, levelWord, sectorOf, trendOf, type CaptionParts } from './captions'
import { TREND_STEP } from './ranges'

const base: CaptionParts = {
  dropout: false, missing: [], melody: null, harmony: null, bass: null, hotspots: null, rhythm: null, motion: null, time: { accent: 'none' },
}

describe('levelWord', () => {
  it('splits 0 to 1 into thirds', () => {
    expect([0, 0.2, 0.33, 0.34, 0.5, 0.66, 0.67, 1].map(levelWord)).toEqual(['low', 'low', 'low', 'middle', 'middle', 'middle', 'high', 'high'])
  })
})

describe('trendOf', () => {
  it('is rising or falling from TREND_STEP on, else steady', () => {
    expect(trendOf(0.5 + TREND_STEP, 0.5)).toBe('rising')
    expect(trendOf(0.5 - TREND_STEP, 0.5)).toBe('falling')
    expect(trendOf(0.5 + TREND_STEP / 2, 0.5)).toBe('steady')
  })

  it('has no trend without an earlier value', () => {
    expect(trendOf(0.5, null)).toBeNull()
    expect(trendOf(null, 0.5)).toBeNull()
  })
})

describe('sectorOf', () => {
  it('splits the image into a 3 × 3 compass', () => {
    expect(sectorOf(0, 0)).toBe('north-west')
    expect(sectorOf(0.5, 0)).toBe('north')
    expect(sectorOf(1, 0)).toBe('north-east')
    expect(sectorOf(0, 0.5)).toBe('west')
    expect(sectorOf(0.5, 0.5)).toBe('centre')
    expect(sectorOf(1, 0.5)).toBe('east')
    expect(sectorOf(0, 1)).toBe('south-west')
    expect(sectorOf(0.5, 1)).toBe('south')
    expect(sectorOf(1, 1)).toBe('south-east')
  })
})

describe('captionsFor', () => {
  it('has a line for every voice, empty when the voice is quiet', () => {
    const { caption } = captionsFor(base)
    expect(Object.keys(caption).sort()).toEqual([...VOICE_IDS].sort())
    expect(caption.rhythm).toBe('')
    expect(caption.motion).toBe('')
    expect(caption.hotspots).toBe('')
    expect(caption.time).not.toBe('')
  })

  it('says "not enough data" for a missing voice, and only for a missing voice', () => {
    const { caption } = captionsFor({ ...base, missing: ['melody', 'harmony', 'bass'] })
    expect(caption.melody).toMatch(/not enough data/)
    expect(caption.harmony).toMatch(/not enough data/)
    expect(caption.bass).toMatch(/not enough data/)
    expect(caption.rhythm).toBe('')
    expect(caption.time).not.toMatch(/not enough data/)
  })

  it('gives a level and a trend, and no trend for a first frame', () => {
    expect(captionsFor({ ...base, melody: { position: 0.8, trend: 'rising' } }).caption.melody).toBe('Melody: high, rising')
    expect(captionsFor({ ...base, melody: { position: 0.5, trend: null } }).caption.melody).toBe('Melody: middle')
  })

  it('names the compass sector of the largest hot spot', () => {
    const { caption } = captionsFor({ ...base, hotspots: { count: 2, band: 'low', x: 0.9, y: 0.1 } })
    expect(caption.hotspots).toBe('Hot spots: 2, the largest is a low one in the north-east')
  })

  it('describes the rhythm, the motion and the time accent', () => {
    const { caption } = captionsFor({ ...base, rhythm: { perBeat: 4 }, motion: { openness: 0.9, sweep: -0.6 }, time: { accent: 'year' } })
    expect(caption.rhythm).toBe('Rhythm: busy')
    expect(caption.motion).toBe('Motion: high, towards the west')
    expect(caption.time).toBe('Time: steady pulse, new year')
    expect(captionsFor({ ...base, time: { accent: 'decade' } }).caption.time).toBe('Time: steady pulse, new decade')
    expect(captionsFor({ ...base, motion: { openness: 0, sweep: 0 } }).caption.motion).toBe('Motion: still')
  })

  it('writes a one-sentence summary that ends with a full stop', () => {
    const { summary } = captionsFor({ ...base, melody: { position: 0.8, trend: 'rising' }, hotspots: { count: 1, band: 'high', x: 0.5, y: 0.5 }, time: { accent: 'month' } })
    expect(summary).toBe('The overall level is high and rising; 1 hot spot, the largest in the centre; a new month.')
  })

  it('says only the time pulse sounds on a dropout', () => {
    const { summary, caption } = captionsFor({ ...base, dropout: true, missing: ['melody', 'harmony', 'bass'] })
    expect(summary).toMatch(/only the time pulse sounds/)
    expect(caption.time).not.toBe('')
  })

  it('never names a variable, a unit or a place', () => {
    const everything: CaptionParts = {
      dropout: false, missing: [], melody: { position: 0.9, trend: 'falling' }, harmony: { notes: 3 }, bass: { shift: 0.9, trend: 'rising' },
      hotspots: { count: 3, band: 'high', x: 0.2, y: 0.8 }, rhythm: { perBeat: 2 }, motion: { openness: 0.5, sweep: 0.5 }, time: { accent: 'month' },
    }
    const { caption, summary } = captionsFor(everything)
    expect(`${Object.values(caption).join(' ')} ${summary}`).not.toMatch(/°|celsius|temperature|warm|cold|cool|ocean|\bsea\b|water|mauritius/i)
  })
})

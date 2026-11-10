import { describe, expect, it } from 'vitest'
import { DETAIL_LEVELS, PRESET_IDS, VOICE_IDS, legendOf } from './sonification'

describe('the v3 lists', () => {
  it('name three presets, three detail levels and the seven voices in caption order', () => {
    expect(PRESET_IDS).toEqual(['major', 'dorian', 'pentatonic'])
    expect(DETAIL_LEVELS).toEqual(['calm', 'standard', 'full'])
    expect(VOICE_IDS).toEqual(['melody', 'harmony', 'bass', 'hotspots', 'rhythm', 'motion', 'time'])
  })

  it('have no id twice', () => {
    for (const list of [PRESET_IDS, DETAIL_LEVELS, VOICE_IDS]) expect(new Set(list).size).toBe(list.length)
  })
})

describe('legendOf', () => {
  it('reads a data set with no legend field as data', () => {
    expect(legendOf({})).toBe('data')
  })

  it('keeps the legend a manifest gives', () => {
    expect(legendOf({ legend: 'data' })).toBe('data')
    expect(legendOf({ legend: 'picture' })).toBe('picture')
  })
})

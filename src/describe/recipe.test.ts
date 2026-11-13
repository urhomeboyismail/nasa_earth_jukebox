import { describe, expect, it } from 'vitest'
import { VOICE_IDS } from '../data/sonification'
import { DETAIL_VOICES } from '../sonify/detail'
import { PRESETS } from '../sonify/presets'
import { detailLevelOf, soundRecipe } from './recipe'

describe('soundRecipe', () => {
  it('has seven rows in the order of the voices', () => {
    for (const preset of Object.values(PRESETS)) expect(soundRecipe(preset).map(row => row.voice)).toEqual([...VOICE_IDS])
  })

  it('says for each voice the first level of detail that plays it', () => {
    for (const row of soundRecipe(PRESETS.major)) {
      expect(DETAIL_VOICES[row.detailLevel]).toContain(row.voice)
      const lower = row.detailLevel === 'full' ? 'standard' : row.detailLevel === 'standard' ? 'calm' : null
      if (lower) expect(DETAIL_VOICES[lower]).not.toContain(row.voice)
    }
    expect(detailLevelOf('melody')).toBe('calm')
    expect(detailLevelOf('bass')).toBe('standard')
    expect(detailLevelOf('motion')).toBe('full')
  })

  it('explains every voice in words: what drives it and what it sounds like', () => {
    for (const row of soundRecipe(PRESETS.dorian)) {
      expect(row.name.length).toBeGreaterThan(0)
      expect(row.drivenBy.length).toBeGreaterThan(5)
      expect(row.sounds.length).toBeGreaterThan(10)
    }
  })
})

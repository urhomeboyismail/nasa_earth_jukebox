import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUDIO_PREFS_KEY, DEFAULT_AUDIO_PREFS, presetIdFor, readAudioPrefs, resetAudioPrefs, saveAudioPrefs } from './prefs'

afterEach(() => {
  vi.restoreAllMocks()
  resetAudioPrefs()
})

describe('audio preferences', () => {
  it('starts at the data set\'s own sound', () => {
    expect(readAudioPrefs()).toEqual(DEFAULT_AUDIO_PREFS)
  })

  it('keeps what is saved, merged with what was there', () => {
    saveAudioPrefs({ style: 'chiptune' })
    saveAudioPrefs({ bassDb: 3, muted: ['rhythm'] })
    expect(readAudioPrefs()).toEqual({ style: 'chiptune', bassDb: 3, speed: 'normal', muted: ['rhythm'], swapEars: false, styleEverywhere: false })
    expect(JSON.parse(localStorage.getItem(AUDIO_PREFS_KEY) ?? '{}').style).toBe('chiptune')
  })

  it('reads an old stored value without swapEars as false, and keeps a stored true', () => {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ style: null, bassDb: 2, speed: 'fast', muted: [] }))
    expect(readAudioPrefs().swapEars).toBe(false)
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ swapEars: true }))
    expect(readAudioPrefs().swapEars).toBe(true)
  })

  it('trusts nothing stored: a bad field falls back, the melody is never muted, and broken text is ignored', () => {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ style: 'jazz', bassDb: 40, speed: 'warp', muted: ['melody', 'bass', 'bass', 'drums'] }))
    expect(readAudioPrefs()).toEqual({ style: null, bassDb: 0, speed: 'normal', muted: [], swapEars: false, styleEverywhere: false })
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ muted: ['melody', 'bass', 'bass'] }))
    expect(readAudioPrefs().muted).toEqual(['bass'])
    localStorage.setItem(AUDIO_PREFS_KEY, '{not json')
    expect(readAudioPrefs()).toEqual(DEFAULT_AUDIO_PREFS)
  })

  it('still holds the choice for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    saveAudioPrefs({ style: 'nature' })
    expect(readAudioPrefs().style).toBe('nature')
  })

  it('reads an old stored value without styleEverywhere as false, so a saved style is only a default (SN15)', () => {
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ style: 'lofi', bassDb: 0, speed: 'normal', muted: [], swapEars: false }))
    expect(readAudioPrefs().styleEverywhere).toBe(false)
    expect(presetIdFor(readAudioPrefs(), 'cinematic')).toBe('cinematic')
  })

  it('forgets everything on reset', () => {
    saveAudioPrefs({ style: 'lofi', bassDb: -2 })
    resetAudioPrefs()
    expect(readAudioPrefs()).toEqual(DEFAULT_AUDIO_PREFS)
  })
})

describe('presetIdFor: which preset plays (SN15)', () => {
  it('plays a style chosen in the Listen mixer over every data set', () => {
    expect(presetIdFor({ style: 'chiptune', styleEverywhere: true }, 'cinematic')).toBe('chiptune')
  })

  it("plays the data set's own preset over a style from the welcome", () => {
    expect(presetIdFor({ style: 'chiptune', styleEverywhere: false }, 'cinematic')).toBe('cinematic')
  })

  it("uses the welcome's style where the data set has no preset of its own", () => {
    expect(presetIdFor({ style: 'chiptune', styleEverywhere: false }, undefined)).toBe('chiptune')
  })

  it('falls back to Major with no style and no preset, and ignores the flag without a style', () => {
    expect(presetIdFor({ style: null, styleEverywhere: false }, undefined)).toBe('major')
    expect(presetIdFor({ style: null, styleEverywhere: true }, 'nature')).toBe('nature')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MIX, MY_MIX_KEY, cleanMix, hasMyMix, readMyMix, saveMyMix } from './mySoundMix'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('My mix', () => {
  it('is the default mix when nothing has been saved', () => {
    expect(readMyMix()).toEqual(DEFAULT_MIX)
    expect(hasMyMix()).toBe(false)
  })

  it('round-trips a saved mix, with the voices in the mixer order', () => {
    expect(saveMyMix({ muted: ['time', 'bass'], solo: 'melody' })).toBe(true)
    expect(hasMyMix()).toBe(true)
    expect(readMyMix()).toEqual({ muted: ['bass', 'time'], solo: 'melody' })
    expect(JSON.parse(localStorage.getItem(MY_MIX_KEY) ?? '')).toEqual({ muted: ['bass', 'time'], solo: 'melody' })
  })

  it('drops a voice the ensemble does not have, and does not guess a replacement', () => {
    localStorage.setItem(MY_MIX_KEY, JSON.stringify({ muted: ['bass', 'kazoo', 'bass'], solo: 'kazoo' }))
    expect(readMyMix()).toEqual({ muted: ['bass'], solo: null })
    expect(cleanMix({ muted: ['cello'], solo: 'harmony' })).toEqual({ muted: [], solo: 'harmony' })
  })

  it.each([
    ['not JSON', '{oops'],
    ['not an object', '"melody"'],
    ['the wrong shape', JSON.stringify({ muted: 'bass', solo: null })],
    ['a missing field', JSON.stringify({ muted: [] })],
    ['a null', 'null'],
  ])('gives the default mix for a store that is %s', (_name, raw) => {
    localStorage.setItem(MY_MIX_KEY, raw)
    expect(readMyMix()).toEqual(DEFAULT_MIX)
    expect(hasMyMix()).toBe(false)
  })

  it('gives the default mix, and says it was not kept, when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readMyMix()).toEqual(DEFAULT_MIX)
    expect(hasMyMix()).toBe(false)
    expect(saveMyMix({ muted: ['bass'], solo: null })).toBe(false)
  })
})

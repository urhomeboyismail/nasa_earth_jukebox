import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_SAVED, type ArtPreset } from './presets'
import { ART_PRESETS_KEY, deletePreset, readPresets, renamePreset, savePreset, writePresets } from './store'

const make = (name: string): ArtPreset => ({ name, tonic: 2, scale: 'dorian', bpm: 90, brightness: 0.4 })
const many = (count: number) => Array.from({ length: count }, (_, i) => make(`P${i}`))

beforeEach(() => localStorage.clear())

describe('the stored list', () => {
  it('is empty at first, and keeps what is written', () => {
    expect(readPresets()).toEqual([])
    writePresets([make('Dusk')])
    expect(readPresets()).toEqual([make('Dusk')])
    expect(localStorage.getItem(ART_PRESETS_KEY)).toContain('Dusk')
  })

  it.each([
    ['text that is not JSON', 'not json'],
    ['an object', '{"name":"x"}'],
    ['a preset with an unknown field', JSON.stringify([{ ...make('A'), instrument: 'piano' }])],
    ['a preset with a value out of range', JSON.stringify([{ ...make('A'), bpm: 400 }])],
    ['more than ten presets', JSON.stringify(many(MAX_SAVED + 1))],
  ])('is ignored, and gives none, for %s', (_name, stored) => {
    localStorage.setItem(ART_PRESETS_KEY, stored)
    expect(readPresets()).toEqual([])
  })

  it('gives none, and does not throw, when storage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readPresets()).toEqual([])
    expect(() => writePresets([make('A')])).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('saving, renaming and deleting', () => {
  it('keeps at most ten presets', () => {
    const full = many(MAX_SAVED)
    const refused = savePreset(full, make('One too many'))
    expect(refused).toEqual({ ok: false, message: 'You can keep 10 presets. Delete one to save another.' })
    // The tenth is allowed.
    expect(savePreset(many(MAX_SAVED - 1), make('Tenth'))).toMatchObject({ ok: true })
  })

  it('replaces a preset saved under the same name, even when the list is full', () => {
    const result = savePreset(many(MAX_SAVED), { ...make('P3'), bpm: 61 })
    expect(result.ok && result.list).toHaveLength(MAX_SAVED)
    expect(result.ok && result.list[3].bpm).toBe(61)
  })

  it('needs a name', () => {
    expect(savePreset([], make('   '))).toEqual({ ok: false, message: 'Give the preset a name first.' })
    expect(renamePreset([make('A')], 'A', ' ')).toEqual({ ok: false, message: 'Give the preset a name first.' })
  })

  it('renames one preset and refuses a name already taken', () => {
    const list = [make('A'), make('B')]
    expect(renamePreset(list, 'A', ' Sunrise ')).toEqual({ ok: true, list: [make('Sunrise'), make('B')] })
    expect(renamePreset(list, 'A', 'B')).toEqual({ ok: false, message: 'There is already a preset called B.' })
    expect(renamePreset(list, 'A', 'A')).toMatchObject({ ok: true })
  })

  it('deletes one preset', () => {
    expect(deletePreset([make('A'), make('B')], 'A')).toEqual([make('B')])
  })
})

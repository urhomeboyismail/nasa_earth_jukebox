import { describe, expect, it } from 'vitest'
import { PRESETS } from '../../sonify'
import { ART_FIELDS, applyChoice, choiceOf, describeChoice, presetFromArt, slug } from './presets'

const base = PRESETS.major

describe('applyChoice', () => {
  it('changes only the four editable fields', () => {
    const next = applyChoice(base, { tonic: 7, scale: 'dorian', bpm: 100, brightness: 0.9 })
    expect(next).toEqual({ ...base, tonic: 7, scale: 'dorian', bpm: 100, brightness: 0.9 })
    expect(next.id).toBe(base.id)
    expect(next.label).toBe(base.label)
    expect(next.note).toBe(base.note)
  })

  it('leaves the fields it is not given, and the base itself, as they were', () => {
    const before = { ...base }
    const next = applyChoice(base, { bpm: 60 })
    expect(next.tonic).toBe(base.tonic)
    expect(next.scale).toBe(base.scale)
    expect(base).toEqual(before)
  })

  it.each(['id', 'label', 'note', 'voices', 'melody'])('refuses to set %s, which is not an art field', field => {
    expect(() => applyChoice(base, { [field]: 'x' })).toThrow(`${field} cannot be changed in art mode.`)
  })

  it.each([
    ['tonic', 12], ['tonic', -1], ['tonic', 1.5], ['scale', 'locrian'], ['bpm', 59], ['bpm', 121], ['bpm', Number.NaN], ['brightness', 1.1], ['brightness', -0.1], ['bpm', '90'],
  ])('refuses %s = %s', (field, value) => {
    expect(() => applyChoice(base, { [field]: value })).toThrow(`The value for ${field} is not allowed.`)
  })

  it('accepts the ends of every range', () => {
    expect(applyChoice(base, { tonic: 0, bpm: 60, brightness: 0 })).toMatchObject({ tonic: 0, bpm: 60, brightness: 0 })
    expect(applyChoice(base, { tonic: 11, bpm: 120, brightness: 1 })).toMatchObject({ tonic: 11, bpm: 120, brightness: 1 })
  })
})

describe('the rest of the module', () => {
  it('lists exactly the four fields of the ticket', () => {
    expect([...ART_FIELDS]).toEqual(['tonic', 'scale', 'bpm', 'brightness'])
    expect(Object.keys(choiceOf(base)).sort()).toEqual([...ART_FIELDS].sort())
  })

  it('labels the preset with the listener\'s name and keeps everything else', () => {
    const preset = presetFromArt(base, { name: 'Dusk', tonic: 3, scale: 'minorPentatonic', bpm: 70, brightness: 0.2 })
    expect(preset).toMatchObject({ id: base.id, label: 'Dusk', tonic: 3, scale: 'minorPentatonic', bpm: 70, brightness: 0.2 })
  })

  it('says the choice in words', () => {
    expect(describeChoice({ tonic: 1, scale: 'minorPentatonic', bpm: 90, brightness: 0.25 })).toBe('C sharp minor pentatonic, 90 beats a minute, brightness 25 percent')
  })

  it('makes a safe file name from any name', () => {
    expect(slug('My  Dusk / take 2!')).toBe('my-dusk-take-2')
    expect(slug('???')).toBe('preset')
  })
})

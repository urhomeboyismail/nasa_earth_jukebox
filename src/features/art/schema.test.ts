import { describe, expect, it } from 'vitest'
import { PRESETS } from '../../sonify'
import { applyChoice, choiceOf, presetFromArt, type ArtPreset } from './presets'
import { parsePresetFile, presetFileText } from './schema'

const preset: ArtPreset = { name: 'Dusk', tonic: 9, scale: 'minorPentatonic', bpm: 100, brightness: 0.7 }

describe('importing a preset file', () => {
  it('accepts a valid file', () => {
    expect(parsePresetFile(JSON.stringify(preset))).toEqual({ ok: true, preset })
  })

  it.each([
    ['is not JSON', 'this is not json', 'That file is not a preset: it is not JSON.'],
    ['is an empty body', '', 'That file is not a preset: it is not JSON.'],
    ['is JSON of the wrong shape', '[1, 2]', 'That file is not a preset'],
  ])('refuses a file that %s', (_name, text, message) => {
    const result = parsePresetFile(text)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toContain(message)
  })

  it('refuses a file with a field art mode does not have, such as an instrument or a mapping', () => {
    for (const extra of [{ instrument: 'piano' }, { mapping: { melody: 'hotspots' } }, { id: 'major' }]) {
      const result = parsePresetFile(JSON.stringify({ ...preset, ...extra }))
      expect(result.ok).toBe(false)
    }
  })

  it.each([
    ['tonic', 12], ['tonic', 2.5], ['scale', 'locrian'], ['bpm', '100'], ['bpm', 30], ['brightness', 2], ['name', ''], ['name', 'x'.repeat(41)],
  ])('refuses a bad %s (%s) and names the field', (field, value) => {
    const result = parsePresetFile(JSON.stringify({ ...preset, [field]: value }))
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toContain(`(${field})`)
  })

  it('refuses a file with a missing field', () => {
    const rest: Partial<ArtPreset> = { ...preset }
    delete rest.bpm
    expect(parsePresetFile(JSON.stringify(rest)).ok).toBe(false)
  })
})

describe('exporting a preset', () => {
  it('gives the same preset back when it is imported', () => {
    expect(parsePresetFile(presetFileText(preset))).toEqual({ ok: true, preset })
  })

  it('writes exactly the name and the four fields', () => {
    expect(Object.keys(JSON.parse(presetFileText(preset))).sort()).toEqual(['bpm', 'brightness', 'name', 'scale', 'tonic'])
  })

  it('survives a round trip through the preset the ensemble plays', () => {
    const played = applyChoice(PRESETS.dorian, { tonic: 5, bpm: 77, brightness: 0.33 })
    const file: ArtPreset = { name: 'Round trip', ...choiceOf(played) }
    const back = parsePresetFile(presetFileText(file))
    if (!back.ok) throw new Error(back.message)
    expect(presetFromArt(PRESETS.dorian, back.preset)).toEqual({ ...played, label: 'Round trip' })
  })
})

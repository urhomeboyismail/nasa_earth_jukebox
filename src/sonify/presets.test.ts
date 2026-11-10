import { describe, expect, it } from 'vitest'
import { DETAIL_LEVELS, PRESET_IDS, VOICE_IDS } from '../data/sonification'
import { DETAIL_VOICES, voicesFor } from './detail'
import { PRESETS, SCALES, pitchClasses, presetFor, snapToScale } from './presets'

describe('presets', () => {
  it('has a preset for every id the manifest can name, and nothing else', () => {
    expect(Object.keys(PRESETS).sort()).toEqual([...PRESET_IDS].sort())
    for (const id of PRESET_IDS) expect(presetFor(id).id).toBe(id)
  })

  it('says it is an artistic choice that never carries data', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(preset.note).toMatch(/artistic/i)
      expect(preset.note).toMatch(/never carries data/i)
      expect(preset.label.length).toBeGreaterThan(0)
    }
  })

  it('has a key, a tempo and a brightness in range, and names no data set, place or unit', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(Number.isInteger(preset.tonic)).toBe(true)
      expect(preset.tonic).toBeGreaterThanOrEqual(0)
      expect(preset.tonic).toBeLessThan(12)
      expect(preset.bpm).toBeGreaterThanOrEqual(60)
      expect(preset.bpm).toBeLessThanOrEqual(120)
      expect(preset.brightness).toBeGreaterThanOrEqual(0)
      expect(preset.brightness).toBeLessThanOrEqual(1)
      expect(JSON.stringify(preset)).not.toMatch(/°|celsius|temperature|ocean|\bsea\b|mauritius/i)
    }
  })

  it('has scales that are sorted, start at 0 and stay inside one octave', () => {
    for (const intervals of Object.values(SCALES)) {
      expect(intervals[0]).toBe(0)
      expect([...intervals].sort((a, b) => a - b)).toEqual([...intervals])
      expect(intervals[intervals.length - 1]).toBeLessThan(12)
    }
  })

  it('has a pentatonic with no semitone step, so every combination is consonant', () => {
    const steps = SCALES.minorPentatonic.map((n, i, all) => (all[i + 1] ?? 12) - n)
    expect(Math.min(...steps)).toBeGreaterThanOrEqual(2)
  })
})

describe('snapToScale', () => {
  const RANGES = [[48, 78], [48, 60], [36, 48], [60, 84], [60, 72]] as const

  it.each(PRESET_IDS)('puts every note of the range in the %s scale and in range', id => {
    const preset = PRESETS[id]
    const classes = pitchClasses(preset)
    for (const [low, high] of RANGES) {
      for (let midi = low - 3; midi <= high + 3; midi += 0.25) {
        const snapped = snapToScale(midi, preset, low, high)
        expect(classes.has(snapped % 12), `${id} ${midi} → ${snapped}`).toBe(true)
        expect(snapped).toBeGreaterThanOrEqual(low)
        expect(snapped).toBeLessThanOrEqual(high)
      }
    }
  })

  it('leaves a note that is already in the scale where it is', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      for (let midi = 48; midi <= 78; midi++) {
        if (pitchClasses(preset).has(midi % 12)) expect(snapToScale(midi, preset, 48, 78)).toBe(midi)
      }
    }
  })

  it('moves a note to the nearest scale note, and a tie goes down', () => {
    // C major: 49 (C#) is between C (48) and D (50); 51 (D#) between D (50) and E (52); 54 (F#) between F (53) and G (55).
    expect(snapToScale(49, PRESETS.major, 48, 78)).toBe(48)
    expect(snapToScale(51, PRESETS.major, 48, 78)).toBe(50)
    expect(snapToScale(54, PRESETS.major, 48, 78)).toBe(53)
    expect(snapToScale(54.6, PRESETS.major, 48, 78)).toBe(55)
    // A minor pentatonic (A C D E G): 61 (C#) is between C (60) and D (62).
    expect(snapToScale(61, PRESETS.pentatonic, 48, 78)).toBe(60)
  })

  it('moves a note outside the range to the nearest scale note at the end of it', () => {
    expect(snapToScale(10, PRESETS.major, 48, 60)).toBe(48)
    expect(snapToScale(200, PRESETS.major, 48, 60)).toBe(60)
  })

  it('follows the key of the preset', () => {
    // D dorian has the notes of C major, so it has no C#: 49 is between C (48) and D (50), and the tie goes down.
    expect(snapToScale(49, PRESETS.dorian, 48, 78)).toBe(48)
    expect(pitchClasses(PRESETS.dorian).has(1)).toBe(false)
    expect(pitchClasses(PRESETS.pentatonic)).toEqual(new Set([9, 0, 2, 4, 7]))
  })
})

describe('detail', () => {
  it('has all seven voices at full detail', () => {
    expect(new Set(DETAIL_VOICES.full)).toEqual(new Set(VOICE_IDS))
    expect(DETAIL_VOICES.full).toHaveLength(VOICE_IDS.length)
  })

  it('adds voices at each level: calm is part of standard, standard part of full', () => {
    const subset = (a: readonly string[], b: readonly string[]) => a.every(v => b.includes(v))
    expect(subset(DETAIL_VOICES.calm, DETAIL_VOICES.standard)).toBe(true)
    expect(subset(DETAIL_VOICES.standard, DETAIL_VOICES.full)).toBe(true)
    expect(DETAIL_VOICES.calm.length).toBeLessThan(DETAIL_VOICES.standard.length)
    expect(DETAIL_VOICES.standard.length).toBeLessThan(DETAIL_VOICES.full.length)
  })

  it('always keeps the melody, the harmony and the time pulse', () => {
    for (const level of DETAIL_LEVELS) for (const voice of ['melody', 'harmony', 'time'] as const) expect(voicesFor(level)).toContain(voice)
  })

  it('has a list for every level, and no voice twice', () => {
    expect(Object.keys(DETAIL_VOICES).sort()).toEqual([...DETAIL_LEVELS].sort())
    for (const level of DETAIL_LEVELS) expect(new Set(voicesFor(level)).size).toBe(voicesFor(level).length)
  })
})

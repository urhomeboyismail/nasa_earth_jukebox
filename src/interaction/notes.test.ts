import { describe, expect, it } from 'vitest'
import fixture from '../../public/data/fixture/manifest.json'
import type { Visualization } from '../data'
import { MELODY_LOW_MIDI, MELODY_SPAN } from '../sonify/ranges'
import { PRESETS, pitchClasses } from '../sonify/presets'
import { features } from '../sonify/testFeatures'
import { toMusicFrame } from '../sonify/music'
import { cellOfFraction, fifthAbove, markNote, noteForPosition, notesOf, octaveBelow, positionOfValue } from './notes'

const scale = (fixture as Visualization).colorScale

describe('noteForPosition', () => {
  it('is in the preset’s key and the melody range for every position, in every preset', () => {
    for (const preset of Object.values(PRESETS)) {
      const classes = pitchClasses(preset)
      for (let p = 0; p <= 1; p += 0.05) {
        const midi = noteForPosition(p, preset)
        expect(classes.has(midi % 12), `${preset.id} ${p}`).toBe(true)
        expect(midi).toBeGreaterThanOrEqual(MELODY_LOW_MIDI)
        expect(midi).toBeLessThanOrEqual(MELODY_LOW_MIDI + MELODY_SPAN)
      }
    }
  })

  it('rises with the position and clamps outside 0 to 1', () => {
    const preset = PRESETS.major
    expect(noteForPosition(0.9, preset)).toBeGreaterThan(noteForPosition(0.1, preset))
    expect(noteForPosition(-3, preset)).toBe(noteForPosition(0, preset))
    expect(noteForPosition(7, preset)).toBe(noteForPosition(1, preset))
  })

  it('is the same every time', () => {
    expect(noteForPosition(0.37, PRESETS.dorian)).toBe(noteForPosition(0.37, PRESETS.dorian))
  })
})

describe('the other notes', () => {
  it('puts the fifth and the mark in the key, and the lower octave exactly twelve below', () => {
    for (const preset of Object.values(PRESETS)) {
      const classes = pitchClasses(preset)
      expect(classes.has(fifthAbove(noteForPosition(0.4, preset), preset) % 12)).toBe(true)
      expect(classes.has(markNote(preset) % 12)).toBe(true)
      expect(markNote(preset)).toBeGreaterThanOrEqual(MELODY_LOW_MIDI + MELODY_SPAN - 2)
    }
    expect(octaveBelow(60)).toBe(48)
  })
})

describe('positionOfValue', () => {
  it('is 0 at the first stop, 1 at the last and clamped outside', () => {
    const first = scale.stops[0].value
    const last = scale.stops[scale.stops.length - 1].value
    expect(positionOfValue(first, scale)).toBe(0)
    expect(positionOfValue(last, scale)).toBe(1)
    expect(positionOfValue(first - 100, scale)).toBe(0)
    expect(positionOfValue(last + 100, scale)).toBe(1)
    expect(positionOfValue((first + last) / 2, scale)).toBeCloseTo(0.5)
  })
})

describe('notesOf', () => {
  it('turns a frame of music into the melody, the chord and the hot spots', () => {
    const frame = toMusicFrame(features({ position: 0.5, histogram: [0.5, 0.5, 0] }), PRESETS.major)
    const notes = notesOf(frame, 0.3)
    expect(notes.length).toBe(1 + (frame.harmony?.midis.length ?? 0) + frame.hotspots.length)
    expect(notes.every(note => note.seconds === 0.3)).toBe(true)
    expect(notes[0].midi).toBe(frame.melody?.midi)
  })

  it('is empty for a frame with no music', () => {
    expect(notesOf(toMusicFrame(features({ position: null }), PRESETS.major), 0.2)).toEqual([])
  })
})

describe('cellOfFraction', () => {
  const area = { x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 }
  it('finds the cell of a place given as fractions of the whole image', () => {
    expect(cellOfFraction(0.5, 0.5, area, 24, 12)).toEqual({ col: 12, row: 6 })
    expect(cellOfFraction(0.25, 0.25, area, 24, 12)).toEqual({ col: 0, row: 0 })
  })
  it('clamps a place outside the map to its nearest cell', () => {
    expect(cellOfFraction(0, 0, area, 24, 12)).toEqual({ col: 0, row: 0 })
    expect(cellOfFraction(1, 1, area, 24, 12)).toEqual({ col: 23, row: 11 })
  })
})

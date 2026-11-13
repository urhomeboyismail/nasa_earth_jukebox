import { describe, expect, it } from 'vitest'
import { PRESETS, toMusicFrame } from '../../sonify'
import { features, spot } from '../../sonify/testFeatures'
import { endWords, SCRUB_STEPS_PER_SECOND, SLICE_MIN_GAP_MS, SLICE_SECONDS, scrubTarget, sliceDue, sliceNotes } from './scrub'

describe('scrubTarget', () => {
  it('moves by the step and stays inside the dates', () => {
    expect(scrubTarget(1, { by: 1 }, 4)).toBe(2)
    expect(scrubTarget(1, { by: -1 }, 4)).toBe(0)
    expect(scrubTarget(0, { by: -1 }, 4)).toBe(0)
    expect(scrubTarget(3, { by: 1 }, 4)).toBe(3)
    expect(scrubTarget(1, { by: 10 }, 4)).toBe(3)
    expect(scrubTarget(2, { by: -10 }, 4)).toBe(0)
  })

  it('goes to the first and the last date', () => {
    expect(scrubTarget(2, { to: 'first' }, 4)).toBe(0)
    expect(scrubTarget(1, { to: 'last' }, 4)).toBe(3)
  })

  it('has nowhere to go with one date or none', () => {
    expect(scrubTarget(0, { by: 1 }, 1)).toBe(0)
    expect(scrubTarget(0, { to: 'last' }, 0)).toBe(0)
  })
})

describe('endWords', () => {
  it('says which end a step that cannot move is at, and nothing when it moved', () => {
    expect(endWords(0, 0, 4)).toBe('First date.')
    expect(endWords(3, 3, 4)).toBe('Last date.')
    expect(endWords(0, 0, 1)).toBe('Only one date.')
    expect(endWords(1, 2, 4)).toBeNull()
  })
})

describe('sliceNotes', () => {
  const music = toMusicFrame(features({ position: 0.6, hotspots: [spot('h1', 'high', 0.3, 0.4)] }), PRESETS.major)

  it('is 150 ms long, for every note of the date', () => {
    const notes = sliceNotes(music)
    expect(SLICE_SECONDS).toBe(0.15)
    expect(notes.length).toBeGreaterThan(1)
    expect(notes.every(note => note.seconds === 0.15)).toBe(true)
  })

  it('gives the same slice for the same date', () => {
    expect(sliceNotes(music)).toEqual(sliceNotes(music))
  })

  it('keeps the length even when the date cannot be read', () => {
    const unreadable = toMusicFrame(features({ position: null }), PRESETS.major)
    expect(sliceNotes(unreadable).every(note => note.seconds === 0.15)).toBe(true)
  })
})

describe('sliceDue', () => {
  it('lets the first slice sound, then one every eighth of a second', () => {
    expect(SCRUB_STEPS_PER_SECOND).toBe(8)
    expect(SLICE_MIN_GAP_MS).toBe(125)
    expect(sliceDue(null, 0)).toBe(true)
    expect(sliceDue(1000, 1100)).toBe(false)
    expect(sliceDue(1000, 1125)).toBe(true)
  })
})

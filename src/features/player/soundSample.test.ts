import { describe, expect, it } from 'vitest'
import { STYLE_IDS } from '../../data'
import { pitchClasses, presetFor } from '../../sonify/presets'
import { sampleNotes } from './soundSample'

describe('the style sample', () => {
  it('is five rising notes of the style\'s own scale and key', () => {
    for (const id of STYLE_IDS) {
      const preset = presetFor(id)
      const notes = sampleNotes(preset)
      expect(notes).toHaveLength(5)
      expect([...notes].sort((x, y) => x - y)).toEqual(notes)
      for (const midi of notes) expect(pitchClasses(preset).has(midi % 12), `${id} ${midi}`).toBe(true)
    }
  })
})

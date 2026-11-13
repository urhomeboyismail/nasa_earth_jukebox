import { describe, expect, it, vi } from 'vitest'
import { INTERACTIVE_LOOKAHEAD_S } from '../audio/ensemble/constants'
import { PRESETS } from '../sonify/presets'
import { EDGE_GAP_S, EDGE_SECONDS, LOCK_SECONDS, MARK_SECONDS, MOVE_LEVEL, MOVE_SECONDS, UNDO_LEVEL, UNLOCK_GAP_S, createFeedback } from './feedback'
import { fifthAbove, markNote, noteForPosition, octaveBelow } from './notes'

const preset = PRESETS.major
function setup() {
  const ensemble = { playNotes: vi.fn(), playDropout: vi.fn(), now: vi.fn(() => 5) }
  return { ensemble, feedback: createFeedback(ensemble, preset) }
}
const place = { position: 0.4, pan: -0.5, elevation: 0.25 }
const note = noteForPosition(0.4, preset)

describe('the feedback sounds', () => {
  it('move: the place’s note, 120 ms, panned to its column and raised by its row, at the default lead', () => {
    const { ensemble, feedback } = setup()
    feedback.move(place)
    expect(ensemble.playNotes).toHaveBeenCalledOnce()
    expect(ensemble.playNotes).toHaveBeenCalledWith([{ midi: note, level: MOVE_LEVEL, seconds: MOVE_SECONDS, pan: -0.5, elevation: 0.25 }])
  })

  it('move on a place with no data plays the seeded dropout, never noise', () => {
    const { ensemble, feedback } = setup()
    feedback.move({ position: null, pan: 0 })
    expect(ensemble.playDropout).toHaveBeenCalledOnce()
    expect(ensemble.playNotes).not.toHaveBeenCalled()
  })

  it('edge: two 60 ms notes, the same note then an octave lower 80 ms later', () => {
    const { ensemble, feedback } = setup()
    feedback.edge(place)
    expect(ensemble.playNotes).toHaveBeenCalledTimes(2)
    expect(ensemble.playNotes.mock.calls[0][0]).toEqual([expect.objectContaining({ midi: note, seconds: EDGE_SECONDS })])
    expect(ensemble.playNotes.mock.calls[1][0]).toEqual([expect.objectContaining({ midi: octaveBelow(note), seconds: EDGE_SECONDS })])
    expect(ensemble.playNotes.mock.calls[1][1]).toBeCloseTo(5 + INTERACTIVE_LOOKAHEAD_S + EDGE_GAP_S)
  })

  it('edge on a place with no data still sounds a note, in the middle of the range', () => {
    const { ensemble, feedback } = setup()
    feedback.edge({ position: null, pan: 0 })
    expect(ensemble.playNotes.mock.calls[0][0][0].midi).toBe(noteForPosition(0.5, preset))
  })

  it('lock: the note and the fifth above it together for 250 ms', () => {
    const { ensemble, feedback } = setup()
    feedback.lock(place)
    expect(ensemble.playNotes).toHaveBeenCalledOnce()
    expect(ensemble.playNotes.mock.calls[0][0].map((n: { midi: number }) => n.midi)).toEqual([note, fifthAbove(note, preset)])
    expect(ensemble.playNotes.mock.calls[0][0].every((n: { seconds: number }) => n.seconds === LOCK_SECONDS)).toBe(true)
  })

  it('unlock: the fifth, then the note 120 ms later', () => {
    const { ensemble, feedback } = setup()
    feedback.unlock(place)
    expect(ensemble.playNotes.mock.calls[0][0][0].midi).toBe(fifthAbove(note, preset))
    expect(ensemble.playNotes.mock.calls[1][0][0].midi).toBe(note)
    expect(ensemble.playNotes.mock.calls[1][1]).toBeCloseTo(5 + INTERACTIVE_LOOKAHEAD_S + UNLOCK_GAP_S)
  })

  it('mark: one note at the top of the melody range for 500 ms', () => {
    const { ensemble, feedback } = setup()
    feedback.mark()
    expect(ensemble.playNotes).toHaveBeenCalledWith([{ midi: markNote(preset), level: MOVE_LEVEL, pan: 0, seconds: MARK_SECONDS }])
  })

  it('undo: the restored place’s note, quieter', () => {
    const { ensemble, feedback } = setup()
    feedback.undo(place)
    expect(ensemble.playNotes.mock.calls[0][0]).toEqual([expect.objectContaining({ midi: note, level: UNDO_LEVEL, seconds: MOVE_SECONDS })])
  })

  it('uses no other audio call, so a sound is always a note of the data’s key', () => {
    const { ensemble, feedback } = setup()
    for (const cue of [feedback.move, feedback.edge, feedback.lock, feedback.unlock, feedback.undo]) cue(place)
    feedback.mark()
    expect(Object.keys(ensemble).sort()).toEqual(['now', 'playDropout', 'playNotes'])
    expect(ensemble.playDropout).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import { MAX_STEPS, midiToFrequency, parseAudioPayload, stepSeconds, totalSeconds, trackSteps } from './payload'

const track = { instrument: 'marimba', pitch_range: [48, 72], volume_curve: [0.2, 0.8] }
const payload = { base_bpm: 90, tracks: [track] }

describe('parseAudioPayload', () => {
  it('takes a payload, and the route\'s whole answer', () => {
    expect(parseAudioPayload(payload)).toEqual(payload)
    expect(parseAudioPayload({ approved: true, feedback: '', revisions: 0, audio: payload, vision: null })).toEqual(payload)
  })

  it.each([
    ['nothing', null],
    ['text', 'play this'],
    ['an answer with no audio', { approved: false, audio: null }],
    ['no tracks', { base_bpm: 90, tracks: [] }],
    ['a tempo that is too slow', { base_bpm: 5, tracks: [track] }],
    ['a tempo that is too fast', { base_bpm: 900, tracks: [track] }],
    ['a pitch range with the highest note first', { base_bpm: 90, tracks: [{ ...track, pitch_range: [72, 48] }] }],
    ['a pitch range of three notes', { base_bpm: 90, tracks: [{ ...track, pitch_range: [48, 60, 72] }] }],
    ['a note that is not a MIDI note', { base_bpm: 90, tracks: [{ ...track, pitch_range: [48, 128] }] }],
    ['a note between two notes', { base_bpm: 90, tracks: [{ ...track, pitch_range: [48.5, 72] }] }],
    ['an empty volume curve', { base_bpm: 90, tracks: [{ ...track, volume_curve: [] }] }],
    ['a volume above 1', { base_bpm: 90, tracks: [{ ...track, volume_curve: [0.2, 1.5] }] }],
    ['a volume below 0', { base_bpm: 90, tracks: [{ ...track, volume_curve: [-0.1] }] }],
    ['a volume that is not a number', { base_bpm: 90, tracks: [{ ...track, volume_curve: ['loud'] }] }],
    ['a curve that is far too long', { base_bpm: 90, tracks: [{ ...track, volume_curve: Array(MAX_STEPS + 1).fill(0.5) }] }],
    ['an instrument with no name', { base_bpm: 90, tracks: [{ ...track, instrument: '' }] }],
  ])('refuses %s', (_name, value) => {
    expect(parseAudioPayload(value)).toBeNull()
  })
})

describe('midiToFrequency', () => {
  it('gives 440 Hz for note 69 and doubles every octave', () => {
    expect(midiToFrequency(69)).toBe(440)
    expect(midiToFrequency(81)).toBeCloseTo(880)
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 2)
  })
})

describe('trackSteps', () => {
  const steps = (pitch_range: [number, number], volume_curve: number[]) => trackSteps({ instrument: 'x', pitch_range, volume_curve })

  it('plays the quietest value on the lowest note, the loudest on the highest, and keeps each value as the gain', () => {
    expect(steps([48, 72], [0.2, 0.5, 0.8])).toEqual([
      { frequency: midiToFrequency(48), gain: 0.2 },
      { frequency: midiToFrequency(60), gain: 0.5 },
      { frequency: midiToFrequency(72), gain: 0.8 },
    ])
  })

  it('uses the whole pitch range even when the volume hardly moves', () => {
    const [first, second] = steps([60, 72], [0.43, 0.55])
    expect(first?.frequency).toBe(midiToFrequency(60))
    expect(second?.frequency).toBe(midiToFrequency(72))
  })

  it('lands on whole notes', () => {
    expect(steps([60, 62], [0.1, 0.3, 0.9])[1]?.frequency).toBe(midiToFrequency(61))
  })

  it('plays the middle note for a flat curve', () => {
    expect(steps([60, 72], [0.5, 0.5])).toEqual([{ frequency: midiToFrequency(66), gain: 0.5 }, { frequency: midiToFrequency(66), gain: 0.5 }])
  })

  it('rests on a value of 0, and a rest does not count as the quietest note', () => {
    expect(steps([48, 72], [0.2, 0, 0.8])).toEqual([{ frequency: midiToFrequency(48), gain: 0.2 }, null, { frequency: midiToFrequency(72), gain: 0.8 }])
    expect(steps([60, 72], [0, 0])).toEqual([null, null])
  })

  it('gives the same steps for the same track every time', () => {
    expect(steps([40, 90], [0.1, 0.7, 0.3])).toEqual(steps([40, 90], [0.1, 0.7, 0.3]))
  })
})

describe('timing', () => {
  it('makes one step an eighth note, and the whole as long as its longest track', () => {
    const two = { base_bpm: 120, tracks: [{ ...track, volume_curve: [0.5, 0.5] }, { ...track, volume_curve: Array(8).fill(0.5) }] }
    const parsed = parseAudioPayload(two)!
    expect(stepSeconds(parsed)).toBe(0.25)
    expect(totalSeconds(parsed)).toBe(2)
  })
})

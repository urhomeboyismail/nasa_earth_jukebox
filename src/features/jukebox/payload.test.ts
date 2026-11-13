import { describe, expect, it } from 'vitest'
import { captionTimes, MAX_STEPS, midiToFrequency, parseAudioPayload, parseVisionPayload, stepSeconds, timbreOf, totalSeconds, trackSteps, type AudioPayload } from './payload'

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

describe('parseVisionPayload', () => {
  const description = { timestamp_sec: 1, alt_text: 'Pale water.', intensity_level: 'low' }

  it('takes a vision payload, and the whole answer of the route', () => {
    expect(parseVisionPayload({ descriptions: [description] })).toEqual({ descriptions: [description] })
    expect(parseVisionPayload({ audio: payload, vision: { descriptions: [description] } })).toEqual({ descriptions: [description] })
  })

  it.each([
    ['nothing', null],
    ['an answer with no vision', { audio: payload, vision: null }],
    ['no list', { descriptions: 'x' }],
    ['an unknown intensity', { descriptions: [{ ...description, intensity_level: 'loud' }] }],
    ['a negative time', { descriptions: [{ ...description, timestamp_sec: -1 }] }],
    ['empty text', { descriptions: [{ ...description, alt_text: '' }] }],
  ])('rejects %s', (_name, value) => {
    expect(parseVisionPayload(value)).toBeNull()
  })
})

describe('captionTimes', () => {
  // 90 bpm: a step is 1/3 s. Three steps: the last one starts at 2/3 s.
  const short: AudioPayload = { base_bpm: 90, tracks: [{ instrument: 'marimba', pitch_range: [48, 72], volume_curve: [0.2, 0.5, 0.8] }] }
  const at = (timestamp_sec: number, alt_text = 'x') => ({ timestamp_sec, alt_text, intensity_level: 'low' as const })

  it('keeps the times that fit, in time order', () => {
    const times = captionTimes({ descriptions: [at(0.5, 'b'), at(0, 'a')] }, short)
    expect(times.map(c => [c.alt_text, c.at])).toEqual([['a', 0], ['b', 0.5]])
  })

  it('scales every time by one factor when the latest is after the last step', () => {
    const times = captionTimes({ descriptions: [at(1), at(4), at(2)] }, short)
    expect(times.map(c => c.at)).toEqual([expect.closeTo(1 / 6), expect.closeTo(2 / 6), expect.closeTo(2 / 3)])
  })

  it('gives nothing for no descriptions, and is the same each time', () => {
    expect(captionTimes({ descriptions: [] }, short)).toEqual([])
    const vision = { descriptions: [at(3), at(1)] }
    expect(captionTimes(vision, short)).toEqual(captionTimes(vision, short))
  })
})

describe('timbreOf', () => {
  it.each([
    ['Bass', 'bass'],
    ['sub BASS guitar', 'bass'],
    ['Low Drone', 'bass'],
    ['Warm Pad', 'pad'],
    ['AMBIENT texture', 'pad'],
    ['marimba', 'lead'],
    ['', 'lead'],
  ])('%s is a %s', (name, timbre) => {
    expect(timbreOf(name)).toBe(timbre)
  })
})

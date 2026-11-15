import { describe, expect, it } from 'vitest'
import { PRESET_IDS, VOICE_IDS } from '../data/sonification'
import { elevationForPoint, panForPoint } from '../audio/pan'
import { toMusicFrame } from './music'
import { PRESETS, pitchClasses } from './presets'
import {
  BASS_HIGH_MIDI, BASS_LOW_MIDI, HARMONY_HIGH_MIDI, HARMONY_LOW_MIDI, HOTSPOT_LOW_MIDI, HOTSPOT_SPAN, LEVEL, MAX_HARMONY_NOTES, MAX_HOTSPOT_NOTES, MELODY_LOW_MIDI,
  MELODY_SPAN, RHYTHM_LOW_MIDI, RHYTHM_SPAN,
} from './ranges'
import { change, features, line, spot } from './testFeatures'

const major = PRESETS.major

describe('toMusicFrame: a uniform frame', () => {
  const frame = toMusicFrame(features({ position: 0.5, histogram: [0, 1, 0] }), major)

  it('puts the melody in the middle of its range, on a scale note, without a glide', () => {
    // 48 + 0.5 × 30 = 63 (D#4) is between D (62) and E (64): the tie goes down.
    expect(frame.melody).toEqual({ midi: 62, glide: false, level: LEVEL.melody })
  })

  it('has a thin chord: one note, from the band that holds the whole picture', () => {
    // Band 1 of 3 is degree round(1 × 6 / 2) = 3 of the major scale (F).
    expect(frame.harmony).toEqual({ midis: [53], level: LEVEL.harmony })
  })

  it('has the bass at its start, and nothing else', () => {
    expect(frame.bass).toEqual({ midi: BASS_LOW_MIDI, level: LEVEL.bassBase })
    expect(frame.hotspots).toEqual([])
    expect(frame.rhythm).toBeNull()
    expect(frame.motion).toBeNull()
    expect(frame.time).toEqual({ accent: 'none', pulseBpm: major.bpm, level: LEVEL.time })
  })

  it('has no missing voice, no dropout, no trend, and says so in words', () => {
    expect(frame.missing).toEqual([])
    expect(frame.dropout).toBe(false)
    expect(frame.caption.melody).toBe('Melody: middle')
    expect(frame.summary).toBe('The overall level is middle.')
    expect(frame.state).toEqual({ melodyPosition: 0.5, chordKey: '53', shift: 0 })
  })

  it('carries the frame id and the date', () => {
    expect(frame).toMatchObject({ frameId: 'f1', date: '2026-01-15' })
  })
})

describe('toMusicFrame: the melody', () => {
  it('follows the position over the whole range, always on a scale note', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      for (let position = 0; position <= 1; position += 0.05) {
        const { melody } = toMusicFrame(features({ position }), preset)
        expect(melody!.midi).toBeGreaterThanOrEqual(MELODY_LOW_MIDI)
        expect(melody!.midi).toBeLessThanOrEqual(MELODY_LOW_MIDI + MELODY_SPAN)
        expect(pitchClasses(preset).has(melody!.midi % 12)).toBe(true)
      }
    }
    expect(toMusicFrame(features({ position: 0 }), major).melody!.midi).toBe(MELODY_LOW_MIDI)
    expect(toMusicFrame(features({ position: 1 }), major).melody!.midi).toBeGreaterThan(MELODY_LOW_MIDI + MELODY_SPAN - 3)
  })

  it('rises with the position', () => {
    const low = toMusicFrame(features({ position: 0.1 }), major).melody!.midi
    const high = toMusicFrame(features({ position: 0.9 }), major).melody!.midi
    expect(high).toBeGreaterThan(low)
  })

  it('smooths towards the new position by half, and glides when the note changes', () => {
    const first = toMusicFrame(features({ position: 0.2 }), major)
    const second = toMusicFrame(features({ position: 0.6 }), major, first)
    expect(second.state.melodyPosition).toBeCloseTo(0.4, 10)
    expect(second.melody!.glide).toBe(true)
    expect(second.caption.melody).toBe('Melody: middle, rising')
    const third = toMusicFrame(features({ position: 0.4 }), major, second)
    expect(third.state.melodyPosition).toBeCloseTo(0.4, 10)
    expect(third.melody!.glide).toBe(false)
    expect(third.caption.melody).toBe('Melody: middle, steady')
  })

  it('starts again after a frame with no melody', () => {
    const gap = toMusicFrame(features({ position: null }), major, toMusicFrame(features({ position: 0.9 }), major))
    expect(gap.melody).toBeNull()
    expect(gap.state.melodyPosition).toBeNull()
    const back = toMusicFrame(features({ position: 0.2 }), major, gap)
    expect(back.state.melodyPosition).toBe(0.2)
    expect(back.melody!.glide).toBe(false)
  })
})

describe('toMusicFrame: the harmony', () => {
  it('is thick for a mixed picture: one note for each band that holds a tenth, at most four', () => {
    const mixed = toMusicFrame(features({ histogram: [0.2, 0.2, 0.2, 0.2, 0.2] }), major)
    expect(mixed.harmony!.midis).toHaveLength(MAX_HARMONY_NOTES)
    const three = toMusicFrame(features({ histogram: [0.5, 0.05, 0.3, 0.15, 0] }), major)
    expect(three.harmony!.midis).toHaveLength(3)
  })

  it('keeps every note inside the harmony range and on a scale note, sorted, once each', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      const { harmony } = toMusicFrame(features({ histogram: [0.2, 0.2, 0.2, 0.2, 0.2] }), preset)
      const notes = harmony!.midis
      expect([...notes].sort((a, b) => a - b)).toEqual(notes)
      expect(new Set(notes).size).toBe(notes.length)
      for (const note of notes) {
        expect(note).toBeGreaterThanOrEqual(HARMONY_LOW_MIDI)
        expect(note).toBeLessThanOrEqual(HARMONY_HIGH_MIDI)
        expect(pitchClasses(preset).has(note % 12)).toBe(true)
      }
    }
  })

  it('keeps the strongest bands when more than four sound', () => {
    const six = toMusicFrame(features({ histogram: [0.11, 0.11, 0.11, 0.11, 0.3, 0.26] }), major)
    expect(six.harmony!.midis).toHaveLength(MAX_HARMONY_NOTES)
  })

  it('holds the chord while the mix keeps its bands, and changes it when the mix changes', () => {
    const first = toMusicFrame(features({ histogram: [0.3, 0.7, 0] }), major)
    const same = toMusicFrame(features({ histogram: [0.35, 0.65, 0] }), major, first)
    expect(same.harmony!.midis).toEqual(first.harmony!.midis)
    expect(same.state.chordKey).toBe(first.state.chordKey)
    const changed = toMusicFrame(features({ histogram: [0.3, 0.4, 0.3] }), major, same)
    expect(changed.harmony!.midis).not.toEqual(first.harmony!.midis)
    expect(changed.harmony!.midis.length).toBeGreaterThan(first.harmony!.midis.length)
  })

  it('is null, and named missing, when no cell can be read', () => {
    const none = toMusicFrame(features({ histogram: [0, 0, 0] }), major)
    expect(none.harmony).toBeNull()
    expect(none.missing).toContain('harmony')
  })

  it('has one note for a one-band picture', () => {
    expect(toMusicFrame(features({ histogram: [1] }), major).harmony!.midis).toEqual([HARMONY_LOW_MIDI])
  })
})

describe('toMusicFrame: the bass', () => {
  it('follows the change from the baseline when there is one, and a missing shift counts as 0', () => {
    const up = toMusicFrame(features({ change: change(1, 'much-above') }), major).bass!
    expect(up.midi).toBe(41) // 36 + 5, F
    expect(up.level).toBeCloseTo(LEVEL.bassBase + LEVEL.bassRange, 10)
    const none = toMusicFrame(features({ change: change(null, 'insufficient') }), major).bass!
    expect(none).toEqual({ midi: BASS_LOW_MIDI, level: LEVEL.bassBase })
  })

  it('without a baseline, follows the distance from the first position of the run', () => {
    const rose = toMusicFrame(features({ position: 0.7, reference: 0.5 }), major).bass!
    expect(rose.midi).toBeGreaterThan(BASS_LOW_MIDI)
    expect(rose.level).toBeCloseTo(LEVEL.bassBase + LEVEL.bassRange * 0.4, 10)
    expect(toMusicFrame(features({ position: 0.5, reference: 0.5 }), major).bass!.midi).toBe(BASS_LOW_MIDI)
    // The shift is clamped to ±1.
    expect(toMusicFrame(features({ position: 1, reference: 0 }), major).state.shift).toBe(1)
  })

  it('stays in its range on a scale note, and starts on the tonic of the key', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      for (const shift of [-1, -0.5, 0, 0.5, 1]) {
        const { bass } = toMusicFrame(features({ change: change(shift) }), preset)
        expect(bass!.midi).toBeGreaterThanOrEqual(BASS_LOW_MIDI)
        expect(bass!.midi).toBeLessThanOrEqual(BASS_HIGH_MIDI)
        expect(pitchClasses(preset).has(bass!.midi % 12)).toBe(true)
      }
    }
    expect(toMusicFrame(features({ change: change(0) }), PRESETS.dorian).bass!.midi % 12).toBe(PRESETS.dorian.tonic)
  })

  it('is missing when the picture cannot be read', () => {
    const frame = toMusicFrame(features({ position: null, change: change(1) }), major)
    expect(frame.bass).toBeNull()
    expect(frame.missing).toContain('bass')
  })

  it('says whether it is rising', () => {
    const first = toMusicFrame(features({ change: change(-0.5) }), major)
    const second = toMusicFrame(features({ change: change(0.5) }), major, first)
    expect(second.caption.bass).toBe('Bass: high, rising')
    expect(first.caption.bass).toBe('Bass: low')
  })
})

describe('toMusicFrame: the hot spots', () => {
  const square = spot('h1', 'high', 23 / 64, 12 / 32, 24 / 2048, 1)
  const frame = toMusicFrame(features({ hotspots: [square] }), major)

  it('puts a hot spot where it is: pitch from the peak, pan and height from the centre, loudness from the area', () => {
    expect(frame.hotspots).toHaveLength(1)
    const [h] = frame.hotspots
    expect(h.id).toBe('h1')
    expect(h.band).toBe('high')
    expect(h.midi).toBe(HOTSPOT_LOW_MIDI + HOTSPOT_SPAN)
    expect(h.pan).toBe(panForPoint(23 / 64))
    expect(h.elevation).toBe(elevationForPoint(12 / 32))
    expect(h.level).toBeCloseTo(Math.sqrt(24 / 2048 / 0.1), 10)
  })

  it('names the sector of the largest spot in the caption', () => {
    expect(frame.caption.hotspots).toBe('Hot spots: 1, the largest is a high one in the centre')
  })

  it('goes to full level at a tenth of the map, and no further', () => {
    expect(toMusicFrame(features({ hotspots: [spot('h1', 'high', 0.5, 0.5, 0.1)] }), major).hotspots[0].level).toBe(1)
    expect(toMusicFrame(features({ hotspots: [spot('h1', 'high', 0.5, 0.5, 0.5)] }), major).hotspots[0].level).toBe(1)
  })

  it('sounds a low spot low, and keeps at most three in the order given', () => {
    const many = toMusicFrame(features({ hotspots: [spot('h1', 'low', 0.1, 0.1), spot('h2', 'high', 0.5, 0.5), spot('h3', 'high', 0.9, 0.9), spot('h4', 'low', 0.2, 0.2)] }), major)
    expect(many.hotspots.map(h => h.id)).toEqual(['h1', 'h2', 'h3'])
    expect(many.hotspots).toHaveLength(MAX_HOTSPOT_NOTES)
    expect(many.hotspots[0].midi).toBe(HOTSPOT_LOW_MIDI)
    expect(many.hotspots[0].pan).toBeLessThan(0)
    expect(many.hotspots[2].pan).toBeGreaterThan(0)
    expect(many.hotspots[0].elevation).toBeGreaterThan(many.hotspots[2].elevation)
  })

  it('is never missing: no hot spot is a quiet voice', () => {
    expect(toMusicFrame(features(), major).missing).not.toContain('hotspots')
    expect(toMusicFrame(features(), major).caption.hotspots).toBe('')
  })
})

describe('toMusicFrame: the rhythm', () => {
  const xs = Array.from({ length: 64 }, (_, i) => 0.1 + (0.8 * i) / 63)

  it('is quiet, not missing, when there is no edge line', () => {
    const frame = toMusicFrame(features({ strongest: null }), major)
    expect(frame.rhythm).toBeNull()
    expect(frame.missing).not.toContain('rhythm')
    expect(frame.caption.rhythm).toBe('')
  })

  it('plays the line as an arpeggio along it, panned to where it is', () => {
    const { rhythm } = toMusicFrame(features({ density: 0.3, strongest: line(xs) }), major)
    expect(rhythm!.perBeat).toBe(4)
    expect(rhythm!.midis.length).toBeGreaterThan(1)
    expect(rhythm!.midis.length).toBeLessThanOrEqual(4)
    expect([...rhythm!.midis].sort((a, b) => a - b)).toEqual(rhythm!.midis)
    for (const midi of rhythm!.midis) {
      expect(midi).toBeGreaterThanOrEqual(RHYTHM_LOW_MIDI)
      expect(midi).toBeLessThanOrEqual(RHYTHM_LOW_MIDI + RHYTHM_SPAN)
    }
    expect(rhythm!.pan).toBeCloseTo(0, 5) // the line runs from 0.1 to 0.9: its middle is the middle of the map
    expect(rhythm!.level).toBe(LEVEL.rhythm)
  })

  it('has more notes a beat as the picture gets busier', () => {
    const beats = [0.01, 0.1, 0.3].map(density => toMusicFrame(features({ density, strongest: line(xs) }), major).rhythm!.perBeat)
    expect(beats).toEqual([1, 2, 4])
    expect(toMusicFrame(features({ density: 0.05, strongest: line(xs) }), major).rhythm!.perBeat).toBe(2)
    expect(toMusicFrame(features({ density: 0.2, strongest: line(xs) }), major).rhythm!.perBeat).toBe(4)
  })

  it('pans a line in the east to the right', () => {
    expect(toMusicFrame(features({ strongest: line([0.8, 0.85, 0.9, 0.95]) }), major).rhythm!.pan).toBeGreaterThan(0.5)
  })
})

describe('toMusicFrame: the motion', () => {
  it('is quiet when there is no motion measured', () => {
    const frame = toMusicFrame(features({ motion: null }), major)
    expect(frame.motion).toBeNull()
    expect(frame.missing).not.toContain('motion')
  })

  it('opens with speed and sweeps with the direction, east to the right', () => {
    const slow = toMusicFrame(features({ motion: { dx: 0.5, dy: 0, speed: 0.5 } }), major).motion!
    const fast = toMusicFrame(features({ motion: { dx: 2, dy: 0, speed: 2 } }), major).motion!
    expect(fast.openness).toBe(1)
    expect(slow.openness).toBeCloseTo(0.25, 10)
    expect(fast.sweep).toBe(1)
    expect(slow.sweep).toBeCloseTo(0.25, 10)
    expect(fast.level).toBeGreaterThan(slow.level)
    expect(toMusicFrame(features({ motion: { dx: -4, dy: 0, speed: 4 } }), major).motion).toMatchObject({ openness: 1, sweep: -1 })
  })

  it('is closed and centred, but still there, when the picture is still', () => {
    expect(toMusicFrame(features({ motion: { dx: 0, dy: 0, speed: 0 } }), major).motion).toEqual({ openness: 0, sweep: 0, level: LEVEL.motionBase })
  })
})

describe('toMusicFrame: the time voice', () => {
  const at = (date: string, prev?: ReturnType<typeof toMusicFrame>) => toMusicFrame(features({ date }), major, prev)

  it('has no accent on the first frame, and a month or year accent when the date turns over', () => {
    const jan = at('2026-01-15')
    expect(jan.time.accent).toBe('none')
    expect(at('2026-01-25', jan).time.accent).toBe('none')
    expect(at('2026-02-15', jan).time.accent).toBe('month')
    expect(at('2027-01-15', jan).time.accent).toBe('year')
    expect(at('2027-03-15', jan).time.accent).toBe('year')
  })

  it('has a decade accent when the decade turns over, before the year accent (SN16)', () => {
    expect(at('1980-07-01', at('1975-07-01')).time.accent).toBe('decade')
    expect(at('1985-07-01', at('1980-07-01')).time.accent).toBe('year')
    expect(at('2030-01-15', at('2029-12-15')).time.accent).toBe('decade')
    expect(at('2029-12-15', at('2029-11-15')).time.accent).toBe('month')
  })

  it('keeps the pulse even when nothing else can be read', () => {
    const frame = toMusicFrame(features({ position: null }), major)
    expect(frame.time).toEqual({ accent: 'none', pulseBpm: major.bpm, level: LEVEL.time })
    expect(frame.caption.time).not.toBe('')
  })

  it('follows the tempo of the preset', () => {
    for (const id of PRESET_IDS) expect(toMusicFrame(features(), PRESETS[id]).time.pulseBpm).toBe(PRESETS[id].bpm)
  })
})

describe('toMusicFrame: a dropout', () => {
  const rich = features({ position: null, histogram: [0.1, 0.8, 0.1], hotspots: [spot('h1', 'high', 0.5, 0.5)], density: 0.3, strongest: line([0.2, 0.4, 0.6, 0.8]), motion: { dx: 1, dy: 0, speed: 1 } })
  const frame = toMusicFrame(rich, major)

  it('is flagged, and names the voices with no data', () => {
    expect(frame.dropout).toBe(true)
    expect(frame.missing).toEqual(['melody', 'harmony', 'bass'])
  })

  it('leaves only the time pulse sounding', () => {
    expect(frame.melody).toBeNull()
    expect(frame.harmony).toBeNull()
    expect(frame.bass).toBeNull()
    expect(frame.hotspots).toEqual([])
    expect(frame.rhythm).toBeNull()
    expect(frame.motion).toBeNull()
    expect(frame.time.level).toBeGreaterThan(0)
  })

  it('says so in words', () => {
    expect(frame.summary).toBe('Not enough readable data on this date: only the time pulse sounds.')
    expect(frame.caption.melody).toBe('Melody: not enough data')
    expect(frame.caption.hotspots).toBe('')
  })

  it('is exactly the frames with no median', () => {
    expect(toMusicFrame(features({ position: 0 }), major).dropout).toBe(false)
    expect(toMusicFrame(features({ position: null }), major).dropout).toBe(true)
  })
})

describe('toMusicFrame: a first frame', () => {
  it('has no glide, no accent and no trend', () => {
    const frame = toMusicFrame(features({ position: 0.8, change: change(0.5) }), major)
    expect(frame.melody!.glide).toBe(false)
    expect(frame.time.accent).toBe('none')
    expect(frame.caption.melody).toBe('Melody: high')
    expect(frame.caption.bass).not.toMatch(/rising|falling|steady/)
  })

  it('treats a missing previous frame like none', () => {
    const f = features({ position: 0.3 })
    expect(toMusicFrame(f, major, null)).toEqual(toMusicFrame(f, major, undefined))
  })
})

describe('toMusicFrame: it is a function of its input', () => {
  const run = () => {
    let prev = toMusicFrame(features({ date: '2026-01-15', position: 0.2, hotspots: [spot('h1', 'high', 0.3, 0.3)] }), PRESETS.dorian)
    prev = toMusicFrame(features({ date: '2026-02-15', position: 0.7, density: 0.1, strongest: line([0.2, 0.4, 0.6, 0.8]), motion: { dx: 1, dy: 1, speed: 1.4 } }), PRESETS.dorian, prev)
    return toMusicFrame(features({ date: '2027-01-15', position: null }), PRESETS.dorian, prev)
  }

  it('gives equal output for equal input', () => {
    expect(run()).toEqual(run())
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })

  it('does not change the features or the previous frame it is given', () => {
    const input = features({ position: 0.6, hotspots: [spot('h1', 'high', 0.5, 0.5)], density: 0.3, strongest: line([0.2, 0.4, 0.6, 0.8]) })
    const prev = toMusicFrame(features({ position: 0.4 }), major)
    const before = JSON.stringify([input, prev])
    toMusicFrame(input, major, prev)
    toMusicFrame(input, major, prev)
    expect(JSON.stringify([input, prev])).toBe(before)
  })

  it('has a caption for every voice, in the order the captions list them', () => {
    expect(Object.keys(toMusicFrame(features(), major).caption)).toEqual([...VOICE_IDS])
  })

  it('does not share notes between frames: changing one frame\'s chord leaves the previous alone', () => {
    const first = toMusicFrame(features({ histogram: [0.3, 0.7, 0] }), major)
    const second = toMusicFrame(features({ histogram: [0.3, 0.7, 0] }), major, first)
    second.harmony!.midis.push(99)
    expect(first.harmony!.midis).not.toContain(99)
  })
})

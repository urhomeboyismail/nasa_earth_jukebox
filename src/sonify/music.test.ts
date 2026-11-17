import { describe, expect, it } from 'vitest'
import { PRESET_IDS, VOICE_IDS } from '../data/sonification'
import { elevationForPoint, panForPoint } from '../audio/pan'
import { isSpaced, toMusicFrame, voiceChord } from './music'
import { PRESETS, chordOn, pitchClasses } from './presets'
import {
  BASS_HIGH_MIDI, BASS_LOW_MIDI, CHORD_ROOT_DEGREES, HARMONY_HIGH_MIDI, HARMONY_LOW_MIDI, HOTSPOT_LOW_MIDI, HOTSPOT_SPAN, LEVEL, MAX_HARMONY_NOTES, MAX_HOTSPOT_NOTES,
  MELODY_LOW_MIDI, MELODY_SPAN, MIN_CHORD_GAP, RHYTHM_LOW_MIDI, RHYTHM_SPAN, TRIAD_NOTES,
} from './ranges'
import { change, features, line, spot } from './testFeatures'
import type { MusicFrame } from './types'

const major = PRESETS.major

/** Histograms of 1 to 8 bands from a fixed sequence (no randomness), shares adding up to 1, some bands empty. */
function histogramSweep(): number[][] {
  let seed = 7
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const out: number[][] = []
  for (const bands of [1, 2, 3, 4, 5, 6, 8]) {
    for (let i = 0; i < 40; i++) {
      const raw = Array.from({ length: bands }, () => (next() < 0.3 ? 0 : next()))
      const total = raw.reduce((sum, share) => sum + share, 0)
      out.push(total > 0 ? raw.map(share => share / total) : raw.map((_, band) => (band === 0 ? 1 : 0)))
    }
  }
  return out
}

describe('the registers', () => {
  it('stack the voices low to high: bass, harmony, melody, arpeggio, hot spots, each starting above the one before and ending no lower', () => {
    const ranges = [
      [BASS_LOW_MIDI, BASS_HIGH_MIDI], [HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI], [MELODY_LOW_MIDI, MELODY_LOW_MIDI + MELODY_SPAN],
      [RHYTHM_LOW_MIDI, RHYTHM_LOW_MIDI + RHYTHM_SPAN], [HOTSPOT_LOW_MIDI, HOTSPOT_LOW_MIDI + HOTSPOT_SPAN],
    ]
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][0])
      expect(ranges[i][1]).toBeGreaterThanOrEqual(ranges[i - 1][1])
    }
  })

  it('keeps the bass below the chord, and the arpeggio and hot spots above it; the chord reaches at most a fifth into the melody', () => {
    expect(BASS_HIGH_MIDI).toBeLessThanOrEqual(HARMONY_LOW_MIDI)
    expect(RHYTHM_LOW_MIDI).toBeGreaterThan(HARMONY_HIGH_MIDI)
    expect(HOTSPOT_LOW_MIDI).toBeGreaterThanOrEqual(RHYTHM_LOW_MIDI + RHYTHM_SPAN)
    expect(HARMONY_HIGH_MIDI - MELODY_LOW_MIDI).toBeLessThanOrEqual(7)
  })
})

describe('toMusicFrame: a uniform frame', () => {
  const frame = toMusicFrame(features({ position: 0.5, histogram: [0, 1, 0] }), major)

  it('puts the melody in the middle of its range, on a scale note, without a glide', () => {
    // 60 + 0.5 × 24 = 72 (C5).
    expect(frame.melody).toEqual({ midi: 72, glide: false, level: LEVEL.melody })
  })

  it('plays a triad in root position on the root the mean band picks', () => {
    // The mean band is the middle (0.5), the third of the major roots I, vi, IV, V: F major, F3–A3–C4.
    expect(frame.harmony).toEqual({ midis: [53, 57, 60], level: LEVEL.harmony })
  })

  it('has the bass on the chord root, and nothing else', () => {
    expect(frame.bass).toEqual({ midi: 41, level: LEVEL.bassBase }) // F2
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
    expect(frame.state).toEqual({ melodyPosition: 0.5, chordKey: '3:3', shift: 0 })
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
  const C_MAJOR = [48, 52, 55] // C3 E3 G3

  it('builds every chord in thirds from the scale: a triad or a seventh, inside the harmony range, sorted, once each', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      for (const histogram of histogramSweep()) {
        const notes = toMusicFrame(features({ histogram }), preset).harmony!.midis
        expect([TRIAD_NOTES, MAX_HARMONY_NOTES]).toContain(notes.length)
        expect([...notes].sort((a, b) => a - b)).toEqual(notes)
        expect(new Set(notes).size).toBe(notes.length)
        for (const note of notes) {
          expect(note).toBeGreaterThanOrEqual(HARMONY_LOW_MIDI)
          expect(note).toBeLessThanOrEqual(HARMONY_HIGH_MIDI)
          expect(pitchClasses(preset).has(note % 12)).toBe(true)
        }
        // The notes are the chord on one of the preset's roots, in thirds.
        const classes = new Set(notes.map(note => note % 12))
        const built = CHORD_ROOT_DEGREES[preset.scale].some(root => [TRIAD_NOTES, MAX_HARMONY_NOTES].some(size => {
          const chord = chordOn(root, size, preset)
          return chord.length === classes.size && chord.every(pc => classes.has(pc))
        }))
        expect(built, `${id} ${histogram.join(',')}`).toBe(true)
      }
    }
  })

  it('never plays a cluster: no two notes a semitone or a whole tone apart, over every preset and a sweep of histograms, frame after frame', () => {
    expect(MIN_CHORD_GAP).toBeGreaterThan(2)
    for (const id of PRESET_IDS) {
      let prev: MusicFrame | undefined
      for (const histogram of histogramSweep()) {
        prev = toMusicFrame(features({ histogram }), PRESETS[id], prev)
        const notes = prev.harmony!.midis
        for (let i = 1; i < notes.length; i++) expect(notes[i] - notes[i - 1], `${id} ${notes.join(',')}`).toBeGreaterThanOrEqual(MIN_CHORD_GAP)
      }
    }
  })

  it('has a spaced triad on every chord root of every preset, whatever chord came before', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      const roots = CHORD_ROOT_DEGREES[preset.scale]
      for (const root of roots) {
        const first = voiceChord(chordOn(root, TRIAD_NOTES, preset), HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI, null)
        expect(isSpaced(first), `${id} ${root}`).toBe(true)
        for (const before of roots) {
          const prev = voiceChord(chordOn(before, TRIAD_NOTES, preset), HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI, null)
          expect(isSpaced(voiceChord(chordOn(root, TRIAD_NOTES, preset), HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI, prev)), `${id} ${before} to ${root}`).toBe(true)
        }
      }
    }
  })

  it('picks the root from the mean band: low values I, then vi, IV, and V for high values (major)', () => {
    const chordFor = (histogram: number[]) => toMusicFrame(features({ histogram }), major).harmony!.midis
    expect(chordFor([1, 0, 0, 0, 0])).toEqual(C_MAJOR)
    expect(chordFor([0, 1, 0, 0, 0])).toEqual([57, 60, 64]) // A minor, A3 C4 E4
    expect(chordFor([0, 0, 1, 0, 0])).toEqual([53, 57, 60]) // F major
    expect(chordFor([0, 0, 0, 0, 1])).toEqual([55, 59, 62]) // G major
  })

  it('is a seventh when the heard bands are spread wide, a triad when they are close, and a triad for one band', () => {
    // Half at each end: the mean is the middle (F), the spread half the band range: F major seventh, F3 A3 C4 E4.
    expect(toMusicFrame(features({ histogram: [0.5, 0, 0, 0, 0.5] }), major).harmony!.midis).toEqual([53, 57, 60, 64])
    expect(toMusicFrame(features({ histogram: [0, 0.5, 0.5, 0, 0] }), major).harmony!.midis).toHaveLength(TRIAD_NOTES)
    // A band under a tenth does not widen the chord.
    expect(toMusicFrame(features({ histogram: [0.05, 0, 0.95, 0, 0] }), major).harmony!.midis).toHaveLength(TRIAD_NOTES)
    expect(toMusicFrame(features({ histogram: [1] }), major).harmony!.midis).toEqual(C_MAJOR)
  })

  it('plays a seventh that cannot be spaced inside the range as its triad', () => {
    // Lo-fi is F major: its IV seventh, B♭ D F A, has no voicing between C3 and G4 without a second.
    const { harmony, state } = toMusicFrame(features({ histogram: [0.5, 0, 0, 0, 0.5] }), PRESETS.lofi)
    expect(state.chordKey).toBe('3:4')
    expect(harmony!.midis).toHaveLength(TRIAD_NOTES)
    expect(new Set(harmony!.midis.map(note => note % 12))).toEqual(new Set(chordOn(3, TRIAD_NOTES, PRESETS.lofi)))
    expect(isSpaced(harmony!.midis)).toBe(true)
  })

  it('gives the same chord for the same histogram, and holds it when the histogram only changes in level', () => {
    const first = toMusicFrame(features({ histogram: [0.2, 0.6, 0.2] }), major)
    expect(toMusicFrame(features({ histogram: [0.2, 0.6, 0.2] }), major).harmony).toEqual(first.harmony)
    const quieter = toMusicFrame(features({ histogram: [0.1, 0.3, 0.1] }), major, first)
    expect(quieter.state.chordKey).toBe(first.state.chordKey)
    expect(quieter.harmony!.midis).toEqual(first.harmony!.midis)
  })

  it('moves to the next chord by the smallest step: C major to F major is C–F–A, not F–A–C', () => {
    const c = toMusicFrame(features({ histogram: [1, 0, 0, 0, 0] }), major)
    const f = toMusicFrame(features({ histogram: [0, 0, 1, 0, 0] }), major, c)
    expect(c.harmony!.midis).toEqual(C_MAJOR)
    expect(f.harmony!.midis).toEqual([48, 53, 57])
    expect(f.state.chordKey).not.toBe(c.state.chordKey)
  })

  it('is null, and named missing, when no cell can be read', () => {
    const none = toMusicFrame(features({ histogram: [0, 0, 0] }), major)
    expect(none.harmony).toBeNull()
    expect(none.missing).toContain('harmony')
  })
})

describe('voiceChord', () => {
  const F_MAJOR = chordOn(3, TRIAD_NOTES, major)
  const voice = (classes: number[], prev: number[] | null) => voiceChord(classes, HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI, prev)

  it('puts a first chord in root position, as low as it fits', () => {
    expect(voice(F_MAJOR, null)).toEqual([53, 57, 60])
    expect(voice(chordOn(0, TRIAD_NOTES, PRESETS.pentatonic), null)).toEqual([57, 62, 67]) // A D G, a stack of fourths
  })

  it('chooses the voicing that moves least, notes paired in sorted order', () => {
    expect(voice(F_MAJOR, [48, 52, 55])).toEqual([48, 53, 57]) // C E G to C F A: 0 + 1 + 2
  })

  it('gives a tie to the lower voicing', () => {
    // From F3 A3 C4, both D3 G3 B3 and G3 B3 D4 move six semitones in all.
    expect(voice(chordOn(4, TRIAD_NOTES, major), [53, 57, 60])).toEqual([50, 55, 59])
  })

  it('moves least between chords of different sizes too', () => {
    // C E G to F A C E: C and E stay, G steps up to A, and F goes on top (each note to the other chord's nearest).
    expect(voice(chordOn(3, MAX_HARMONY_NOTES, major), [48, 52, 55])).toEqual([48, 52, 57, 65])
  })
})

describe('toMusicFrame: the bass', () => {
  // One band at the bottom: the chord is the tonic's, so the bass rests on the tonic.
  const tonic = [1, 0, 0]

  it('follows the change from the baseline when there is one, and a missing shift counts as 0', () => {
    const up = toMusicFrame(features({ histogram: tonic, change: change(1, 'much-above') }), major).bass!
    expect(up.midi).toBe(41) // 36 + 5, F
    expect(up.level).toBeCloseTo(LEVEL.bassBase + LEVEL.bassRange, 10)
    const none = toMusicFrame(features({ histogram: tonic, change: change(null, 'insufficient') }), major).bass!
    expect(none).toEqual({ midi: BASS_LOW_MIDI, level: LEVEL.bassBase })
  })

  it('without a baseline, follows the distance from the first position of the run', () => {
    const rose = toMusicFrame(features({ histogram: tonic, position: 0.7, reference: 0.5 }), major).bass!
    expect(rose.midi).toBeGreaterThan(BASS_LOW_MIDI)
    expect(rose.level).toBeCloseTo(LEVEL.bassBase + LEVEL.bassRange * 0.4, 10)
    expect(toMusicFrame(features({ histogram: tonic, position: 0.5, reference: 0.5 }), major).bass!.midi).toBe(BASS_LOW_MIDI)
    // The shift is clamped to ±1.
    expect(toMusicFrame(features({ position: 1, reference: 0 }), major).state.shift).toBe(1)
  })

  it('stays in its range on a scale note, and rests on the root of the chord', () => {
    for (const id of PRESET_IDS) {
      const preset = PRESETS[id]
      for (const shift of [-1, -0.5, 0, 0.5, 1]) {
        const { bass } = toMusicFrame(features({ change: change(shift) }), preset)
        expect(bass!.midi).toBeGreaterThanOrEqual(BASS_LOW_MIDI)
        expect(bass!.midi).toBeLessThanOrEqual(BASS_HIGH_MIDI)
        expect(pitchClasses(preset).has(bass!.midi % 12)).toBe(true)
      }
      for (const histogram of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) {
        const frame = toMusicFrame(features({ histogram, change: change(0) }), preset)
        const root = CHORD_ROOT_DEGREES[preset.scale][histogram.indexOf(1)]
        expect(frame.bass!.midi % 12, `${id} ${histogram.join(',')}`).toBe(chordOn(root, 1, preset)[0])
      }
    }
    expect(toMusicFrame(features({ histogram: tonic, change: change(0) }), PRESETS.dorian).bass!.midi % 12).toBe(PRESETS.dorian.tonic)
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

  it('plays only tones of the chord under it, over every preset and a sweep of histograms', () => {
    for (const id of PRESET_IDS) {
      for (const histogram of histogramSweep()) {
        const frame = toMusicFrame(features({ histogram, density: 0.3, strongest: line(xs) }), PRESETS[id])
        const chord = new Set(frame.harmony!.midis.map(note => note % 12))
        for (const midi of frame.rhythm!.midis) expect(chord.has(midi % 12), `${id} ${midi}`).toBe(true)
      }
    }
    // The default histogram gives F major (F A C): the line from 0.1 to 0.9 across the map climbs through its tones from C5 to C6.
    expect(toMusicFrame(features({ density: 0.3, strongest: line(xs) }), major).rhythm!.midis).toEqual([72, 77, 81, 84])
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

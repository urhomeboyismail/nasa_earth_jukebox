// The proof that art mode leaves the data mapping alone (ticket IX12): the same features give the same drivers with any art preset, and the ruleset reads
// nothing from a preset but the key, the scale, the tempo and the brightness.

import { describe, expect, it } from 'vitest'
import { toMusicFrame, PRESETS } from '../../sonify'
import type { MusicFrame, Preset } from '../../sonify/types'
import { change, features, line, spot } from '../../sonify/testFeatures'
import { ART_FIELDS, applyChoice } from './presets'

const busy = () => features({
  position: 0.7,
  histogram: [0.2, 0.5, 0.3],
  hotspots: [spot('a', 'high', 0.3, 0.4, 0.05, 0.9), spot('b', 'low', 0.7, 0.6, 0.02, 0.1)],
  density: 0.5,
  strongest: line([0.1, 0.5, 0.9]),
  motion: { dx: 1, dy: 0, speed: 0.4 },
  change: change(0.3),
})

const quiet = () => features({ position: null })

/** What the data decides, with the pitches (which the key and scale decide) taken out: how many notes, how loud, where, and which voices are silent. */
function drivers(music: MusicFrame) {
  return {
    melody: music.melody && { level: music.melody.level, glide: music.melody.glide },
    harmony: music.harmony && { notes: music.harmony.midis.length, level: music.harmony.level },
    bass: music.bass && { level: music.bass.level },
    hotspots: music.hotspots.map(({ id, band, pan, elevation, level }) => ({ id, band, pan, elevation, level })),
    rhythm: music.rhythm && { notes: music.rhythm.midis.length, perBeat: music.rhythm.perBeat, pan: music.rhythm.pan, level: music.rhythm.level },
    motion: music.motion,
    time: { accent: music.time.accent, level: music.time.level },
    missing: music.missing,
    dropout: music.dropout,
    summary: music.summary,
  }
}

const artA = applyChoice(PRESETS.major, { tonic: 0, scale: 'major', bpm: 84, brightness: 0.5 })
const artB = applyChoice(PRESETS.major, { tonic: 7, scale: 'minorPentatonic', bpm: 112, brightness: 0.95 })
const artC = applyChoice(PRESETS.dorian, { tonic: 10, scale: 'dorian', bpm: 61, brightness: 0 })

describe('art mode does not change the data mapping', () => {
  it.each([['a busy frame', busy], ['a frame with no data', quiet]])('gives the same drivers with any preset for %s', (_name, make) => {
    const a = drivers(toMusicFrame(make(), artA))
    expect(drivers(toMusicFrame(make(), artB))).toEqual(a)
    expect(drivers(toMusicFrame(make(), artC))).toEqual(a)
  })

  it('keeps the drivers through a run of frames, where each carries the last one\'s state', () => {
    const run = (preset: Preset) => {
      let previous: MusicFrame | null = null
      return [0.1, 0.5, 0.9, 0.4].map(position => {
        previous = toMusicFrame(features({ position, histogram: [0.3, 0.3, 0.4] }), preset, previous)
        return drivers(previous)
      })
    }
    expect(run(artB)).toEqual(run(artA))
  })

  it('does change what the listener chose: the pitches follow the key and scale, and the pulse follows the tempo', () => {
    const a = toMusicFrame(busy(), artA)
    const b = toMusicFrame(busy(), artB)
    expect(a.time.pulseBpm).toBe(84)
    expect(b.time.pulseBpm).toBe(112)
    expect(b.hotspots.map(h => h.midi)).not.toEqual(a.hotspots.map(h => h.midi))
  })

  it('reads only the key, the scale, the tempo and the brightness from a preset', () => {
    const read = new Set<string>()
    const watched = new Proxy({ ...artA }, {
      get(target, property, receiver) {
        if (typeof property === 'string') read.add(property)
        return Reflect.get(target, property, receiver)
      },
    })
    toMusicFrame(busy(), watched)
    toMusicFrame(quiet(), watched)
    expect(read.size).toBeGreaterThan(0)
    expect([...read].filter(field => !(ART_FIELDS as readonly string[]).includes(field))).toEqual([])
  })
})

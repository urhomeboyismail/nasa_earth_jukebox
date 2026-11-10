import { describe, expect, it } from 'vitest'
import { VOICE_IDS } from '../../data/sonification'
import { toMusicFrame } from '../../sonify/music'
import { PRESETS } from '../../sonify/presets'
import { features, line, spot } from '../../sonify/testFeatures'
import type { MusicFrame, VoiceId } from '../../sonify/types'
import { MAX_HOTSPOT_VOICES } from './constants'
import { midiToHz, planFrame } from './plan'

const major = PRESETS.major
const NO_MIX = { solo: null, muted: new Set<VoiceId>() }

/** A frame in which every voice has something to play. */
const rich: MusicFrame = toMusicFrame(features({
  position: 0.6,
  hotspots: [spot('h1', 'high', 0.2, 0.3, 0.05), spot('h2', 'low', 0.8, 0.7, 0.02)],
  density: 0.3,
  strongest: line([0.2, 0.4, 0.6, 0.8]),
  motion: { dx: 1, dy: 0, speed: 1 },
  histogram: [0.2, 0.3, 0.5],
}), major)

const sounding = (actions: ReturnType<typeof planFrame>) => actions.filter(a => a.sounding).map(a => (a.voice === 'hotspots' ? `hotspots${a.slot}` : a.voice))

describe('planFrame: the shape of the plan', () => {
  const plan = planFrame(rich, 'full', NO_MIX)

  it('has one action for each voice slot, in the order of the voices, with the hot-spot slots in place of the hot-spot voice', () => {
    expect(plan.map(a => a.voice)).toEqual(['melody', 'harmony', 'bass', 'hotspots', 'hotspots', 'hotspots', 'rhythm', 'motion', 'time'])
    expect(plan.filter(a => a.voice === 'hotspots').map(a => a.slot)).toEqual([0, 1, 2])
    expect(new Set(plan.map(a => a.voice))).toEqual(new Set(VOICE_IDS))
  })

  it('sounds every voice that has something to play at full detail', () => {
    expect(sounding(plan)).toEqual(['melody', 'harmony', 'bass', 'hotspots0', 'hotspots1', 'rhythm', 'motion', 'time'])
  })

  it('copies the notes, levels, places and ids from the frame', () => {
    const melody = plan[0]
    expect(melody).toMatchObject({ midis: [rich.melody!.midi], level: rich.melody!.level, glide: false })
    expect(plan[1].midis).toEqual(rich.harmony!.midis)
    expect(plan[3]).toMatchObject({ id: 'h1', midis: [rich.hotspots[0].midi], pan: rich.hotspots[0].pan, elevation: rich.hotspots[0].elevation })
    expect(plan[6]).toMatchObject({ midis: rich.rhythm!.midis, perBeat: 4, pan: rich.rhythm!.pan })
    expect(plan[7]).toMatchObject({ pan: rich.motion!.sweep, brightness: rich.motion!.openness })
    expect(plan[8]).toMatchObject({ accent: 'none', pulseBpm: major.bpm })
  })

  it('keeps every level between 0 and 1, and a silent voice at 0', () => {
    for (const a of plan) {
      expect(a.level).toBeGreaterThanOrEqual(0)
      expect(a.level).toBeLessThanOrEqual(1)
      if (!a.sounding) expect(a.level).toBe(0)
    }
  })

  it('does not change the frame, and gives the same plan every time', () => {
    const before = JSON.stringify(rich)
    expect(planFrame(rich, 'full', NO_MIX)).toEqual(plan)
    expect(JSON.stringify(rich)).toBe(before)
  })
})

describe('planFrame: detail, solo and mute', () => {
  it('never plans the bass, hot spots, rhythm or motion at calm', () => {
    const plan = planFrame(rich, 'calm', NO_MIX)
    expect(sounding(plan)).toEqual(['melody', 'harmony', 'time'])
    for (const a of plan.filter(x => ['bass', 'hotspots', 'rhythm', 'motion'].includes(x.voice))) expect(a.sounding).toBe(false)
  })

  it('adds the bass and the hot spots at standard', () => {
    expect(sounding(planFrame(rich, 'standard', NO_MIX))).toEqual(['melody', 'harmony', 'bass', 'hotspots0', 'hotspots1', 'time'])
  })

  it('leaves one voice sounding when it is soloed', () => {
    expect(sounding(planFrame(rich, 'full', { ...NO_MIX, solo: 'melody' }))).toEqual(['melody'])
    expect(sounding(planFrame(rich, 'full', { ...NO_MIX, solo: 'hotspots' }))).toEqual(['hotspots0', 'hotspots1'])
  })

  it('applies the detail level before the solo: a soloed voice outside the level stays silent', () => {
    expect(sounding(planFrame(rich, 'calm', { ...NO_MIX, solo: 'bass' }))).toEqual([])
  })

  it('silences a muted voice and leaves the others', () => {
    expect(sounding(planFrame(rich, 'full', { ...NO_MIX, muted: new Set<VoiceId>(['harmony', 'time']) }))).toEqual(['melody', 'bass', 'hotspots0', 'hotspots1', 'rhythm', 'motion'])
  })
})

describe('planFrame: voices with nothing to play', () => {
  it('is silent for a voice that is missing or null in the frame, and plans no notes for it', () => {
    const dropout = toMusicFrame(features({ position: null }), major)
    const plan = planFrame(dropout, 'full', NO_MIX)
    expect(sounding(plan)).toEqual(['time'])
    for (const a of plan.filter(x => x.voice !== 'time')) expect(a.midis).toEqual([])
  })

  it('does not trigger a quiet rhythm or motion', () => {
    const plain = toMusicFrame(features(), major)
    expect(sounding(planFrame(plain, 'full', NO_MIX))).toEqual(['melody', 'harmony', 'bass', 'time'])
  })
})

describe('planFrame: the hot-spot slots', () => {
  it('are in the order of the spots and at most three', () => {
    const many = toMusicFrame(features({ hotspots: [1, 2, 3].map(n => spot(`h${n}`, 'high', n / 4, 0.5)) }), major)
    const slots = planFrame(many, 'full', NO_MIX).filter(a => a.voice === 'hotspots')
    expect(slots.map(a => a.id)).toEqual(['h1', 'h2', 'h3'])
    expect(slots).toHaveLength(MAX_HOTSPOT_VOICES)
  })

  it('leaves a slot silent when there are fewer spots, and takes the brightness from the mix', () => {
    const one = toMusicFrame(features({ hotspots: [spot('h1', 'high', 0.5, 0.5)] }), major)
    const slots = planFrame(one, 'full', { ...NO_MIX, brightness: 0.9 }).filter(a => a.voice === 'hotspots')
    expect(slots.map(a => a.sounding)).toEqual([true, false, false])
    expect(slots[0].brightness).toBe(0.9)
    expect(planFrame(one, 'full', NO_MIX).find(a => a.voice === 'hotspots')!.brightness).toBe(0.5)
  })
})

describe('midiToHz', () => {
  it('puts A4 at 440 Hz and an octave at double', () => {
    expect(midiToHz(69)).toBe(440)
    expect(midiToHz(81)).toBeCloseTo(880, 10)
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3)
  })
})

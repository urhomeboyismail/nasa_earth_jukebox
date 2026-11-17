// The three artistic presets (docs/PLAN.md §6.3, ticket SN03): the key, the scale and the tempo. A preset is a choice of taste, the same for every
// frame of every data set; it never carries data. A manifest only names one (`sonification.preset`).

import type { PresetId } from '../data/sonification'
import type { Preset, ScaleName } from './types'

export const SCALES: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
}

export const PRESETS: Record<PresetId, Preset> = {
  major: {
    id: 'major', label: 'Major', tonic: 0, scale: 'major', bpm: 84, brightness: 0.5,
    note: 'A bright, open key. The choice is artistic: it is the same for every frame and never carries data.',
  },
  dorian: {
    id: 'dorian', label: 'Dorian', tonic: 2, scale: 'dorian', bpm: 72, brightness: 0.4,
    note: 'A calm key with a slightly darker colour. The choice is artistic: it is the same for every frame and never carries data.',
  },
  pentatonic: {
    id: 'pentatonic', label: 'Pentatonic', tonic: 9, scale: 'minorPentatonic', bpm: 100, brightness: 0.7,
    note: 'Five notes with no clashing intervals, so every combination sounds consonant. The choice is artistic: it never carries data.',
  },
  // The music styles (docs/planning/UIUX-BLUEPRINT.md §1.3). shortcut: starting values, to be tuned by a listening check.
  cinematic: {
    id: 'cinematic', label: 'Cinematic orchestral', tonic: 2, scale: 'dorian', bpm: 72, brightness: 0.4,
    kit: { melody: 'sawtooth', bass: 'triangle', rhythm: 'sine' }, sound: 'Strings and brass, slow and wide.',
    note: 'A music style. The choice is artistic: it changes the instruments and never carries data.',
  },
  chiptune: {
    id: 'chiptune', label: '8-bit arcade', tonic: 0, scale: 'major', bpm: 120, brightness: 0.8,
    kit: { melody: 'square', bass: 'triangle', rhythm: 'square' }, sound: 'Bright chip sounds, like an old game.',
    note: 'A music style. The choice is artistic: it changes the instruments and never carries data.',
  },
  lofi: {
    id: 'lofi', label: 'Lo-fi ambient', tonic: 5, scale: 'major', bpm: 76, brightness: 0.3,
    kit: { melody: 'sine', bass: 'sine', rhythm: 'triangle' }, sound: 'Soft keys and a slow beat.',
    note: 'A music style. The choice is artistic: it changes the instruments and never carries data.',
  },
  bass: {
    id: 'bass', label: 'Heavy bass electronic', tonic: 9, scale: 'minorPentatonic', bpm: 110, brightness: 0.6,
    kit: { melody: 'sawtooth', bass: 'sawtooth', rhythm: 'square' }, sound: 'Deep bass and a steady electronic pulse.',
    note: 'A music style. The choice is artistic: it changes the instruments and never carries data.',
  },
  nature: {
    id: 'nature', label: 'Organic nature', tonic: 7, scale: 'minorPentatonic', bpm: 64, brightness: 0.5,
    kit: { melody: 'triangle', bass: 'sine', rhythm: 'sine' }, sound: 'Wood, water and gentle percussion.',
    note: 'A music style. The choice is artistic: it changes the instruments and never carries data.',
  },
}

export function presetFor(id: PresetId): Preset {
  return PRESETS[id]
}

/** The pitch classes (0 to 11) of the preset's scale. */
export function pitchClasses(preset: Preset): Set<number> {
  return new Set(SCALES[preset.scale].map(interval => (preset.tonic + interval) % 12))
}

/**
 * The pitch classes of the chord built in thirds on scale degree `rootDegree`: degrees root, root+2, root+4 (and root+6 for a seventh), counted
 * round the scale, root first. On a 7-note scale these are the ordinary triads and sevenths; on the 5-note pentatonic, open stacks (A–D–G).
 */
export function chordOn(rootDegree: number, size: number, preset: Preset): number[] {
  const scale = SCALES[preset.scale]
  return Array.from({ length: size }, (_, i) => (preset.tonic + scale[(rootDegree + 2 * i) % scale.length]) % 12)
}

/**
 * The note of the preset's scale nearest to `midi`, inside [low, high] (both included). `midi` may be fractional; one outside the range is
 * first moved to its nearest end. A tie goes down. If the range holds no note of the scale, the nearest whole note in range is returned.
 */
export function snapToScale(midi: number, preset: Preset, low: number, high: number): number {
  return snapToClasses(midi, pitchClasses(preset), low, high)
}

/** Like `snapToScale`, but onto any set of pitch classes (0 to 11), for example a chord's. */
export function snapToClasses(midi: number, classes: ReadonlySet<number>, low: number, high: number): number {
  const target = Math.min(high, Math.max(low, midi))
  let best: number | null = null
  for (let note = low; note <= high; note++) {
    if (!classes.has(note % 12)) continue
    // Notes come in ascending order, so on a tie the lower note was found first and stays.
    if (best === null || Math.abs(note - target) < Math.abs(best - target)) best = note
  }
  return best ?? Math.round(target)
}

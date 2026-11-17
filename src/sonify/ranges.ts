// Every pitch range and weight of the ruleset (docs/PLAN.md §6.3, ticket SN03), as named constants, so a rule never carries a bare number.
// MIDI note numbers: C3 = 48, C4 = 60.
// Each voice has its own register (SN18), low to high: bass C2–C3, harmony C3–G4, melody C4–C6, arpeggio C5–C6, hot spots C6–C7. The ranges are
// taste, the same for every data set.

import type { ScaleName } from './types'

export const MELODY_LOW_MIDI = 60 // C4
/** Two octaves: C4 to C6 (14 notes of a 7-note scale). */
export const MELODY_SPAN = 24
/** Weight of the new position in the melody's smoothing (0 to 1). */
export const MELODY_SMOOTHING = 0.5
export const HARMONY_LOW_MIDI = 48 // C3
/**
 * G4. A fifth into the melody's register: the least that lets the tonic chord of the pentatonic presets (a stack of fourths, A–D–G) and most
 * seventh chords be voiced with no two notes closer than MIN_CHORD_GAP.
 */
export const HARMONY_HIGH_MIDI = 67
/** A band must hold this share of the readable cells to count towards the chord's fullness. */
export const HARMONY_MIN_SHARE = 0.1
/** A chord built in thirds: a triad, or a seventh with MAX_HARMONY_NOTES. */
export const TRIAD_NOTES = 3
export const MAX_HARMONY_NOTES = 4
/**
 * The chord roots, as scale degrees, that the histogram's weighted mean band chooses from, low values first. Major: I, vi, IV, V. Dorian: i, VII,
 * IV, v (its vi is diminished, so it is left out). Pentatonic: the first four degrees. shortcut: starting values, to be tuned by ear.
 */
export const CHORD_ROOT_DEGREES: Record<ScaleName, readonly number[]> = { major: [0, 5, 3, 4], dorian: [0, 6, 3, 4], minorPentatonic: [0, 1, 2, 3] }
/**
 * The heard bands' share-weighted spread (standard deviation), as a share of the band range, at or above which the chord is a seventh (below: a
 * triad). shortcut: a starting value, to be tuned by ear. On the committed NASA data sets the spread is 0.08 to 0.26, so they play triads only.
 */
export const SEVENTH_SPREAD = 0.35
/** No two notes of a chord are closer than this (a minor third), so a chord is never a cluster of seconds. */
export const MIN_CHORD_GAP = 3
export const BASS_LOW_MIDI = 36 // C2
export const BASS_HIGH_MIDI = 48 // C3
/** A full shift (±1) moves the bass a fourth from its start. */
export const BASS_SHIFT_SEMITONES = 5
export const HOTSPOT_LOW_MIDI = 84 // C6
/** Up to C7. */
export const HOTSPOT_SPAN = 12
export const MAX_HOTSPOT_NOTES = 3
/** A hot spot covering this share of the map sounds at full level. */
export const HOTSPOT_FULL_SHARE = 0.1
export const RHYTHM_LOW_MIDI = 72 // C5
/** Up to C6. */
export const RHYTHM_SPAN = 12
/** The arpeggio's notes, each a tone of the chord under it. */
export const RHYTHM_NOTES = 4
/** Edge density below this: 1 note a beat. */
export const RHYTHM_SPARSE_DENSITY = 0.05
/** Edge density at or above this: 4 notes a beat (between: 2). */
export const RHYTHM_BUSY_DENSITY = 0.2
/** Cells a step for a full motion (see SN01 `Motion`). */
export const MOTION_FULL_SPEED = 2
/** C2; a year accent moves it up an octave (the ensemble, SN04, reads this). */
export const TIME_PULSE_MIDI = 36
/** How far above the pulse a year accent clicks (one octave) and a decade accent (two octaves, SN16). */
export const YEAR_ACCENT_SEMITONES = 12
export const DECADE_ACCENT_SEMITONES = 24
/** A melody position change this big counts as rising or falling. */
export const TREND_STEP = 0.02
export const LEVEL = { melody: 0.8, harmony: 0.5, rhythm: 0.5, time: 0.4, motionBase: 0.2, motionRange: 0.6, bassBase: 0.4, bassRange: 0.4, dropout: 1 } as const

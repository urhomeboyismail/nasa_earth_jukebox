// Every pitch range and weight of the ruleset (docs/PLAN.md §6.3, ticket SN03), as named constants, so a rule never carries a bare number.
// MIDI note numbers: C3 = 48, C4 = 60.

export const MELODY_LOW_MIDI = 48 // C3
/** Two and a half octaves: C3 to F#5. */
export const MELODY_SPAN = 30
/** Weight of the new position in the melody's smoothing (0 to 1). */
export const MELODY_SMOOTHING = 0.5
export const HARMONY_LOW_MIDI = 48 // C3
export const HARMONY_HIGH_MIDI = 60 // C4
/** A band must hold this share of the readable cells to sound. */
export const HARMONY_MIN_SHARE = 0.1
export const MAX_HARMONY_NOTES = 4
export const BASS_LOW_MIDI = 36 // C2
export const BASS_HIGH_MIDI = 48 // C3
/** A full shift (±1) moves the bass a fourth from its start. */
export const BASS_SHIFT_SEMITONES = 5
export const HOTSPOT_LOW_MIDI = 60 // C4
/** Up to C6. */
export const HOTSPOT_SPAN = 24
export const MAX_HOTSPOT_NOTES = 3
/** A hot spot covering this share of the map sounds at full level. */
export const HOTSPOT_FULL_SHARE = 0.1
export const RHYTHM_LOW_MIDI = 60 // C4
/** Up to C5. */
export const RHYTHM_SPAN = 12
/** The arpeggio's notes. */
export const RHYTHM_NOTES = 4
/** Edge density below this: 1 note a beat. */
export const RHYTHM_SPARSE_DENSITY = 0.05
/** Edge density at or above this: 4 notes a beat (between: 2). */
export const RHYTHM_BUSY_DENSITY = 0.2
/** Cells a step for a full motion (see SN01 `Motion`). */
export const MOTION_FULL_SPEED = 2
/** C2; a year accent moves it up an octave (the ensemble, SN04, reads this). */
export const TIME_PULSE_MIDI = 36
/** A melody position change this big counts as rising or falling. */
export const TREND_STEP = 0.02
export const LEVEL = { melody: 0.8, harmony: 0.5, rhythm: 0.5, time: 0.4, motionBase: 0.2, motionRange: 0.6, bassBase: 0.4, bassRange: 0.4, dropout: 1 } as const

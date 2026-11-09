# SN03 Ruleset and presets: `FrameFeatures` → `MusicFrame`

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | SN01, SN05 |
| **Hotspots** | — |
| **Branch** | `feature/SN03-ruleset-presets` |

## Goal

`toMusicFrame(features, preset, prev)` turns one frame's `FrameFeatures` (SN01) into one `MusicFrame`: a target for each of the seven voices, the voices with no data, the seeded dropout flag, a caption per voice and a summary. It is pure and deterministic. Three presets (`major`, `dorian`, `pentatonic`) choose the key, the scale and the tempo. Nothing else about the music is a choice: the data drives it.

## Why

- Today one fixed note stands for each colour band (`src/audio/engine.ts` `sounding`, `categories[].note`). That tells a listener almost nothing about shape, motion or places (`PLAN.md` §6.3).
- The ensemble (SN04) and the captions (SN07) need one shared description of "what should sound now". That description is `MusicFrame`. Writing it once, as a pure function, means the live path, the offline render (SN12), the captions and the golden tests all use the same rules.
- `src/audio/pan.ts` already has the pure helpers `panForPoint` and `elevationForPoint`. Reuse them for the hot spots' pan and height. Do not write new ones.

**Order.** This ticket needs the three lists in `src/data/sonification.ts` (`PRESET_IDS`, `DETAIL_LEVELS`, `VOICE_IDS`) from SN05, and the `FrameFeatures` type from SN01. The queue's Needs column says "—", so SN05 and SN01 must be on `main` first. The golden test (step 6) runs on real data sets and needs SN01's `extractFeatures`. The unit tests use hand-made features and need nothing else.

## Design

Files, all new, under `src/sonify/` (pure: no DOM, no Tone, no network; see the boundary in `PLAN.md` §5.9):

| File | Contents |
|---|---|
| `types.ts` | `Preset`, `MusicFrame`, `VoiceId` and `DetailLevel` re-exported from `src/data/sonification.ts`. |
| `ranges.ts` | Every MIDI range and weight below, as named constants. |
| `presets.ts` | `PRESETS`, `presetFor(id)`, `SCALES`, `snapToScale`. |
| `detail.ts` | `DETAIL_VOICES`, `voicesFor(detail)`. |
| `music.ts` | `toMusicFrame` and one helper per voice. |
| `captions.ts` | The words for each voice's caption and the summary. |
| `index.ts` | The public API. |

### Types (`types.ts`)

```ts
import type { Band, FrameFeatures } from '../analysis/features/types'
import type { DetailLevel, PresetId, VoiceId } from '../data/sonification'
export type { DetailLevel, PresetId, VoiceId }

export type ScaleName = 'major' | 'dorian' | 'minorPentatonic'

export type Preset = {
  id: PresetId
  label: string
  /** Says what kind of choice this is: artistic, the same for every frame, never data. Shown on Learn and About. */
  note: string
  /** Pitch class of the key: C = 0, D = 2, … B = 11. */
  tonic: number
  scale: ScaleName
  /** Beats a minute of the time pulse. 60 to 120. */
  bpm: number
  /** 0 to 1. How bright the hot-spot voices and the motion pad sound. */
  brightness: number
}

export type MusicFrame = {
  frameId: string
  date: string
  /** The melody: null when silent. `glide` slides from the previous note. */
  melody: { midi: number; glide: boolean; level: number } | null
  /** Chord notes, 1 to 4, in the harmony range. Thin for a uniform picture, thick for a mixed one. */
  harmony: { midis: number[]; level: number } | null
  bass: { midi: number; level: number } | null
  /** At most MAX_HOTSPOT_NOTES, in the order of `features.hotspots`. `pan` −1 to +1, `elevation` −1 to +1 (height only in 3D). */
  hotspots: { id: string; band: Band; midi: number; pan: number; elevation: number; level: number }[]
  /** An arpeggio along the strongest edge, `perBeat` notes a beat. */
  rhythm: { midis: number[]; perBeat: 1 | 2 | 4; pan: number; level: number } | null
  /** `openness` 0 to 1 (opens the pad's filter), `sweep` −1 (west) to +1 (east). */
  motion: { openness: number; sweep: number; level: number } | null
  time: { accent: 'none' | 'month' | 'year'; pulseBpm: number; level: number }
  /** Voices with no data this frame. They are silent, and the caption says so. */
  missing: VoiceId[]
  /** True when the whole frame cannot be read: the ensemble plays the seeded dropout cue once, when it starts. */
  dropout: boolean
  /** One line per voice for the caption strip ('' when silent). */
  caption: Record<VoiceId, string>
  /** One sentence for the caption strip and for announcements. */
  summary: string
  /** Carried into the next call (smoothing, and "the chord changes only when the mix does"). Not for display. */
  state: { melodyPosition: number | null; chordKey: string; shift: number | null }
}
```

### Constants (`ranges.ts`)

```ts
export const MELODY_LOW_MIDI = 48          // C3
export const MELODY_SPAN = 30              // two and a half octaves: C3 to F#5
export const MELODY_SMOOTHING = 0.5        // weight of the new position in the melody's smoothing (0 to 1)
export const HARMONY_LOW_MIDI = 48         // C3
export const HARMONY_HIGH_MIDI = 60        // C4
export const HARMONY_MIN_SHARE = 0.1       // a band must hold this share of the readable cells to sound
export const MAX_HARMONY_NOTES = 4
export const BASS_LOW_MIDI = 36            // C2
export const BASS_HIGH_MIDI = 48           // C3
export const BASS_SHIFT_SEMITONES = 5      // a full shift (±1) moves the bass a fourth from its start
export const HOTSPOT_LOW_MIDI = 60         // C4
export const HOTSPOT_SPAN = 24             // up to C6
export const MAX_HOTSPOT_NOTES = 3
export const HOTSPOT_FULL_SHARE = 0.1      // a hot spot covering this share of the map sounds at full level
export const RHYTHM_LOW_MIDI = 60          // C4
export const RHYTHM_SPAN = 12              // up to C5
export const RHYTHM_NOTES = 4              // the arpeggio's notes
export const RHYTHM_SPARSE_DENSITY = 0.05  // edge density below this: 1 note a beat
export const RHYTHM_BUSY_DENSITY = 0.2     // above this: 4 notes a beat (between: 2)
export const MOTION_FULL_SPEED = 2         // cells a step for a full motion (see SN01 `Motion`)
export const TIME_PULSE_MIDI = 36          // C2; a year accent moves it up an octave
export const TREND_STEP = 0.02             // a melody position change this big counts as rising or falling
export const LEVEL = { melody: 0.8, harmony: 0.5, rhythm: 0.5, time: 0.4, motionBase: 0.2, motionRange: 0.6, bassBase: 0.4, bassRange: 0.4, dropout: 1 } as const
```

Every MIDI range is written as a whole note. `snapToScale` moves each computed note to the nearest note of the preset's scale inside the range, with a tie going down.

### Presets (`presets.ts`)

```ts
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
}
export const SCALES: Record<ScaleName, readonly number[]> = { major: [0,2,4,5,7,9,11], dorian: [0,2,3,5,7,9,10], minorPentatonic: [0,3,5,7,10] }
export function presetFor(id: PresetId): Preset
export function snapToScale(midi: number, preset: Preset, low: number, high: number): number
```
`note` is a sentence for About, for example: "A bright, open key. The choice is artistic: it is the same for every frame and never carries data." Write one for each preset.

### Detail (`detail.ts`)

```ts
export const DETAIL_VOICES: Record<DetailLevel, readonly VoiceId[]> = {
  calm: ['melody', 'harmony', 'time'],
  standard: ['melody', 'harmony', 'time', 'bass', 'hotspots'],
  full: ['melody', 'harmony', 'bass', 'hotspots', 'rhythm', 'motion', 'time'],
}
export function voicesFor(detail: DetailLevel): readonly VoiceId[]
```
The ensemble (SN04) reads this; it does not copy it. `full` lists all seven voices (`VOICE_IDS`), so a test checks that `full` equals `VOICE_IDS` as sets.

### The rules (`music.ts`): `toMusicFrame(features, preset, prev)`

For each voice, in this order. Every rule is a function of `features`, `preset` and `prev` only.

1. **Melody.** `position = features.stats.position`. If it is `null`, the melody is `null` and `melody` is in `missing`. Otherwise the smoothed position is `prev?.state.melodyPosition` moved towards `position` by `MELODY_SMOOTHING`, or `position` itself on the first frame. `midi = snapToScale(MELODY_LOW_MIDI + smoothed × MELODY_SPAN, preset, MELODY_LOW_MIDI, MELODY_LOW_MIDI + MELODY_SPAN)`. `glide` is true when `prev.melody` exists and its midi differs. `level = LEVEL.melody`.
2. **Harmony.** The bands with a share of at least `HARMONY_MIN_SHARE`, from `features.histogram`. Band `b` of `n` bands gives scale degree `round(b × (length − 1) / (n − 1))` (degree 0 when `n` is 1). Each degree is snapped into `[HARMONY_LOW_MIDI, HARMONY_HIGH_MIDI]`. Keep the `MAX_HARMONY_NOTES` largest shares, sort the notes ascending and remove duplicates. `chordKey` is the notes joined by commas. **If `chordKey` equals `prev.state.chordKey`, the harmony keeps `prev.harmony.midis`** (the chord changes only when the mix does). With no readable cell (`histogram` all zeros), `harmony` is `null` and `harmony` is in `missing`.
3. **Bass.** The shift: `features.change?.shift` when there is a baseline (`change` is not `null`; a `null` shift counts as 0). Otherwise `clamp((position − features.reference) × 2, −1, 1)`, and 0 on the first readable frame. `midi = snapToScale(BASS_LOW_MIDI + preset.tonic + round(shift × BASS_SHIFT_SEMITONES), preset, BASS_LOW_MIDI, BASS_HIGH_MIDI)`. `level = bassBase + bassRange × |shift|`. Missing when `position` is `null`.
4. **Hot spots.** The first `MAX_HOTSPOT_NOTES` of `features.hotspots`, in their order. `midi = snapToScale(HOTSPOT_LOW_MIDI + peakPosition × HOTSPOT_SPAN, …)`. `pan = panForPoint(centroid.x)`, `elevation = elevationForPoint(centroid.y)` (both from `src/audio/pan.ts`). `level = min(1, sqrt(areaShare / HOTSPOT_FULL_SHARE))`. Never missing: no hot spot is a quiet voice, not a missing one.
5. **Rhythm.** Null when `features.edges.strongest` is `null` (quiet, not missing). `perBeat` is 1 below `RHYTHM_SPARSE_DENSITY`, 4 at or above `RHYTHM_BUSY_DENSITY`, else 2. `midis`: the line's points at `RHYTHM_NOTES` evenly spaced indexes (`round(i × (n − 1) / (RHYTHM_NOTES − 1))`); each point's `x` gives `RHYTHM_LOW_MIDI + x × RHYTHM_SPAN`, snapped; sorted ascending, duplicates removed. `pan = panForPoint(mean x of the line)`. `level = LEVEL.rhythm`.
6. **Motion.** Null when `features.motion` is `null` (quiet, not missing). `openness = min(1, speed / MOTION_FULL_SPEED)`, `sweep = clamp(dx / MOTION_FULL_SPEED, −1, 1)`, `level = motionBase + motionRange × openness`.
7. **Time.** `accent` is `'year'` when the year of `date` differs from `prev.date`, `'month'` when the month differs, else `'none'`; `'none'` on the first frame. `pulseBpm = preset.bpm`, `level = LEVEL.time`. Never missing and never null: the time voice always keeps the pulse.
8. **Missing and dropout.** `missing` lists `melody`, `harmony` and `bass` when their rule found no data, in `VOICE_IDS` order. `dropout` is `true` exactly when `features.stats.position` is `null`.
9. **Caption and summary.** Words come from `captions.ts` (rules, no model). Each caption is one short line: the voice, the level in words (`high`, `middle`, `low`), a trend (`rising`, `falling`, `steady`, from `prev.state.melodyPosition`), and for the hot spots the compass sector (`north-west` … `south-east`, a 3 × 3 split of the image) of the first spot. The summary is one sentence, and on a dropout date it says that only the time pulse sounds. No word names a variable, a unit or a place outside the map.

Missing and quiet are different. A missing voice has no data and is named in `missing`. A quiet voice (rhythm, motion with no speed) is `null` and is not named. The caption says "not enough data" only for a missing voice.

## Reuse

- `FrameFeatures`, `Hotspot`, `Band`, `Motion` (`src/analysis/features/types.ts`, SN01).
- `panForPoint`, `elevationForPoint` (`src/audio/pan.ts`). Pure functions; the React hook in the same file is not used.
- `VOICE_IDS`, `DETAIL_LEVELS`, `PRESET_IDS`, `VoiceId`, `DetailLevel`, `PresetId` (`src/data/sonification.ts`, SN05).
- `median` (`src/analysis/median.ts`) if needed; no other helper.
- `installFakeWorker`, `decodePng` and the change scene (`src/test/`) only in tests.

## Touches

- New: `src/sonify/**` (all files listed above), with tests and `src/sonify/__golden__/music.json`.
- Edit: `src/boundary.test.ts` only to add `./sonify/**/*.{ts,tsx}` to the guarded globs, and a line to its header comment that names `sonify/`.
- Do not touch `src/audio/**` (the ensemble is SN04), `src/analysis/**` (SN01) or `src/data/**` (SN05).

## Steps

1. Write `ranges.ts`, `presets.ts` (with a note for each preset), `detail.ts`. Test them alone.
2. Write `music.ts` one voice at a time, each with its unit test built from a hand-made `FrameFeatures` (a test helper in `src/sonify/testFeatures.ts`, not exported from `index.ts`).
3. Write `captions.ts` and the summary.
4. Add the boundary entry in `src/boundary.test.ts`; run it and check it flags a `fetch()` inserted into a `sonify/` file (a temporary change you then revert).
5. Write `index.ts`.
6. After SN01 is on `main`: write `src/sonify/golden.test.ts`. For the fixture, `synthetic-ocean`, `synthetic-globe`, `synthetic-change`, read each frame, `extractFeatures` with `previous` carried, then `toMusicFrame` with `presetFor('major')` and then `presetFor('pentatonic')`. Record the `MusicFrame`s of the first twelve frames (a summary: midis, levels, missing, caption, summary) in `__golden__/music.json`. Run `npx vitest run -u src/sonify/golden.test.ts` once and read the diff.
7. Run the checks.

## Tests

- Every rule in "The rules", one test each, on hand-made features: a uniform frame (one harmony note, a melody in the middle of the range), a warm square (one high hot spot, its pan and height), a line (rhythm, `perBeat` 4 when the density is high), a dropout (`dropout` true, `missing` lists melody, harmony and bass, the time voice still sounds), a first frame (no glide, no accent, no trend).
- Determinism: the same features and `prev` give `toEqual` output; the output never changes when the object is passed twice.
- Chord hold: with the same mix, `harmony` is the same object's notes as `prev`; a different mix changes them.
- `snapToScale`: every result is in the scale and in range, for every preset, for every whole MIDI note in the range; ties go down.
- `DETAIL_VOICES.full` equals `VOICE_IDS`; `calm` is a subset of `standard`, and `standard` a subset of `full`.
- Captions: a missing voice says "not enough data"; a quiet voice (no rhythm line) is `''`.
- Golden (step 6): `src/sonify/golden.test.ts` against `__golden__/music.json`.
- `src/boundary.test.ts` passes, and the temporary `fetch()` in step 4 is caught.

## Guardrails

- The same input always gives the same output (no randomness; no `Date.now()`).
- Presets are general: their names, notes and ranges say nothing about one data set. The manifest only names a preset (`sonification.preset`).
- Words never name a unit or a place outside the map. Words like "warm" come from the manifest's category labels, which this ticket does not read; captions use "high", "middle" and "low".
- No model in `sonify/` (`PLAN.md` §6.3). No `fetch`, no `WebSocket`, no import of `src/assistant/`, `src/config`.
- Sound: the output is numbers only; the sound itself is SN04. Peak level and ramps are SN04's guardrails.

## Done when

- `toMusicFrame` gives every field above for a normal, a sparse and a dropout frame.
- Presets, detail and snapping pass their tests.
- The boundary test covers `sonify/` and passes.
- The golden file exists (after SN01, step 6).
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data                          # only if public/data/ changed (it should not)
```

## Out of scope

- Playing the music (SN04), and the Listen page (SN07).
- Scan and explore voices (SN08, SN09).
- Words for the screen-reader events and the sound recipe (SN10).
- Changing presets for a data set: a data set only chooses one by its id.

## Result

Not started.

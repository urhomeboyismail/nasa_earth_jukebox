# SN16 A decade accent on the time voice, so years-apart data sets feel the decades pass

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/SN16-decade-accent` |

## Goal

When a data set's frames are years apart, the time voice marks the decades: a stronger accent when the decade changes, so the listener can count decades by ear. Data sets with monthly or daily frames sound exactly as before.

## Why

- The time voice knows two accents: a month change or a year change (`src/sonify/music.ts:97-98`), played as one octave up for a year (`src/audio/ensemble/voices.ts:82`) and `ACCENT_DB` louder (`voices.ts:81`).
- A data set whose frames are five years apart (for example 1880 to 2025 every five years) changes year on every frame, so every click is a year accent and the accent tells the listener nothing.

## Design

- `src/sonify/types.ts` and `src/audio/ensemble/plan.ts:30`: the accent becomes `'none' | 'month' | 'year' | 'decade'`.
- `src/sonify/music.ts` `timeFor`: `'decade'` when the first three digits of the year change (`date.slice(0, 3)`), checked before `'year'`. Text slices only, as today: no Date object, no time zone.
- `src/audio/ensemble/voices.ts`: a decade click is two octaves up (`TIME_PULSE_MIDI + 24`) with `ACCENT_DB`, a year click stays one octave up. One new named constant for the decade offset in `src/sonify/ranges.ts` or `src/audio/ensemble/constants.ts`.
- `src/sonify/captions.ts` (the time line): "A new decade: the 1980s." on a decade accent, in plain words.
- A frame step of a decade or more gives a decade accent on every frame, as today's year accent does; that is fine.

## Reuse

`timeFor` in `music.ts`, the time voice in `voices.ts`, the caption builder in `captions.ts`, `TIME_PULSE_MIDI` and `ACCENT_DB`.

## Touches

- `src/sonify/types.ts`, `src/sonify/music.ts`, `src/sonify/captions.ts` and their tests
- `src/audio/ensemble/plan.ts`, `src/audio/ensemble/voices.ts`, `src/audio/ensemble/constants.ts` and their tests
- `src/sonify/__golden__/` and `src/audio/ensemble/__golden__/` if a golden file records accents (rewrite only for this change, and say so in the PR)

## Steps

1. The type, then `timeFor`, with tests (1975 to 1980: decade; 1980 to 1985: year; January to February: month; first frame: none).
2. The click in `voices.ts`, with a test through the fake ensemble.
3. The caption.

## Tests

- `music.test.ts`: the four cases above, and that a data set with monthly frames gives no decade accent except across a real decade boundary.
- `voices.test.ts` (or the ensemble tests): a decade accent plays `TIME_PULSE_MIDI + 24`.
- The golden tests still pass, or are rewritten for this change only.

## Guardrails

The template's guardrails. Nothing specific to one data set in `src/`: the rule reads only the frames' dates.

## Done when

- Playing a data set with frames five years apart, the click jumps higher at 1880, 1890, 1900 and so on, and the caption names the decade. Monthly and daily data sets sound as before. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A century accent. Changing the tempo by decade.

## Result

Built by agent E (Claude Code, for Roni), 15 Nov 2026, on `feature/SN16-decade-accent`.

- `src/sonify/types.ts`: `TimeAccent` (`'none' | 'month' | 'year' | 'decade'`), used by `plan.ts` and `voices.ts`.
- `src/sonify/music.ts`: `'decade'` when the year's first three digits change, checked before `'year'`.
- `src/sonify/ranges.ts`: `YEAR_ACCENT_SEMITONES` (12) and `DECADE_ACCENT_SEMITONES` (24); `voices.ts` clicks a decade two octaves above the pulse, with the same `ACCENT_DB`.
- `src/sonify/captions.ts`: "Time: steady pulse, new decade". (The caption parts carry no date, so it does not name the decade.)
- Tests: `music.test.ts` (1975 to 1980 decade, 1980 to 1985 year, 2029 to 2030 decade, a month), `voices.test.ts` (two octaves up, 3 dB), `captions.test.ts`. No golden file changed.

Checks (Windows): `npm run lint` 0 errors; `npm run build` built; `npm test` 217 files, 3079 tests passed.

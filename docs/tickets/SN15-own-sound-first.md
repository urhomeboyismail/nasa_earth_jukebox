# SN15 Each data set keeps its own sound unless the listener chooses a style on purpose

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/SN15-own-sound-first` |

## Goal

A style picked in the welcome is a default for data sets that have no sound of their own; it no longer replaces a data set's own preset. Only a style the listener picks in the Listen mixer ("Music style") plays over every data set, and "The data set's own sound" turns that off again.

## Why

- Listening on 15 Nov 2026, every data set sounded nearly the same on Listen. One cause: the listener's style always wins over the manifest's preset. `src/features/player/symphonyState.ts:101` is `presetFor(prefs.style ?? spec?.preset ?? 'major')`; the same order is in `src/features/compare/Fusion.tsx:43`, `src/features/home/preview.ts:85` and `src/features/player/SoundPrefs.tsx:108`.
- The welcome writes that same `style` (`src/features/landing/storage.ts:24`, `saveAudioPrefs({ style })`), so one chip picked on the first visit (`src/features/landing/Landing.tsx:166`) flattens every data set's `sonification.preset` for good, without the listener knowing.
- Data sets now set their own preset on purpose (for example `cinematic` for the 1880 to 2025 temperature record and `bass` for the hurricane season), so the welcome's choice hides that work.

## Design

- `src/audio/prefs.ts`: add `styleEverywhere: boolean` to `AudioPrefs` (default `false`; a stored value without it parses as `false`, so nothing already saved breaks).
- The one rule, as a pure helper next to the prefs (for example `presetIdFor(prefs, spec)`):
  - `styleEverywhere && style` → `style`;
  - else the manifest's `sonification.preset`, if any;
  - else `style` (the welcome's choice, as a default);
  - else `'major'`.
- `symphonyState.ts:101`, `Fusion.tsx:43`, `preview.ts:85` and the sample in `SoundPrefs.tsx:108` use the helper instead of their own `??` chain.
- `SoundPrefs.tsx`: choosing a style in the Listen mixer saves `{ style, styleEverywhere: true }`; choosing "The data set's own sound" saves `{ style: null, styleEverywhere: false }`. The hint says which applies ("Plays over every data set" / "Each data set's own sound; your welcome choice is used where a data set has none").
- The welcome (`storage.ts:24`) keeps saving only `style`, so its choice stays a default. No change in `src/features/welcome/`.
- Art mode (IX12) still plays instead of all of these, as today.

## Reuse

`useAudioPrefs`, `saveAudioPrefs`, `readAudioPrefs` and the zod parser in `src/audio/prefs.ts`; `presetFor` in `src/sonify/presets.ts`.

## Touches

- `src/audio/prefs.ts` and its test (the new field, the parser, the helper)
- `src/features/player/symphonyState.ts`, `src/features/player/SoundPrefs.tsx` and their tests
- `src/features/compare/Fusion.tsx`, `src/features/home/preview.ts` (one line each)

## Steps

1. Add `styleEverywhere` and the helper, with tests for the four cases of the rule and for an old stored value.
2. Use the helper in the four places.
3. Make the mixer set and clear `styleEverywhere`; update its hint.

## Tests

- `prefs.test.ts`: the rule's four cases; a stored value from before (no `styleEverywhere`) parses as `false`.
- `SoundPrefs.test.tsx`: picking a style sets `styleEverywhere`; "The data set's own sound" clears both; the hint changes; `expectNoA11yViolations`.
- A Symphony test: with a welcome style and a manifest preset, the manifest's preset plays; after a mixer choice, the mixer's style plays.

## Guardrails

The template's guardrails. A preset never carries data, so this changes only which artistic choice plays. Nothing specific to one data set in `src/`.

## Done when

- With a style picked in the welcome, a data set with its own preset plays that preset, and one without plays the welcome's style.
- A style picked in the Listen mixer plays over every data set until "The data set's own sound" is chosen. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Changing the welcome's chips or wording (`welcome` hotspot).
- Which mode Listen opens in (`src/features/player/listenMode.ts`: Symphony when the manifest has a `sonification` block, otherwise Simple).

## Result

Filled in by the agent.

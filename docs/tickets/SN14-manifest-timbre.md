# SN14 Manifest timbre: an optional, general `sonification.timbre` field

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 (the team leader signs off the design and the sound) |
| **Needs** | SN05 |
| **Hotspots** | schema, explorer (`engine` is `src/audio/engine.ts`, which this does not touch) |
| **Branch** | `feature/SN14-manifest-timbre` |

**Built at Raghav's request (14 Nov); the team leader still signs off through R-20261114-SN14-1 on `docs/AGENT-BOARD.md`.** `docs/PLAN.md` §6.3 says timbre comes from a general preset that a manifest only names, so this needs the owner's OK first.

## Goal

A manifest can tune the timbre of its live sonification within limits: the instrument (`synth` or `fm`), the low-pass range and the curve it follows, and the pan width. Leaving any of them out keeps today's sound exactly, so every data set and every golden is unchanged.

## Why

- `src/data/schema.ts:102-108`: `sonification` is strict and holds only `preset`, `detail` and `voices`, so a data set cannot choose its instrument or filter.
- The engine's mappings are fixed constants: low-pass ranges `MOTION_FILTER_HZ` and `HOLD_FILTER_HZ` (`src/audio/ensemble/constants.ts:40,42`), ramped linearly with `lerp` (`src/audio/ensemble/voices.ts:140,178,240`); panning goes through `aimPanner` (`src/audio/pan.ts`).
- Asked for in the EIC04 brief (14 Nov): "FMSynth oscillator nodes mapped via Low-Pass Filter cutoffs, exponential easing, and spatial panning".

## Design

```json
"sonification": { "preset": "pentatonic", "timbre": { "instrument": "fm", "filterHz": { "low": 300, "high": 4000 }, "curve": "exponential", "panWidth": 0.8 } }
```

- Every field is optional, with these defaults: `instrument` `"synth"` (today's oscillators), `filterHz` the current constants, `curve` `"linear"`, `panWidth` `1`. Limits: 20 ≤ low < high ≤ 12000 Hz, and `panWidth` from 0 to 1. Like the rest of `sonification`, it is strict.
- The inputs stay the general frame features (brightness, position, value). It is never keyed to a named measure such as moisture flux: a data set gets that meaning through its colour scale and categories (`.claude/rules/phases.md`).
- `exponential` maps brightness b to `low × (high/low)^b`. Ramps stay `PARAM_RAMP_S`.

## Reuse

`src/audio/ensemble/graph.ts` (`filterTo`, `synthFor`), `voices.ts`, `aimPanner`, `src/audio/ensemble/toneMock.ts` for tests, the goldens in `src/audio/__golden__` and `src/sonify/__golden__`.

## Touches

`src/data/schema.ts`, `src/data/types.ts`, `src/audio/ensemble/timbre.ts` (new), `graph.ts`, `voices.ts`, `index.ts`, `types.ts`, `useEnsemble.ts`, the callers `src/features/player/symphonyState.ts`, `src/features/player/Scan.tsx` and `src/features/explore/useExplorer.ts` (explorer hotspot), their tests, and `docs/data-sources.md` ("v3 fields").

## Tests

- Schema: a manifest without `timbre` validates as before; bad limits are reported with the field's path.
- Engine (Tone mock): with no `timbre`, the nodes and ramps are exactly today's. `fm` builds an FM synth. `exponential` gives `low × (high/low)^b` at b = 0, 0.5 and 1. `panWidth 0` keeps every voice centred.
- The goldens are unchanged.

## Guardrails

As in `_TEMPLATE.md`: the same input gives the same output, the peak stays at or below −1 dBFS, no sound plays before a click or key press, every voice keeps its text equivalent, and nothing specific to one data set goes in `src/`.

## Done when

- The team leader has answered R-20261114-SN14-1 and listened to `fm` + `exponential` on `synthetic-storm` and `fixture`.
- The checks pass and the goldens are unchanged.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

## Out of scope

- Mappings keyed to named measures, per-voice instruments, effects other than the low-pass filter.

## Result

Branch `feature/SN14-manifest-timbre` (agent E, 14 Nov). Built at Raghav's request, so it still needs the team leader's answer to R-20261114-SN14-1 and a listen before merging.

- `sonification.timbre` (`instrument`, `filterHz`, `curve`, `panWidth`) in `src/data/schema.ts` and `types.ts`, strict, all optional.
- `src/audio/ensemble/timbre.ts` (new): `resolveTimbre`, `cutoff` (linear, or `low x (high/low)^brightness`), `oscillatorFor` (`fm` + waveform). `graph.ts` builds FM oscillators on pitched voices (the time pulse stays plain); `voices.ts` uses the range, curve and pan width. `createEnsemble` and `useEnsemble` take the timbre; Symphony, Scan and Explore pass the manifest's.
- Without `timbre` the nodes and ramps are exactly as before: all goldens unchanged.
- Not done: WAV exports from marks and the playlist (`renderRecording.ts`, `renderSequence.ts`) and Learn, Legend, Fusion still use the default sound.
- Not heard: only tested against the Tone mock. Listen to `fm` + `exponential` before merging.

Checks:
- `npm run lint`: 2 errors, both in `src/sonify/fuse.ts:31,39`, already on `main`; nothing new.
- `npm test` (`--maxWorkers=2`; the default worker count got killed for memory): 199 files, 2907 tests passed (13 new: `timbre.test.ts`, schema cases).
- `npm run check-data`: 303 passed.
- `npm run build`: built.

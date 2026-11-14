# JB10 The tour's third stop is the sound mixer

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | JB05 |
| **Hotspots** | player |
| **Branch** | `feature/JB10-tour-mixer-stop` |

## Goal

The guided tour covers the three things a new listener needs: the data set picker, Play, and the sound controls (Speed and Volume), instead of "Explore the map".

## Why

- `TOUR_STEPS` (`src/features/demo/script.ts:31`) stops at the picker, Play and Explore the map (`data-tour="explore"`, `src/features/player/index.tsx:292`). JB05 had no Export button to point at, so it picked Explore.
- The Speed group (`src/features/player/index.tsx:316`) and the Volume slider (`:322`) shape what the listener hears, and nothing points them out.

## Design

- Wrap the Speed group and the Volume slider in one `<div data-tour="mixer">` in the player (or put the attribute on an existing wrapper if one holds both). No other player change.
- The third step: `{ page: 'listen', say: 'Speed and Volume change how fast the dates play and how loud they are.', target: '[data-tour="mixer"]' }`. The wording stays general.
- Keep `data-tour="explore"` unless nothing else uses it.

## Reuse

`TOUR_STEPS`, the tour runner and overlay (JB05).

## Touches

- `src/features/demo/script.ts` and its test.
- `src/features/player/index.tsx` (the `player` hotspot): one wrapper or attribute.
- `src/features/mascot/TourOverlay.test.tsx` if it names the third stop.

## Steps

1. Add the `data-tour="mixer"` target.
2. Change the third step.
3. Checks; try the tour in the browser.

## Tests

- The tour's third stop rings the Speed and Volume controls; the existing tour and player tests pass.

## Guardrails

Nothing specific to one data set; the caption is announced politely.

## Done when

- The third stop points at Speed and Volume. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- New steps beyond three.

## Result

Built by agent E, 14 Nov 2026. `data-tour="mixer"` is on the existing `player__settings` wrapper (holds Speed and Volume); the third `TOUR_STEPS` entry now points at it. `data-tour="explore"` is kept. The `TourOverlay` test page and a new `runDemo.test.ts` case follow the new stop.

Checks (Windows, Node), on this branch merged with `chore/fusion-file-casing` (it fixes a `Fusion.ts`/`fusion.ts` casing clash on `main` that stops the build on Windows):
- `npm test`: 206 files, 2963 tests passed.
- `npm run build`: built.
- `npm run lint`: 2 errors, both in `src/sonify/fuse.ts` (type assertions), a file this ticket does not touch; the same on `main`.
- The tour was not opened in a browser; the tests cover that the third step targets `[data-tour="mixer"]`.

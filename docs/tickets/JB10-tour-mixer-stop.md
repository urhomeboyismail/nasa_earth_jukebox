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

Checks (Windows, Node):
- `npx vitest run src/features/demo src/features/mascot src/features/player`: 26 files, 336 tests passed.
- `npm test`: 205 files passed, 1 failed (`src/features/compare/Fusion.test.tsx`, 4 tests). It fails the same way on a clean `main`: `compare/index.tsx` imports `./Fusion` but the file is `fusion.ts`, so it breaks on a case-insensitive file system (Windows).
- `npm run lint`: 2 errors, both in `src/sonify/fuse.ts` (type assertions), a file this ticket does not touch; same on `main`.
- `npm run build`: fails on the same `Fusion.ts` / `fusion.ts` casing clash (TS1261). Not caused by this change.
- Not tried in a browser: the full app does not build here because of the casing clash.

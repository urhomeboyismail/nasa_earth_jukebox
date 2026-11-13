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

Filled in by the agent.

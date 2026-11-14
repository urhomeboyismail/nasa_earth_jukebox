# UI08 Echo's chest equaliser: bars that follow the real sound

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/UI08-chest-equaliser` |

## Standalone

A tap on the sound's output, a small hook and a new method on the robot element. All of them are on `main` today. The ticket does not edit the dock, the tour or the engine, so it holds no hotspot.

## Goal

While the data plays, a small screen on Echo's chest shows five to eight bars that move with the real sound, read from a Web Audio `AnalyserNode`. When nothing plays, the bars rest flat. Under `prefers-reduced-motion` they stay still.

## Why

- The master prompt asks for a "live Web Audio chest equaliser" on Echo.
- Echo is drawn by `<robot-companion>` (`public/robot/robot-companion.js`, typed in `src/types/robot-companion.d.ts`). The belly has a printed logo patch (`robot-companion.js:576`, `belly_logo`) and no screen.
- The ensemble's chain ends in a master gain (`src/audio/ensemble/graph.ts:4`, `master`). Nothing reads the level.
- `UI-OVERHAUL.md` §3: "A visualiser draws the real sound or the real data, never decoration."

## Design

- **The tap:** `graph.ts` connects `master` to an `AnalyserNode` too (`fftSize` 256, `smoothingTimeConstant` 0.8). The analyser goes nowhere else, so the sound is unchanged. `src/audio/level.ts` holds it: `setLevelSource(node | null)` and `readBands(count): number[]` (0 to 1, log-spaced bands, all zeros when there is no source).
- **The hook:** `src/features/mascot/useChestBands.ts` reads `readBands(6)` at most 30 times a second while playback runs. It stops when the tab is hidden or under reduced motion, and passes the values to the robot.
- **The robot:** `robot-companion.js` gets a `setChestBands(values)` method. It draws a 64×32 canvas texture on a small rounded screen mesh over the belly patch: aqua bars on the dark visor glass colour, at most 30 updates a second. `null` or reduced motion draws flat bars. Add it to the typing in `robot-companion.d.ts`.
- The robot is `aria-hidden` already. The bars are decoration of a sound that has its own text (captions), so they need no text of their own.

## Reuse

`graph.ts` and its mock (`src/audio/ensemble/toneMock.ts`), `FakeAnalyserNode` in `src/test/fakes.ts`, the robot's existing material and `add()` helper, the reduced-motion check in `src/features/mascot/tour.ts`.

## Touches

- `src/audio/ensemble/graph.ts` (the tap), `src/audio/level.ts` and test (new)
- `src/features/mascot/useChestBands.ts` and test (new), and wherever the app mounts `<robot-companion>` (one call to the hook, not in `MascotDock.tsx`)
- `public/robot/robot-companion.js` (`setChestBands` and the screen mesh), `src/types/robot-companion.d.ts`

## Steps

1. The analyser tap and `readBands`, tested with the fake.
2. `setChestBands` and the screen mesh on the robot.
3. The hook, wired where the robot is mounted.

## Tests

- `level.test.ts`: no source → zeros; with a fake analyser filled with known bytes → the expected bands.
- `graph.test.ts`: `master` connects to the analyser and still reaches the speakers; the output is unchanged (golden tests pass).
- `useChestBands.test.ts`: no reads under reduced motion, none while paused, stops on `visibilitychange`.

## Guardrails

The template's guardrails, and:

- The tap must not change the sound: the golden and peak tests pass unchanged.
- Nothing flashes more than 3 times a second. The bars move smoothly; no full-screen brightness change.
- Nothing specific to one data set in `src/`.

## Done when

- Echo's chest bars move with the music and rest when it stops, are still under reduced motion, and the checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The Home globe's Echo (`OrbitGlobe.tsx`). A full spectrum view. Echo's scroll boost and flight (UI05).

## Result

Filled in by the agent.

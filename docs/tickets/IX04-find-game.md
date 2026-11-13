# IX04 Find game

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | IX01, SN04 |
| **Hotspots** | player |
| **Branch** | `feature/IX04-find-game` |

## Goal

The listener finds the warmest place, the edge, or the biggest change by ear alone. A pulse gets faster as the cursor gets closer. Finding it plays a success sound. A timer and a score are kept on this device.

## Why

- The sound map is free exploration only. Nothing gives the listener a task, which is the "learn by doing" principle (PLAN §6.3, principle 5).
- SN01 gives the targets: the `grid` (for the warmest place), `edges` (for the edge) and `change` or `hotspots` (for the biggest change). Nothing computes them yet.
- The first minute (IX11) is built on this game, so it must not depend on any one data set.

## Design

- **Targets (pure, `src/features/find/targets.ts`).** `targetsFor(features)` returns, on the sound map's grid:
  - `warmest`: the cell with the highest value in SN01's `grid` (64 × 32; cells with `null` are skipped), converted to the sound map's cell by its position in the image (`cellOfFraction`, IX01 `notes.ts`);
  - `edge`: the midpoint of `edges.strongest` (a contour, `null` when there is none), converted the same way;
  - `change`: the centroid of the largest hotspot in `change`, or of the largest `hotspots` entry when there is no change layer (`cellOfFraction`). `null` if there is none.
- **Levels (difficulty, not data).** Level 1: `warmest`. Level 2: `warmest`, then `edge`. Level 3: all three that exist. The same levels for every data set. No data-set name goes in `src/`.
- **Tolerance.** A target is found when the cursor is within 1 cell (Chebyshev distance).
- **Guidance: pulse rate.** A soft note (`playNotes`, level 0.15, 80 ms) at the cursor's place, with the note of that place (`noteForPosition`, IX01 `notes.ts`). Its interval depends on the distance `d` in cells: 1200 ms at `d ≥ 12`, 120 ms at `d ≤ 1`, linear in between (`pulseIntervalMs(d)`, pure). The pulse says how close, not which way.
- **Success.** The target's note, then the top note of the melody range (two `playNotes` calls, about 600 ms in all). The next target starts after 800 ms. The success sound is the game's own; it is not the interface `success` cue (AU-UI).
- **Timer and score.** The timer starts at the first move and stops at the last success. Score per target: `max(0, 1000 − 5 × moves − 10 × seconds)`. Stored in `localStorage` under `earth-jukebox:find` as `{ best: { "<dataId>:<level>": { score, seconds } } }`, validated with zod on read; the best is kept.
- **Start and stop.** `F` (IX01 `find`), and a "Start the find game" button in `ExplorerPanel` for touch and screen readers.
- **Words.** The visible line shows the target and the timer. When a target is found, the score line is announced once through `useAnnounce`. Nothing else is spoken.

## Reuse

- SN01's `FrameFeatures` (`grid`, `edges`, `change`, `hotspots`) from SN01's ticket file.
- SN04's `playNotes` (and `playDropout` for a place with no data).
- IX01's `notes.ts`: `noteForPosition`, `cellOfFraction`.
- `src/features/explore/useExplorer.ts`: `cursor`, `moveTo`, `grid`, `place`.
- IX01: `useActionHandler` (`find`), `recordUndo` (not needed: a finished game is not undone).
- `src/components/Button.tsx`, `useAnnounce`.

## Touches

- `src/features/find/targets.ts`, `pulse.ts`, `score.ts`, `store.ts` (zod), `useFindGame.ts`, `FindPanel.tsx`, and a test file next to each.
- `src/features/player/index.tsx`: mount `FindPanel` under the explorer panel. Hotspot `player` is not in the queue row for this ticket; the mount is one line, so no other player ticket runs at the same time. Say so in the PR.
- `src/features/explore/useExplorer.ts`: expose `cursor` (already exposed) and nothing more.

## Steps

1. Write `targets.ts`, `pulse.ts` and `score.ts` as pure functions, with table tests.
2. Write `store.ts`: read and write `earth-jukebox:find` through zod. Blocked storage gives an empty record.
3. Write `useFindGame.ts`: the state (level, target index, moves, start time, found) in React state, updated from the event that causes it. Timers in refs. No `setState` inside an effect.
4. Write `FindPanel.tsx`: start and stop buttons, the target name, the timer, the score, the level choice.
5. Register the `find` handler. On each cursor move, recompute the distance and the pulse interval.

## Tests

- `targets.test.ts`: on the SN02 set with a known warm point, `warmest` is that cell; with no change layer, `change` falls back to the largest hotspot; `null` cells are skipped.
- `pulse.test.ts`: the interval is 1200 at 12 cells and above, 120 at 1 cell and below, and falls as the cursor gets closer (monotone).
- `score.test.ts`: the formula, and the floor at 0.
- `store.test.ts`: a valid record round-trips; a corrupt record is ignored; the best is kept.
- `FindPanel.test.tsx` (fake timers, fake engine): moving the cursor onto the target ends the target, plays the success sound once and announces the score once; the pulse count in 2 s is larger when the cursor is closer.
- `expectNoA11yViolations` on the panel.

## Guardrails

- The same frame, the same target and the same pulse times for the same input. Nothing is random.
- Peak at or below −1 dBFS; no sound before a key press or a click.
- Nothing flashes. The timer is text, not a flashing light.
- Every sound has its text: the pulse's text is the visible distance line; the success is the score line, announced once.
- Changes are announced through `useAnnounce`; no spoken automatic messages.
- No data-set name, unit or colour in `src/`. Levels are difficulty only.

The five principles, for this ticket:
1. The pulse is an immediate answer to each move.
2. Sound first: the game is sound; the words are the score and the target name.
3. The listener can stop the game with `F` or Escape, and nothing traps.
4. Keys, touch and gamepad all start and move the cursor through IX01.
5. This is the learn-by-doing loop itself.

## Done when

- `F` or the button starts the game; the first target is the warmest place.
- Within the tolerance, the target is found, the success plays, and the next target starts.
- The pulse's interval falls as the cursor nears the target (tested).
- The score and the timer are kept on this device and survive a reload.
- All tests pass on the SN02 set and the fixture; the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Real-data levels and the level list for a specific set (the listening test, H03, decides the difficulty).
- Leaderboards, sharing, and any server call.
- A second game.

## Result

Built by agent D on `feature/IX04-find-game`, 13 Nov 2026, from `main` at `5599da7`.

**What changed**

- `src/features/find/targets.ts` (pure):
  - `targetsFor(features, cols, rows, area)` gives `highest`, `edge` and `spot` on the sound map's grid. Highest is the first cell, row by row, with the largest readable value. Edge is the middle point of `edges.strongest`. Spot is the centroid of the largest hot spot. Each goes through `cellOfFraction`.
  - `levelTargets` gives level 1 = highest; 2 = highest, edge; 3 = highest, edge, spot. A target the frame lacks is left out.
  - `distanceTo` (Chebyshev), and `FOUND_WITHIN = 1`.
- `pulse.ts`: `pulseIntervalMs(d)`, 1200 ms at 12 cells or more, 120 ms at 1 or less, linear in between. Pulse level 0.15, 80 ms.
- `score.ts`: `targetScore = max(0, round(1000 − 5·moves − 10·seconds))`, and `clock`.
- `store.ts`: `earth-jukebox:find` as `{ best: { "<dataId>:<level>": { score, seconds } } }`, read through zod. Broken or blocked storage gives an empty record. The best is kept: a higher score, or the same score in less time.
- `useFindGame.ts`:
  - **Starting:** `F` (IX01 `find`), gamepad Menu or the button starts a game on the date on screen. It reads that one frame's features, as SN12 does, with no other date needed.
  - **Pulse:** plays at the cursor (`noteForPosition`, or `playDropout` on a place with no data), sooner as it nears the target.
  - **Found:** within one cell, it plays the target's note, then the top of the melody range (`markNote`, about 600 ms). It announces "Found the highest place in 3 moves and 3 seconds: 955 points." once, and the next target starts after 800 ms. At the end the total is kept as the best for that data set and level.
  - **Stopping:** `F` again, Escape, or the sound map going off.
- `FindPanel.tsx`: "Start the find game" / "Stop the find game", the Level radio group (disabled during a game), the line (target, target n of m, clock; not a live region) and the best kept. Mounted under the explorer panel in `src/features/player/index.tsx`, with the hook: two lines and an import.
- **Outside Touches, as IX01 asks** (`shortcuts.ts:4`): `F` and gamepad Menu are now listed. `shortcuts.test.ts` moves them from "later" to listed.

**Where the build differs from the ticket**

- **A move is any change of the cursor**, seen while rendering (React's "adjust state when a prop changes"). That's not the explorer's move actions, because the sound map's two sliders (the screen-reader path) call `moveTo` directly and dispatch no action: a slider user could not have found anything. The clock is read only in effects and timers, which keep the times in refs, so nothing impure runs in render. There's no `setState` in an effect.
- **No change places exist.** SN01's `change` is a `ChangeSummary`, a step and shares, with no places. So level 3's third target is always the ticket's fallback, the largest hot spot. It is named "the largest hot spot", not "the biggest change", so the words match what it is.
- **The words are the data set's:** "the `words.highest` place" and "the `words.edge`" (`variableWords`). The code says `highest`, not "warmest" (I02, phases.md).
- **`useExplorer.ts` is unchanged.** `cursor`, `grid`, `area` and IX03's `ensemble` were already exposed.
- A sweep or a followed hot spot moves the cursor too, so it counts as moves, and it can land on a target. That's left as it is: the listener started the sweep or the follow.
- Player hotspot: `src/features/player/index.tsx` gets the mount only. No other player ticket is claimed while this one is.

**Tests:**

- `targets.test.ts` (10): on the SN02 motion set the highest place is inside a warm patch, and with no change layer the spot is the largest hot spot. Also: unreadable cells are skipped and the first equal highest is taken; empty frames; the edge's middle point; the map area; the levels; the distance.
- `pulse.test.ts` (8): 1200 ms at 12 cells and above, 120 ms at 1 and below, linear and falling.
- `score.test.ts` (10): the formula, the floor at 0, the clock.
- `store.test.ts` (10): round trip, five corrupt records ignored, the best kept, data sets and levels apart, blocked storage.
- `FindPanel.test.tsx` (8), with fake timers and a fake ensemble:
  - The first target is the highest place, and the first pulse comes with the press.
  - More pulses in 2 s when closer.
  - Within one cell it plays the success once and announces once, the next state comes after 800 ms, the best is kept and survives a remount.
  - Moves and seconds count in the score.
  - Level 2 asks for the edge next.
  - `F` toggles and Escape stops, with no more pulses.
  - It ends with the sound map.
  - No a11y violations during a game.
- `player.test.tsx` (1): on Listen with the sound map on, the panel is there and `F` starts a game on the SN02 date; Escape stops it.

**Checks.** On this laptop the default `npm test` (8 vmThreads workers) runs out of memory (about 650 MB free), so the suite ran as `npx vitest run --pool=forks --maxWorkers=1`. Same tests, one process.

```
$ npm run lint
> moon-heist@0.0.0 lint
> oxlint
(exit 0, no warnings)

$ npx vitest run --pool=forks --maxWorkers=1
 Test Files  160 passed (160)
      Tests  2520 passed (2520)
   Duration  2838.25s (environment 90%, tests 5%, import 3%, setup 2%)

$ npm run build
✓ built in 778ms

$ npm run check-bundle
index-C1C6oaDG.js: 80664 bytes gzip (78.8 KB), within the budget of 84362 bytes (82.4 KB).

$ npx vitest run src/features/find src/features/player src/features/explore src/features/follow src/interaction --pool=forks --maxWorkers=1
 Test Files  31 passed (31)
      Tests  454 passed (454)
```

**Not checked here:** real speakers (whether 0.15 is soft enough next to the map's own move note, how the pulse feels), and the difficulty of each level on real data, which H03 decides.

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

Not started.

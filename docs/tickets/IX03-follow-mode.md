# IX03 Follow a hot spot through time

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01, SN04 |
| **Hotspots** | player |
| **Branch** | `feature/IX03-follow-mode` |

## Goal

The listener picks a hot spot and the dates play on while the cursor and the spot's own voice stay on it. When the spot disappears, the listener hears that, and it is said in words only if the gate allows.

## Why

- SN01 tracks hot spots across frames (`hotspots`, tracked by nearest centroid). Nothing uses the tracks yet.
- The locked place (`src/features/explore/useExplorer.ts`, `lock` and `playAcrossDates`) holds one fixed cell. A pool that drifts leaves the cell within a few dates, so the listener hears the wrong place.
- The date moves by `goTo` and the playback timer in `src/features/player/usePlayer.ts`. Nothing tells the explorer which spot to keep under the cursor.

## Design

- **Choosing.** `H` toggles follow: if the cursor is on a hot spot, follow that one; otherwise follow the largest one in the frame. `[` and `]` choose the previous and next hot spot in the current frame, sorted by area (largest first). These are IX01 actions (`follow`).
- **Following.** On each date step (playback or `goTo`), the tracker finds the same track id in the new frame's `hotspots`. Its centroid is an image fraction (SN01), so the cell comes from `cellOfFraction` (IX01 `notes.ts`), and the cursor moves there silently (`moveTo` with speech off). The spot's note is its entry in SN03's `MusicFrame.hotspots` with the same id (the note the Symphony hot-spot voice plays), sounded with `playNotes` on each date, panned from the centroid and raised by its height (3D only).
- **Losing it.** If the track id is not in the new frame, follow stops and the `end` figure plays: two falling `playNotes` calls, as IX01's `unlock`. The words "The hot spot has gone from the map." go through `createSpeechGate` (IX01). A dropped sentence is not repeated.
- **Stopping.** `H` again, Escape (IX01 `stopSpeech` stops follow too), or a change of visualization.
- **Undo.** Starting or stopping follow is recorded with `recordUndo`.
- **Location.** The state lives in `src/features/follow/useFollow.ts` (new), mounted by the player. The player only passes the current frame index and its features.

## Reuse

- SN01's `hotspots` (with its track id), `FrameFeatures` type from SN01's ticket file.
- SN03's `MusicFrame.hotspots` (the note of each spot, by id), and SN04's `playNotes`.
- IX01's `notes.ts`: `cellOfFraction`, `noteForPosition`.
- `src/features/explore/useExplorer.ts`: `moveTo` (with `speak = false`), `cursor`.
- `src/features/player/usePlayer.ts`: `index` and `goTo`/`showDate`.
- IX01: `useActionHandler`, `recordUndo`, `createSpeechGate`.

## Touches

- `src/features/follow/useFollow.ts` (new), `pick.ts` (pure: the choice of hot spot and the order by area), `useFollow.test.ts`.
- `src/features/player/index.tsx` (mount the hook, pass the date and features). `player.test.tsx`.
- `src/features/explore/useExplorer.ts` only to accept a silent `moveTo` (IX01 already has the `speak` flag).

## Steps

1. Write `pick.ts`: `pickHotspot(frame, cursor?)` and `orderedHotspots(frame)`, both pure.
2. Write `useFollow`: it keeps the track id in a ref (not state), and reads the new frame's features on each date change.
3. Register `follow` handlers (`toggle`, `next`, `previous`) with `useActionHandler`.
4. On each date change: find the track; move the cursor; play the spot's note; or end follow and play `end`.
5. Mount it from `player/index.tsx`. Stop follow when the explorer turns off or the story opens.

## Tests

- `pick.test.ts`: the largest spot is chosen when the cursor is not on one; `[` and `]` wrap around.
- Use an SN02 synthetic set with a known moving hot spot (the id is in SN02's ticket). After each date step, the cursor's column is within one cell of the spot's known centroid.
- The lost-spot case: the `end` sound is played once, and the gate drops a second sentence within 4 s.
- `H` toggles; Escape stops follow and the sound.
- Undo restores "not following".
- Fake engine (the `engine` mock in `Explorer.test.tsx`); `expectNoA11yViolations` on the panel text.

## Guardrails

- The same frames give the same track and the same cursor path (the tracker is deterministic).
- Peak at or below −1 dBFS; no sound before a key press or click.
- Nothing flashes; the cursor does not animate under reduced motion.
- Every sound has its text: the `end` sound's words are the "gone" sentence, through the gate.
- Changes are announced through `useAnnounce`, and automatic speech goes through the gate.
- No data-set name in `src/`: the spot is found by track id, not by place name.

The five principles, for this ticket:
1. The spot's note sounds at once when the date changes (`playNotes`, 20 ms lead).
2. Sound first: the spot's note carries the follow; words only for losing it, and then through the gate.
3. The listener can stop it with `H` or Escape, and undo it.
4. The same keys work for keyboard, touch (the hot spot is picked by tap) and gamepad (LB and RB).
5. Learn by doing: IX11 teaches `H` and `[`.

## Done when

- `H` follows the spot under the cursor, or the largest; `[` and `]` change the choice.
- On the SN02 set, the cursor stays on the spot through the dates.
- A lost spot plays the `end` sound and speaks at most one sentence per 4 s.
- Escape and `H` stop it; undo works.
- All tests pass, and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Motion arrows or vectors on the map (a separate idea).
- Following several spots at once.
- Changing SN01's tracking.

## Result

Not started.

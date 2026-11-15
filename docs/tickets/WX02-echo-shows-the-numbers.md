# WX02 Echo shows the numbers it fetched

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S |
| **Who** | agent |
| **Needs** | WX01 |
| **Hotspots** | — |
| **Branch** | `feature/WX02-echo-shows-the-numbers` |

## Goal

Under Echo's answer in the Jukebox, a "Show the numbers" disclosure lists every value Echo fetched (time, value and unit) in an accessible table. While the sound plays, the row being heard is marked. This works for weather and for every Planetary Computer series.

## Why

- The route returns only the reply, the theme and the `AudioPayload` (`server/app/api/mascot.py` `MascotAnswer`). The dates and values are thrown away after `answer_for` (`server/app/agent/planetary.py:237`). So a listener hears 24 notes but can read only the lowest and highest.
- "Every sound has a text equivalent" (`.claude/rules/frontend.md`). Each note should have a row a screen reader can reach.

## Design

- **Server**: `MascotAnswer` gains `series: {metric, unit, times[], values[]} | None`, filled in `answer_for` from the state and the source's labels. It is `None` for a local data set, for help, and on error.
- **Browser**:
  - `mascotQuery.ts` validates `series` with zod; a bad series is dropped, not an error.
  - A new `SeriesTable.tsx` in `src/features/jukebox/` renders a `<details>` with "Show the numbers", then a `<table>` with a caption ("Air temperature, °C"), one row per value, times in the listener's locale, and `aria-current="true"` on the row playing.
  - `JukeboxPlayer` gains an optional `onStep(index | null)` prop. It schedules one event per step on the Transport, the same way as the captions, and calls back with null on Stop. Without the prop nothing changes. (No open ticket holds the player, so no board post was needed.)
- Labels and units come from the server. Nothing specific to weather goes in `src/` (`phases.md`).

## Reuse

The `Card` and `Notice` components; the design tokens; `useAnnounce` (the reply is already announced, so the table is not); the `fetch` stub and `expectNoA11yViolations` patterns in `src/features/jukebox/JukeboxStudio.test.tsx`.

## Touches

`server/app/api/mascot.py`, `server/app/agent/planetary.py`, `server/tests/test_mascot.py`, `src/features/jukebox/mascotQuery.ts` (+ test), `src/features/jukebox/SeriesTable.tsx` (new, + test), `src/features/jukebox/JukeboxStudio.tsx` (+ test), `src/features/jukebox/JukeboxPlayer.tsx` (+ test), `src/features/jukebox/jukebox.css`.

## Steps

1. Add `series` to the answer, with server tests.
2. Parse it in `mascotQuery.ts`, with tests for good, missing and bad series.
3. Write `SeriesTable` and its test (role `table`, caption, rows, `aria-current`, a11y).
4. Render it under the reply in `JukeboxStudio`.

## Tests

`SeriesTable.test.tsx`: find it by `getByRole('group')` / `getByText('Show the numbers')`, open it with `userEvent`, check the row count and caption, and run `expectNoA11yViolations`. `test_mascot.py`: the series is in the answer for a fetch and absent for help.

## Guardrails

- Nothing flashes. Under `prefers-reduced-motion`, the playing row's mark does not animate.
- The table is closed by default, so the sound comes first and the words on request (PLAN §6.3).

## Done when

- After a weather answer, opening "Show the numbers" lists every hour with its temperature, and the playing hour is marked.
- The same works for a sea surface temperature answer.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- A chart (the player's own visuals stay as they are), and the layout pass (`platform.md`).

## Result

Built by agent A on 2026-11-14, on top of the local WX01 commit.

- **Server**:
  - `MascotAnswer` gains `series: {metric, unit, times, values}`, filled by `answer_for` for every fetched series (weather and Planetary Computer);
  - it is null for help, a local data set, or an error.
- **Browser**:
  - `queryMascot` validates `series` with zod; a bad series is dropped and the reply kept;
  - the new `SeriesTable` is a closed `<details>`, "Show the numbers", holding a captioned table with one row per note, days or hours in UTC, and the playing row marked with `aria-current` (a colour change only);
  - `JukeboxPlayer` gains an optional `onStep`;
  - `JukeboxStudio` wires the two together under Echo's reply.

Checks:

```
(cd server && .venv/bin/python -m pytest)   396 passed, 2 skipped, 14 warnings in 11.32s
npm run lint                                exit 0; only the existing warnings in src/features/compare/Fusion.tsx
npm test                                    Test Files 222 passed (222)
npm run build                               ✓ built in 970ms
```

`npm test` was flaky: two earlier full runs failed 40 and then 14 tests in `Explorer.test.tsx` and `player.test.tsx`. Neither file imports the Jukebox, and both passed alone (193 of 193). Run on the WX01 commit without these changes, the suite failed only the known `ArtPanel` flake. The run quoted above passed in full.

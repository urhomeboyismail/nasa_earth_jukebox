# S05 Salvage the T114 change-style listening sheet

| | |
|---|---|
| **Priority** | P0 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | S02 |
| **Hotspots** | — |
| **Branch** | `feature/S05-t114-sheet` |

## Goal

The listening sheet for the "Change from normal" sound is on `main` as `docs/tests/t114-listening-check.md`. Every answer in it has been re-derived from the data, and its links point at the current documents. The sheet stays marked NOT RUN until a listener has taken part.

## Why

- The finished work is commit `d755c87` ("T114: ready-to-run listening check for the change sound") on `feature/T114-listening-check`, based on `main`. It adds one file, `docs/tests/t114-listening-check.md` (+80). It cherry-picks cleanly.
- Part 1 (12 date pairs) comes from `public/data/synthetic-change/expected.json`, which is on `main`.
- Part 2 (six warm-edge traces) uses five rows from `mur-sst-mauritius`. That data set exists only after S02 lands. So S05 needs S02 for those rows. The queue row says "—" under Needs, and it should say S02.
- The sheet points at `docs/TICKETS.md` for "T114 step 7". That text now lives in `docs/archive/TICKETS-pre-v3.md`. The link must change.
- The sheet names the controls: a "Sound" control with "Full" and "Change from normal", and a "Trace the warm edge" button. In the app, the label "Sound" is at `src/features/player/index.tsx:230`, the style choices are at about line 231, and the trace button is at about line 253. If a label differs, correct the sheet. Do not change the app for the sheet.
- The sheet is the basis for H04 (the change-style check on real data). An error here would mislead the listening test.

## Reuse

- `public/data/synthetic-change/expected.json`: the known answers for Part 1.
- The app's own change steps and contour tracing, for Part 2. Use the app, not a second implementation.

## Touches

- `docs/tests/t114-listening-check.md` only.

## Steps

1. Use a worktree: `git worktree add ../nasa-a main`, then `cd ../nasa-a && git switch -c feature/S05-t114-sheet`. Run `git cherry-pick d755c87`.
2. Part 1. Open `public/data/synthetic-change/expected.json`. For each of the 12 pairs, check the "Correct" column and the "What the temperature says" column. Write the rule you used for "About the same" in the Result, and check that it matches the app's rule.
3. Part 2. Trace the five `mur-sst-mauritius` rows in the app once S02 is on `main`. Check the thirds of the map (west, middle, east) and the average x of the line's points. If S02 is not on `main` yet, leave those rows marked "pending S02", and keep the sheet NOT RUN.
4. Check the synthetic-change row (15 October 2024, +1 °C) the same way.
5. Replace the link to `docs/TICKETS.md` with a link to `docs/archive/TICKETS-pre-v3.md`, or to the queue item H04 once H04 exists in `docs/TICKETS.md`.
6. Check the control names against `src/features/player/index.tsx`. Correct the sheet if a name differs.
7. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

Not applicable: a document. The checks are the re-derivation in Steps 2 to 4 and the link check below.

## Guardrails

Not applicable: no sound or visual change.

## Done when

- Every row of Part 1 has been re-derived from `expected.json`, and the Result names the method.
- The five Mauritius rows are either checked after S02, or marked "pending S02" with the reason.
- The sheet still says NOT RUN, and it has no names of listeners.
- The links resolve.

## Checks

```bash
npm run lint && npm test && npm run build
for p in $(grep -o '`[^`]*\.\(md\|json\|ts\|tsx\)`' docs/tests/t114-listening-check.md | tr -d '`' | sort -u); do test -e "$p" || echo "missing: $p"; done
```

## Out of scope

- Running the listening test (H03, H04).
- Changing the change-style sound.
- Other parts of the T114 work that are not in this commit.

## Result

Branch `feature/S05-t114-sheet`: `d755c87` cherry-picked (clean), then one commit with the corrections below. Only `docs/tests/t114-listening-check.md`, `docs/tickets/S05-salvage-t114-sheet.md`, `docs/TICKETS.md` and `docs/PRE-HACKATHON-WORK.md` change. The sheet still says NOT RUN and has no names.

**Part 1 (12 pairs): all 12 rows matched, no answer changed.** Method: for each pair, take the change step (and, for the temperature column, the category) of both dates from `expected.json` for `regions[0]` (`east-patch`), and compare them by index in the manifest's `changeSteps` and `categories`. "About the same" is equal index, which is the app's rule in `src/features/compare/judge.ts` (same change step when both dates have one, otherwise same category). Ten of the twelve pairs have different change and temperature answers (pairs 4 and 8 agree), as the sheet says. The rule is now written into the sheet.

**Part 2 (six lines): the numbers all matched, but the structure was misleading, and is corrected.** I scored each date with the app's own `scorePixels` on the real PNGs (a throwaway test, deleted, not committed):
```
synthetic-change 2024-10-15: +1: x 0.66 to 0.89, mean 0.78      (the only line in the 12 dates)
mur 2023-03-24: +1: x 0.64 to 1.00, mean 0.81 | +2: x 0.00 to 0.05, mean 0.03
mur 2023-03-14: +1: x 0.59 to 0.96, mean 0.81
mur 2023-04-03: +1: x 0.81 to 1.00, mean 0.89 | +2: x 0.04 to 0.22, mean 0.14
mur 2023-05-23: +1: x 0.38 to 0.77, mean 0.61
```
The thirds (left, middle, right) and the averages in the sheet match. What the sheet missed: "Trace the warm edge" plays every line of the date in turn (`traceWarmEdge` in `src/features/player/usePlayer.ts`), +1 first, then +2, so 24 March and 3 April each play two lines, and rows 4 and 6 are one press of 3 April. The sheet now says so, labels each row first or second line, notes that 24 March's first line (+1, right) is not scored, and tells the facilitator to ask about each line.

**Also corrected:**
- After each line the app says it in words ("runs from the north-west to the east", `describeContour` in `src/describe/change.ts`), which would give the Part 2 answer to a listener with a screen reader. The sheet now says to turn the screen reader off for Part 2.
- On Compare the style is a toggle button "Change from normal", not Listen's "Sound" group. Both are named in the sheet, with a note that the choice is remembered and must not be "Simple".
- The link to `docs/TICKETS.md` for "T114 step 7" now points at `docs/archive/TICKETS-pre-v3.md` (and H04 for the run).
- Control names checked against `src/features/player/index.tsx` and `src/features/compare/index.tsx`: "Sound", "Full", "Change from normal", "Trace the warm edge" (the edge word is "warm edge" by default and explicit for Mauritius).
- Only October has a line in `synthetic-change`: checked for all 12 dates.

```
$ npm run lint
(oxlint: no warnings or errors)
$ npm test
 Test Files  64 passed (64)
      Tests  1203 passed (1203)
$ npm run build
✓ built in 362ms
$ for p in $(grep -o '`[^`]*\.\(md\|json\|ts\|tsx\)`' docs/tests/t114-listening-check.md | tr -d '`' | sort -u); do test -e "$p" || echo "missing: $p"; done
(no output)
```

Not done: running the listening test (H03, H04), as the ticket says. The pass rule ("4 of 6" lines) is unchanged, and still counts the six lines in the table.

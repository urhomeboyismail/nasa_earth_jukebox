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
- Review: the team leader (the change sound is the team leader's area, `docs/PLAN.md` §4).

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
- The team leader has reviewed the answers.

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

Not started.

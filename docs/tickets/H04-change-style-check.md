# H04 Change-style check on real data

| | |
|---|---|
| **Priority** | P3 |
| **Size** | S (under half a day, plus the listeners) |
| **Who** | 👤 |
| **Needs** | S02, S05 |
| **Hotspots** | — |
| **Branch** | `chore/H04-change-style-check` |

## Goal

Decide, on the real data set, whether the "change from normal" sound (the `"change"` style, sound pipeline v2) is at least as good as the current notes for answering "which date is further above normal?". Record the decision in the listening-check file. Until it is recorded, the demo calls the change sound "experimental".

## Why

- `docs/PLAN.md` §6.2, "13 Nov decision rule": if the bed scores at least as well as the current notes in a pilot check (T114), `"change"` becomes the default for data sets with a baseline. Otherwise it stays an opt-in style and the demo uses v1.
- The change style has not been checked by a listener. `docs/submission/demo-script.md` (the "Do not show" rule) says it is shown only as "experimental" until the check is written.
- S02 brings the real `mur-sst-mauritius` data set into the repo. S05 brings the listening sheet from T114 (`docs/tests/t114-listening-check.md`). Both are needed first.

## What to do

1. Confirm S02 and S05 are `done`. Note the commit.
2. Check the data set: `npm run check-data` passes. Open the manifest and note whether it has a `baseline` (and its `kind`, `label` and `noiseFloor`). A data set without a baseline cannot use the change style, so the decision is "not applicable" for it, and you stop here after writing that down.
3. Check the baseline wording with a person on the team: the `baseline.label` (for example "the 1991 to 2020 August average") is what listeners will hear and read. It is in the manifest, so change it there only (`docs/DATASET-PLAYBOOK.md`), never in `src/`.
4. Run the pilot with at least 3 listeners, with headphones, the same volume as the other checks. Use the sheet in `docs/tests/t114-listening-check.md`. For each listener, play the same two dates in the current style and in the change style, in alternating order, and ask: which date is further above normal? Record the answer and whether it was right.
5. Score the pilot in the sheet: right answers for each style, out of the number asked. Write the decision.

## The decision

- **`"change"` becomes the default for this data set** only if its right answers are at least as many as the current notes', over the same questions, and at least one listener is not sighted (or the answer says that no such listener took part).
- **Otherwise** the change style stays an opt-in style, and the demo uses the current notes. Write the reason in one line.
- Write the decision in `docs/tests/t114-listening-check.md` with the date, n, the scores, and the commit tested. Update the demo script's "experimental" line only if the decision says so, and only by a person.

## Done when

- `docs/tests/t114-listening-check.md` has the pilot table, the n, the decision and the commit.
- The baseline label and noise floor are the ones in the manifest, and `npm run check-data` passes.
- The demo script's wording about the change sound matches the decision.

## Checks

```bash
npm run check-data
grep -rnE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/tests   # must print nothing
```

## Guardrails

No sound is changed by this ticket. If the change style sounds wrong, record it and open a ticket; do not tune it here.

## Out of scope

- Changing the sound or the mapping (a new ticket, by the team leader).
- Choosing a baseline kind for other data sets.
- The full practice test (H03).

## Result

Not started.

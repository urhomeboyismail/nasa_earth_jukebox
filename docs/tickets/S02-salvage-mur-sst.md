# S02 Salvage the `mur-sst-mauritius` data set

| | |
|---|---|
| **Priority** | P0 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | catalogue |
| **Branch** | `feature/S02-mur-sst-mauritius` |

## Goal

The first real NASA data set, sea surface temperature around Mauritius from January to August 2023, is on `main`. It is listed in `public/data/index.json`, passes `npm run check-data`, and its credit and licence wording has been checked by a person.

## Why

- The work is one commit, `479df87` ("T85: first real data set…"), on `feature/T85-mur-sst-mauritius`, based on `main` at `afcbc8f`. Check with `git branch -a --contains 479df87` and `git show --stat 479df87`.
- It changes 30 files (+2379 −48):
  - `public/data/mur-sst-mauritius/`: `manifest.json` and 20 frame PNGs (no baseline PNGs; the baseline is a reference date);
  - `public/data/index.json` (+5);
  - `docs/data-sources.md` (+17): a section "Real data set: `mur-sst-mauritius` (T85)";
  - `docs/AGENT-BOARD.md` (+20): entries `R-20261109-T85-1` and `R-20261109-T85-2`, both `open`;
  - `docs/PRE-HACKATHON-WORK.md` (+1);
  - `src/data/__golden__/change.json` (+80): three recorded Scores;
  - `src/data/change-regression.test.ts`: now scores reference-date baselines too;
  - `src/App.test.tsx` and `src/components/DatasetPicker.test.tsx`: one line changed in each.
- The commit also deletes `.claude/hooks/layout-changed.sh` (41 lines), which `main` still has. A data set has no reason to touch it. Leave the deletion out, unless H01 decides to delete the hook.
- **Credit conflict.** The manifest's `source.credit` (line 13 of `public/data/mur-sst-mauritius/manifest.json`) names "GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis (v4.1), NASA PO.DAAC", and `source.license` is "CC0 (…)". The commit message says the "PO.DAAC citation is left out until a person checks it". The two disagree. A person must settle the wording before the merge (👤).
- The T88b demo script (`docs/submission/demo-script.md`, on `feature/T88b-demo-script`) and the README draft (S03) both name this data set. The demo script links board entry `R-20261109-T85-2`. Until S02 lands, those links point at nothing.
- The rehearsal copy `public/data/rehearsal-sst/` is git-ignored. Never commit it (`docs/data-sources.md`).

## Reuse

- `docs/DATASET-PLAYBOOK.md`: the steps for a data set.
- `docs/data-sources.md`: the manifest fields.
- `npm run check-data`: schema, images, legend, no `TODO`.
- The frames were made by `scripts/convert_frames.py`. Do not edit frames, numbers or baselines by hand. Regenerate them with the converter if something must change.

## Touches

- `public/data/mur-sst-mauritius/**`, `public/data/index.json`, `docs/data-sources.md`, `docs/AGENT-BOARD.md`, `docs/PRE-HACKATHON-WORK.md`.
- `src/data/__golden__/change.json`, `src/data/change-regression.test.ts`, `src/App.test.tsx`, `src/components/DatasetPicker.test.tsx`.
- Review: Dhruv (`public/data/`, `src/data/`). The team leader approves any change to a golden file (`src/data/sound-regression.test.ts` header). Mohammad for `src/App.test.tsx`.

## Steps

1. Use a worktree: `git worktree add ../nasa-a main`, then `cd ../nasa-a && git switch -c feature/S02-mur-sst-mauritius`.
2. Run `git cherry-pick 479df87`. Then run `git show --stat HEAD` and check the file list against Why.
3. Keep `.claude/hooks/layout-changed.sh` as it is on `main`: run `git checkout main -- .claude/hooks/layout-changed.sh` and amend, unless H01 has decided to delete the hook.
4. Credit and licence (👤). A person checks NASA's own page for this data set, and the GIBS credit line, against the NASA Earthdata data use policy. Replace `source.credit` and `source.license` with the wording that was confirmed. If the PO.DAAC citation cannot be confirmed, remove it and say so. Put who checked, and when, in the pull request description, not in the manifest.
5. Set the words explicitly, so the Mauritius text stays the same after the neutral defaults land (I02). Add this to the manifest's `variable` object: `"words": { "higher": "warmer", "lower": "cooler", "highest": "warmest", "lowest": "coolest", "edge": "warm edge", "thing": "water" }`.
6. Check the structure that the schema does not catch: each comparison's `regionId` is `regions[0]`, each story chapter's frames exist, and the baseline's noise floor (0.3 °C) matches the manifest's description.
7. Run `npm run check-data` and `npx vitest run src/data src/analysis`. If the change regression reports a difference, stop and find out why. Do not rewrite `change.json` to make the test pass. Any golden change goes in the pull request description, with the reason.
8. Board. Keep `R-20261109-T85-1` and `R-20261109-T85-2` open until the team answers. When answered, record the answer in the entry and in the pull request.
9. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon": S02, the first real data set, `mur-sst-mauritius`.
10. Run the checks.

## Tests

- `npm run check-data` covers the schema, the images, the legend and the absence of `TODO`.
- `src/data/change-regression.test.ts` covers the recorded Scores for three frames.
- Check that `grep -n -i "not yet\|TODO" public/data/mur-sst-mauritius/manifest.json` prints nothing.
- No new unit test is needed. This ticket adds data only.

## Guardrails

Data only. The sound engine and the visuals are not changed. The existing guardrails for the engine apply, as they do for any data set.

## Done when

- `npm run check-data` passes and `public/data/index.json` lists `mur-sst-mauritius` with its title and summary.
- The credit and licence wording is the one a person confirmed. The pull request says who checked and when (👤).
- The manifest has no "not yet checked" or `TODO` text.
- `variable.words` is set explicitly, and the Mauritius text reads as it did before.
- `docs/data-sources.md` matches the manifest: dates, frame count, baseline, number of comparisons and story chapters.
- The rehearsal copy is not committed.
- Dhruv has reviewed the data, and the team leader has approved any golden change.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
npx vitest run src/data src/analysis
```

## Out of scope

- Rewriting the comparisons or the story. Their wording is checked in H04 and H07.
- The known-answer check against NASA's numbers (D04).
- Other NASA data sets (EIC02, EIC03).
- Changing the sound or the visuals.

## Result

Branch `feature/S02-mur-sst-mauritius`: `ce3f4b1` (cherry-pick of `479df87`, 29 files) plus one commit that adds `variable.words`. Conflicts were only in `docs/AGENT-BOARD.md` and `docs/PRE-HACKATHON-WORK.md`; both kept `main`'s entries and added the new ones. The deletion of `.claude/hooks/layout-changed.sh` was left out (`git diff main -- .claude` is empty). The T85 line in `PRE-HACKATHON-WORK.md` is now the S02 line.

Done:
- Step 5: `variable.words` set explicitly (warmer, cooler, warmest, coolest, warm edge, water).
- Step 6: every comparison's `regionId` is `regions[0]` (`mauritius`); every comparison and story frame, and the baseline frame, exists among the 20 frames; the baseline `noiseFloor` is 0.3, as in `docs/data-sources.md`. The manifest's `description` does not mention the floor.
- Step 7: the change regression passes, so `change.json` is unchanged from the cherry-pick (three recorded Scores added by T85, none rewritten).
- Step 8: `R-20261109-T85-1` and `R-20261109-T85-2` are on the board and still `open`.
- No `TODO` or "not yet" text in the manifest; no `rehearsal-*` data committed.

**Step 4, credit and licence (👤), partly done on 9 Nov 2026.** The PO.DAAC dataset page was read in a browser (Citation tab). The title, the DOI 10.5067/GHGMR-4FJ04 and the suggested citation are confirmed, and the citation is now in `source.credit`, followed by GIBS's acknowledgement. The page states no licence. The Earthdata data use page could not be opened in that session (the browser blocked the domain), so `source.license` is still the CC0 wording from `479df87`, unchecked. A person still has to confirm the CC0 line against https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance and put who checked and when in the pull request description. The other open checks are in `docs/data-sources.md` under "A person still has to check".

```
$ npm run lint
(oxlint: no warnings or errors)

$ npm test
 Test Files  61 passed (61)
      Tests  1121 passed (1121)

$ npm run build
✓ built in 415ms

$ npm run check-data
 Test Files  9 passed (9)
      Tests  190 passed (190)

$ npx vitest run src/data src/analysis
 Test Files  17 passed (17)
      Tests  287 passed (287)
```

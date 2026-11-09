# EIC03 Ingest and tune each picked visualisation (manifest and data only)

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M each |
| **Who** | agent+👤 |
| **Needs** | EIC01, EIC02 |
| **Hotspots** | catalogue |
| **Branch** | `feature/EIC03-<id>`, one branch for each picked data set (`<id>` is the id from EIC02) |

## Goal

Each visualisation picked in EIC02 becomes a checked data set in `public/data/<id>/`: dated frames, a colour scale, the map area, a web video (when it is an animation), a manifest with its source, its words, its comparisons and its story, an entry in `public/data/index.json`, and a sonification preset chosen by a person. It is tuned by changing its **data and manifest only**. No file in `src/` changes.

## Why

- `docs/PLAN.md` §6.3 and `.claude/rules/phases.md`: from 9 November each NASA data set is refined through its own manifest and data, not through code. `docs/DATASET-PLAYBOOK.md` is the order to do it in.
- EIC01 writes the folder and most fields. What is left is the words, the choices and the checks against the NASA source, which need a person.
- A data set that cannot be checked is worse than none: `npm run check-data` must pass, and every number in the manifest must come from the source page or from the picture.

## Design

### The steps, per data set

1. **Source.** Take the EIC02 row for `<id>`: the page, the exact credit, the licence, the colour bar's ends and unit, the baseline candidate. Download the frames (or the MP4) from the page, and write the download date.
2. **Rehearse first.** Ingest into `public/data/rehearsal-<name>/` (git-ignored) to check the colour bar and the map area. Only then the real folder.
3. **Ingest.** With EIC01, into `public/data/<id>/`:
   ```bash
   .venv/bin/python -I scripts/eic_ingest.py --id <id> --video <file.mp4> \
     --start-date <YYYY-MM-DD> --step-days <n> \
     --legend-min <min> --legend-max <max> --legend-ticks 9 \
     --preset <major|dorian|pentatonic> --out public/data/<id>
   ```
   (or `--frames <dir> --dates <csv>` for a folder). Run `--detect-only` first, and check the printed direction of the bar against the page.
4. **Baseline.** If the data set has one (EIC02), use the converter's baseline flags (`docs/data-sources.md`, "Baselines (v2, T111)"), with the label as the page states it (for example "the 1991 to 2020 August average"). Never call a `reference-date` change "anomaly" (`PLAN.md` §5.1).
5. **Manifest words.** Replace every `TODO`: title, summary, description, variable name and unit, the source's name, URL, credit, licence and `retrievedOn`, the region's name and description, the alt text of each frame (from the page, adapted to the frame). Copy the credit and the licence exactly.
6. **Categories.** Five categories, coolest first, with labels and notes that fit this variable (the converter splits the legend evenly; adjust the split to the variable's meaningful breaks, and keep them contiguous, with no gap). With a baseline, `changeSteps` and `contourLevels` that fit the size of this data set's changes (`docs/DATASET-PLAYBOOK.md` step 4).
7. **Preset.** Choose one of `major`, `dorian`, `pentatonic` (SN03). Write the reason in one sentence in the data set's notes (`docs/data-sources.md`, a row under the EIC03 section). The choice is artistic. It never carries data.
8. **Detail.** Optional: `calm`, `standard` or `full`, for the level a first listener should hear. Default `standard`.
9. **Voices.** Optional: a list of voices, when this data set has no use for one (for example no `motion` for a still picture). Leave it out otherwise.
10. **Comparisons.** At least one per data set. Each: two dates (`frameA`, `frameB`), a question a listener can answer by ear or by eye, the answer (`a`, `b` or `same`) and an explanation that cites the source page. Compare, the listening test and the Compare page use `regions[0]`, so `regionId` is the first region. With a baseline, include one comparison where "by value" and "by change" give different answers.
11. **Story.** Optional chapters (`story`), forward in time, each with a text taken from the source page and `fromFrame`, `toFrame` as real frame ids.
12. **Index.** Add the entry to `public/data/index.json` (the title and the summary, neither containing `TODO`).
13. **Check.** `npm run check-data` must pass with no `TODO`. `npm test` must pass. With a baseline: record its `Score`s in `src/data/__golden__/change.json` (the test tells you how, `change-regression.test.ts`) and read the diff. Only add the id to `BASELINED` in `src/data/sound-regression.test.ts` when the team has agreed the sound.
14. **Listen and tune.** `npm run dev`, then `#listen?data=<id>`. Tune only manifest values until the sound and the words read right. Keep notes of each change in the data set's notes.
15. **Commit.** On `feature/EIC03-<id>`: the data set folder (without a `rehearsal-*` folder), its `index.json` entry, the golden files if they changed, and a line in `docs/PRE-HACKATHON-WORK.md` under "During the hackathon". No change to `src/` (the phases rule). If a general field is needed, it is a separate ticket.

### What counts as tuned

- Every frame's alt text describes what is on that frame, from the page (not invented).
- The categories' labels are words a listener would use for this variable.
- The comparisons' answers were checked against the source page or the picture, and the explanation says so.
- The sound was heard through at least once by the person who signs off.

## Reuse

- `scripts/eic_ingest.py` (EIC01), `scripts/convert_frames.py` (its guarantees), `scripts/templates/manifest.template.json`.
- `docs/DATASET-PLAYBOOK.md`, `docs/data-sources.md` ("Manifest fields", "Converting frames (T91)", "Baselines (v2, T111)").
- `npm run check-data`, `src/data/change-regression.test.ts`, `src/data/sound-regression.test.ts`.
- `public/data/synthetic-change/manifest.json` as an example of a finished manifest with a baseline (its words are made up: do not copy them).

## Touches

- New: `public/data/<id>/**` (the folder; `frames/`, `video/`, `baselines/`, `manifest.json`).
- Edit: `public/data/index.json` (one entry), `src/data/__golden__/change.json` (only if the data set has a baseline; additive), `src/data/sound-regression.test.ts` (`BASELINED`, only after the team agrees the sound), `docs/PRE-HACKATHON-WORK.md`, `docs/data-sources.md` (the notes section for the data set).
- No other file. In particular, nothing in `src/` except the golden and the `BASELINED` list named above.
- Reviewers: Dhruv (`public/data/`), and the person who signs off the sound (the team leader or the listening check, H03).

## Steps

Run once per picked data set, on its own branch. Do them in order: 1 to 13 are agent work; 14 and 15 need a person.

1. Read EIC02's row and the playbook. Do not start without a recorded credit and licence.
2. Download and rehearse (steps 1 and 2 above). Attach the detect-only output to Result.
3. Ingest, then fill the manifest (steps 3 to 12).
4. Check (step 13). Paste the real output under Result.
5. Hand over: the person listens (step 14) and signs off (step 15).

## Tests

- `npm run check-data` (all data sets, including the new one): schema, files, frame sizes, the legend's round trip, the categories' coverage, the video's container and date grid (SN05), and no `TODO`.
- `npm test` (the sound regression and the change regression for the new data set, when they are added).
- A comparison's frames and region are checked by the schema (it does this; it is not a test to write).
- The listening check: a person hears the data set through, in Symphony and in Simple, and says whether it reads right. The result goes to `docs/evidence/` (the protocol is there).

## Guardrails

- Data and manifest only. No code in `src/` for one data set (`.claude/rules/phases.md`).
- Every number in the manifest comes from the page, the file or the legend: never a guess. Unknown is written as a `TODO` and the ticket stops until it is answered.
- The credit and the licence are copied from the page, with the date read. A part that is not clearly free to use is not published.
- No model writes any word on the manifest. The alt text and the descriptions are written by a person from the page.
- The sound's preset is a choice, written as a choice, not as a fact about the data.
- `rehearsal-*` folders and their `index.json` entries are never committed.

## Done when

- The data set passes `npm run check-data` with no `TODO`, `npm test` passes, and its entry is in `index.json`.
- Its comparisons and story (if any) cite the page, and the preset and reason are written down.
- A person has listened through it in Symphony and Simple, and signed off on the branch.
- The branch is ready for review; nothing is pushed or merged without the person's go-ahead.

## Checks

```bash
npm run check-data
npm run lint && npm test && npm run build
.venv/bin/python -I -m pytest scripts/tests/test_eic_ingest.py    # if the ingest script changed in between
git status --short public/data/                                  # no rehearsal-* folder staged
```

## Out of scope

- Choosing the visualisations (EIC02) and writing the ingest script (EIC01).
- Any code change for one data set. A general manifest field goes through SN05 or a new ticket.
- Known-answer checks against NASA's numbers (D04).
- The listening-test study and its results (H03, H04).

## Result

Not started.

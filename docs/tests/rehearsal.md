# Rehearsal: real NASA sea-temperature frames through the converter (7 Nov 2026)

A dry run of the 13 Nov real-data steps (T85) on frames we already have, so the first real conversion holds no surprises.
Output: `public/data/rehearsal-sst/` (git-ignored, not committed). Branch `feature/T85-rehearsal`.

**Input:** `docs/planning/prototype/pipeline/cache/`: 20 GIBS frames of `GHRSST_L4_MUR_Sea_Surface_Temperature` around Mauritius (160 × 160, every 10 days, 23 Jan to 1 Aug 2023) and the layer's colour map (`colormap-GHRSST_Sea_Surface_Temperature.xml`).

## What the times mean

Times are **wall-clock gaps between command timestamps** in the session, so a step includes the time to write its command or script. They are not stopwatch times of a person at a keyboard: doing these steps by hand will take longer, especially step 6 (reading the source page). Clock times are 7 Nov.

| # | Manual step | Time | Notes |
|---|---|---|---|
| 1 | Set up the Python environment (`python3 -m venv .venv && pip install -r scripts/requirements.txt`) | 11 s | One-off |
| 2 | Look at the input: sizes, colour mode, transparency | about 1 min | The frames are RGBA; land (6.3% of pixels) is transparent; `2023-02-02` is 100% transparent (NASA published nothing that day) |
| 3 | Turn the colour map XML into `legend.json` (215 stops; value = middle of each bin; the two open-ended bins use the edge ± 0.075) | about 1 min | A throwaway script, **not in the repo**. The converter has no XML reader, and `--legend-box` cannot be used because GIBS tiles carry no colour bar |
| 4 | Flatten each frame onto an opaque land colour (grey 128,128,128, checked not to be on the legend) | under 1 s to run (same script as step 3) | The converter refuses transparent pixels. The grey matches the template's `noData` |
| 5 | Run `convert_frames.py` with `--baseline-kind reference-date --baseline-frame 2023-01-23 --baseline-label "23 January 2023"` | under 1 s (13:42:39) | 20 frames and a manifest with 33 `TODO` fields; noise floor 0.3 °C |
| 6 | Fill in the 33 `TODO` fields and add the data set to `index.json` (by script) | about 40 s (13:42:39 to 13:43:18) | Title, summary, description, variable, source, region, one alt text per frame. **Credit and licence were not checked against the source page** (see "Not verified") |
| 7 | `npm run check-data`, first run | 10 s | Failed on one guard (see "What broke") |
| 8 | Run the app's real analysis on the 20 frames to see what it reads (throwaway test, not kept) | about 40 s | Medians match the prototype's day-1 report to within one legend bin (0.15 °C) |
| 9 | Ask GIBS which layers exist (WMTS capabilities, 5 MB) | about 20 s | To justify the baseline choice |
| 10 | Move the 2 of 30 region points that sat on land; set the five categories to the data's real span | about 15 s | Neither was reported by `check-data` |
| 11 | `npm run check-data` again, `npm test`, `npm run lint`, remove the `index.json` entry | about 1 min | See "Verified" |

About 4 minutes between the first and last command. Reading `AGENTS.md`, the feature review and the tickets before that is not counted.

## Baseline: reference-date, and why

`reference-date`, frame `2023-01-23`, label "23 January 2023" (it plays as "change since 23 January 2023").

- **Why not a better kind.** The preferred kind (`docs/data-sources.md`, "Baselines") is `anomaly-product`. GIBS has one: `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` is in the capabilities list. **It is not in this cache**, and the brief was to use the cache. A `climatology` needs a long-term average for each calendar month, one picture per frame, and nothing here provides it.
- **What it costs.** January to August is autumn and winter in the southern hemisphere, so the sea cools. Against 23 January every later date reads below normal, and by July "much below" (−2 to −2.4 °C). That is the season, not a climate signal, which is exactly what the docs warn about. The change sound on this data set says "it gets colder in winter" and nothing more.
- **For 13 Nov:** fetch the anomalies layer for the same dates and box, check its colour map spans both signs (the converter and `check-data` enforce this), and use `--baseline-kind anomaly-product`. Not done here.

## What broke, and what I changed

1. **`check-data` failed once a data set with a baseline was listed in `index.json`.** The guard in `src/data/change-regression.test.ts` ("has an entry for every data set in index.json that has a baseline") expects only `synthetic-change` and wants recorded Scores for any other. For a git-ignored `rehearsal-*` folder that demand is wrong. **Fix:** the guard now skips ids starting with `rehearsal-` (the prefix `.gitignore` uses). Every other data set with a baseline still needs an entry.
2. **Nothing in the converter broke.** It rejects transparent frames with a clear message, by design. I did not change it.

## What `check-data` does not catch (found, not fixed)

- Two of the 30 default region points were on land (the centre of the island). `check-data` passes anyway; only the converter's "Also check" list mentions it.
- The default categories split the legend's whole range (−0.075 to 32.075 °C) in five. Real values here run from 24.7 to 28.6 °C, so 17 of 19 dates came out "hot". I re-cut the ranges at 25, 26, 27 and 28 °C by hand. The labels are still the template's "Cold, Cool, Mild, Warm, Hot", which is wrong in words for a 24 °C sea; a person needs to rename them.
- `changeSteps` default to −1, −0.25, 0.25 and 1 °C; with a 0.3 °C noise floor the "normal" band is narrower than the floor. Not changed.
- The gap date 2 Feb reads as "insufficient" (0 readable points), as it should, so it plays the hiss.

## Verified

- The converter ran on the 20 real frames and wrote a manifest the schema accepts.
- `npm run check-data` passes (8 files; 184 tests with the rehearsal entry listed in `index.json` after the guard fix, 178 without it).
- The app's analysis reads the frames: 19 dates with data and 28 of 30 points readable on each, with the gap date "insufficient". Per-date medians are within one legend bin of the prototype's day-1 report.
- `npm run lint`: no errors (warnings only, all in `Explorer.tsx`, which I did not touch).
- `npm test` without the rehearsal entry in `index.json`: 890 of 891 pass. The one failure is `change-regression.test.ts > gives the same Score every time`, a 5 s timeout in the full parallel run. **It fails the same way with my change stashed**, and the whole file passes alone in 7.8 s. I did not change it.
- With the rehearsal entry **in** `index.json`, two more tests fail (`App.test.tsx`, `DatasetPicker.test.tsx`), because they expect the exact catalog. That is why `docs/data-sources.md` says to take the entry out again; it is out now.

## Not verified

- **Listening.** Nobody has heard this data set, in either the temperature or the change sound.
- **A browser.** I did not open Listen, the explorer or Compare on `rehearsal-sst`, so I have not seen the picker, legend, alt text or the change style on it.
- **The analysis after moving the land points.** The 28 of 30 count is from before the move; afterwards I re-ran `check-data` only.
- **Manifest text.** Credit and licence are placeholders, not copied from a NASA page. The source URL is the colour map, not the layer's page. The "MUR" description and the note about the blank 2 Feb map come from the prototype's report and the layer id, not from a NASA page I read.
- **The anomaly layer.** I saw its name in the capabilities and nothing else: not its dates, its box, or whether its legend spans both signs.
- **Colour bar stability** across frames: the converter did not check it (no `--legend-box`; these tiles have no bar). A GIBS colour map is fixed per layer, so I expect it holds, but I did not test it.
- **Comparisons and story:** `comparisons` is empty and there is no `story`. The real run needs 3 to 5 comparisons with known answers and chapters whose facts are on a NASA page.

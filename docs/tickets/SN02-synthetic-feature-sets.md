# SN02 Synthetic data sets with known answers for motion and hot spots

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01 |
| **Hotspots** | catalogue |
| **Branch** | `feature/SN02-synthetic-feature-sets` |

## Goal

Two made-up data sets whose motion and hot spots are known exactly, so the feature extractor (SN01) and the ruleset (SN03) can be proved right before any NASA data is used:

- `synthetic-motion`: a current that moves east at exactly two grid cells a step.
- `synthetic-storm`: a warm storm that travels a known path, a cold patch that appears and goes, and a date with no data at all.

Both pass `npm run check-data`, are listed in `public/data/index.json`, and come with an `expected.json` that holds the answers.

## Why

- The only synthetic sets today are `synthetic-ocean`, `synthetic-globe` and `synthetic-change`. None has motion. None has a hot spot that moves, so nothing tests hot-spot tracking (`SN01`) or the motion voice (`SN03`).
- `make_synthetic.py` and `make_synthetic_change.py` already show the pattern: draw the frames, compute the answers from the drawn values (never by reading an image back), write `expected.json`, and test the decoded values against it.
- `src/data/synthetic-change.test.ts` and `src/data/change-regression.test.ts` show how a test reads these files.

**Order of merge.** The data, the manifests, `index.json` and the value test (step 5 to 6) do not need SN01, so this ticket can merge alone. The feature test (step 7) needs SN01 on `main`; add it as the last commit, after SN01 has merged. If SN01 has not merged, leave that step out and say so in Result.

## Design

### Shared look (no new legend)

Reuse the legend, the no-data colour, the categories, the tick and the missing cue from `scripts/make_synthetic.py` by loading it with `importlib` by path, as `make_synthetic_change.py` does (`python -I` does not add the folder to the import path). Frames are 800 × 400 pixels, so one grid cell (64 × 32) is 12.5 × 12.5 pixels. Land is `NO_DATA` grey.

### `synthetic-motion` (`scripts/make_synthetic_motion.py`)

- Twelve daily frames, `2026-03-01` to `2026-03-12`, `frames/<date>.png`.
- Background: value 14 everywhere (one flat category, no gradient).
- A current band, grid rows 8 to 23 (pixel rows 100 to 300). It holds six round blobs: four warm (value 27) and two cold (value 4), radius 30 pixels.
- Frame `k` (0 to 11) draws the blobs with their centres at x = 50 + 25 × k + 100 × i for blob `i`. Each frame moves every blob east by exactly 25 pixels, which is exactly two grid cells. Blobs never leave the image (the last one stays below x = 700 by frame 11).
- Known answer for every frame `k ≥ 1`: moved blocks move east, so `motion.dx = 2`, `dy = 0`, `speed = 2`, `direction = 0`. Frame 0 has no motion (`null`).

### `synthetic-storm` (`scripts/make_synthetic_storm.py`)

- Ten daily frames, `2026-03-01` to `2026-03-10`.
- Background value 14. A coast of land (`NO_DATA`) on the east edge, from x = 0.92 of the width.
- **Storm:** a warm disc (value 28, radius 60 pixels) whose centre moves in a straight line from `(0.25, 0.35)` to `(0.62, 0.55)` (fractions of the image) over frames 0 to 8. Its path is `centre(k) = start + (end − start) × k / 8`, in pixels.
- **Cold patch:** a cold disc (value 2, radius 40 pixels) at `(0.80, 0.70)`, present on frames 5 to 7 only.
- **No data:** frame 9 is all land (`NO_DATA`), so the whole date is `insufficient`.
- Known answers: frames 0 to 4 and 8 have one `high` hot spot (the storm). Frames 5 to 7 have one `high` hot spot and one `low` hot spot (the cold patch). Frame 9 has no hot spot and `validShare` 0. The storm keeps one id on frames 0 to 8, and the cold patch has a different id.

### `expected.json` (both sets)

Written from the values the script draws, never read back from the image.

```json
{
  "id": "synthetic-motion",
  "frames": [
    { "date": "2026-03-01", "valueAt": [{ "x": 0.1, "y": 0.4, "value": 14 }], "motion": null },
    { "date": "2026-03-02", "valueAt": [{ "x": 0.1, "y": 0.4, "value": 14 }], "motion": { "dx": 2, "dy": 0, "direction": 0 } }
  ]
}
```

For `synthetic-storm`, each frame has `hotspots: [{ "band": "high", "centre": { "x": 0.25, "y": 0.35 } }, …]` (the drawn centre, not the cell centroid) and `validShare`. The test allows one cell (1/64 of the width) between the drawn centre and the cell centroid.

### Manifest (both sets)

Written by the script, following `public/data/synthetic-ocean/manifest.json`:

- `id`, `title` (`"Synthetic motion (made-up practice data)"`, `"Synthetic storm (made-up practice data)"`), a `summary` and a `description` that say the data is made up.
- `variable`: `{ "name": "sea surface temperature (made up)", "unit": "°C" }`.
- `source`: `{ "name": "Made-up practice data", "url": "", "credit": "Made up for testing; not NASA data", "license": "Made up; no licence needed", "retrievedOn": "2026-11-09" }`.
- `colorScale` from `make_synthetic.py`, `regions` with one region of 6 × 5 points between x 0.1 and 0.85 (away from the land), `frames` with an `altText` for each frame, `mapping` (categories, tick and missing cue from `make_synthetic.py`), `comparisons: []`.
- No `baseline`, no `video`, no `sonification`, no `legend` (the defaults apply; SN05 may add the fields later).

### `public/data/index.json`

Two entries appended, in the same style as the others:

- `synthetic-motion`: "Synthetic motion (made-up practice data)", "Twelve made-up daily frames of a pretend current that moves east by exactly two grid cells a step, for practice and tests."
- `synthetic-storm`: "Synthetic storm (made-up practice data)", "Ten made-up daily frames of a warm storm that travels a known path, a cold patch and a day with no data, for practice and tests."

## Reuse

- `scripts/make_synthetic.py` (legend, land colour, categories, tick, missing cue), loaded by path.
- `scripts/make_synthetic_change.py` for the pattern of `expected.json` and the image helpers.
- `valueAtPixel`, `decodePng` (`src/analysis/analyze.ts`, `src/analysis/png.ts`) for the value test.
- `src/data/synthetic-change.test.ts` for how a test reads a synthetic set.
- The feature test, later: `extractFeatures` (SN01).

## Touches

- New: `scripts/make_synthetic_motion.py`, `scripts/make_synthetic_storm.py`, `public/data/synthetic-motion/**`, `public/data/synthetic-storm/**`.
- Edit: `public/data/index.json` (two entries appended).
- New test: `src/data/synthetic-feature-sets.test.ts` (step 6; the value test). Step 7 adds `src/analysis/features/synthetic.test.ts` after SN01.
- Do not edit `make_synthetic.py`, `make_synthetic_change.py` or any existing data set. Their golden files must stay byte-for-byte the same.

## Steps

1. Write `scripts/make_synthetic_motion.py`. It loads the shared look from `make_synthetic.py`, draws the twelve frames, writes `manifest.json` and `expected.json`.
2. Write `scripts/make_synthetic_storm.py` the same way.
3. Run both with `.venv/bin/python -I`. Run each twice and check the files are identical (`cmp`).
4. Add the two `index.json` entries.
5. Write `src/data/synthetic-feature-sets.test.ts`: for each set, load the manifest through `visualizationSchema`, decode each frame, and check every `valueAt` point with `valueAtPixel` (equal to the expected value within `legendRounding`). Check the frame count and that `check-data` passes.
6. Run the checks, then merge this part.
7. After SN01 is on `main`: add `src/analysis/features/synthetic.test.ts`. It runs `extractFeatures` over each set with `previous` carried, and checks motion (mean `dx` 2 ± 0.25, `dy` 0 ± 0.25, `direction` 0 ± 0.1 for frames 1 to 11; `null` for frame 0), hot-spot count per frame, centroid distance (≤ 1/64 across), id stability (the storm keeps one id on frames 0 to 8; the cold patch has another), and the no-data frame (`stats.median` null, no hot spots).

## Tests

- Step 5 (above) and the existing `npm run check-data` (`src/data`, runs the schema and the file checks on every data set in `index.json`).
- Step 7 (above), after SN01.
- Both scripts run twice give identical bytes.

## Guardrails

- Made-up data only, and every manifest says so (`source.name`, `credit`, `description`).
- The answers come from the drawing, never from reading the image back.
- Nothing data-set-specific goes in `src/`. The tests may name the two sets: they are fixtures, which `phases.md` allows.
- Sound: not applicable in this ticket. The sets are later used for sound (SN03, SN11); the answers here are the contract for those tickets.

## Done when

- Both sets pass `npm run check-data` and appear in `public/data/index.json`.
- Both scripts are deterministic (identical output on a second run).
- Every `valueAt` and every frame's answer in `expected.json` matches the decoded images (step 5).
- Step 7 passes once SN01 is on `main`, or Result says it was left out and why.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

Also, for the scripts (from the repo root):

```bash
.venv/bin/python -I scripts/make_synthetic_motion.py && .venv/bin/python -I scripts/make_synthetic_storm.py
git status --short public/data/synthetic-motion public/data/synthetic-storm   # regenerated files must match what is committed
```

## Out of scope

- Real NASA data (EIC03, D04).
- Any change to the existing synthetic sets or their golden files.
- Comparisons for the new sets. `comparisons: []` is valid; a comparison can be added later with a question and an answer checked against the drawing.

## Result

Built on `feature/SN02-synthetic-feature-sets`, with SN01 already on `main`, so step 7 is included.

### Checks (real output)

```
$ npm run lint                      exit 0 (no warnings)
$ npm test                          exit 0   Test Files 75 passed (75)   Tests 1369 passed (1369)
$ npm run check-data                exit 0   Test Files 12 passed (12)   Tests 248 passed (248)
$ npm run build                     exit 0   built in 461ms
$ python -I scripts/make_synthetic_motion.py && python -I scripts/make_synthetic_storm.py   (run twice)
  sha256 of every file under public/data/synthetic-motion, synthetic-storm and index.json: identical on both runs
```

No existing data set, golden file or script changed (`git diff` over `synthetic-ocean`, `-globe`, `-change`, `fixture` and both `__golden__` folders is empty).

### What was built

- `scripts/make_synthetic_motion.py` and `scripts/make_synthetic_storm.py`, `public/data/synthetic-motion/**` (12 frames) and `public/data/synthetic-storm/**` (10 frames), two entries appended to `public/data/index.json`.
- `src/data/synthetic-feature-sets.test.ts` (step 5): labelling, frame counts and sizes, the drawn value at every sample point (within 0.1 °C of legend rounding), hot-spot categories, and for the motion set that each frame is the one before moved 25 pixels east, pixel for pixel.
- `src/analysis/features/synthetic.test.ts` (step 7): `extractFeatures` over each set with `previous` carried.

### What the extractor finds (SN01 on these sets)

- `synthetic-motion`: motion between frames is dx 1.89 to 1.94, dy 0 to −0.11, direction within 0.1 of east on every step (drawn: dx 2, dy 0). Six hot spots every frame (four high, two low, 18 to 19 cells each), within one cell of the drawn centres, and each keeps its id (`h1` to `h6`) through all twelve frames.
- `synthetic-storm`: one `high` spot on frames 0 to 8 (one id, `h1`), the cold patch on frames 5 to 7 (`h2`), none on frame 9, which has `validShare` 0 and no median. `validShare` equals the share computed from the drawn land mask (0.9219).

### Decisions and differences from the ticket text (for review)

1. **Patch spacing 70 pixels, not 100.** The ticket's formula `x = 50 + 25 k + 100 i` puts the sixth patch at x = 825 on frame 11, off the 800-pixel picture, while the ticket also says patches never leave the image and the last stays below x = 700. Spacing 70 gives 675. Patch heights alternate between pixel rows 160 and 240 (the ticket gave none).
2. **No legend bar or label drawn.** The manifest has no `mapArea`, so the whole picture is the map and the 64 × 32 grid covers it as the ticket's 12.5-pixel cell assumes.
3. **`expected.json` is a superset of the ticket's layout.** The existing `src/data/datasets.test.ts` requires every `expected.json` to carry `frameId`, `regionId`, `sampled`, `valid`, `medianValue` and `category` per frame, and `check-data` failed without them. Both files now have those (from the drawn model, not the images) next to the ticket's `date`, `valueAt`, `hotspots`, `motion`/`validShare`.
4. **Two files outside Touches changed, one line each:** `src/App.test.tsx` and `src/components/DatasetPicker.test.tsx` list every catalogue title, so they now end with the two new titles. Adding the catalogue entries breaks them otherwise.

### Things later tickets should know

- **Motion cannot see more than two cells a step.** `MOTION_SEARCH` is 2. The storm travels about 3 cells east a frame (37 pixels) and 0.8 south, and the extractor reports dx about 1.1 to 1.8, dy 0.25 to 1. The direction is right, the speed is capped. The ticket keeps the storm's path as is; if SN03's motion voice needs the real speed, the search range has to grow or the frames have to be closer together.
- **The aperture problem shows here too:** the motion set's dy is not exactly 0 (down to −0.11), because some blocks see only a patch's trailing edge. It stays well inside the ticket's ±0.25.
- **The last storm frame has motion 0/0 rather than null:** the frame before it was readable, so SN01 compares them (a frame that goes from data to no data).

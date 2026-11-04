# Dhruv tickets (medium)

The data: the schema checks, synthetic frames, NASA research and conversion, and the real comparisons.

Files you own: `src/data/` (except `types.ts`, which T00 defines), `scripts/make_synthetic.py`, `scripts/convert_nasa.py`, `scripts/requirements.txt`, `public/data/` (except `fixture/`), `docs/data-sources.md`.

---

## T30: Data schema and validation (M2)

**Files:** `src/data/schema.ts`, `src/data/index.ts` (add validation to T00's loaders), `src/data/*.test.ts`.

**Do:**
1. Write Zod schemas matching `src/data/types.ts` from T00, and add a test that **the inferred types equal the hand-written ones**, so the two can't drift.
2. Add checks Zod can't express alone:
   - color stops ordered by value
   - category ranges ordered coolest first, with no overlaps
   - every comparison's frames and region exist
   - region points between 0 and 1
3. `loadVisualization` validates and throws `DataError` with a message naming the file and the field.
4. Add a test that loads and validates every manifest listed in `public/data/index.json`, so bad data fails CI.

**Done when:** tests cover a valid manifest and at least four invalid ones, each with a readable error.

---

## T31: Synthetic frame generator (M2)

**Files:** `scripts/make_synthetic.py`, `scripts/requirements.txt`, `public/data/synthetic-ocean/` (generated), `public/data/index.json`.

**Do:**
1. Use Python with Pillow and NumPy, and run the script with `python -I`.
2. Define a legend with about 8 color stops (blue = cold to red = warm, 0–30 °C) and the same 5 categories as T00's fixture.
3. Draw 12 dated PNG frames (800 × 400). Each has an ocean area colored from the legend, a gray land shape, a legend bar and a text label; land, the legend and the label use `noData` colors or sit outside the sample points.
4. Scenarios:
   - steady warming over dates 1–6
   - recovery over dates 7–9
   - date 10 is mostly missing data (must give `"insufficient"`)
   - dates 11–12 are an "about the same" pair
5. Define one region with about 30 sample points in the ocean.
6. Write `manifest.json` following `src/data/types.ts`, with 3 comparisons and clear alt text. The `source` says "Synthetic test data".
7. Write `expected.json`: the median value and category for each frame, computed from the values the script drew (not by reading the image back).
8. Add `synthetic-ocean` to `index.json`.

**Done when:** two runs give identical files, and the manifest loads in the app.

---

## T32: NASA source research (start now, not code)

**Files:** `docs/data-sources.md`.

**Do:** for the Sea Surface Temperature visualization in the EIC collection, plus 2 backups (Arctic sea ice and the global temperature anomaly), record:
- frame format and size
- number of dated frames
- whether the legend values can be read
- the link to the underlying dataset
- license and credit wording
- 1–2 date pairs from the same season that show real change

Note anything that breaks our assumptions, such as no fixed legend or a map projection that shifts between frames.

**Done when:** T33 could start converting on 13 Nov without further research.

---

## T33: NASA converter and check (M4, 13 Nov)

**Files:** `scripts/convert_nasa.py`, `public/data/<nasa-id>/`, `public/data/index.json`, `docs/data-sources.md`.

**Do:**
1. Turn NASA's released files into a manifest, with:
   - 12–24 dated frames
   - the legend stops
   - one ocean region whose points avoid land, labels and the legend
   - alt text and source credits
2. Keep T31's category names unless the real data needs others. If it does, tell the team leader and Mohammad.
3. Check the color-to-value lookup: compare 3 points on 2 frames against the underlying dataset, and record the results in `docs/data-sources.md`. If the error is more than one category, adjust the stops or `maxColorDistance`, and tell Roni for the About page.

**Done when:** the real manifest validates, shows on the Listen page, and the check results are written down.

---

## T34: Curate real comparisons (M5)

**Do:** add 3–5 comparisons to the real manifest, each with a `question`, `answer` and plain-language `explanation`. Use the same season in different years, or a real event, never summer against winter. Include one "about the same" pair. These are what the listening test uses.

**Done when:** each `answer` matches what the app's analysis gives for those frames.

# Pre-hackathon tickets: ready for real data

Written 5 Nov 2026 from two team requests, checked against the code on `main` (`b5a0243`). The first asks to "lock down UI, accessibility, audio mapping and data schemas before the sprint" (T88 to T99). The second adds three features (T100 to T104): both dates at once, one in each ear; display modes with a voice command; and a beacon that leads the cursor to the hottest area. Where the second request repeats the first, it is folded into the existing ticket, not written twice. Numbering continues [`docs/TICKETS.md`](TICKETS.md) (last ticket there: T87). The same rules apply as in that file:

- Hand a ticket to your own AI like this:

  > Read `AGENTS.md`, `docs/PLAN.md` and ticket `<ID>` in `docs/PRE-HACKATHON-TICKETS.md`. Do only that ticket, on branch `feature/<ID>-short-name`, and open a PR into `main`.

- Every PR meets the definition of done in PLAN.md §9. If it changes layout, check **360, 768, 1024 and 1280 px** with the `responsive-layout` skill and list the widths in the PR.
- If a ticket lists a file someone else owns (PLAN.md §4), that owner reviews the PR. Files in `src/analysis/` and `src/audio/` (except `pan.ts`) belong to the team leader.
- Interface changes are optional fields only, unless the ticket says otherwise. The PR that makes one updates PLAN.md §5.
- No new npm packages (T99 asks the team leader for one decision about this).
- Owners below are suggestions that follow folder ownership; swap them if someone has no time.

**Sizes:** S is up to half a day, M about a day, L about two days.

## Purpose

When the NASA resources arrive on 13 Nov (T85), adding a real data set should be routine: convert, fill in a few fields, run one check, listen. Everything else (pages, keyboard, announcements, sound) should already be finished and tested, so the sprint goes on data, the listening test and T87.

These tickets do not replace anything in `docs/TICKETS.md`. They must not push back the T85 real-device speed numbers or the T87 steps marked "now".

## Scope and cut order

The second request adds three large features on top of the first, with 8 days left (5 Nov today; real data and the sprint start 13 Nov; cut line 12 Nov). Both requests do not fit. This is the split:

| Priority | Tickets | Why |
|---|---|---|
| **Must** | T88 regression baseline, T89 manifest and check command, T90 part A legend matcher and missing data, T91 converter and rehearsal, T92 explorer keys and focus, T93 announcements, T96 engine cleanup (step 1 and 2), T98 Compare region fix and About claims table | The 30-minute T85 target, the rules that keep the sound honest, and accessibility we already promise |
| **Should** | T94 touch and vibration, T96 steps 3 to 5, T97 WAV, T98 Learn, T99 clean load, **T100 both dates at once (behind a listening check)**, **T101 display settings with a visible control** | Real improvements that can wait if a Must is late |
| **Could** | T90 part B CIELAB, T95 height accent, T97 part B, **T102 colour-vision patterns**, **T103 voice path for display settings**, **T104 hottest-area beacon** | Unproven, or a second path to something that already has one |

**Cut first, in this order:** T104 beacon; T102 colour-vision patterns; T103 voice path; T95 height accent; T97 part B; T90 part B; T100 (if its listening check fails, it is cut anyway); T99 step 3 (CI; keep the command); T101 (keep the browser's own `prefers-contrast` and `forced-colors` support from its step 1 if anything); T98 Learn; T94 layout extras.

**Never cut:** T88, T89, T90 part A, T91, T92, T93, T96 steps 1 and 2, the Compare region fix and the claims table in T98.

No Should or Could ticket starts before its owner's Must tickets are merged.

## The T85 target: a real data set in under 30 minutes

Measured with a stopwatch in the T91 rehearsal, driven by someone who did not write the converter, using only this list. Comparisons and story chapters are **not** inside the 30 minutes: their facts need a person to check them against the NASA source (T85 step 5).

| Step | What | Budget |
|---|---|---|
| 1 | Put the frames (PNG or JPEG, or PNGs extracted from a video) in one folder outside the repository | 3 min |
| 2 | Write `legend.json` (stops read off the colour bar), or give the colour bar's box and its end values to the converter | 5 min |
| 3 | `.venv/bin/python -I scripts/convert_frames.py --id <id> --frames <dir> --legend <legend.json> --map-area x0,y0,x1,y1 --out public/data/<id>` (T91). Writes the frames and a manifest | 3 min |
| 4 | Fill in every `TODO` the converter lists: title, summary, description, variable and unit, source name, URL, credit and licence copied exactly from the source page, retrieved date, region names, alt text | 10 min |
| 5 | Add the data set to `public/data/index.json` | 1 min |
| 6 | `npm run check-data` (T89) passes. It checks the schema, image files and sizes, the legend round trip, no `TODO` left, and the missing-data rules | 2 min |
| 7 | `npm run dev`, open `#listen?data=<id>`: Play is enabled within 5 s; the coolest and warmest dates sound low and high; in the explorer, land and labels play the hiss on two dates | 6 min |
| | **Total** | **30 min** |

Done when: the rehearsal in T91 meets the total, or each step that ran over has a fix merged and a second run meets it.

## The tickets

| ID | Title | Suggested owner | Size | Depends on | Due | Priority | Request area |
|---|---|---|---|---|---|---|---|
| T88 | Sound regression baseline for the three data sets | Dhruv (team leader reviews) | S | none | 6 Nov | Must | 1 |
| T89 | Manifest contract, template and one check command | Dhruv (team leader reviews `types.ts`) | M | T88 | 8 Nov | Must | 1 |
| T90 | Colour to category: harden the existing legend matcher; one rule for missing data | Team leader (Dhruv reviews schema) | M, part B S | T88; T89 for the schema half | 9 Nov | Must; part B Could | 1, 5 |
| T91 | Frame converter and a timed T85 rehearsal | Dhruv, team leader joins the rehearsal | L | T89, T90 step 2 | 11 Nov | Must | 1 |
| T92 | Explorer: keyboard edges and focus indicator | Mohammad (Roni reviews CSS) | S | none | 10 Nov | Must | 2, 5 |
| T93 | Announcements: what is said, and how often | Mohammad (player, explorer), Roni (`Announcer`, `src/describe/`) | M | T90 step 3 for the words | 11 Nov | Must | 2, 5 |
| T94 | Touch, small screens and vibration | Mohammad (Listen), Roni (`vibration.ts`) | S | T92 | 11 Nov | Should | 2 |
| T95 | 3D sound: a height accent for north, as an experiment | Bhavish (team leader reviews `engine.ts`) | M | none | check 11 Nov, decision 12 Nov | Could | 3 |
| T96 | Sound engine: cleanup, style switching, one music context, clipping, latency | Team leader | M | T88 | 11 Nov | Must (cleanup); Should (rest) | 3, 5 |
| T97 | WAV download: the 3-minute limit, speed, and ranges | Team leader (engine), Mohammad (button), Dhruv (measures) | S, part B S | T96 | 11 Nov | Should; part B Could | 3 |
| T98 | Learn, Compare and About: fill the gaps | Roni (Learn, About), Mohammad (Compare); three PRs | M | T90 step 3, T95 decision, T96 | 12 Nov | Must (Compare fix, About claims); Should (Learn) | 4 |
| T99 | Clean page load: no early audio, no console warnings | Bhavish (script, CI), Roni (`src/test/`) | S | T96 | decision 7 Nov, done 10 Nov | Should | 5 |
| T100 | Both dates at once, one in each ear (a Compare mode) | Mohammad (Compare), team leader (engine) | L | T96, T98 Compare fix | listening check 11 Nov, decision 12 Nov | Should | second request A |
| T101 | Display settings: a visible control, combinable modes | Roni (Mohammad reviews the shell) | M | T92 | 12 Nov | Should | second request B |
| T102 | Colour-vision patterns over the map | Roni (pattern layer), Mohammad (explorer) | M | T101 | after the cut line | Could | second request B |
| T103 | Voice path for the display settings | Mohammad (voice guide) | S | T101 | after the cut line | Could | second request B |
| T104 | Hottest-area beacon in the sound map | Mohammad (explorer), team leader (engine ping) | M | T92, T93, T96 | after the cut line | Could | second request C |

The three kinds of unit test in request area 5 are in the tickets that own the code: colour edge cases in T90, grid edges in T92, announcement strings in T93.

The second request's repeated items are covered here: the manifest types (T89), the normalizer and the hiss (T90), the north accent (T95), the WAV audit (T97), focus visibility on grid cells and controls (T92), aria-live for coordinates (T93) and for display changes (T101, T103), and Learn, Compare and About (T98).

## Order

**Critical path** (the 30-minute target depends on it): T88 (6 Nov) → T89 (8 Nov) → T90 (9 Nov) → T91 converter and rehearsal (11 Nov) → T85 on 13 Nov.

**In parallel, from 6 Nov:**
- Mohammad: T92 → T94; the player and explorer parts of T93; the Compare PR of T98 once T96's `dispose` is merged.
- Roni: the announcer and wording parts of T93; Learn and About PRs of T98.
- Bhavish: T95 (independent), T99 (after the decision on 7 Nov).
- Team leader: T90, then T96 → T97. This is a heavy load on top of T87's creative process. If it slips, Dhruv takes the T97 measurements and the team leader only reviews T88 and T89.
- Roni: T101 after T93's part, by 12 Nov. Then T102 only after the cut line.
- Mohammad and team leader: T100 after T96 and the Compare fix. T103 and T104 only after the cut line.

The cut order is in "Scope and cut order" above.

## What already exists (do not rebuild it)

Most of the request is already on `main`. These tickets are audits and gap fills unless they say otherwise.

| Request item | Already on `main` |
|---|---|
| FrameManifest, SamplingPoint, DataCategory, LegendMetadata | `Visualization`, `Region.points`, `Category`, `ColorScale` in `src/data/types.ts`, with Zod schemas in `src/data/schema.ts`. All three data sets pass them (`src/data/datasets.test.ts`) |
| Colour-to-category normalizer | `valueAtPixel` and `categoryFor` in `src/analysis/analyze.ts`: nearest point on the legend's line in RGB, a distance threshold (`maxColorDistance`), no-data colours, transparent pixels; `'insufficient'` below `minValidFraction` |
| Missing data as a hiss | `missingCue: noise` in every manifest; pink noise through a 900 Hz band-pass in `src/audio/engine.ts` |
| Keyboard grid movement | `useExplorer` in `src/features/explore/Explorer.tsx`: arrows, Shift + arrow, Home, End, Page Up, Page Down, Space, Enter, Escape, clamped to the grid |
| aria-live announcements | One polite live region (`src/components/Announcer.tsx`); the explorer waits 400 ms after the last move |
| Touch and vibration | Pointer capture on the explorer, sliders and sweep buttons for phones, `src/features/player/vibration.ts` |
| 3D sound | T84: `createPanner` and `aimPanner` in `src/audio/pan.ts`, `setSpatial` on the engine, elevation as height, never as pitch |
| Full and Simple styles | `setStyle` in `src/audio/engine.ts`, `useSoundStyle` in `src/audio/style.ts` |
| WAV export | `renderToWav` (Tone.Offline, 180 s limit) and `encodeWav` in `src/audio/wav.ts`; the Download button on Listen |
| Learn, Compare, About pages | `src/features/learn/`, `src/features/compare/`, `src/features/about/` |
| Comparing two dates | The Compare page and test mode (`src/features/compare/`), one date at a time |
| Display themes | Light and dark tokens on `:root` in `src/index.css` (`prefers-color-scheme`), `prefers-reduced-motion`, and a token contrast test in `src/styles/tokens.test.ts`. No display settings control |
| Voice commands | Server tools in `server/app/assistant/tools.py` (navigate, explain, playback, date, screen context), sent to the browser by `server/app/api/assistant.py`, checked by `toAssistantAction` in `src/hooks/useVoiceAssistant.ts` and carried out by `handleAssistantAction` in `src/App.tsx` |

---

## T88: Sound regression baseline for the three data sets (Dhruv)

**6 Nov, Must, S.** Depends on nothing. It goes first: T89, T90 and T91 change the schema, manifests and analysis, and this is how we know they did not change what anyone hears.

**Files:** `src/data/sound-regression.test.ts` (new), `src/data/__golden__/fixture.json`, `synthetic-ocean.json`, `synthetic-globe.json` (new, written by the test's first run). It reads `src/analysis/analyze.ts`, `src/analysis/png.ts`, `src/audio/voicing.ts` and `src/audio/pan.ts` and changes none of them. If the step builder in `src/features/player/usePlayer.ts` cannot be imported, move it into an exported pure function in the same file in this PR (Mohammad reviews), so the test and Listen use the same code.

**Do:**
1. For each data set in `public/data/index.json` (never a `stress-*` folder), decode every frame with `decodePng` and record:
   - for each frame and region: `sampled`, `valid`, `category`, `medianValue` rounded to 2 decimals, `shares` rounded to 3;
   - for each region, the steps Listen plays: `category`, `pan`, `elevation`, and `pad`, `glide` and `bell` from `voicingFor`;
   - for each frame, the sound-map grid from `gridFromPixels` with the manifest's `mapArea`: `cols`, `rows` and every cell's category;
   - each category's note and the missing cue's type.
2. Compare with `expect(...).toMatchFileSnapshot('__golden__/<id>.json')` and commit the golden files.
3. Write at the top of the test: a PR that changes a golden file says why in its description, and the team leader approves it.

**Done when:**
- `npm test` passes with the golden files committed, in under 10 s.
- A test that changes one legend stop of the fixture in memory shows the comparison fails, so the check is known to work.

**Done (5 Nov).** `src/data/sound-regression.test.ts` and `src/data/__golden__/{fixture,synthetic-ocean,synthetic-globe}.json`, generated from the current code and committed data. To regenerate after a change you meant to make: `npx vitest run -u src/data/sound-regression.test.ts`, then read the diff of `__golden__/` (the PR says why; the team leader approves).
- Verified: `npm test` 647 passed (642 before; 5 new), the file runs in about 1.5 s. Changing the fixture's `mild` note to A4 in `manifest.json` made the test fail with a line diff (`- "mild": "G4"` / `+ "mild": "A4"`); reverted. The in-memory legend-stop test (stop value 15 to 25) also checks the comparison notices a change.
- Readings of the steps: (1) `stepsFor` in `usePlayer.ts` is now the exported pure `sequenceSteps(results, region, mapping, from, to, stepMs)`; the hook calls it, same output, and Mohammad reviews. (2) "For each region" records the steps for every region in the manifest, though Listen plays `regions[0]` only. (3) Steps are recorded at normal speed (speed only moves `atMs`, which is left out). (4) Grid rows are one line of category ids each, so a diff shows which cell moved. (5) `pad`, `glide` and `bell` are written as `null`/`false` when absent so a missing key cannot hide a change.
- Not done: nothing was listened to by ear; the baseline records what the code decides, not how it sounds. `src/analysis/` and `src/audio/` were read, not changed.

---

## T89: Manifest contract, template and one check command (Dhruv)

**8 Nov, Must, M.** Depends on T88. The team leader reviews any change to `src/data/types.ts`.

**What exists.** The schema is strict already and all three data sets pass it. The request's names map to existing types: FrameManifest is `Visualization`, SamplingPoint is one entry of `Region.points`, DataCategory is `Category`, LegendMetadata is `ColorScale`. **Do not add new types or rename these.** Two names for one thing is how they drift apart. Add one comment line to each type naming the request's term, so a search finds it.

**Files:** `src/data/schema.ts`, `src/data/schema.test.ts`, `src/data/datasets.test.ts`, `src/data/types.ts` (comments only), `package.json` (one script line), `scripts/templates/manifest.template.json` (new), `docs/data-sources.md` (a "Manifest fields" section), `.gitignore` (one line).

**Do:**
1. **Close two gaps in the schema**, each with a readable message and a test in `schema.test.ts`:
   - **Categories must not leave gaps:** each range starts where the one before it ends. Today a gap is allowed, and `categoryFor` (`src/analysis/analyze.ts`) sends a value that falls into it to the coolest or warmest category, so a value between "mild" and "warm" would sound "hot".
   - **A comparison's `regionId` must be the first region's**, until T98 makes Compare use the comparison's own region. Today Compare and TestMode analyse `regions[0]` only, so a comparison in another region would play the wrong place.
2. **`npm run check-data`** in `package.json`: `vitest run src/data src/analysis/synthetic.test.ts`. This is the one command for T85. Extend `datasets.test.ts` so that, for every data set in `index.json`, it also checks:
   - each frame's PNG is 8-bit RGB or RGBA, not interlaced, and its real width and height equal the manifest's (read the header; `decodePng` already rejects other kinds);
   - frames are in date order with no date twice;
   - **legend round trip:** each stop's own colour, read through `valueAtPixel`, gives the stop's value within 0.01, so the legend and the analysis agree;
   - no no-data colour lies within `maxColorDistance` of the legend's line (otherwise grey land a little off its listed colour is read as a value);
   - the categories cover the legend's value span: the first range starts at or below the first stop, the last ends at or above the last stop;
   - no field still contains `TODO`.
3. **Make the check pass on machines that have the stress set.** Today "lists each one in the catalog" fails whenever `public/data/stress-globe/` exists (run on 5 Nov: 1 failed, 23 passed). Ignore folders named `stress-*` and `rehearsal-*`, and add `public/data/rehearsal-*/` to `.gitignore` for T91.
   - Fixed in the datasets.test.ts catalog check: `stress-*` folders are ignored ("Fix datasets test failing when stress-globe is on disk"). `rehearsal-*` and `.gitignore` are still to do.
4. **`scripts/templates/manifest.template.json`:** a valid manifest with `TODO: from the source page` in every field a person fills in, the five standard categories with C4 E4 G4 C5 E5, `missingCue` noise, and one example frame. `schema.test.ts` parses it, so it cannot go stale.
5. **`docs/data-sources.md`, "Manifest fields":** one row per field: who fills it (converter or person) and where it comes from.

**Done when:**
- `schema.test.ts` covers the gap rule and the comparison-region rule with their messages.
- `npm run check-data` passes on the three data sets and fails with a readable message for: a frame whose PNG size differs from the manifest, a `TODO` left in, a legend stop that does not round-trip, a no-data colour on the legend line.
- It passes with `public/data/stress-globe/` present.
- The T88 golden files are unchanged. PLAN.md §5.1 is updated for the two new rules.

**Done (5 Nov).** `npm run check-data` (`vitest run src/data src/analysis/synthetic.test.ts`) passes on the three data sets, and with `stress-*` and `rehearsal-*` folders present. The checks live in `src/data/check.ts` (pure, so `check.test.ts` can feed it bad input) and `datasets.test.ts` runs them on every catalog entry. Also new: the two schema rules, `scripts/templates/manifest.template.json` (parsed by `schema.test.ts`), "Manifest fields" in `docs/data-sources.md`, `public/data/rehearsal-*/` in `.gitignore`, the four request-term comments in `types.ts`, PLAN.md §5.1, one line in AGENTS.md.
- Verified: `npm test` 668 passed (647 before; 21 new), build and lint clean. The T88 golden files are unchanged. Each bad case fails with `file: field: message`, e.g. `public/data/fixture/manifest.json: frames.1.width: is 400 but "frames/2024-07-15.png" is 200 pixels wide`, and `... source.credit: still contains TODO ("TODO: from the source page"); replace it with the real text from the source`. Tests cover a wrong PNG size, a missing file, a 16-bit/palette/interlaced/non-PNG file, a date twice, dates out of order, a legend stop that does not round-trip, a stop read as missing data, a no-data colour on the legend line, categories short of the legend, `TODO`, the gap rule and the comparison-region rule.
- Changed from the ticket, and why: (1) **The fixture failed its own new rule.** Its grey no-data colour (128,128,128) is the midpoint of its blue to yellow line (distance 0.8, so any grey land would read as 7.5 degrees). Smallest fix: the fixture's no-data colour and its one grey frame are now (200,200,200) (`scripts/make_fixture.py`, regenerated). Every frame still reads missing, so the sound is identical (goldens unchanged). Two tests that hard-code that grey for the fixture changed with it (`src/analysis/grid.test.ts` line 14, `src/analysis/index.test.ts` line 16; test data only, no analysis code). (2) The template's legend stops, frame date, size and categories are real-looking placeholders, because the schema needs valid values there; only text fields carry `TODO`, so the check cannot flag an unchanged placeholder stop or date. (3) The gap rule treats edges that differ by less than 1e-9 as equal. (4) The comparison-region message appears only when the region exists, so the old "there is no region" message is unchanged. (5) The check also scans the data set's `index.json` entry for `TODO`.
- Not verified: no real NASA frames (none exist yet); the interlaced and 16-bit cases use hand-built PNG headers, not files from an image editor; `npm run check-data` was not timed against a 30-frame set.

---

## T90: Colour to category: harden the existing legend matcher; one rule for missing data (Team leader)

**9 Nov. Part A Must, M; part B Could, S.** Depends on T88; step 3 also on T89. Touches `src/analysis/`, which is the team leader's.

**This is not a new module.** `valueAtPixel` and `categoryFor` already do what the request describes. This ticket keeps their approach, adds the edge-case tests, and fixes what the tests find.

**Decision: the legend decides, not hue bands.** The primary method stays "nearest colour on the data's own legend, with a distance threshold; beyond the threshold the pixel cannot be read". Fixed HSV hue bands are not used to pick a category:
- NASA colour bars are not ordered by hue. Many run from purple through blue to red, and some end in dark red or white, so hue wraps round at 0/360° or stops meaning anything.
- Greys, black and white have no defined hue, and these are exactly the land, coastline and label colours.
- Fixed bands ignore the values printed on the legend, so a new data set would need new bands.

HSV is used only in tests, to build awkward colours.

**Files:** `src/analysis/analyze.ts`, `src/analysis/analyze.test.ts`, `src/analysis/pixels.ts`, `src/analysis/pixels.test.ts`, `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/data/types.ts`, `src/data/schema.ts`, `src/data/schema.test.ts` (Dhruv reviews), `src/describe/index.ts` (Roni reviews), `src/features/player/usePlayer.ts` (one label; Mohammad reviews), `docs/PLAN.md` §5.1 and §5.2.

**Do (part A):**
1. **Edge-case tests** in `analyze.test.ts`, pure, without images:
   - each stop's exact colour gives its value; the colour halfway between two stops gives their mean;
   - noise of ±3 on each channel around a stop keeps its category (compression jitter);
   - a colour at `maxColorDistance − 1` from the legend gives a value; at `+ 1` it gives `null`;
   - built with an `hsvToRgb` helper in the test: hue 0° and 360° give the same result; saturation 0 (greys from black to white) gives `null` unless the legend has that grey; value 0 (black coastlines and text) gives `null`; a hue between two legend colours but at low saturation gives `null`;
   - a legend whose line passes close to itself (red at both ends): a colour equally near two parts gives the same answer every time, and the rule is written in a comment;
   - transparency: alpha 0 gives `null` (exists); decide alpha 1 to 254 (soft edges in a PNG with transparency). Recommended: treat anything below 255 as unreadable; check T88 is unchanged;
   - a value exactly on a category edge goes to the warmer one, and a value beyond the ends to the nearest end (both documented today, neither tested).
2. **Colour management.** `readPixels` calls `createImageBitmap(blob)` with default options, so the browser may convert a PNG with an embedded colour profile or gamma chunk and shift its colours, while the Node test decoder does not. Pass `{ colorSpaceConversion: 'none', premultiplyAlpha: 'none' }`. Test with a mocked `createImageBitmap` that the options are passed. (T91's converter also strips those chunks.)
3. **Missing data, one rule end to end.** A pixel that cannot be read is `null`; a cell, region or date with too few readable points is `'insufficient'`; `'insufficient'` always plays the hiss and never a note.
   - **Interface change** (PLAN.md §5.1, `types.ts`, `schema.ts` together, agreed with everyone who uses `SoundMapping`): `missingCue.type` becomes `'noise'` only. Today `'note'` is allowed and the engine then plays a sawtooth B1, a low note, which breaks the rule. Remove the note path (`missingSynth`) from `engine.ts`, and replace the engine test "can use a note for the missing cue instead" with a schema test that rejects `"note"` with a readable message. All three manifests already use noise.
   - Done: `missingCue.type` is `'noise'` only; the schema rejects `"note"` and the engine's B1 path is gone ("Reject note-type missing cue; missing data always plays the hiss").
   - Keep the existing hiss (pink noise through a 900 Hz band-pass). The request says white noise; the pink noise is already tested and documented in `docs/SOUND_MAPPINGS.md` §5, and there is no reason to change it.
   - Check that every place that meets `'insufficient'` plays the missing cue and nothing else: Listen's steps, the explorer's cells and sweeps, Compare, TestMode, Learn, `renderToWav`. Add a test for any that has none. `voicingFor` already gives `{}`.
   - **One phrase.** Today the player says "no data", `describeCell` "No data (land, cloud or labels)", About "Not enough readable points". Use "not enough data" wherever a date or cell is `'insufficient'`, keeping "(land, cloud or labels)" in rich cell descriptions. T93 and T98 use these words.

**Part B (Could, after part A): CIELAB, tried and not adopted blindly.** Add optional `colorScale.colorSpace?: 'rgb' | 'lab'`, default `'rgb'` (an optional field; update PLAN.md §5.1). With `'lab'`, the nearest point on the legend line and the threshold are measured in CIELAB (sRGB, D65, ΔE76), and `maxColorDistance` is in ΔE. Switch a data set to `'lab'` only if its T88 output is unchanged, or each difference is explained and approved, **and** on the T91 rehearsal frames it reads fewer blended edge pixels as values. Otherwise leave it out and say why in one line in the PR.

**Done when:**
- The new tests pass, and the T88 golden files are unchanged (or each difference is explained and approved by the team leader).
- The schema rejects a `"note"` missing cue, and `engine.ts` has no note path left.
- Every `'insufficient'` path has a test that it plays the missing cue.
- PLAN.md §5.1 and §5.2 are updated.

---

## T91: Frame converter and a timed T85 rehearsal (Dhruv)

**11 Nov, Must, L.** Depends on T89 (the check command) and T90 step 2 (colour handling). The team leader joins the rehearsal.

**What exists.** T85 step 3 plans a converter for 13 Nov, but none is written: `scripts/` has only the synthetic generators and `summarize_results.py`. Writing it now is what makes the 30 minutes possible.

**Files:** `scripts/convert_frames.py` (new), `scripts/tests/test_convert_frames.py` (new), `docs/data-sources.md`, `docs/performance.md` (the rehearsal times). Pillow and NumPy are already in `scripts/requirements.txt`.

**Do:**
1. **`scripts/convert_frames.py --id <id> --frames <dir> --legend <legend.json> --map-area x0,y0,x1,y1 --out public/data/<id>`**:
   - Reads PNG or JPEG frames. For a video, `docs/data-sources.md` gives the `ffmpeg` line that extracts PNG frames first; the app never plays video.
   - Takes each date from the file name with `--date-pattern` (a regular expression), sorts by date, and rejects two frames with the same date.
   - Writes 8-bit RGB PNGs, not interlaced, without colour profile or gamma chunks (iCCP, gAMA, cHRM, sRGB). The test decoder and the browser then read the same colours.
   - With `--max-width`, scales down using nearest-neighbour only. Smoothing blends neighbouring colours into ones that are not on the legend. Scaling down is how to deal with the memory risk in `docs/performance.md` if the real frames are large.
   - Rejects frames of different sizes, with a readable message.
   - Legend: either `legend.json` with stops `[{ "value": …, "rgb": [r, g, b] }]`, or `--legend-box x0,y0,x1,y1 --legend-values min,max` to sample the colour bar on the first frame at evenly spaced points. Then it checks the bar is the same (within 3 per channel) on every frame, and rejects a changing legend (T85 step 3).
   - Fills in the manifest from `scripts/templates/manifest.template.json` (T89) with one default region (a 5 × 6 lattice of points inside the map area), leaves `TODO` in the fields a person must fill in, and prints what is left to fill.
   - JPEG input works but gives more unreadable points; say so in its output. Prefer PNG.
2. **Tests** (`scripts/tests/test_convert_frames.py`, pytest, on tiny generated images): dates read and sorted; a duplicate date rejected; a size mismatch rejected; a changing legend rejected; nearest-neighbour scaling leaves only legend colours; the written PNGs have no colour chunks; running twice gives identical files.
3. **Rehearsal, 11 Nov, with a stopwatch.** Someone who did not write the converter follows only the checklist at the top of this file. Use a public NASA SVS image sequence with a colour bar (one of the pages in `docs/data-sources.md`), saved under `public/data/rehearsal-<name>/`, which is in `.gitignore`. **Do not commit or deploy it**: its licence and credit have not been checked. Write each step's time in `docs/performance.md`, and open a fix for every step over its budget.

**Done when:**
- The pytest tests pass.
- The rehearsal is written down with each step's time, and the total is 30 minutes or less, or the slow steps have fixes merged and a second run is 30 minutes or less.

---

## T92: Explorer: keyboard edges and focus indicator (Mohammad)

**10 Nov, Must, S.** Depends on nothing. Roni reviews CSS changes.

**What exists.** `useExplorer` handles arrows, Shift + arrow (four cells), Home, End, Page Up, Page Down, Space, Enter, Shift + Enter and Escape, clamps every move to the grid, and calls `preventDefault()` on handled keys. The surface has `role="application"` and a 3 px `var(--focus)` outline; the cursor has a white ring outside and a black ring inside. `Explorer.test.tsx` covers most keys. This ticket adds the edge cases and fixes the focus indicator.

**The requirement, rewritten.** The request asked for "44px+ visible focus rings". The focus indicator and the touch target are separate things:
- **Focus indicator:** at least 2 px thick, with at least 3:1 contrast against the colours next to it.
- **Target:** at least 44 × 44 px.

Checked against WCAG 2.2: 2.4.7 Focus Visible (AA); 2.4.11 Focus Not Obscured (Minimum) (AA), which means no focused control is completely hidden behind the bottom bar or the voice guide panel; 2.5.8 Target Size (Minimum) (AA, 24 px; our own 44 px rule matches 2.5.5, AAA). The 2 px and 3:1 numbers come from 2.4.13 Focus Appearance (AAA) and 1.4.11 Non-text Contrast; we adopt them as our rule.

**Files:** `src/features/explore/Explorer.tsx`, `src/features/explore/explore.css`, `src/features/explore/Explorer.test.tsx`, and `scroll-margin` lines in `src/App.css` if step 3 needs them (Mohammad owns the shell).

**Do:**
1. **Edges.** Today a key that pushes past the edge plays and announces the same cell again, so on a fast key repeat nothing seems to happen. Instead: at an edge, do not play again, and announce "West edge." (or East, North, South) after the usual 400 ms.
2. **Tests** in `Explorer.test.tsx`, with the mocked 24 × 12 grid:
   - Shift + ArrowLeft from column 2 lands on column 0; Shift + ArrowDown from row 10 lands on row 11;
   - Home, End, Page Up and Page Down from each corner;
   - the edge announcement, and no second play at the edge;
   - keys before the grid has loaded do nothing and throw nothing;
   - Ctrl, Alt or Meta with an arrow is not handled, so browser and player shortcuts still work;
   - a new date whose grid has 6 rows while the cursor is on row 10 puts the cursor back in the middle (the code does this; nothing tests it);
   - a pointer at the exact right or bottom edge gives the last cell.
3. **Focus indicator.** The surface's outline is drawn over the map image, so `var(--focus)` may have no contrast against some map colours. Give the surface the same light and dark double ring as the cursor, each ring at least 2 px. Tab through every control on Listen and check each indicator is at least 2 px and 3:1 against what is next to it.
4. **Not obscured (2.4.11).** Below 768 px, with the bottom bar and the voice guide panel open, Tab through Listen with the explorer on. No focused control may be completely hidden; add `scroll-margin-bottom` (bar height plus `env(safe-area-inset-bottom)`) where needed.

**Done when:**
- The tests pass; the a11y check passes with the explorer on.
- The PR gives the measured contrast of the surface's focus ring against a yellow, a navy and a grey map area.
- Layout is checked at 360, 768, 1024 and 1280 px, and a keyboard-only pass is written in the PR.

---

## T93: Announcements: what is said, and how often (Mohammad, Roni)

**11 Nov, Must, M.** Mohammad: the player and explorer. Roni: `src/components/Announcer.tsx` and `src/describe/`. Depends on T90 step 3 for the missing-data words.

**What exists.** One shared polite live region (`AnnouncerProvider`: `role="status"`, `aria-live="polite"`, `aria-atomic`, and a trailing-space trick so a message can be repeated). The player announces "March 2024: warm" once per date, **including during playback**, which at Fast is every 500 ms. The explorer waits 400 ms after the last move; a sweep is described at its end; Learn has its own status line.

**The requirement, rewritten.** "Without flooding" becomes:
- At most **one live-region update per 1.5 s** while a sequence or sweep is playing. The newest message replaces any that is waiting; older ones are dropped, never queued.
- During playback, a date is announced only when its category differs from the last one announced. When playback stops or is paused, the current date is always announced ("Paused at June 2024: hot").
- In the explorer, the first message after turning it on, or after the date changes, starts with the date ("March 2024. Warm, about 21 °C, north-east, column 13 of 24, row 6 of 11."). Later moves leave the date out. Edges say "West edge." (T92).
- Every message is at most 160 characters in rich detail and 60 in concise detail.

**Files:** `src/components/Announcer.tsx`, `src/components/useAnnounce.ts`, `src/components/announceRate.ts` (new), `src/components/components.test.tsx`, `src/describe/index.ts`, `src/describe/describe.test.ts`, `src/features/player/usePlayer.ts`, `src/features/player/player.test.tsx`, `src/features/explore/Explorer.tsx`, `src/features/explore/Explorer.test.tsx`.

**Do:**
1. A pure rate rule in `src/components/announceRate.ts` (when to speak now, when to hold, what to drop), used by `AnnouncerProvider` when a caller passes `{ busy: true }`. This is an optional argument to `announce`, so every existing call still works.
2. Pure, tested string builders for: the player's date line, the paused or stopped line, the explorer's first and later messages, the edge message, the end of a sweep. Each for both detail levels, with T90's missing-data words. Same input, same words.
3. Manual check: NVDA with Firefox or Chrome on Windows, and VoiceOver with Safari on macOS. Play synthetic-globe at Fast, sweep one row, and hold ArrowRight for 3 s. Write down in the PR what was spoken.

**Done when:**
- Tests with fake timers show at most one update per 1.5 s during a 12-date run at Fast, and that the last date is always announced.
- The string builders have tests for both detail levels; the a11y checks pass.
- The manual check shows nothing still being spoken more than 2 s after the sound stops, and is written in the PR.

---

## T94: Touch, small screens and vibration (Mohammad, Roni)

**11 Nov, Should, S.** Mohammad: Listen and the explorer. Roni: `src/features/player/vibration.ts`. Depends on T92 (same CSS).

**What exists.** The explorer surface uses pointer capture and turns off touch scrolling only while the explorer is on. Two sliders and the sweep buttons are the phone fallback and wrap at 360 px. The vibration setting is hidden where `navigator.vibrate` does not exist. Each date and each cell vibrates when the setting is on (`vibrateForDate`, 30 to 120 ms; missing data two taps). Tests in `vibration.test.tsx`.

**The haptics requirement, rewritten.** "Zero-lag mobile haptics" cannot be proven in jsdom or headless Chromium. `navigator.vibrate` does not exist in Safari on iOS, so **iOS gets no haptics at all**. The requirement is:
1. When a key press or touch sounds a cell at once, `navigator.vibrate` is called synchronously inside that event handler, in the same call as `playCategory`.
2. When the 120 ms limit delays a cell, the delayed call still vibrates. Chrome allows this after the first tap; check it on the phone.
3. On a browser without vibration: no call, no error, no console warning, and no setting shown.
4. Checked on one real Android phone in Chrome: the PR names the model and Chrome version and says whether pulse and sound arrive together.

**Files:** `src/features/explore/Explorer.tsx`, `src/features/explore/Explorer.test.tsx`, `src/features/explore/explore.css`, `src/features/player/vibration.ts`, `src/features/player/vibration.test.tsx`, `src/features/player/player.css` if layout needs it.

**Do:**
1. Tests with a stubbed `navigator.vibrate`: ArrowRight on the surface calls it before the handler returns, with the cell's pattern; with a delayed play pending, it is called once when the timer runs; without vibration support, there is no call, no exception, and no `console.warn` (spy).
2. Touch tests: `pointerdown`, `pointermove` and `pointerup` with `pointerType: 'touch'` map to the right cells; `pointercancel` announces once.
3. Small screens. At 360 px a cell of the 24-column grid is about 15 px wide. That is fine for dragging a finger across the map (the surface is one target), but too small for tapping one place, so the sliders are the precise route. At 360 × 740 with the explorer on, the sliders and sweep buttons can be scrolled to and are never behind the bottom bar.
4. The real-phone check above.

**Done when:**
- The tests pass, and the PR names the phone, the browser and the result.
- No horizontal scroll at 320, 360, 768, 1024 and 1280 px, nor at 200% zoom at 1280 px. Layout is checked at 360, 768, 1024 and 1280 px.

---

## T95: 3D sound: a height accent for north, as an experiment (Bhavish)

**Listening check by 11 Nov, decision by 12 Nov, Could, M.** Depends on nothing (T84 is merged). The team leader reviews `engine.ts`. Cut early (see "Scope and cut order").

**What exists.** T84: in 3D mode the panner is an HRTF `Panner3D`, `aimPanner` turns elevation −1 to +1 into −45° to +45°, the "3D sound (headphones)" setting is off by default, and elevation is never pitch.

**Why an experiment.** Height cues from a generic HRTF are weak and differ a lot between people; up/down mix-ups are common. The proposed accent is a timbre cue ("brighter means higher"), not pitch, so in itself it does not break "pitch means warmer". But a high-pass filter **can** move the pitch you hear: if its cutoff gets near a note's fundamental, the fundamental fades and some listeners hear the note an octave up. The chord's lowest note is C3 (131 Hz), so a high-pass on the whole sound has almost no room to work. **A cutoff change must never move the audible pitch.**

**Design rules:**
- Only in 3D mode, and only when a new "Height accent" setting is on. **Off by default.** It can be turned off at any time.
- Start with a high shelf: a boost above about 4 kHz, from 0 dB at elevation 0 and below up to **at most +4 dB** at +1. Use a high-pass only if the shelf cannot be heard, and then only on the melody (not the chord), with the cutoff no higher than one octave below the lowest category note (C4 → 130 Hz). Say in the PR which was used.
- Changes ramp over at least 20 ms, so they never click.
- **Cap:** a worst-case render (hot note, three-note chord, bell, elevation +1, volume 1) peaks at or below −1 dBFS, and is no more than 1 dB louder (RMS) than the same render with the accent off.

**Files:** `src/audio/pan.ts` (a pure `accentFor(elevation)`), `src/audio/pan.test.ts`, `src/audio/engine.ts` (the filter, after the panner), `src/audio/engine.test.ts`, `src/audio/index.ts` (an optional `setHeightAccent(on)`; interface change to PLAN.md §5.3), `src/features/player/index.tsx` (the setting; Mohammad reviews), `docs/PLAN.md` §5.3 and §6.1.

**Do:**
1. `accentFor` and its tests at −1, 0, +1 and beyond (clamped).
2. Engine tests with the Tone mock: accent off, nothing changes; on in stereo, nothing changes; on in 3D, only the filter's parameters change, ramped, and no synth's frequency or detune is touched.
3. **Pitch check in a browser** (OfflineAudioContext, through `renderToWav` on the preview build): render C4 and E5 at elevation −1, 0 and +1. The fundamental (strongest low peak, or autocorrelation) is the same within 1% in all three. Write the numbers, peak level and RMS difference in the PR.
4. **Blind listening check.** At least two people, on their own headphones, who are **not told which direction is which** and do not see the screen. Each hears 20 single notes of one category, 10 at elevation +1 and 10 at −1 in random order, with the accent on; then 20 more with it off. Alternate which block comes first between people. They answer "above" or "below".
   - **Pass:** every listener gets at least 15 of 20 with the accent on, and at least 3 more right than with it off.
   - **Fail:** the setting stays off by default, or is removed, and Learn does not mention it.
   - **Pass:** it is still off by default (3D is off by default too), and T98 adds one sentence to Learn.

**Done when:** the tests pass; the browser check numbers and the listening results (scores and headphone models, no names) are in the PR; the default follows the rule above.

---

## T96: Sound engine: cleanup, style switching, one music context, clipping, latency (Team leader)

**11 Nov. Must (cleanup), Should (the rest), M.** Depends on T88.

**What exists.** One set of voices per engine, built on `unlock()` and used for both live sound and WAV export. `setStyle` changes the reverb and the melody's envelope; `setSpatial` swaps the panner and disposes the old one; `stop()` fades out in 20 ms. Learn, Listen, Compare and TestMode each create their own engine and call `stop()` when the page closes.

**Found while reading** (check each; fix what is confirmed):
- **Leak.** An engine's voices (about ten nodes plus the reverb) are never disposed. Every visit to a page that plays something adds another set to Tone's audio context.
- **Clicks.** `applyStyle` sets `reverb.wet.value` in one step, and `applySpatial` disconnects the bus while a note may be sounding.
- **Shared Transport.** Every engine uses Tone's one global Transport, and `resetTransport` in one cancels another's steps. This is safe only while one page with an engine is mounted at a time; keep it that way, and note it in the code.
- **Latency.** Immediate notes use Tone's `now()`, which is likely to include the context's look-ahead (0.1 s by default in Tone), so an explorer move may sound about 100 ms late on top of the output latency. Measure; if confirmed, use Tone's `immediate()` for unscheduled calls (`playCategory`, `playMissing`, `playTick`) and keep the look-ahead for the Transport.

**"Only one AudioContext", rewritten.** The music uses exactly one live AudioContext (Tone's) for the whole app. The only other contexts allowed are the voice guide's own microphone and speaker contexts (`src/assistant/audio.ts`, created in a click and closed when the guide stops) and the OfflineAudioContext of a WAV export.

**Files:** `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/audio/index.ts`, and one cleanup line each in `src/features/learn/index.tsx` (Roni reviews), `src/features/player/usePlayer.ts`, `src/features/compare/index.tsx` and `src/features/compare/TestMode.tsx` (Mohammad reviews), `docs/PLAN.md` §5.3.

**Do:**
1. **`dispose()`** on `SoundEngine` (interface change to PLAN.md §5.3; update every fake engine in the tests). It stops, then disposes every node; it is safe twice and before `unlock()`; afterwards every call does nothing and throws nothing. The pages call it in their existing cleanup effect in place of `stop()`.
2. **Leak test** with the Tone mock: create, unlock, play and dispose 50 times; nodes created equals nodes disposed.
3. **No clicks:** ramp the reverb over at least 20 ms on a style change; on a spatial change, fade the cut gain down, swap, fade up (40 ms at most in total). Tests show ramps, not direct `.value` writes.
4. **Clipping:** in a browser, render the worst case (hot note, three-note chord, bell, and the missing cue overlapping; full style; volume 1). The peak is at or below −1 dBFS (|sample| ≤ 0.891). If not, add headroom (lower levels or a limiter at −1 dB) and confirm T88 is unchanged.
5. **Latency:** measure, in Chrome on a laptop, the delay between a key press and the note's start time on the audio clock. Target: 30 ms or less beyond the output latency. Write the number in `docs/performance.md`.

**Done when:**
- The tests pass and the existing engine, player, compare and learn tests pass.
- In Chrome DevTools' WebAudio panel, after switching Learn, Listen and Compare 10 times with a sound on each, there is one realtime context, and its node count is within 10% of the count after the first visit.
- The peak level and latency numbers are in the PR. T88 is unchanged.

---

## T97: WAV download: the 3-minute limit, speed, and ranges (Team leader, Mohammad, Dhruv)

**11 Nov. Should, S; part B Could, S.** Team leader: `engine.ts`. Mohammad: the button. Dhruv: the measurements. Depends on T96.

**What exists.** `renderToWav` makes the file last as long as the last step plus 1.5 s, rejects anything over 180 s with "That is too long to download (over 3 minutes).", renders with `Tone.Offline` (two channels, 44 100 Hz) and encodes 16-bit WAV. Listen's Download button renders **all** dates at the current speed, is disabled while it runs and shows an error on failure. **There is no way to choose a date range today,** so "for any chosen date range" in the request does not match the app (see part B).

**Decision above 3 minutes: a clear message, no chunked rendering.** Rendering in chunks would cut through reverb tails, held chords and slides at each join, which can be heard, and the whole file still has to sit in memory to be saved. Three minutes holds 180 dates at Normal speed or 360 at Fast. The message is computed from the steps, for example: "This would be 4 min 10 s at Normal speed; downloads can be up to 3 minutes. Choose Fast, or download one story chapter."

**Files:** `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/features/player/usePlayer.ts`, `src/features/player/index.tsx`, `src/features/player/player.test.tsx`, `docs/performance.md`.

**Do:**
1. **Measure.** Regenerate the stress set with the command in `docs/performance.md` (it is gitignored), copy it into `dist/data/`, open `#listen?data=stress-globe`, and time the download at Slow (60 × 1.6 s + 1.5 s = 97.5 s of audio), Normal and Fast, in Chrome on a laptop and on an Android phone. Also time a 180 s render on the phone. Write all of it in `docs/performance.md`.
   - **Budget:** the 97.5 s file in 10 s or less on the laptop and 30 s or less on the phone; the 180 s file in 60 s or less on the phone without the tab crashing.
   - If over budget, the button says "Preparing the audio… this can take up to a minute on a phone."
2. **Tests:** a last step at 178.5 s is accepted and one at 178.6 s rejected, with the new message; the empty-steps message; steps with missing data use the hiss voice; the file name; the object URL is revoked; a second click while rendering does nothing; the current style and spatial mode are used.
3. **"Same input, same output"** holds only for steps without missing data, because the hiss is random noise. Test byte-identical output for two renders of a sequence with no missing data, and say this in the code.

**Part B (Could, after the cut line).** "Download this chapter" in the story panel, using the chapter's frames. It is the only "chosen date range" the app has. One test: it renders only the chapter's steps.

**Done when:** the numbers are in `docs/performance.md`; the tests pass; the over-limit message names the length and what to do.

---

## T98: Learn, Compare and About: fill the gaps (Roni, Mohammad)

**12 Nov, M in total, one PR per page.** Roni: Learn and About. Mohammad: Compare. Depends on T90 step 3 (words), the T95 decision (Learn) and T96 (`dispose`). All three pages exist; below is exactly what is missing compared with the request.

### Learn (Roni, Should)

**Exists:** a Play button for each category with its range and note; the chord ("all warm", "mixed"), slide and bell cards, replaced in Simple style by "Simple sound is on"; the tick; the missing-data hiss; "Explore the map" with its keys; "Play all" and "Stop"; a hidden status line.

**Missing:**
1. Nothing explains where a sound sits. Add a card "Where the sound is" with "Play: west" and "Play: east" (pan −1 and +1), and, when the listener's spatial mode is 3D, "Play: north" and "Play: south" (elevation), saying headphones are needed. Learn's engine must follow `useSpatialMode()`; today it does not.
2. When the hiss plays: "when fewer than N% of the points can be read", with N from `mapping.minValidFraction` and T90's words.
3. "Stop" works only during "Play all". Make it stop any sound.
4. One sentence on vibration, shown only where it is supported; the height accent sentence only if T95 passed.

All text must make sense without seeing anything. No new sounds.

**Done when:** tests check each new button calls the engine with the expected `pan` or `elevation`; the north and south buttons appear only in 3D mode; Stop stops a single sound; the a11y check passes; layout is checked at 360, 768, 1024 and 1280 px.

### Compare (Mohammad, Must for item 1)

**Exists:** Play date A and Play date B (each stops the other), answer, reveal with both images and descriptions, sound stopped on leaving, and test mode as a separate view.

**Missing:**
1. **A bug that real data would expose.** Compare and TestMode analyse `regions[0]` for every comparison and ignore `comparison.regionId`. Analyse the comparison's own region (custom dates keep `regions[0]`). Then remove T89's temporary rule. Test with a manifest whose comparison is in its second region.
2. "Play A, then B" in Compare only: A, an 800 ms gap, B, announced as "Date A, then date B". Pressing it again starts over, and Stop ends it. **Not in TestMode:** the listening-test protocol must not change before the 12 Nov practice test.
3. One sound at a time: tests with the fake engine show `stop()` before every play, so pressing B while A sounds ends A within the engine's 20 ms fade.
4. Leaving the page calls `dispose()` (T96).

**Done when:** the tests pass; the a11y check passes; layout is checked at 360, 768, 1024 and 1280 px.

### About and the other static pages (Roni, Must for the claims table)

**Exists:** everything on About is read from the manifest (title, description, variable, source name and link, credit, licence, retrieved date, how colours become sound, the ranges and notes table, the legend, limits, AI-tool use). No NASA fact is typed into About itself. The one typed NASA claim in the app is on Home: "The Earth Jukebox turns NASA Earth imagery into sound." Until 13 Nov the app only shows made-up data.

**Missing:**
1. **Method for the newer features**, one or two plain sentences each: the sound map (24 columns, nine samples per cell, the middle value), stereo and 3D placement, the chord, slide and bell rules, the WAV download, and vibration (Android only; **iOS has none**). Numbers come from the code's constants (for example `GRID_COLS`), not typed in.
2. **When `source.url` is empty**, About says "This is made-up practice data, not NASA data."
3. **A claims table** in `docs/data-sources.md`, "Claims to check". One row per sentence on Home, Learn or About that states a fact about NASA, a data set, a credit or a licence, with: the exact wording, the primary NASA page it comes from, and a box:

   `[ ] Needs human check against the NASA source. Checked by ____ on ____.`

   No claim, credit or licence wording goes on a page unless it can be traced to a primary NASA source. A row stays unticked until a person has read the source page. The real data sets' credit and licence are filled in on 13 Nov (T85 step 5), copied exactly from the source page, not reworded. Nothing with an unticked row is deployed after 13 Nov.

**Done when:** `about.test.tsx` shows the method numbers come from code constants and the made-up-data line appears when the URL is empty; the claims table exists with every current claim listed; the a11y check passes; layout is checked at 360, 768, 1024 and 1280 px.

---

## T99: Clean page load: no early audio, no console warnings (Bhavish, Roni)

**Decision 7 Nov, done 10 Nov, Should, S.** Bhavish: the script and CI. Roni: the test in `src/test/`. Depends on T96.

**The requirement, rewritten.** Browsers keep an AudioContext suspended until a user gesture on purpose (autoplay policy), and Chrome warns when code tries to start one earlier. "Zero suspension errors" therefore means: **no AudioContext is created or resumed before the first click or key press, and loading any page gives no uncaught error and no console message at warning or error level.** Checked on all five pages with each of the three data sets, with the server off and on (the voice guide must not log anything on load when its server cannot be reached).

**What exists.** Tone is loaded only inside `unlock()` and `renderToWav()`, and the voice guide creates its contexts in a click, so nothing should start early. Nothing checks it.

**Files:** `src/test/page-load.test.tsx` (new), `scripts/console_check.sh` (new) or a Playwright spec (see step 2), `.github/workflows/ci.yml`.

**Do:**
1. **jsdom test:** with `installFakeAudioContext()` and `fetch` mocked from the files in `public/data/`, render the app on each page and data set. `FakeAudioContext.instances` stays empty, and spies on `console.warn` and `console.error` are never called (React warnings included).
2. **Browser check.** Playwright is not in `package.json`, and `docs/TICKETS.md` allows no new npm packages. By 7 Nov the team leader chooses:
   - (a) allow `@playwright/test` as a dev dependency only, not shipped: a spec visits each page, fails on `page.on('console')` warnings or errors and on `page.on('pageerror')`, and counts `new AudioContext` before the first click with an init script; or
   - (b) no package: `scripts/console_check.sh` runs headless Chrome with `--enable-logging=stderr` on each URL and fails on any console line at warning or error level. It cannot count AudioContexts; step 1 covers that.

   With no decision by 7 Nov, do (b).
3. Run it in CI against `vite preview` after the build if it takes under 2 minutes; otherwise document it as the command to run before the demo.
4. Fix what it finds, or list each remaining message with a ticket. The allow-list is empty when this merges, or each entry has a reason and a ticket.

**Done when:** the test and the check pass on `main`; 15 page loads (five pages, three data sets) give 0 warnings and 0 errors; no AudioContext exists before the first gesture; the check runs in CI or is documented.

---

## T100: Both dates at once, one in each ear (a Compare mode) (Mohammad, team leader)

**Should, L. Listening check by 11 Nov, decision by 12 Nov.** Mohammad: Compare. Team leader: the engine. Depends on T96 (`dispose`, clipping) and the Compare region fix in T98. Second request, item A ("Stereo Time-Travel").

**What it is.** Date A (the reference) plays in the left ear and date B (the target) in the right, at the same moment, so the difference is heard as an interval between the ears (for example C4 left, E4 right: B is warmer).

**Where it lives: a mode of the Compare page, not a new feature.** Compare already picks two dates and a region, so this is a third way to play them, next to "Play date A" and "Play date B". It is **not** added to TestMode: the listening-test protocol must not change before the 12 Nov practice test. It uses the page's existing engine, so the music keeps one AudioContext.

**The conflict with pan, resolved.** Today pan means "west to east on the map" (`src/audio/pan.ts`), and in 3D mode azimuth means the same. In this mode, left and right mean "which date" instead. The two meanings must never mix:
- In this mode, region pan and the 3D panner are off. Elevation is off too (keeping it would make the 3D panner move the sound off hard left and right).
- The mode says so on screen and in its announcement: "Both dates at once: date A in your left ear, date B in your right. Left and right do not mean west and east here."
- Pitch still means only "warmer". Two notes at once are allowed; nothing else changes pitch.

**It fails for some listeners, so there is always a fallback.** Hard left and right are lost on speakers, with mono audio turned on (a common accessibility setting), with hearing in one ear only, and in some Bluetooth headset modes. So:
- The mode is offered with a choice, "At the same time (headphones)" or "One after the other", and "One after the other" (A, a short gap, B, both centred) is the default.
- Every play shows and announces both results in words: "Date A: cool. Date B: warm, two steps warmer." The words come from rules in `src/describe/` (Roni reviews), with T90's missing-data words when a date has too few readable points.

**Region first, cells later.** The request asks for both notes while sweeping a cell or a row. Version 1 plays the comparison's region (the same result Compare already judges). A cell or row sweep needs two sound-map grids and the explorer on the Compare page; that is part B, after the cut line, only if part A passes its listening check.

**Any two dates.** The request's example (1980 against 2026) is not in any data set: we have practice data until 13 Nov, and the real dates are unknown. The mode works with any two frames in the manifest, and is built and tested on synthetic-globe first.

**Files:** `src/audio/engine.ts`, `src/audio/index.ts`, `src/audio/engine.test.ts` (team leader), `src/features/compare/index.tsx`, `src/features/compare/compare.css`, `src/features/compare/compare.test.tsx`, `src/describe/index.ts`, `src/describe/describe.test.ts` (Roni reviews), `docs/PLAN.md` §5.3.

**Do (part A):**
1. **Engine (team leader).** The engine has one melody voice and one panner, so it cannot play two notes at two places at once. Add `playPair(a, b, opts?)` (interface change to PLAN.md §5.3): A on its own melody voice hard left, B on a second one hard right, through stereo panners even when the listener has 3D on. Each side is the plain melody (Simple style: no chord, slide, bell or reverb), so at most two voices sound. An `'insufficient'` side plays the hiss on that side. **Cap:** each note at least 6 dB below a single note, and a render of the loudest pair (hot and hot) peaks at or below −1 dBFS. `dispose()` (T96) also disposes the second voice.
2. **Compare.** A "How to play both" choice (a radio group with "One after the other" and "At the same time (headphones)"), remembered with the same try/catch as `useSoundStyle`, and a "Play both" button. Play A, Play B and Play both each stop whatever is sounding first.
3. **Words.** A pure `describePair(visualization, resultA, resultB, options)` that gives "Date A: cool. Date B: warm, two steps warmer." (or "the same", "one step cooler", "not enough data"), concise and rich, with tests.
4. **Listening check (11 Nov):** at least two people on headphones, who do not see the screen or the dates' categories: each hears 12 pairs from synthetic-globe at the same time (random order, including same-category pairs and one-step pairs) and says "left warmer", "right warmer" or "the same". **Pass:** every listener gets at least 9 of 12 right. If it fails, "At the same time" is removed and only "One after the other" stays (which is T98's "Play A, then B").

**Part B (Could, after the cut line, only if part A passed):** the sound map on Compare, playing the same cell or row of both dates at once, with two grids from `analyzeGrid` and the same rules.

**Done when:**
- Engine tests (Tone mock): `playPair` uses two voices at pan −1 and +1 and no 3D panner; style and spatial mode are restored afterwards; the hiss plays on the side with no data.
- Compare tests (fake engine): "Play both" in each choice calls the right engine method; it stops the previous sound; the announcement and the visible text equal `describePair`; nothing in TestMode changes.
- The peak and the listening results are in the PR, and the decision follows the pass rule.
- The a11y check passes; layout is checked at 360, 768, 1024 and 1280 px.

---

## T101: Display settings: a visible control, combinable modes (Roni)

**Should, M, 12 Nov.** Roni owns `src/styles/`, `src/index.css` and `src/components/`; Mohammad reviews the shell (`src/App.tsx`, `src/App.css`). Depends on T92 (focus rings). Second request, item B, without the voice part (T103) and the colour-vision patterns (T102).

**The primary path is a visible control, not voice.** Someone who needs high contrast or a calmer layout cannot depend on the voice guide: it needs the server, which sleeps for up to a minute on Render, needs a Gemini key, and is optional. So the settings live in a "Display" control that is visible on every page, works by keyboard, and is remembered on the device. Voice (T103) is a thin second path to the same setter.

**State is a set of flags, not one mode,** because modes combine (for example, easier reading with colour-vision patterns). `{ readable: boolean; highContrast: boolean; singleColumn: boolean; patterns: boolean }` (`patterns` is used by T102). Each flag adds a class on `<html>`: `accessibility-dyslexia`, `accessibility-high-contrast`, `accessibility-tunnel-vision`, `accessibility-cvd` (the request's names). The classes change **CSS variables on `:root`**, in the existing design tokens; they do not override component CSS.

**Defaults from the system.** With nothing stored, `highContrast` follows `prefers-contrast: more`, and the existing `prefers-color-scheme` and `prefers-reduced-motion` keep working. Under `forced-colors: active` (Windows High Contrast), the app uses system colours and the high-contrast class adds nothing that fights them.

**The modes, checked:**

| Mode | Request | What we do, and why |
|---|---|---|
| Easier reading (`accessibility-dyslexia`) | OpenDyslexic, Atkinson Hyperlegible or sans-serif; line height 1.8; letter spacing 0.05em; background #F5F2EB, text #1A1A1A | The evidence that dyslexia fonts help is mixed, and OpenDyslexic has the weakest support and adds weight and a licence to check. Use **Atkinson Hyperlegible, served from `public/fonts/`** (no third-party CDN), WOFF2, regular and bold, Latin subset, at most 100 KB together, `font-display: swap`, loaded only when the mode is on. Check its licence (believed to be the SIL Open Font License) and record it in `docs/data-sources.md`. Spacing and colours as requested. **Contrast: #1A1A1A on #F5F2EB is 15.6:1.** Every other token used on that background must be checked too (for example `--text` #6b6375 is 5.1:1, `--focus` #1a5fd0 is 5.2:1, `--accent` #8a1fe0 is 5.6:1) |
| High contrast (`accessibility-high-contrast`) | Background #000, text #FFF, accents and focus #FFE600 and #00FFFF, borders at least 3 px | **#FFF on #000 is 21:1, #FFE600 on #000 is 16.6:1, #00FFFF on #000 is 16.8:1.** Both accents fail on white (1.3:1) and against each other (1.0:1). So they are allowed **only on black**: yellow for focus rings and links, cyan for selected and pressed states. Never one on the other, never on the map image (the focus ring over the map keeps T92's light-and-dark double ring), never on white |
| Single column (`accessibility-tunnel-vision`) | One centred column, max width 640 px, no sidebars | There are no sidebars today, and below 768 px the app is already one column. What actually changes: on tablet and desktop, the page is at most 640 px wide and centred; grids that become two or more columns (Learn cards, Compare dates and images, the explorer's sliders, About facts) stay one column; the voice guide panel opens inside the column instead of floating at the side. The bottom bar below 768 px is unchanged; on desktop the header navigation wraps within 640 px |

**Files:** `src/display/` (new: `useDisplaySettings.ts`, `DisplaySettings.tsx`, `display.test.tsx`; add the folder to Roni in PLAN.md §4), `src/index.css`, `src/styles/tokens.test.ts`, `src/App.tsx` and `src/App.css` (the control in the header; Mohammad reviews), `public/fonts/` (new), `docs/data-sources.md` (font licence), `docs/PLAN.md` §4.

**Do:**
1. `useDisplaySettings()` with a context provider near the root: reads and writes `localStorage` `earth-jukebox:display` with the same try/catch as `useSoundStyle`, applies the classes to `document.documentElement`, and honours the system defaults above. One setter, `setDisplay(changes)`, which T103 also uses. "Reset display" clears every flag.
2. The control: a "Display" button in the header (44 × 44 px, `aria-expanded`), opening a panel of labelled switches and a "Reset display" button. Each change is announced politely ("High contrast on."). It works by keyboard alone; Escape closes the panel and returns focus to the button.
3. Tokens: one block per class on `:root` in `src/index.css`. Extend `tokens.test.ts` so every text and focus pair in each mode, and in each combination with dark mode, is at least 4.5:1 for text and 3:1 for focus rings and borders.

**Done when:**
- Tests: every flag on its own and these combinations: readable + high contrast, readable + single column, high contrast + single column, all four (with T102). Each sets the right classes; the choice survives a reload; blocked storage still works for the visit; `prefers-contrast: more` turns high contrast on when nothing is stored; "Reset display" clears all.
- `tokens.test.ts` passes for every mode and combination.
- In every mode and combination: no horizontal scroll at 320, 360, 768, 1024 and 1280 px and at 200% zoom; touch targets at least 44 × 44 px; layout checked at 360, 768, 1024 and 1280 px.
- The font files are within the budget, served locally, and their licence is recorded.

---

## T102: Colour-vision patterns over the map (Roni, Mohammad)

**Could, M, after the cut line.** Roni: the pattern layer and legend. Mohammad: the explorer surface. Depends on T101 (the `patterns` flag). Second request, item B (the `accessibility-cvd` overlay).

**What changes from the request.** The request names two patterns (dots for hot, crosshatch for cold). We need **six that differ without colour**: one for each of the five categories and one for not enough data. Suggested: plain (cold), wide diagonal lines (cool), crosshatch (mild), small dots (warm), large dots (hot), and a wavy line (not enough data). They must be told apart in greyscale.

**Rules:**
- **The analysis must read the original image, never the overlay.** The patterns are an SVG layer drawn over the picture in the page; the worker fetches and decodes the frame file itself (`readPixels`), so it never sees them. A test checks that turning patterns on does not change `analyzeGrid`'s input.
- Real SVG `<pattern>` fills, one per sound-map cell (the explorer's grid), from the cell's category.
- The layer is `aria-hidden="true"`: each cell's category is already said in words by the explorer's announcements and sliders.
- The legend (`src/components/Legend.tsx`) shows the matching pattern next to each category's colour, so the key works without colour.
- In high contrast (T101) the pattern strokes are white on a black outline so they show on any map colour.

**Files:** `src/components/PatternLayer.tsx` (new), `src/components/Legend.tsx`, `src/components/components.test.tsx`, `src/features/explore/Explorer.tsx` and `src/features/player/Viewer.tsx` (Mohammad), `src/styles/`.

**Do:** the layer, drawn from the same `FrameGrid` the explorer uses (the grid is read when the patterns are on, even if the explorer is off); the legend entries; tests.

**Done when:** tests show six distinct pattern ids for the five categories and the missing case, the layer is hidden from assistive technology, the legend lists a pattern for each category, and the grid read with patterns on equals the grid with them off; the a11y check passes; layout is checked at 360, 768, 1024 and 1280 px, and the patterns are visible at 360 px (at least 15 px cells; say in the PR whether they can still be told apart there).

---

## T103: Voice path for the display settings (Mohammad)

**Could, S, after the cut line.** Mohammad owns the voice guide (`server/app/assistant/`, `server/app/api/`, `src/hooks/useVoiceAssistant.ts`). Depends on T101. Second request, item B (the voice part).

**What it is.** The voice guide can turn the display settings on and off by calling the same `setDisplay` as the visible control. It is a convenience, not the way in: everything works without the server.

**Files:** `server/app/assistant/tools.py` (a new `set_display` tool), `server/app/assistant/knowledge.py` (a `DISPLAY_FLAGS` list and a line in the guide's instructions), `server/tests/test_assistant.py`, `src/hooks/useVoiceAssistant.ts` (`toAssistantAction` accepts `{ action: "display", ... }`), `src/hooks/useVoiceAssistant.test.ts`, `src/App.tsx` (`handleAssistantAction` calls `setDisplay`), `src/display/flags.ts` (from T101: the flag names in one exported list).

**Do:**
1. Server: `set_display` with `{ "flag": one of DISPLAY_FLAGS or "reset", "on": boolean }`. It returns a client action `{"action": "display", "flag": ..., "on": ...}`. Update the module comment ("every tool is navigational, read-only, or a playback control") and `test_tools_only_navigate_or_read`, which assumes there is no other kind.
2. A drift test like `test_pages_match_frontend`: `DISPLAY_FLAGS` in `knowledge.py` must equal the list in `src/display/flags.ts`.
3. Browser: `toAssistantAction` accepts only known flags and a boolean, nothing else, and `handleAssistantAction` calls `setDisplay`. Every voice-made change is announced politely, exactly as a click would be ("High contrast on. Say 'reset display' or use the Display button to undo.").
4. "Reset display" works by voice and by the button.

**Done when:** server tests cover a valid flag, an unknown flag (rejected), reset, and the drift test; browser tests show an unknown flag or a non-boolean is ignored and a valid one calls `setDisplay` and announces; everything still works with the server off.

---

## T104: Hottest-area beacon in the sound map (Mohammad, team leader)

**Could, M, after the cut line; first to be cut.** Mohammad: the explorer. Team leader: the ping in the engine. Depends on T92, T93 and T96. Second request, item C ("Acoustic Anomaly Beacon").

**"Anomaly" is not something our data has.** The frames are colour-coded temperatures read into categories, not departures from a baseline; without a baseline (a climatology) there is no anomaly, only the hottest place. So version 1 finds **the hottest area of the current date**, and it is labelled that way: "hottest area", never "anomaly". If a real anomaly data set arrives on 13 Nov (its legend is already in departures from normal), the same beacon finds its largest value, and only then may the label say anomaly, with the source page as the reference. "The biggest change since the previous date" is a later option, not version 1.

**The target:** the cell or cells of the warmest category present in the grid. Among several, the one nearest the cursor (ties broken by row, then column, so the answer is always the same). Cells with not enough data are never targets.

**The key, scoped.** The request asks for F. A plain letter must not be taken over across the page: NVDA and JAWS use F in browse mode for "next form field", and typing in the text and voice fields must not set it off. So F works **only while the sound-map surface has focus** (it is `role="application"`, where screen readers pass keys through), and it is listed in the surface's instructions and on Learn. A visible "Find the hottest area" button next to the sweep buttons does the same, because a key alone cannot be discovered.

**The sound.** The ping comes from where the target is, relative to the cursor, using the existing placement: east-west as pan, north-south as elevation in 3D mode. Distance is told by **repetition, never pitch** (pitch means warmer): one ping when far, up to four quicker pings when near. The ping is the same fixed sound every time. On arriving at the target, the cell plays as usual. The announcement (polite, under T93's rate rule) says where it is: "Hottest area: hot, 9 columns east and 2 rows north, column 22, row 4."

**Files:** `src/features/explore/beacon.ts` (new, pure: `findHottest(grid, cursor)` and `directionTo(cursor, target)`), `src/features/explore/beacon.test.ts`, `src/features/explore/Explorer.tsx`, `src/features/explore/Explorer.test.tsx`, `src/audio/engine.ts`, `src/audio/index.ts`, `src/audio/engine.test.ts` (an optional `playPing(opts)`; interface change to PLAN.md §5.3), `src/features/learn/index.tsx` (one line; Roni reviews).

**Do:** the pure functions; the key and the button; the ping; the announcement.

**Done when:**
- `beacon.test.ts` covers: the cursor already on the target ("You are on the hottest area."); several equal targets (nearest wins, ties always the same); targets next to cells with not enough data; a grid with no readable cells ("Not enough data on this date to find the hottest area.", and no ping); a grid where every cell is the same category.
- Explorer tests: F on the focused surface pings and announces; F in a text field or elsewhere on the page does nothing; the button does the same as F.
- Engine test: the ping's pitch is the same at every distance; only the number and spacing of pings change.
- The a11y check passes; layout is checked at 360, 768, 1024 and 1280 px.

---

## Risks and things I changed from the request

1. **The height accent is an experiment, not a feature.** A brighter sound for north is a timbre cue, so it does not break "pitch means warmer". But generic HRTF height cues are weak and the effect is unproven, and a high-pass cutoff near a note's fundamental can make the note sound an octave higher. T95 starts with a high shelf, caps the boost at +4 dB and the peak at −1 dBFS, checks the pitch does not move, adds an off switch, and keeps it off unless at least two listeners who are not told the directions pass a blind check.
2. **"Zero-lag haptics" cannot be measured where our tests run,** and iOS Safari has no `navigator.vibrate`. T94 requires the call to happen synchronously in the input handler, unsupported browsers to do nothing quietly, and a check on one real Android phone. iOS gets no haptics, and About says so (T98).
3. **"44px+ focus ring" mixed up two things.** The focus indicator is at least 2 px thick with 3:1 contrast; the touch target is at least 44 × 44 px. T92 checks against WCAG 2.2 2.4.7, 2.4.11 and 2.5.8. 2.4.11 is "focus not obscured", which matters here because of the bottom bar and the voice guide panel. The 2 px and 3:1 numbers come from 2.4.13 and 1.4.11.
4. **"Zero AudioContext suspension errors on load" is not achievable as written,** because suspension before a gesture is how browsers are meant to behave. T99 requires that no AudioContext is created or resumed before a gesture and that there are no warnings or errors on load, tested on every page. The request asked for Playwright, but `docs/TICKETS.md` forbids new npm packages. T99 asks the team leader to decide and has a no-package fallback.
5. **The colour normalizer already exists.** `valueAtPixel` and `categoryFor` match against the legend with a distance threshold, which is the right primary method for NASA colour bars. T90 hardens and tests it rather than building a second one. HSV hue bands are rejected as the method and used only to build test colours. CIELAB is an opt-in experiment (T90 part B), adopted only if the T88 output stays the same.
6. **Converting the data sets must not change the sound.** All three data sets already pass the schema, so "standardise to the new schema" is mostly done. T88 freezes the categories, steps, chords and grids of fixture, synthetic-ocean and synthetic-globe before anything changes, and T89 and T90 must leave them unchanged.
7. **The WAV limit stays at 3 minutes,** with a message that gives the length and what to do; there is no chunked rendering (T97). The render time is measured on the 60-frame stress set, which is gitignored and has to be regenerated first. There is no date-range picker, so "any chosen date range" means the whole run today, and a story chapter in T97 part B.
8. **Learn and Compare already exist.** T98 lists exactly what is missing on each. "Only one AudioContext" is rewritten: one for the music, plus the voice guide's own contexts and the offline one for WAV export. T96 adds `dispose()` and a create-and-dispose leak test, because today engines are stopped but never disposed.
9. **About must not state any NASA fact we cannot trace.** T98 adds a claims table with a human-check box for each claim. Home's "turns NASA Earth imagery into sound" is on that list, because until 13 Nov the app shows only made-up data. Real credits and licences are filled in on 13 Nov from the source page.
10. **Absolutes are now numbers:** announcements at most one per 1.5 s (T93); explorer latency within 30 ms of output latency (T96); Play enabled within 5 s and 30 minutes for the whole T85 check (T91); render budgets (T97); peak at or below −1 dBFS (T95, T96); 0 warnings on 15 page loads (T99).

**From the second request:**

11. **Both dates at once (T100) changes what left and right mean.** Today pan is west to east. In this mode it is "which date", so region pan, 3D and elevation are off in it, and the screen and announcement say so. Hard left and right fail on speakers, mono audio, hearing in one ear and some Bluetooth modes, so "One after the other" is the default, and both results are always given in words. It is a Compare mode (one AudioContext, the existing engine plus a second voice), not in TestMode, region-level first, and it stays only if two listeners pass a blind check. The engine cannot play two notes at two places today; `playPair` is an interface change.
12. **Voice is the wrong main control for display modes.** T101 makes a visible, keyboard-operable, remembered "Display" control the main path, with system preferences as defaults; T103 adds voice as a thin second path through the existing tool and action route, with a drift test like the pages one, and every change announced and reversible.
13. **Design details changed:** Atkinson Hyperlegible served locally instead of OpenDyslexic, with the mixed evidence stated; contrast ratios computed (15.6:1, 21:1, 16.6:1, 16.8:1) and the yellow and cyan accents allowed only on black (1.3:1 on white, 1.0:1 against each other); modes are combinable flags as CSS variables on `<html>`; single column described by what it really changes on desktop; six colour-vision patterns instead of two, never read by the analysis, hidden from assistive technology, and in the legend.
14. **The "anomaly" beacon finds the hottest area,** because the data has no baseline. F only works on the focused sound map (screen readers use F, and text fields must not trigger it), with a visible button too; distance is told by repetition, never pitch.
15. **Schedule.** Three large features on top of the first request do not fit in 8 days. T100 and T101 are Should; T102, T103 and T104 are Could and start only after the cut line. See "Scope and cut order".

**Conflicts with the code found while writing these:**
- `missingCue.type: "note"` is allowed and plays a low B1 sawtooth, against the rule that missing data is never a low note. Removed in T90 (an interface change).
- A gap between category ranges makes a value in the gap sound like the warmest or coolest category. Forbidden in T89.
- Compare and TestMode ignore `comparison.regionId` and always use the first region. Guarded in T89, fixed in T98.
- `datasets.test.ts` fails on any machine that has generated the stress set. Fixed in T89.
- The browser may colour-convert frames that carry a colour profile, while the tests do not. Fixed in T90 and T91.
- The request says "white noise hiss"; the app uses pink noise, already tested and documented. Kept.
- The engine has one melody voice and one panner, so two dates at once (T100) needs a new engine method.
- `test_tools_only_navigate_or_read` and the comment in `server/app/assistant/tools.py` assume the voice guide can only navigate, read and control playback; T103 must change both, on purpose.
- There are no sidebars to remove for "tunnel vision"; below 768 px the app is already one column.
- The request's type names (FrameManifest and so on) and "missing_data" are not added. The code keeps `Visualization`, `Category`, `ColorScale` and `'insufficient'`, so there are not two names for one thing.

**Other risks:**
- **Load.** The team leader holds T90, T96 and T97 on top of T87, and Mohammad holds T92, T93, T94 and Compare. If either slips, follow the cut order above. Do not push back T85's real-device numbers or T87's "now" steps.
- **Dates.** The request says the sprint is 13 to 14 Nov; PLAN.md §2 says the hackathon is 14 to 15 Nov, with the resources on 13 Nov. These tickets target 12 Nov either way. Fix whichever document is wrong.
- **The rehearsal is not the real data.** An SVS sequence tests the converter, but the 13 Nov frames may be video, have a changing legend, or be much larger. `docs/performance.md` already flags memory as the risk for large frames; nearest-neighbour scaling in T91 is the fallback.

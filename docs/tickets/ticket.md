# Plan: an Earth Jukebox that judges can hear, explore and read, on top of a frontend ready for the NASA data

Written 5 Nov 2026 and revised the same day against the challenge brief (`CHALLENGE.md`). This revision replaces the first version of this file (which aimed only at "accommodate the NASA data, plus ADK"). Tickets follow on from T52 and are hung off [`docs/PLAN.md`](../PLAN.md); where this file and the plan disagree, T53 fixes the plan first.

Hand a ticket to your own AI like this:

> Read `AGENTS.md`, `docs/PLAN.md` and ticket `<ID>` in `docs/tickets/ticket.md`. Do only that ticket, on branch `feature/<ID>-short-name`, and open a PR into `main`.

Every ticket must also meet the definition of done in PLAN.md §9, including the layout rule in `AGENTS.md`. Check at 360, 768, 1024 and 1280 px using the `responsive-layout` skill, and list the widths you checked in the PR. If a ticket lists a file that someone else owns (PLAN.md §4), that owner reviews the PR. The ticket lists the file because the change was agreed here.

## Goal and boundaries

1. **Serve the challenge, not just the data.** The brief asks for an *exploratory*, *musical*, *accessible* translation of EIC frames into sound, with rich descriptive text, a story with emotional weight, a documented creative process, and optionally a curated set of generated audio files. Today the app plays one of five notes per date. This plan adds:
   - a sound map you can explore by keyboard, touch and pointer (T65, T67)
   - harmony and a change sound worked out from the data (T68)
   - computed descriptions for screen readers (T69)
   - a story mode (T71)
   - WAV export and a curated playlist (T72, T74)
   - the creative-process write-up (T73)
2. **Stay ready for the real NASA data on 13 Nov.** Everything that does not depend on the data is built now. Anything that depends on the data waits for 13 Nov (T61).
3. **Google ADK stays in the plan, at lower priority.** The voice guide already works on the current bridge. Moving it to ADK changes how it is built, not what judges see or hear. The spike (T58) still runs. T59 runs only if the challenge-critical tickets are merged in time, and T60 is the first thing cut.
4. **Stack stays the same:** React 19, TypeScript, Vite 8, Zod 4, Tone.js, Tonal, Vitest. No new npm packages: the WAV encoder and the PNG test reader are written by hand (about 40 lines each). The only possible new dependency is the Python package `google-adk`, and only if T59 goes ahead.

**Hard boundary:** agents and LLMs never touch image analysis (`src/analysis/`), sound mapping and voicing (`src/audio/`), descriptions (`src/describe/`) or listening-test scoring (`src/features/compare/judge.ts`, `server/app/study/`). The same frame must always give the same category, chord, description and score (PLAN.md §9). An agent may explain or propose; deterministic code decides. T64 adds a test that enforces this on the frontend, whatever happens to ADK.

**Another rule:** the app must keep working with the server off (`AGENTS.md`). Nothing in the listening, exploring, story or download features may depend on the server, ADK or Gemini.

## Coverage of the challenge

The status column is judged from the code on 5 Nov, not from the docs.

| Challenge element | Status today | Where it is covered | Honest note |
|---|---|---|---|
| Select a visualization | **Built, not merged** | T54 (branch `feature/T54-dataset-picker`), merged in T63; real data sets in T61 | Only two synthetic data sets exist. The picker matters once there are real data sets to pick from. |
| Easy to start the audio | Built | Play button and Space bar on Listen; Learn page | Fine. |
| Real-time sonification from the frames | Built, thin | Analysis runs live in a Web Worker | The output is one note per date: the median of about 30 points in one region becomes one of 5 notes. Real-time, yes; dynamic, barely. Fixed by T65, T67 and T68. |
| Musicality (scales, harmony, rule sets) | **Thin** | T66 (consonant notes), T68 (chord, glide, bell, softer tone, reverb) | The notes are a plain triangle wave on C4 D4 E4 G4 A4. Our own `docs/SOUND_MAPPINGS.md` §4.1 already says these steps are too narrow. There is no harmony, no timbre and no space. |
| Colour spectrum to chords | **Gap** | T68: a soft chord built from how the region's values are spread across the categories | — |
| Pixel density to rhythm | Gap, left out on purpose | — | We put the spread of values into the chord's voicing instead. A second rhythm cue would break our own rule of one main cue plus one backup (SOUND_MAPPINGS §1). T73 explains this. |
| Change between dates | **Gap** (only a tick) | T68 (glide from the previous note; a bell when the value jumps two or more steps), T69 ("up two steps from March") | — |
| Exploratory, spatial interaction | **Gap** | T65 (value grid for the whole map), T67 (explore by keyboard, touch, pointer and sliders; sweep a row or column) | Today the region outline is only decoration, and nothing can be explored. This is the biggest gap against the brief. |
| Stereo or spatial audio | **Thin: built but never used** | T67 (pan follows the cursor and the sweeps) | `src/audio/pan.ts` exists and the engine accepts `pan`, but no caller passes one. Listen and Compare are always centred. |
| Blind and low-vision access | Built (baseline) | Keyboard shortcuts, live announcements, alt text, axe checks; T62, T75 | No screen-reader user has tried it yet (T45, T75). |
| Screen-reader compatibility | Built for current pages | T67 (the explorer is the hard part), T62 | `role="application"` and touch exploration on phones need checking with real screen readers. The explorer's sliders are the fallback. |
| Tactile feedback | Built, thin | Vibration (Android Chrome only); T67 adds a pulse as the explorer cursor moves | iOS Safari has no vibration API. Say so in About and the README rather than promise it. |
| Rich descriptive text | **Thin** | T69 | Today there is only hand-written alt text per frame and the method on About. Nothing is computed per date: no value, no share of points read, no change, no mix. |
| An audio description a screen reader can read | **Gap** | T69 (summary of the whole sequence; description of a sweep) | — |
| Story, emotion, urgency | **Gap** | T71 (story mode), T66 (synthetic heatwave story for rehearsal), T61 (real story text), T07 (demo) | Today the story is one sentence on Home, and synthetic data carries no urgency. The urgency has to come from the real data on 13 Nov. |
| Beauty of interconnected systems | Gap, mostly out of scope | Partly: the picker across real data sets (T61) and the whole-map explorer (T67) | No cross-data-set sonification. Too much for 10 days. |
| Documented creative process ("why") | **Thin** | T73, folded into the README in T24 | `SOUND_MAPPINGS.md` (research) and the About page (method) exist. There is no write-up of the choices and why we made them. |
| Alternative deliverable: generated audio files | **Gap** | T72 (`renderToWav` plus a Download button), T74 (playlist and release) | `renderToWav` currently rejects with "not built yet". The playlist is also our guaranteed backup if the live site fails. |
| Extract frames from EIC animations | Not built | T33 and T61 (convert video to PNG frames offline) | Waits for the real resources. |
| Evidence that listeners understood | Built | Test mode, study API, results summary; T75 (practice test, 12 Nov), T45 (real test) | — |
| Correctness on real images ("same frame, same result") | **Thin** | T65 adds a test that decodes the synthetic PNGs and checks them against `expected.json` | PLAN.md §9 says this check must always pass, but no test reads the PNGs. Only hand-built pixel arrays are tested, and `expected.json` is checked by nothing. |
| Voice guide | Built | T58 and T59 (ADK, optional) | Already works on the current bridge. |

## Order and dates

Today is 5 Nov. M2 is 9 Nov, M3 (feature complete, deployed) is 12 Nov, M4 (real data, judging guide) is 13 Nov, and M5 (submission) is 15 Nov, with features frozen 6 hours before the deadline.

| Order | ID | Title | Owner | Due | Priority | Depends on | Status |
|---|---|---|---|---|---|---|---|
| 1 | T53 | Decisions: new scope, owners, ADK priority, cut line (changed) | Team leader | 6 Nov | Must | none | To do |
| 1 | T63 | Merge T57, T55 and T54 into `main` (new) | Team leader | 6 Nov | Must | none | To do |
| 2 | T64 | Interfaces and stubs for the new features (new) | Team leader | 7 Nov | Must | T53, T63 | To do |
| 2 | T58 | ADK spike, one day at most (throwaway) | Mohammad | 7 Nov | Should (was Must) | T53 | To do |
| 3 | T66 | Synthetic data: wider notes, map area, a varied "globe" data set with a story (new) | Dhruv | 8 Nov | Must | T64 | To do |
| 4 | T65 | Value grid, category shares and a PNG check (new) | Team leader | 9 Nov | Must | T64 | To do |
| 4 | T69 | Computed descriptions (new) | Roni | 9 Nov | Must | T64 | To do |
| 4 | T72a | WAV encoder (new; part of T72) | Bhavish | 9 Nov | Must | T64 | To do |
| 5 | T67 | Sound map explorer (new) | Mohammad | 10 Nov | Must | T64 (stub), T65 (real grid) | To do |
| 5 | T68 | Musical layer: chord, glide, bell, tone, simple style (new) | Team leader | 10 Nov | Must | T64, T65 (shares), T66 (notes) | To do |
| 5 | T56 | Stress data set and analysis speed, including the grid (changed) | Dhruv + Team leader | 10 Nov | Must (measure); Should (speed-up) | T65 | To do |
| 6 | T72 | WAV export and Download button (was T08, Should) | Team leader + Mohammad | 11 Nov | Must | T68, T72a | To do |
| 6 | T70 | Learn page: teach the new sounds and the explorer (new) | Roni | 11 Nov | Must | T67, T68 | To do |
| 6 | T71 | Story mode (new) | Bhavish | 11 Nov | Should | T64, T66, T69 | To do |
| 7 | T75 | Practice listening test of the new sound (new) | Roni | 12 Nov | Must | T67, T68, T70 | To do |
| 7 | T73 | Creative-process write-up (new) | Team leader (Bhavish edits) | Draft 12 Nov, final 15 Nov | Must | T68 | To do |
| 7 | T59 | Voice guide on ADK, behind a setting | Mohammad | 12 Nov | Could (was Must) | T58 says yes, and T67 merged by 10 Nov | To do |
| 8 | T60 | `data_explainer` sub-agent | Mohammad | 12 Nov | Could, cut first | T59 | To do |
| 9 | T61 | Data-specific variants, real story text, map areas (changed) | Dhruv + Team leader | 13–14 Nov | Must | Real NASA data, T33 | Waits for data |
| 10 | T74 | Curated playlist of generated audio (new) | Dhruv + Bhavish | 14 Nov | Must | T72, T61 | Waits for data |
| 10 | T62 | Final verification pass (changed) | Roni | 14 Nov | Must | All of the above | Waits for data |
| — | T54 | Dataset picker | Mohammad | — | Must | — | **Built** (`13a5f12`), merged in T63 |
| — | T55 | Accessible legend | Roni | — | Must | — | **Built** (`44414f6`), merged in T63 |
| — | T57 | Dates for any cadence | Roni | — | Should | — | **Built** (`8967dfb`), merged in T63 |

Tickets in the per-person files that this plan touches. Their text stays in those files, but their content changes as described:

| ID | File | Due | Change |
|---|---|---|---|
| T06 Re-plan against the judging guide | `team-leader.md` | 13 Nov | Score this coverage table against the published criteria, too. |
| T33 NASA converter, T34 real comparisons | `dhruv.md` | 13–14 Nov | Unchanged. The converter also writes `mapArea` (T61). |
| T45 Testers | `roni.md` | Now → 14 Nov | Recruit at least one screen-reader user for T75 on 12 Nov. |
| T07 Demo script and backup video | `team-leader.md` | 14 Nov | New demo flow: pick a data set → story mode → explore the map by keyboard → compare two dates by ear → reveal → play a track from the playlist → test results → limits. |
| T24 Submission README | `bhavish.md` | 15 Nov | Summarise T73 and link it, link the T74 playlist, and add the coverage table. |
| T08 WAV export | `team-leader.md` | — | Replaced by T72. |

**Cut line for 12 Nov (M3, feature complete).** These are Must and are merged and deployed by the end of 12 Nov:
- T53, T63, T64, T65, T66, T67 (keyboard, sliders and row sweep at least), T68 (chord and glide at least), T69, T70, T72, T75
- the T56 measurements
- the T73 draft

After 12 Nov, only data, text, fixes and tests go in.

**Waits for real data (13 Nov onward):** T61 (including real story text and map areas), T33, T34, T06, T74, T62, T07, and the T73 final with results.

**If time runs out, cut in this order** (first cut at the top):
1. T60
2. T59 (keep T58's written result for the README)
3. T56 step 3 (progressive analysis; keep the measurements)
4. T71 story mode (the sequence description from T69 and the demo script carry the story instead)
5. T68 bell and reverb (keep the chord and glide)
6. T67 pointer and touch drag (keep keyboard, sliders and sweeps)
7. T72's Download button (keep `renderToWav` so the playlist can still be made)

**Never cut:** T63, T64, T65, T67 keyboard and sliders, T69, T75, T61, T62, T73, T74. If T68 hurts accuracy in T75, ship the simple style as the default rather than cut it.

**ADK cut line, end of 7 Nov:** if the T58 spike has not shown a working Live voice session with tool calls on Python 3.12 within Render's free-tier memory, drop T59 and T60, and the current bridge stays. Even if the spike passes, T59 starts only if T67 is merged by 10 Nov. Mohammad's time goes to the explorer first. The voice guide is a Must (F10), and it must not be put at risk a week before the demo for a change judges cannot see.

---

## T53: Decisions: new scope, owners, ADK priority, cut line (6 Nov, Must)

**Owner:** Team leader. **Depends on:** none.

**Files:** `docs/PLAN.md` (§3 decisions, §4 owners, §6 features, §8 milestones, §11 risks), `docs/tickets/README.md` (add a pointer to this file and the new IDs T53–T75), `AGENTS.md` (server notes only if T59 goes ahead).

**Do:**
1. Add to the PLAN.md §3 decisions table:
   - "Sound map explorer: the whole frame is read into a grid of values, explored by keyboard, touch, pointer and sliders."
   - "Musical layer: notes C4 E4 G4 C5 E5 (a C major arpeggio, so any mix of notes is consonant); a soft chord from the spread of values; a glide for change; a bell for big jumps; a 'Simple sound' setting."
   - "Descriptions are computed by rules in `src/describe/`, never by an LLM."
   - "WAV export, plus a curated playlist as the second deliverable and our backup."
   - "Voice guide on ADK: optional, behind a setting, after the Musts; the current bridge stays the default."
2. Add the hard boundary from this file, with its folder list, to PLAN.md §9.
3. Add owners for the new folders to PLAN.md §4: `src/describe/` (Roni), `src/features/explore/` (Mohammad), `src/features/story/` (Bhavish). Add `src/audio/wav.ts` to Bhavish for T72a.
4. Update PLAN.md §6 features:
   - Add F18 Sound map explorer (Must), F19 Harmony and change sounds (Must), F20 Computed descriptions (Must), F21 Story mode (Should), F22 Curated playlist (Must), F23 Creative-process write-up (Must).
   - Change F14 WAV export from Should to Must.
   - Cut F17 (background drone) and say why: the T68 chord does that job and is driven by data.
5. Copy the cut line above into PLAN.md §8, and the risk rows from "Risks for the judging" at the end of this file into §11.
6. Record that `google-adk` is approved only if T59 goes ahead (new packages need the team leader's agreement).

**Done when:** PLAN.md names the new features, owners, boundary and cut line; `docs/tickets/README.md` points here; and the PR has been read by all five members, each confirming their tickets.

---

## T63: Merge T57, T55 and T54 into `main` (6 Nov, Must)

**Owner:** Team leader (Mohammad reviews the T54 parts, Roni the T55 and T57 parts). **Depends on:** none.

**Found:**
- `feature/T55-legend` is stacked on `feature/T57-date-formatting`: it already contains commit `8967dfb`.
- `feature/T54-dataset-picker` branches from `main`.
- T54 and T55 both add an export to `src/components/index.ts` and a block to `src/styles/components.css`.
- T55 and T57 change `src/features/player/index.tsx`, `Viewer.tsx` and `usePlayer.ts`.

**Do:**
1. Open and merge the PRs in this order: T57, then T55, then T54. Run `npm test`, `npm run lint` and `npm run build` after each merge, and wait for CI to pass.
2. Resolve conflicts by keeping both sides: both exports in `src/components/index.ts`, both CSS blocks in `src/styles/components.css`.
3. After the last merge, check by hand in `npm run dev`:
   - `#listen?data=synthetic-ocean` shows the legend and the month-and-year dates.
   - Switching data set in the picker reloads Listen, Compare, Learn and About.
   - A bad `?data=` shows the fallback message.
4. Tell the team in chat to rebase their branches on the new `main`.

**Done when:** all three are on `main`, CI is green, and the four checks in step 3 pass at 360 and 1280 px.

---

## T64: Interfaces and stubs for the new features (7 Nov, Must)

**Owner:** Team leader. **Depends on:** T53, T63. Dhruv reviews the data changes; Mohammad, Roni and Bhavish review the stubs they will build on.

This follows the T00 method: every new interface lands on day 1 with a working stub behind it, so T65–T72 can run in parallel.

**Files:** `src/data/types.ts`, `src/data/schema.ts`, `src/data/schema.test.ts`, `src/analysis/index.ts`, `src/audio/index.ts`, `src/audio/engine.ts` (accept the new fields and ignore them for now), `src/audio/voicing.ts` (new), `src/audio/style.ts` (new), `src/describe/index.ts` (new), `src/boundary.test.ts` (new), every test file that builds a fake engine (`src/features/player/player.test.tsx`, `src/features/compare/compare.test.tsx`, `src/features/compare/test-mode.test.tsx`, `src/features/learn/learn.test.tsx`), and `docs/PLAN.md` §5 (new subsections 5.6 to 5.8).

**Do:**
1. **Data:** in `src/data/types.ts` add these, and the matching Zod schema in `schema.ts`:
   ```ts
   /** The part of the image that is map, as fractions 0 to 1 (x0 < x1, y0 < y1). Leaves out legend bars and titles. Default: the whole image. */
   export type MapArea = { x0: number; y0: number; x1: number; y1: number }
   /** One chapter of the story mode. fromFrame and toFrame are frame ids; fromFrame comes first in date order. */
   export type StoryChapter = { id: string; title: string; text: string; fromFrame: string; toFrame: string }
   // in Visualization:
   mapArea?: MapArea
   story?: StoryChapter[]
   ```
   The schema rejects, with a readable message, an area outside 0 to 1 or an empty one, and a chapter whose frames do not exist or are in the wrong order. Add tests for each rejection to `schema.test.ts`.
2. **Analysis:** in `src/analysis/index.ts`:
   ```ts
   FrameAnalysis { ...existing; shares?: Record<CategoryId, number> } // fraction of valid points in each category; sums to 1 when valid > 0
   export type GridCell = { value: number | null; category: CategoryId | 'insufficient' }
   export type FrameGrid = { frameId: string; cols: number; rows: number; area: MapArea; cells: GridCell[] } // row-major, row 0 is the top (north)
   export function analyzeGrid(frame: Frame, colorScale: ColorScale, mapping: SoundMapping, area?: MapArea): Promise<FrameGrid>
   ```
   The stub returns a 24 × 12 grid that runs from the coolest category in the west to the warmest in the east, with the last two columns `'insufficient'`, so the explorer can be built against it.
3. **Audio:** in `src/audio/index.ts`:
   ```ts
   export type SequenceStep = { category: CategoryId | 'insufficient'; atMs: number; pan?: number
                                pad?: CategoryId[]; glide?: boolean; bell?: boolean }
   playCategory(id: CategoryId, opts?: { pan?: number; durationMs?: number; pad?: CategoryId[] }): void
   playSequence(steps: SequenceStep[], onStep: (index: number) => void, opts?: { tick?: boolean }): void // tick defaults to true
   setStyle(style: SoundStyle): void
   ```
   `src/audio/style.ts` exports `type SoundStyle = 'full' | 'simple'` and `useSoundStyle(): [SoundStyle, (s: SoundStyle) => void]`. The hook is stored in `localStorage` under `earth-jukebox:sound-style`, wrapped in try/catch, and defaults to `'full'`.

   `src/audio/voicing.ts` exports `voicingFor(results: FrameAnalysis[], index: number, mapping: SoundMapping): Pick<SequenceStep, 'pad' | 'glide' | 'bell'>`. The stub returns `{}`.

   The engine accepts all the new fields and ignores them until T68. `tick: false` already skips the tick.
4. **Descriptions:** `src/describe/index.ts` exports these, each as a stub returning a short fixed sentence:
   ```ts
   describeFrame(v: Visualization, results: FrameAnalysis[], index: number): string
   describeSequence(v: Visualization, results: FrameAnalysis[]): string
   describeCell(v: Visualization, grid: FrameGrid, col: number, row: number): string
   describeSweep(v: Visualization, grid: FrameGrid, line: { kind: 'row' | 'column'; index: number }): string
   ```
5. **Boundary test:** `src/boundary.test.ts` reads, with Node's `fs`, the source files under `src/analysis/`, `src/audio/`, `src/describe/` and `src/features/compare/judge.ts`. It fails if any of them imports from `src/assistant/`, `src/hooks/useVoiceAssistant`, `src/VoiceAssistant` or `src/config`, or contains `fetch(` (except `src/analysis/pixels.ts`) or `WebSocket`.
6. Update every fake engine in the test files above so it has `setStyle` and accepts the new options.
7. Write PLAN.md §5.6 (grid), §5.7 (voicing and style) and §5.8 (descriptions) with the signatures above.

**Done when:**
- `npm run build`, `npm run lint` and `npm test` pass.
- The current manifests still validate (both new fields are optional).
- The schema tests cover the new rejections.
- The boundary test passes, and fails when you temporarily add `import '../assistant/context'` to `src/audio/voicing.ts`.

---

## T58: ADK spike (7 Nov, throwaway, Should)

**Owner:** Mohammad. **Depends on:** T53. **Time box:** one working day. If it is not proven by the end of 7 Nov, the answer is "no".

**Files:** a throwaway branch only. Do not merge. Put the report in the PR description and copy it to `docs/adk-spike.md` on `main` (a short note; T24 quotes it in the README).

**Do:** prove or disprove, on **Python 3.12** (what Render runs), that:
1. ADK runs a Gemini Live voice session through our FastAPI WebSocket, using the same browser protocol as `server/app/api/assistant.py`.
2. Tool calls work, for example `navigate_to` and `control_playback` from `server/app/assistant/tools.py`, and their results still reach the browser as `{"type":"action",...}`.
3. User and assistant transcripts still arrive, and the browser's page-context messages can be passed in.
4. A sub-agent hand-off works in Live mode. This is unverified so far, and it decides whether T60 is possible.
5. Idle memory and cold-start time fit Render's free tier (512 MB).
6. The current version of `google-adk` on PyPI is checked and written down. Search results disagreed on version numbers, and the Python Live streaming docs label the feature experimental.

**Done when:** each of the six points has a written yes or no, with the numbers for memory and start time, and a clear recommendation on T59.

---

## T66: Synthetic data: wider notes, map area, a varied "globe" data set with a story (8 Nov, Must)

**Owner:** Dhruv. **Depends on:** T64.

**Found:**
- The synthetic ocean is one flat colour with only ±0.5 °C of variation, so a sound map of it would play the same note everywhere.
- Its legend bar (bottom 48 px) is drawn in legend colours, so a whole-frame grid would read it as water.
- The notes C4 D4 E4 G4 A4 are only 2 to 3 semitones apart (`docs/SOUND_MAPPINGS.md` §4.1).

**Files:**
- `scripts/make_synthetic.py`
- `scripts/make_fixture.py`
- `scripts/make_synthetic_globe.py` (new; share helpers with `make_synthetic.py` by importing them, not by copying)
- `public/data/synthetic-ocean/`, `public/data/fixture/`, `public/data/synthetic-globe/` (new), `public/data/index.json`
- `src/analysis/analyze.test.ts`, `src/features/learn/learn.test.tsx`, `src/features/about/about.test.tsx` (only the lines that assert the old note names; the owners review)

**Do:**
1. Change the five category notes in both scripts to **C4, E4, G4, C5, E5**. Regenerate the fixture and the synthetic ocean, and update the tests that assert `D4` or `A4`.
2. Add `"mapArea": {"x0": 0, "y0": 0, "x1": 1, "y1": 0.88}` to the synthetic ocean manifest. The legend bar starts at y = 352 of 400 px.
3. Write `make_synthetic_globe.py`. It writes `public/data/synthetic-globe/` with:
   - 12 monthly PNG frames for 2024, 1200 × 600 px, on the same 0–30 °C legend.
   - Water temperature by latitude: about 28 °C at the equator, falling to about 1 °C near the top and bottom edges.
   - Two grey (`NO_DATA`) land masses, one west and one east.
   - A warm current along the east coast of the western land mass, about +3 °C.
   - A "marine heatwave" patch in the north-east ocean that grows from March to August (up to +5 °C) and fades by November.
   - One frame (October) with a grey cloud over half the patch.
   - The legend bar along the bottom, with `mapArea` leaving it out.
4. Give the globe data set two regions:
   - `north-east-patch`: 30 points inside the heatwave.
   - `tropics`: 30 points along the equator.

   Put `north-east-patch` first, because Listen uses `regions[0]`.
5. Give it three comparisons: same patch in March vs August (`b`), August vs November (`a`), and one "about the same" pair. Give it an `expected.json` computed from drawn values (as in the ocean script), with the same 0.75 °C safety margin from category edges.
6. Write a 4-chapter `story` in the globe manifest:
   1. "A normal spring" (Jan–Mar)
   2. "The patch warms" (Mar–Aug)
   3. "Cloud hides the sea" (Oct)
   4. "It fades, for now" (Sep–Dec)

   Each chapter has 2–3 plain sentences, and the first says clearly that this is made-up practice data.
7. Add the globe to `public/data/index.json`, with "made-up" in its title.

**Done when:**
- Running each script twice gives byte-identical files.
- All three manifests validate.
- `npm test` passes.
- On `#listen?data=synthetic-globe` the legend, dates and region show correctly at 360 and 1280 px.

---

## T65: Value grid, category shares and a PNG check (9 Nov, Must)

**Owner:** Team leader. **Depends on:** T64.

**Files:** `src/analysis/analyze.ts`, `src/analysis/analyze.test.ts`, `src/analysis/index.ts`, `src/analysis/index.test.ts`, `src/analysis/protocol.ts`, `src/analysis/worker.ts`, `src/analysis/png.ts` (new, test-only helper), `src/analysis/synthetic.test.ts` (new).

**Do:**
1. **One pixel lookup.** Pull the per-pixel code out of `analyzePixels` into an exported `valueAtPixel(pixels, px, py, colorScale): number | null` (transparent, no-data and unmatched pixels give `null`). Use it in `analyzePixels` and in the grid, so both always agree.
2. **Shares.** `analyzePixels` also returns `shares`: for each category id, the fraction of the valid points whose value falls in it. Use the same `categoryFor` as the median. Leave it out when `valid === 0`.
3. **Grid.** Write a pure `gridFromPixels(pixels, frame, colorScale, mapping, area)`:
   - `cols = 24`.
   - `rows = clamp(round(24 × areaHeightPx / areaWidthPx), 6, 16)`.
   - For each cell, sample a 3 × 3 lattice at 1/6, 1/2 and 5/6 of the cell's width and height.
   - A cell's `value` is the median of its valid samples. If fewer than `mapping.minValidFraction` of its 9 samples are valid, the cell is `{ value: null, category: 'insufficient' }`.

   `analyzeGrid` runs it in the worker. Add a `kind: 'frame' | 'grid'` field to `WorkerRequest`. Results are cached by `frame.id|frame.image|area|cols×rows`, as `analyzeFrame` is. If `area` is missing, use the whole image.
4. **Decode once.** The worker keeps the last two decoded images by URL, so the grid and the frame analysis of the same date decode once.
5. **PNG check.** `src/analysis/png.ts` decodes 8-bit RGB and RGBA non-interlaced PNGs: parse the chunks, join the IDAT chunks, `zlib.inflateSync`, then undo filter types 0–4. It uses only Node's `zlib` and is imported only by tests. `synthetic.test.ts` analyses every frame of `public/data/synthetic-ocean` and `public/data/synthetic-globe` with `analyzePixels` and checks `category`, `valid` and `medianValue` (to 0.01) against each `expected.json`.
6. Unit tests for the grid with built pixel arrays, as `analyze.test.ts` does:
   - A two-colour image gives the two categories in the right cells.
   - A no-data band gives `'insufficient'` cells.
   - `area` leaves out a legend strip.
   - The same input twice gives deep-equal output.

**Done when:**
- `synthetic.test.ts` passes for every frame of both data sets. This is the first test that enforces PLAN.md §9's "known frames give the intended categories" on the real image files.
- The grid and shares tests pass.
- `analyzeGrid` on a synthetic-globe frame returns warm cells near the equator and `'insufficient'` cells over land.
- The existing tests still pass.

---

## T69: Computed descriptions (9 Nov, Must)

**Owner:** Roni. **Depends on:** T64 (stubs), T65 (real shares and grid; build against the stubs first).

**Files:** `src/describe/index.ts`, `src/describe/describe.test.ts`, `src/describe/Description.tsx` (new), `src/describe/description.css` (new), `src/features/player/index.tsx` and `src/features/compare/index.tsx` (one placement each; Mohammad reviews).

**Do:** write the four functions from T64 as pure rules (no LLM, no randomness). Use the shared date formatter in `src/dates.ts` (`dateFormatterFor`) and the category labels from the manifest. Round values to whole units, and shares to the nearest 10%.
1. `describeFrame`:
   - Normal date: "March 2024. North-east patch: warm, about 21 °C. 28 of 30 points could be read. Up two steps from February (cool). Mostly warm (70%), some mild (20%) and hot (10%)."
   - The comparison is with the previous date that has data: "Same as February.", or "First date." for the first.
   - List shares of at least 10% only.
   - A missing date: "October 2024. North-east patch: not enough data. Only 12 of 30 points could be read (land, cloud or labels), so this date plays the hiss, not a note."
2. `describeSequence`: "12 dates, January to December 2024, in the north-east patch. It starts cool and ends mild. Warmest: hot, in July and August. Coolest: cool, in January. Biggest change: up two steps, from March (cool) to April (warm). No data in October." For more than three dates in one item, say "on 5 dates" instead of listing them.
3. `describeCell`: "Warm, about 21 °C, north-east (column 19 of 24, row 3 of 11)." A missing cell: "No data (land, cloud or labels), north-east (column 19 of 24, row 3 of 11)." For the compass word, split the area into thirds each way: north-west, north, north-east, west, centre, east, south-west, south, south-east.
4. `describeSweep` collapses runs: "Row 3, west to east: land for 4 cells, cool for 6, mild for 8, warm for 6." Columns read "north to south".
5. `Description.tsx` takes `{ visualization, results, index }`:
   - A `<section aria-labelledby>` with an `h2` "Description" and the `describeFrame` text. It is not a live region: the player already announces the short label, so this is there to be read on demand.
   - A `<details><summary>Describe all dates</summary>` holding `describeSequence`.
   - Body text at least 16 px; wraps at 360 px.
6. Place it below the Viewer on Listen. On Compare, after a reveal, show `describeFrame` for date A and date B under the explanation.

**Done when:**
- `describe.test.ts` covers every sentence shape above, using the fixture and synthetic-globe data (including missing data, the first date, "same as", three-plus dates and a sweep with land), and the same input always gives the same string.
- The a11y checks pass on Listen and Compare.
- Layout is checked at four widths.

---

## T72a: WAV encoder (9 Nov, Must; part of T72)

**Owner:** Bhavish. **Depends on:** T64.

**Files:** `src/audio/wav.ts` (new), `src/audio/wav.test.ts` (new).

**Do:** `encodeWav(channels: Float32Array[], sampleRate: number): Blob` writes a 16-bit PCM WAV:
- RIFF header, `fmt ` chunk, `data` chunk, channels interleaved.
- Samples clamped to −1…1 and scaled to Int16.
- Blob type `audio/wav`.
- Rejects (throws) an empty channel list or channels of different lengths, with a readable message.

**Done when:** the tests check the header bytes (`RIFF`, `WAVE`, sample rate, byte rate, block align, data size), the interleaving of two channels, the clamping of 1.5 and −1.5, and the two error cases.

---

## T67: Sound map explorer (10 Nov, Must)

**Owner:** Mohammad. **Depends on:** T64 (build against the stub grid from 8 Nov), T65 (real grid), T69 (`describeCell`, `describeSweep`).

**Files:** `src/features/explore/Explorer.tsx` (new), `src/features/explore/explore.css` (new), `src/features/explore/Explorer.test.tsx` (new), `src/features/player/Viewer.tsx` (optional `children`, drawn over the image inside `.player__frame`), `src/features/player/index.tsx` (place it), `src/features/player/usePlayer.ts` (also return `engine` and `pause`).

**Do:**
1. **Turn it on.** An "Explore the map" toggle button (`pressed` state, 44 px) in the player. While it is on:
   - pause the player;
   - fetch `analyzeGrid(frame, colorScale, mapping, visualization.mapArea)` for the current date, showing the Notice "Reading the map…" while it waits;
   - draw the explorer layer over the image.

   Turning it off, or changing the date, stops its sound. Changing the date while it is on reloads the grid for the new date.
2. **The surface.**
   - An element over the map area with `tabIndex={0}`, `role="application"`, `aria-roledescription="sound map"`, `aria-label="Explore the map by sound"`, and `aria-describedby` pointing at a visible instruction line.
   - Focus moves to it when the toggle turns on.
   - The cursor is an `aria-hidden` rectangle with a 3 px outline that has at least 3:1 contrast on both light and dark map colours (a double outline, light and dark).
3. **Keys on the surface.** Every handled key calls `preventDefault()`, so the player's own shortcuts (which bail on `defaultPrevented`) do not change the date.
   - Arrow keys: move one cell. Shift + arrow: move four.
   - Home and End: first or last column. Page Up and Page Down: top or bottom row.
   - Space: play the cell again.
   - Enter: sweep the row west to east. Shift + Enter: sweep the column north to south.
   - Escape: stop.
4. **Moving the cursor.**
   - Sound: `engine.playCategory(cell.category, { pan: panForPoint(cellCentreX), durationMs: 300 })`, or `engine.playMissing()` for an `'insufficient'` cell. `cellCentreX` is a fraction of the whole image, so pan matches the picture. At most one sound every 120 ms; the latest move wins.
   - Speech: announce `describeCell` through `useAnnounce`, 400 ms after the last move, so holding an arrow does not flood the screen reader.
   - Touch: if the vibration setting is on, `vibrateForDate(cell.category, mapping)`.
5. **Pointer and touch.** `pointerdown` and `pointermove` on the surface, with `setPointerCapture`, map the position to a cell and play it. `touch-action: none` only on the surface, and only while the explorer is on, so the page still scrolls normally when it is off. On `pointerup`, announce `describeCell` once.
6. **Fallback controls** for phone screen readers, where direct touch is often unavailable. Below the image, while the explorer is on:
   - Two `Slider`s: "Column, west to east" (1–cols) and "Row, north to south" (1–rows), each with `describe` set to the `describeCell` text, moving the same cursor.
   - Buttons "Sweep this row", "Sweep this column" and "Stop", all 44 px and wrapping at 360 px.
7. **Sweeps.**
   - Steps: one per cell, `atMs = k × 250` (SOUND_MAPPINGS §6 rule 3), `pan` from `panForPoint`, played with `engine.playSequence(steps, onStep, { tick: false })`.
   - `onStep` moves the cursor so the highlight follows the sound.
   - At the end, announce `describeSweep`.
   - A key press or Stop during a sweep stops it.
8. **Listen region pan.** In `usePlayer.ts`, pass `pan: panFor(region)` on each sequence step, so F13 is finally used. This makes Listen and the explorer agree on where the region is.

**Done when:** `Explorer.test.tsx` passes, using the fake engine and a mocked `analyzeGrid` returning the T64 stub grid. It checks that:
- ArrowRight on the surface plays the next cell's category with a larger pan, and does **not** change the date slider;
- a move into an `'insufficient'` cell calls `playMissing`;
- Enter calls `playSequence` with 24 steps, `tick: false` and rising pan;
- the sliders move the cursor and have names;
- Escape stops;
- the announcement text equals `describeCell` after the debounce (use fake timers).

It also needs: the a11y check passes with the explorer on; layout checked at four widths (targets at least 44 px, no sideways scroll, controls clear of the bottom bar); and a manual pass with a keyboard only and with NVDA or VoiceOver on desktop, recorded in the PR.

---

## T68: Musical layer: chord, glide, bell, tone, simple style (10 Nov, Must)

**Owner:** Team leader. **Depends on:** T64, T65 (shares), T66 (new notes).

**Files:** `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/audio/voicing.ts`, `src/audio/voicing.test.ts` (new), `src/audio/style.ts`, `src/features/player/usePlayer.ts` and `src/features/player/index.tsx` (pass the voicing; add the "Simple sound" toggle; Mohammad reviews), `src/features/compare/index.tsx` and `src/features/compare/TestMode.tsx` (pass `pad` when playing a date; Mohammad reviews).

**Do:**
1. **`voicingFor(results, i, mapping)`**, a pure function:
   - `pad`: the categories with a share of at least 0.2 in `results[i].shares`, sorted coolest first, at most 3. The engine plays them **one octave below** their notes (`Note.transpose(note, '-8P')`), so the chord sits under the melody. With the notes C4 E4 G4 C5 E5, any subset is a consonant C major chord.
   - `glide`: true when there is a previous date with data and its category is different.
   - `bell`: true when the category rank moved by two or more steps since the previous date with data.
   - An `'insufficient'` date returns `{}`, and so does the date after one, compared with nothing.
2. **Engine voices** (built in `build()`; keep everything in C3–C6, SOUND_MAPPINGS §6):
   - **Melody, a softer mallet tone:** triangle oscillator with envelope attack 0.005, decay 0.35, sustain 0.25, release 0.6.
   - **Pad:** a `PolySynth` of sine `Synth`s (attack 0.3, release 0.8, volume −18 dB), into the same panner. In `playCategory` and in sequence steps, trigger the pad notes for the same length as the melody note.
   - **Glide:** set `categorySynth.portamento = 0.12` inside the scheduled callback for steps with `glide`, and to `0` otherwise. The mono synth then slides from the last note, so a bigger change sounds like a longer slide.
   - **Bell:** a sine `Synth` (attack 0.002, decay 0.5, sustain 0, volume −16 dB) playing G5, 50 ms after the note starts.
   - **Space:** a `Freeverb` (roomSize 0.6, wet 0.2) between `cut` and `master`. Use Freeverb, not `Tone.Reverb`, because Reverb builds its impulse from random noise.
3. **`setStyle('simple')`** turns off the pad, glide, bell and reverb (wet 0) and keeps the melody, tick and missing cue exactly as now. `setStyle('full')` turns them back on. The engine starts in `'full'`.
4. **Callers.**
   - `usePlayer` builds each step as `{ category, atMs, pan, ...voicingFor(results, i, mapping) }`.
   - Compare and TestMode pass `pad` from `voicingFor` when playing one date, with no glide or bell, since they play a single date.
   - Listen, Learn, Compare and TestMode all call `engine.setStyle(style)` from `useSoundStyle()`.
   - A "Simple sound" toggle button sits in the Listen settings, with the one-line hint "Just the main note, without the chord and slides."
5. Validation: `validateMapping` also checks that each pad note (category note minus an octave) is at or above C3.

**Done when:**
- `voicing.test.ts` covers: pad from shares (one category, two, four with only the top three kept), glide on change, no glide after missing data, bell on a two-step jump, `{}` for missing data, and the same input always giving the same output.
- `engine.test.ts` (with the fake audio context) shows that a step with `glide` sets portamento before the trigger, a step with `pad` triggers the pad, and `'simple'` triggers neither.
- The existing engine, player and compare tests pass.
- The team leader has listened to synthetic-globe on headphones and on a phone speaker, and writes one line in the PR saying whether the melody is still clearly the loudest thing.

---

## T56: Stress data set and analysis speed, including the grid (10 Nov; Must to measure, Should to speed up)

**Owner:** Dhruv (data) + Team leader (analysis). **Depends on:** T65.

**Files:** `scripts/make_synthetic_globe.py` (add `--frames N --width W --height H --out DIR` options), `src/analysis/`, tests, and `docs/performance.md` (new, short).

**Found:** the synthetic data is 12 frames at 800 × 400 or 1200 × 600. Real frames may be much larger and more numerous, and `analyzeAll` (in `src/analysis/index.ts`) analyses all of them before Play is enabled.

**Do:**
1. Generate a stress data set: 60 frames at 1920 × 1080 into a folder that is in `.gitignore`. Do **not** commit the images.
2. In Chrome on a mid-range laptop **and** on a phone, measure:
   - the time from opening Listen to Play becoming enabled;
   - the time for one `analyzeGrid`;
   - peak memory.

   Write the numbers in `docs/performance.md`.
3. (Should) If Play takes longer than 5 s, make the analysis progressive: the first dates become playable while the rest are analysed. Results must not change: the same frame still gives the same result.

**Done when:** the numbers are written down, Listen, the explorer and Compare stay usable with the stress set, and `synthetic.test.ts` (T65) still passes.

---

## T72: WAV export and Download button (11 Nov, Must; was T08)

**Owner:** Team leader (engine) + Mohammad (button). **Depends on:** T68, T72a.

**Files:** `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/features/player/index.tsx`, `src/features/player/usePlayer.ts` (expose the step list it plays), `src/features/player/player.test.tsx`.

**Do:**
1. **One set of voices for live and offline.** Refactor `build(t)` into `createVoices(t, mapping, style)`, and the scheduling inside `playSequence` into `scheduleSteps(t, voices, steps, opts)`. Live playback and offline rendering then use exactly the same voices and timing.
2. **`renderToWav(steps)`:**
   - duration = last `atMs` + 1.5 s of tail, rejecting with "That is too long to download (over 3 minutes)." above 180 s;
   - `Tone.Offline(() => { createVoices(...); scheduleSteps(...); transport.start() }, duration, 2, 44100)`;
   - then `encodeWav([buffer.getChannelData(0), buffer.getChannelData(1)], 44100)`.

   It uses the current style.
3. **Button.** On Listen settings, "Download this soundscape (WAV)":
   - Builds the full sequence at the current speed.
   - While rendering: disabled, with the text "Preparing the audio…".
   - Saves as `earth-jukebox-<visualization.id>-<region.id>.wav` via an object URL, revoked after the click.
   - Shows an error Notice on failure.

**Done when:**
- The engine tests show that `renderToWav` rejects above 180 s and calls `encodeWav` with two channels (Tone mocked as in `engine.test.ts`).
- The player test shows the button disables while rendering and shows an error Notice when rendering fails.
- By hand: the downloaded synthetic-globe file plays in a normal audio player and on a phone, and sounds the same as the live sequence (same notes, same order, chord and glide present in Full, absent in Simple).

---

## T70: Learn page: teach the new sounds and the explorer (11 Nov, Must)

**Owner:** Roni. **Depends on:** T67, T68.

**Files:** `src/features/learn/index.tsx`, `src/features/learn/learn.css`, `src/features/learn/learn.test.tsx`.

**Do:** keep the existing cards, and say "Plays the note C4" from the manifest as now. Add three cards, each with a Play button that uses the real engine:
1. **"The soft chord underneath"**: "When the place you listen to is all one temperature you hear one deep note under the melody; when it is mixed, you hear a chord." Two buttons: "Play: all warm" (pad = warm) and "Play: mixed" (pad = cool, mild, warm).
2. **"The slide"**: "When the temperature changes from one date to the next, the note slides to its new pitch. A longer slide is a bigger change." The button plays two steps, cool then hot, with `glide`.
3. **"The bell"**: "A bell above the melody means a big jump: two or more steps at once." The button plays cool then hot, with `bell`.

Add a short "Explore the map" paragraph: what the explorer does, its keys, and the sliders for phones. Link to `#listen`, keeping `?data=`. In Simple style, hide the three new cards and say "Simple sound is on: you hear only the main note." All text must make sense without seeing anything.

**Done when:** the tests check each new button calls the engine with the expected `pad`, `glide` or `bell`, Simple style hides the cards, the a11y checks pass, and layout is checked at four widths.

---

## T71: Story mode (11 Nov, Should)

**Owner:** Bhavish. **Depends on:** T64, T66 (a story to show), T69 (`describeSequence`).

**Files:** `src/features/story/StoryPanel.tsx` (new), `src/features/story/story.css` (new), `src/features/story/StoryPanel.test.tsx` (new), `src/features/player/usePlayer.ts` (add `playRange(from, to)`), `src/features/player/index.tsx` (the "Hear the story" button). Mohammad reviews both player files.

**Do:**
1. **`playRange(from, to)`** in `usePlayer` works like `startFrom`, but plays only the frames `from` to `to` and then stops at `to`. Same voicing, announcements and image sync.
2. **The button.** If `visualization.story?.length`, show "Hear the story" above the playback controls. It opens an inline panel (not a modal) in place.
3. **The panel:**
   - An `h2` "Chapter 1 of 4: The patch warms" with `tabIndex={-1}`, and the chapter text below it.
   - Buttons: "Play this part" (`playRange` over the chapter's frames), "Previous chapter", "Next chapter" and "Close story", all 44 px and wrapping at 360 px.
   - Changing chapter moves focus to the chapter heading, so a screen reader reads the title and then the text.
   - It never moves on by itself: the listener sets the pace, so it never talks over their screen reader.
   - After the last chapter, "Next chapter" becomes "Finish". It shows "The end of the story." followed by the `describeSequence` text.
   - "Close story" stops the sound and puts focus back on "Hear the story".
4. While the story panel is open, the explorer toggle is disabled, so the two modes cannot both play.

**Done when:**
- The tests check: the panel only shows with a story; "Play this part" plays the right frame range (fake engine); focus moves to the heading on chapter change and back to the button on close; the last chapter shows the summary.
- The a11y checks pass.
- Layout is checked at four widths.
- A keyboard-only run through the synthetic-globe story is noted in the PR.

---

## T75: Practice listening test of the new sound (12 Nov, Must)

**Owner:** Roni (Team leader joins to observe). **Depends on:** T67, T68, T70, on the deployed site.

**Files:** `docs/tests/practice-2026-11-12.md` (new). No code.

**Do:** with at least 3 people, including at least one screen-reader user if T45 found one, using headphones for half the tasks and a phone speaker for the other half:
1. **Compare.** The three synthetic-ocean comparisons in test mode (`#compare?test=1`), once in Full and once in Simple. Alternate which style each person hears first. Record the number correct and the confidence.
2. **Explorer.** On synthetic-globe for August, without looking: "Find the warmest place and tell me roughly where it is." Record success and the time taken.
3. **Story.** Play the synthetic-globe story, then ask: "What happened to the north-east patch?" Write down the answer.
4. **Feeling.** "How pleasant was it to listen to, from 1 to 5?" and "Anything confusing?"

**Decision rule:** if Full gets fewer correct than Simple on Compare (averaged over people), or two or more people say they cannot pick out the main note, the team leader makes `'simple'` the default in `src/audio/style.ts` by 13 Nov. Every problem found gets a ticket or a fix.

**Done when:** the results file is merged with raw counts and quotes, the style decision is written in it, and any follow-up tickets are listed.

---

## T73: Creative-process write-up (draft 12 Nov, final 15 Nov, Must)

**Owner:** Team leader writes; Bhavish edits and folds a summary into the README in T24. **Depends on:** T68; T75 and the final test results for the final version.

**Files:** `docs/CREATIVE_PROCESS.md` (new), `src/features/about/index.tsx` (one link at the end of "How colours become sound"; Roni reviews).

**Do:** write it for judges and for anyone building on our work, in plain language with short sections:
1. **Intent.** Who it is for (blind and low-vision listeners first, everyone else too). What it should feel like: the beauty of the patterns, and the urgency when the line keeps rising.
2. **The pipeline, step by step, with file pointers.** Frame → legend lookup (`valueAtPixel`) → median and shares per region, and the grid for the whole map (`src/analysis/`) → voicing (`src/audio/voicing.ts`) → Tone.js voices (`src/audio/engine.ts`) → words (`src/describe/`).
3. **Every artistic choice and why**, citing `docs/SOUND_MAPPINGS.md`:
   - warmer is higher;
   - five categories, not a continuous pitch;
   - the notes C4 E4 G4 C5 E5 (wider steps, any mix consonant);
   - the chord from the spread of values;
   - the slide for change, and the bell for big jumps;
   - the mallet tone and light reverb;
   - the hiss for missing data (never cold);
   - stereo only for sweeps and the explorer, never alone;
   - the tick.
4. **What we tried or rejected, and why:** raw pixel-to-sound (noise), rhythm from pixel density (one cue too many), machine learning or an LLM in the loop (the same frame must give the same sound; testable), a drone (the chord does the job).
5. **Accessibility decisions:** a user-paced story, sliders as the explorer's fallback, descriptions computed by rules, vibration only where supported.
6. **Evidence:** T75 practice results, then the final listening-test results (T23).
7. **Limits** (from About), and **how to add a data set**: the manifest fields, including `mapArea` and `story`, and the scripts.

**Done when:** the draft is merged on 12 Nov and linked from About; the final version with results is merged by the feature freeze on 15 Nov; and every file pointer in it exists.

---

## T59: Voice guide on ADK, behind a setting (12 Nov, Could)

**Owner:** Mohammad. **Depends on:** T58 says yes **and** T67 merged by 10 Nov. Otherwise skip this ticket and quote the T58 result in the README.

**Files:** `server/app/api/assistant.py`, `server/app/assistant/` (new agent module), `server/app/config.py`, `server/requirements.txt`, `render.yaml`, `server/tests/test_assistant.py`, a `docs/` note.

**Do:**
1. Build the guide as an ADK agent that keeps the five existing tools and their behaviour (`navigate_to`, `explain_section`, `control_playback`, `set_date`, `get_screen_context`).
2. Keep the browser protocol exactly as documented at the top of `assistant.py`, so the frontend needs **no** change.
3. A setting (`ASSISTANT_ENGINE=bridge|adk`) chooses ADK or the current bridge. The current bridge stays the default.
4. Pin the `google-adk` version in `requirements.txt` and keep Python 3.12 in `render.yaml`.
5. Add a server test that nothing under `server/app/study/` imports ADK.

**Done when:** the existing server tests pass in both modes, a manual session works end to end (page navigation, playback by voice, context read-out), memory and start time are within the T58 numbers, and switching back to `bridge` needs only an environment change, not a code deploy.

---

## T60: `data_explainer` sub-agent (12 Nov, Could, cut first)

**Owner:** Mohammad. **Depends on:** T58 point 4 passed and T59 merged.

**Files:** `server/app/assistant/`, tests.

**Do:** a read-only sub-agent that answers "where does this data come from, and what are its limits?" strictly from the loaded manifest: source, credit, licence, method, and the limits on the About page. It must say "I don't know" for anything the manifest does not contain. If sub-agent hand-off does not work in Live mode, expose the same content as one more read-only tool instead.

**Done when:** a test shows it refuses to invent facts that are not in the manifest, and it cannot change anything in the app.

---

## T61: Data-specific variants, real story text, map areas (13–14 Nov, Must)

**Owner:** Dhruv + Team leader. **Depends on:** the real NASA resources, T33.

**Files:**
- `src/data/types.ts` and `src/data/schema.ts` (change both together, with the agreement of everyone who uses them)
- `src/analysis/` (team leader)
- `scripts/`, `public/data/`, `docs/data-sources.md`

**Do, after the real resources are released and T32 and T33 give the facts.** Only do what `docs/data-sources.md` actually flagged, and only if the real frames need it:
- A wider legend (for example 0 to 32 °C): a manifest change only. Check that the five ranges still split the real values sensibly, and keep the notes C4 E4 G4 C5 E5.
- Sea ice shown as ice or no ice rather than a gradient: two categories ("open water", "ice"; notes C4 and G4) and a two-stop legend. The grid and shares then tell how much ice there is.
- Frames that are videos: convert them to PNG images offline. Do not play video in the app.
- A legend that changes between frames, or a moving map projection: reject it in the converter with a readable message, or convert it. Do not guess.

For every real data set:
- Set `mapArea` so legend bars, titles and logos are left out.
- On two dates, check in the explorer that labels and coastlines read as "no data" and not as values.
- Write 3–5 `story` chapters. Every fact (a date, a record, a number) must be stated on the NASA source page; note the page in `docs/data-sources.md`. Wording may be drafted with an AI tool, but a person checks every fact against the page. Say plainly what the change means, for example "the lowest minimum in the record", without exaggerating.

**Done when:** the real manifest validates; loads in Listen, the explorer, Compare and the story; passes the "known frames give the intended categories" check from T34's comparisons; and shows its legend, credit and story.

---

## T74: Curated playlist of generated audio (14 Nov, Must)

**Owner:** Dhruv (tracks and text) + Bhavish (release and links). **Depends on:** T72, T61.

This is the challenge's second deliverable ("a curated collection of original, generated audio files … with an explanation of the creative process"), and our backup if the live site fails during judging.

**Files:** `docs/PLAYLIST.md` (new). The audio files go in a GitHub release named `audio-v1`, not in the repository.

**Do:**
1. Using the Download button (T72), at Normal speed, in the default style chosen in T75, download:
   - one track for each real data set's first region;
   - one for synthetic-globe, labelled as made-up practice data.

   Name them `01-<data-id>-<region-id>.wav`, `02-…`, and so on.
2. In `docs/PLAYLIST.md`, write one entry per track:
   - title;
   - NASA source, credit and licence;
   - dates and region;
   - length;
   - "What you hear": paste the `describeSequence` text from the app;
   - one line on the mapping, linking `docs/CREATIVE_PROCESS.md`.
3. Bhavish creates the release with `gh release create audio-v1` and the files, then puts the links in `PLAYLIST.md` and in the README (T24).

**Done when:** every track plays on a phone and a laptop, every link opens in a private window, and each track's description matches the app.

---

## T62: Final verification pass (14 Nov, Must)

**Owner:** Roni. **Depends on:** all of the above.

**Files:** `docs/tests/final-check.md` (new).

**Do:**
1. Run the T52 layout measurements again on the real data at 320, 360, 768, 1024 and 1280 px: no sideways scroll, targets at least 44 px, content clear of the bottom bar. Cover every page, Compare after a reveal, the explorer switched on, the story panel, and the voice guide panel.
2. Run lint, build, the front-end tests and the server tests.
3. Do a keyboard-only pass of Home → Learn → Listen → explorer → story → Compare → About.
4. Do screen-reader passes:
   - NVDA or VoiceOver on desktop: the full journey, including the explorer's arrow keys and a sweep.
   - TalkBack or VoiceOver on a phone: the explorer's sliders and sweep buttons, plus the story.
5. Check that the WAV download works on a phone, that the music pauses while the voice guide talks, and that everything except the voice guide works with the server off.
6. Write down anything not checked.

**Done when:** the results are written down per page and width, and every failure has a ticket or a fix.

---

## T54: Dataset picker (built, merged in T63)

Built on `feature/T54-dataset-picker` (`13a5f12`): `src/components/DatasetPicker.tsx`, with `?data=<id>` in the hash through `route.ts`; a bad id falls back with a message. **Done when:** T63's checks pass on `main`. No further work.

## T55: Accessible legend (built, merged in T63)

Built on `feature/T55-legend` (`44414f6`): `src/components/Legend.tsx` and `colourAt.ts`, reused on About. **Done when:** T63's checks pass on `main`, and the legend renders for synthetic-globe (T66) and each real data set (T61).

## T57: Dates for any cadence (built, merged in T63)

Built on `feature/T57-date-formatting` (`8967dfb`): one formatter, `src/dates.ts` (`granularityOf`, `formatDate`, `dateFormatterFor`), used by all pages. T69 uses it too. **Done when:** T63's checks pass on `main`.

---

## Deliberately left out, and why

- **Rhythm from pixel density.** It is one cue too many on top of pitch plus a chord. The chord already carries how spread out the values are.
- **A continuous background drone (F17).** The chord is driven by data and does the same job.
- **Region picker on Listen.** The explorer covers "listen somewhere else" across the whole map, and Compare already has regions in its comparisons.
- **Compare with A in the left ear and B in the right.** Small value for the risk of changing the listening test a few days before it runs.
- **Speech synthesis inside story mode.** Screen-reader users have their own voice, and two voices would talk over each other. The voice guide already speaks for those who want it.
- **Sounds that combine data sets** ("interconnected systems"), and timbre per topic. Too much for 10 days, and they need several real data sets we will not have until 13 Nov.
- **iOS vibration.** Safari has no API for it. We say so instead.
- **Descriptions in the voice guide's screen context.** This would need `CONTEXT_KEYS` changed on both sides. The guide can already read the screen.

## Risks for the judging

| Risk | Mitigation |
|---|---|
| The chord and slide make the main note harder to pick out, and accuracy drops | T75 measures Full against Simple on 12 Nov, with a fixed decision rule; Simple keeps the original sound exactly |
| The explorer is unusable with phone screen readers (`role="application"` and direct touch behave differently in VoiceOver and TalkBack) | Sliders and sweep buttons as the fallback (T67 step 6); real checks in T62 |
| Real frames contain labels, coastlines, JPEG blur or a legend inside the map, which the grid reads as values | `mapArea`, `maxColorDistance` and the no-data colours; check two dates by ear in T61 |
| Real data arrives on 13 Nov, leaving two days for story text that must be true | Story mode is rehearsed on synthetic-globe first; every fact is checked against the NASA page (T61) |
| The team leader is the bottleneck (T64, T65, T68, T72, T73) | Stubs first (T64), so no one waits; Bhavish takes the WAV encoder; the cut order above |
| Three unmerged branches plus seven new tickets touch the player files | T63 merges first on 6 Nov; every ticket lists the player files it touches, and Mohammad reviews them |
| The live demo fails, or the free server is asleep | The playlist (T74) and backup video (T07) need no server; everything but the voice guide works offline |
| The judging guide (13 Nov) weighs things differently | T06 re-scores this coverage table against it the same day |
| A refactor of the live engine for WAV export (T72) breaks playback late | `createVoices` and `scheduleSteps` are shared by both paths, so one test suite covers both; done by 11 Nov, before the freeze |

## Where the first version of this plan was wrong or overreaching

1. **It aimed at the data, not the challenge.** It never addressed musicality, exploration, computed descriptions, story or the audio-file deliverable, which are the things the brief asks for.
2. **ADK (T59) was a Must due 12 Nov,** with full parity, for a voice guide that already works. That was a high-risk, low-visibility change in the last week. It is now a Could, after the explorer.
3. **T60 repeated the About page** through an experimental Live sub-agent feature.
4. **It treated stereo panning (F13) as built.** The engine accepts `pan`, but no caller ever passes one.
5. **It relied on the PLAN.md §9 correctness check without checking it ran.** No test reads the synthetic PNGs or `expected.json`.
6. **It kept the notes C4 D4 E4 G4 A4,** which our own `SOUND_MAPPINGS.md` says are too close together.
7. **It had no plan for the synthetic data's flat colour,** which makes any spatial feature impossible to build or demo before 13 Nov.

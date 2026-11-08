# Tickets: the work left in the plan

Written 5 Nov 2026 from [`docs/PLAN.md`](PLAN.md). It replaces the old `docs/tickets/` folder, so it is the only ticket list. It lists only work that is **not built yet**, checked against the code on `main` (`4b3ea13`). Where this file and the plan disagree, fix the plan first.

**Sound pipeline v2 (added 5 Nov, T111 to T115).** The sound moves from the absolute value to the change from a baseline, in three layers (PLAN.md §6.2). It is built **alongside** the current sound as a new `"change"` style, so the working demo is never at risk. T111 to T113 are pure code that changes nothing a listener hears, so they may start before the cut line, but only after their owners' Must tickets (including those in `docs/PRE-HACKATHON-TICKETS.md`). T114 and T115 come after the cut line. T105 to T107 in `docs/PRE-HACKATHON-TICKETS.md` are superseded by T114.

Hand a ticket to your own AI like this:

> Read `AGENTS.md`, `docs/PLAN.md` and ticket `<ID>` in `docs/TICKETS.md`. Do only that ticket (or only its part A or part B), on branch `feature/<ID>-short-name`, and open a PR into `main`.

Every PR must meet the definition of done in PLAN.md §9, including the layout rule in `AGENTS.md` (check 360, 768 and 1280 px with the `responsive-layout` skill, and list the widths in the PR). If a ticket lists a file someone else owns (PLAN.md §4), that owner reviews the PR.

## Already built (no ticket)

**Status check, 7 Nov (from `git log` on `main` at `b995ddc`):** T80 A, T81 A, T82 A, T83, T84 and T112 to T115 are merged; T85 step 1 and the T86 spike note are in. **T111 built 7 Nov** (baseline in the schema, `check-data` rules, converter flags, the `synthetic-change` data set; v2 now plays on that data set). **Open:** T85 real data (each with a baseline kind chosen, see `docs/data-sources.md` "Baselines"), T87, T81 B F23. **Cut 7 Nov:** T86 build, F21, F22, F24, F25 (none had code; see `docs/planning/FEATURE-REVIEW.md`). The ticket text below is kept for reference.

F1 to F13, F15 and F12's ducking are on `main`, as are the dataset picker, legend, date formatter, Home page, the interfaces and stubs in PLAN.md §5.6 to §5.8 (T64), the synthetic globe with its story (T66), the real value grid and shares (T65), the computed descriptions (T69) and the WAV encoder `encodeWav` (T72a).

## How these tickets stay independent

1. **Every part A builds on what is on `main` today.** The stubs from T64 are there: `voicingFor` returns `{}`, `setStyle` does nothing, `renderToWav` rejects. A caller can be built and tested against them now, and it starts to sound richer when the owner replaces the stub behind the same export. Nobody waits for anybody.
2. **Extensions that build on one feature live in that feature's ticket, as part B.** That is why there are so few tickets. Part B starts only after part A is merged **and** the 12 Nov cut line (below) is met. Part B is cut before anyone else's part A.
3. **Integration lines.** A few extensions need one line in a file another ticket creates. Each is listed in the table below and is done by **whichever of the two PRs merges second**. Both tickets mention it, so it never gets lost and never blocks a merge.
4. **Interface changes** (PLAN.md §5) are optional fields only, so old callers keep working. The PR that adds one also updates PLAN.md §5 and is reviewed by everyone who uses that interface.
5. **No new npm packages.** The only possible new dependency is the Python package `google-adk`, and only if T86 goes ahead.

## The tickets

| ID | Title | Owner | Part A due | Priority | Covers |
|---|---|---|---|---|---|
| T80 | Musical engine and WAV rendering | Team leader | 9 Nov | A Must (built); B Should | §5.7, F14 engine; B: F18 (F22, F24 cut) |
| T81 | Listen: sound-map explorer and player wiring | Mohammad | 10 Nov | A Must (built); B Should | §5.6 explorer, F13 in use, F14 button, style toggle; B: F23 (F25 cut) |
| T82 | Learn the new sounds, and concise or rich descriptions | Roni | 11 Nov | A Must (built) | Learn cards, F19 rules (F21 cut) |
| T83 | Story mode | Bhavish | 11 Nov | Should | `story` chapters (§5.1) |
| T84 | 3D spatial audio | Bhavish | after 12 Nov | Could | F20 |
| T85 | Real NASA data | Dhruv + Team leader | 10 Nov (speed), 14 Nov (data) | Must | F16, real `mapArea`, story text, comparisons, speed |
| ~~T86~~ | ~~Voice guide on ADK~~ Cut 7 Nov after the spike | — | — | Cut | — |
| T87 | Evidence, write-up and submission | Roni, Team leader, Bhavish, Dhruv | 12 to 15 Nov | Must | F11 evidence, playlist, creative process, README, demo |
| ~~T111~~ | v2: baseline in the manifest, and a synthetic data set with a known change. **Built 7 Nov**; `types.ts` still needs the team leader's review | Dhruv (team leader reviews `types.ts`) | done | Built | F26, PLAN.md §5.1 |
| T112 | v2: change field and change steps | Team leader | 11 Nov | Should (v2 core) | F27, PLAN.md §5.2, §5.9 |
| T113 | v2: contour tracing (marching squares) | Bhavish suggested (team leader reviews) | 12 Nov | Should | F18 analysis, PLAN.md §5.9 |
| T114 | v2: the `"change"` sound style (bed, contour voice, hiss) | Team leader (engine), Bhavish (spatial path, listening check) | 13 Nov | Should | F28 sound, F18 sound, PLAN.md §6.2 |
| T115 | v2: wiring, Compare, descriptions and Learn | Mohammad (Listen, explorer, Compare), Roni (describe, Learn, About) | 14 Nov | Should | F28 wiring, F18 trace button |
| T116 | UI: Material 3 Expressive tokens and app shell. **Built 9 Nov**, in review ([PR #1](https://github.com/raghavburtony-creator/nasa/pull/1)) | Mohammad (Roni reviews `src/index.css` and `src/styles/`) | 8 Nov | Should | `docs/UI_FOLLOWUP.md` §1.1 to 1.6, §2, §3.1 to 3.2 |
| T117 | UI: Material 3 Expressive components and voice guide panel | Roni (Mohammad reviews the voice guide files) | 12 Nov | Should | `docs/UI_FOLLOWUP.md` §3.3, §4, §6.1 |

### Integration lines

| Line | File | Done by whichever merges second of |
|---|---|---|
| `analyzeChange` adds `contours: pickContours(...)` to the `Score` | `src/analysis/worker.ts` | T112 and T113 |
| The explorer passes `elevation` from the cell's row | `src/features/explore/Explorer.tsx` | T84 and T81 A |
| The explorer's announcements use the listener's detail level | `src/features/explore/Explorer.tsx` | T82 A and T81 A |

## Order and cut line

- **By 12 Nov (M3, feature complete and deployed):** T80 A, T81 A (keyboard, sliders and row sweep at least), T82 A (Learn cards at least), T83, the T85 speed measurements, and the T87 steps marked "now".
- **After 12 Nov:** only part B, data, text, fixes and tests.
- **From 13 Nov:** T85's real data, then T87's playlist, final check and demo.
- **Features freeze 6 hours before the deadline** (PLAN.md §8).

**If time runs out, cut in this order** (first cut at the top; T86, F25, F22, F21 and F24 were already cut on 7 Nov): the contour voice (T113, T114 step 3, T115's trace button and Learn card); T84 (built; hide its toggle); T81 B F23; the rest of v2 (T111, T112, T114, T115: v1 ships unchanged); T83; T81 A pointer and touch drag (keep keyboard, sliders and sweeps); T81 A's Download button (keep `renderToWav`, so the playlist can still be made).

**Never cut:** T80 A, T81 A keyboard and sliders, T85, T87.

---

## T80: Musical engine and WAV rendering (Team leader)

**Part A: 9 Nov, Must.** Replaces the stubs from PLAN.md §5.7 and the `renderToWav` stub behind the same exports.

**Files:** `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/audio/voicing.ts`, `src/audio/voicing.test.ts`, `src/audio/style.ts`. Nothing outside `src/audio/`: the callers are wired in T81 and T82, against the same exports.

**Do:**
1. **`voicingFor(results, i, mapping)`**, pure:
   - `pad`: categories with a share of at least 0.2 in `results[i].shares`, coolest first, at most 3. The engine plays them one octave below their notes, so the chord sits under the melody. With the notes C4 E4 G4 C5 E5 any subset is consonant.
   - `glide`: there is an earlier date with data and its category differs.
   - `bell`: the category moved two or more steps since the previous date with data.
   - An `'insufficient'` date gives `{}`; so does the first date with data after one, compared with nothing.
2. **Voices**, all within C3 to C6 (`docs/SOUND_MAPPINGS.md` §6):
   - Melody: a softer mallet tone (triangle; attack 0.005, decay 0.35, sustain 0.25, release 0.6).
   - Pad: a `PolySynth` of sine voices (attack 0.3, release 0.8, −18 dB) into the same panner, held as long as the melody note.
   - Glide: `portamento = 0.12` for steps with `glide`, otherwise 0, set inside the scheduled callback.
   - Bell: a sine voice (attack 0.002, decay 0.5, sustain 0, −16 dB) on G5, 50 ms after the note.
   - Space: a `Freeverb` (roomSize 0.6, wet 0.2). Not `Tone.Reverb`, which builds its impulse from random noise and so breaks "same input, same output".
3. **`setStyle('simple')`** turns off pad, glide, bell and reverb, and keeps the melody, tick and missing cue exactly as they are now. The engine starts in `'full'`.
4. **One set of voices for live and offline.** Split `build()` into `createVoices(t, mapping, style)` and the scheduling in `playSequence` into `scheduleSteps(t, voices, steps, opts)`.
5. **`renderToWav(steps)`**: duration is the last `atMs` plus 1.5 s; reject above 180 s with "That is too long to download (over 3 minutes)."; render with `Tone.Offline` using `createVoices` and `scheduleSteps`, two channels at 44 100 Hz; then `encodeWav` (`src/audio/wav.ts`). It uses the current style.
6. `validateMapping` also checks that each pad note (category note minus an octave) is at or above C3.

**Done when:**
- `voicing.test.ts` covers: pad with one, two and four categories (top three kept); glide on change; no glide after missing data; bell on a two-step jump; `{}` for missing data; same input, same output.
- `engine.test.ts` (fake audio context) shows: `glide` sets portamento before the trigger; `pad` triggers the pad; `'simple'` triggers neither; `renderToWav` rejects above 180 s and passes two channels to `encodeWav`.
- The existing engine, player, compare and learn tests pass unchanged.
- You have listened to synthetic-globe on headphones and on a phone speaker, and the PR says in one line whether the melody is still clearly the loudest sound.

**Part B.** F18 is now the contour voice (sound pipeline v2, PLAN.md §6.2): see T113 and T114 (built). F24 (alarm) and F22 (reef) were cut on 7 Nov; see `docs/planning/FEATURE-REVIEW.md`.

---

## T81: Listen: sound-map explorer and player wiring (Mohammad)

**Part A: 10 Nov, Must.** Builds against what is on `main`: the real `analyzeGrid`, `describeCell` and `describeSweep`, and the stubbed `voicingFor`, `setStyle` and `renderToWav`.

**Files:** `src/features/explore/` (new: `Explorer.tsx`, `explore.css`, `Explorer.test.tsx`), `src/features/player/Viewer.tsx` (optional `children` drawn over the image), `src/features/player/index.tsx`, `src/features/player/usePlayer.ts`, `src/features/player/player.test.tsx`, `src/features/compare/index.tsx` and `src/features/compare/TestMode.tsx` (style and pad only). Add `src/features/explore/` to you in PLAN.md §4.

**Do:**
1. **Wire the sound that is already designed.**
   - In `usePlayer`, build each step as `{ category, atMs, pan: panFor(region), ...voicingFor(results, i, mapping) }`. Stereo panning (F13) is then finally used.
   - Listen, Compare and TestMode call `engine.setStyle(style)` from `useSoundStyle()`. Compare and TestMode pass `pad` from `voicingFor` when playing a single date, with no glide or bell.
   - A "Simple sound" toggle button in the Listen settings, with the hint "Just the main note, without the chord and slides."
2. **Download button.** In the Listen settings, "Download this soundscape (WAV)": build the full sequence at the current speed and call `engine.renderToWav(steps)`. While it runs, the button is disabled and reads "Preparing the audio…". Save as `earth-jukebox-<visualization.id>-<region.id>.wav` through an object URL, revoked after the click. On failure show an error Notice (today's stub rejects, so this path is testable now).
3. **Turn the explorer on.** An "Explore the map" toggle button (pressed state, 44 px). While on: pause the player, load `analyzeGrid(frame, colorScale, mapping, visualization.mapArea)` for the current date (Notice "Reading the map…" while it waits), and draw the explorer over the image. Turning it off, or changing date, stops its sound; changing date while on reloads the grid.
4. **The surface.** An element over the map area with `tabIndex={0}`, `role="application"`, `aria-roledescription="sound map"`, `aria-label="Explore the map by sound"` and `aria-describedby` pointing at a visible instruction line. Focus moves there when the explorer turns on. The cursor is an `aria-hidden` rectangle with a double (light and dark) 3 px outline, so it shows on any map colour.
5. **Keys.** Every handled key calls `preventDefault()`, so the player's own shortcuts do not change the date.
   - Arrows move one cell; Shift + arrow moves four.
   - Home and End: first or last column. Page Up and Page Down: top or bottom row.
   - Space plays the cell again. Enter sweeps the row west to east; Shift + Enter sweeps the column north to south. Escape stops.
6. **Moving the cursor.** Play `engine.playCategory(cell.category, { pan: panForPoint(cellCentreX), durationMs: 300 })`, or `engine.playMissing()` for an `'insufficient'` cell, at most once every 120 ms (the latest move wins). `cellCentreX` is a fraction of the whole image. Announce `describeCell` through `useAnnounce` 400 ms after the last move. If the vibration setting is on, call `vibrateForDate(cell.category, mapping)`.
7. **Pointer and touch.** `pointerdown` and `pointermove` with `setPointerCapture` map the position to a cell and play it. Use `touch-action: none` only on the surface and only while the explorer is on. On `pointerup`, announce `describeCell` once.
8. **Fallback for phone screen readers.** Below the image, while on: two `Slider`s, "Column, west to east" and "Row, north to south", each described by the `describeCell` text, moving the same cursor; buttons "Sweep this row", "Sweep this column" and "Stop", 44 px, wrapping at 360 px.
9. **Sweeps.** One step per cell, `atMs = k × 250`, `pan` from `panForPoint`, played with `playSequence(steps, onStep, { tick: false })`. `onStep` moves the cursor; at the end announce `describeSweep`. A key press or Stop ends the sweep.

**Done when:**
- `Explorer.test.tsx`, with the fake engine and a mocked 24 × 12 grid, shows: ArrowRight plays the next cell with a larger pan and does **not** change the date; a move into an `'insufficient'` cell calls `playMissing`; Enter calls `playSequence` with 24 steps, `tick: false` and rising pan; the sliders have names and move the cursor; Escape stops; the announcement equals `describeCell` after the debounce (fake timers).
- `player.test.tsx` shows: steps carry `pan`; the Simple toggle calls `setStyle('simple')`; the Download button disables while rendering and shows an error Notice when rendering fails.
- The a11y check passes with the explorer on; layout is checked at the three widths, with the controls clear of the bottom bar.
- A keyboard-only pass and an NVDA or VoiceOver pass on desktop are written in the PR.

**Part B: after the cut line.**
1. **F23 time travel (Should).** In the explorer, `L` (and a "Lock this place" toggle button for touch) locks the current cell. While locked, the date slider and Play play that one cell across all dates, using `analyzeGrid` for each date (cached), with `voicingFor`-style glide and bell computed from the cell's own categories. The announcement says "Locked on north-east, column 19, row 3". Unlock with `L` again or Escape. Test: locked playback calls `playSequence` with one step per date for that cell.
2. ~~F25 sound buoys~~ cut on 7 Nov.

---

## T82: Learn the new sounds, and concise or rich descriptions (Roni)

**Part A: 11 Nov. Learn cards Must; detail level Should.** The Learn cards call the engine options that already exist (`pad`, `glide`, `bell`), so they are built and tested now with the fake engine and sound richer once T80 A lands.

**Files:** `src/features/learn/index.tsx`, `src/features/learn/learn.css`, `src/features/learn/learn.test.tsx`, `src/describe/index.ts`, `src/describe/describe.test.ts`, `src/describe/Description.tsx`, `src/describe/detail.ts` (new), and one line each in `src/features/player/index.tsx` and `src/features/compare/index.tsx` if they need to pass the detail level (Mohammad reviews).

**Do:**
1. **Learn: three new cards**, each with Play buttons using the real engine, keeping the existing cards:
   - "The soft chord underneath": "When the place you listen to is all one temperature you hear one deep note under the melody; when it is mixed, you hear a chord." Buttons "Play: all warm" (`pad` = warm) and "Play: mixed" (`pad` = cool, mild, warm).
   - "The slide": "When the temperature changes from one date to the next, the note slides to its new pitch. A longer slide is a bigger change." Plays cool then hot with `glide`.
   - "The bell": "A bell above the melody means a big jump: two or more steps at once." Plays cool then hot with `bell`.
2. **Learn: "Explore the map".** A short paragraph on what the explorer does, its keys (as in T81 step 5), and the sliders for phones, with a link to `#listen` that keeps `?data=`.
3. **Learn: Simple style.** When `useSoundStyle()` is `'simple'`, hide the three cards and say "Simple sound is on: you hear only the main note." All text must make sense without seeing anything.
4. **F19 detail level.** `describeFrame`, `describeCell` and `describeSweep` gain an optional last argument `{ detail: 'concise' | 'rich' }`, default `'rich'`, so every existing call stays the same (interface change to PLAN.md §5.8; update it in the PR).
   - Rich is today's text.
   - Concise keeps only the label, the rounded value and the change, for example "Warm, 21 °C, north-east." and "March: warm, up two steps."
   - `src/describe/detail.ts` exports `useDescriptionDetail()`, remembered in `localStorage` under `earth-jukebox:detail` with the same try/catch as `useSoundStyle`, default `'rich'`.
   - `Description.tsx` gets a two-option "Description: Rich / Concise" control. Integration line: the explorer's announcements (see the table).

**Done when:** the Learn tests check each new button calls the engine with the expected `pad`, `glide` or `bell`, and that Simple hides the cards; `describe.test.ts` covers concise for each function and shows the default is unchanged; same input, same words; a11y checks pass; layout checked at the three widths.

**Part B:** ~~F21 anomaly haptics~~ cut on 7 Nov. F15 vibration stays; iOS Safari has no vibration API, so say so on About.

---

## T83: Story mode (Bhavish)

**11 Nov, Should.** Synthetic-globe already has a four-chapter `story`, and `describeSequence` is built, so this needs nothing else.

**Files:** `src/features/story/` (new: `StoryPanel.tsx`, `story.css`, `StoryPanel.test.tsx`), `src/features/player/usePlayer.ts` (add `playRange(from, to)`), `src/features/player/index.tsx` (the "Hear the story" button). Mohammad reviews both player files. Add `src/features/story/` to you in PLAN.md §4.

**Do:**
1. `playRange(from, to)` in `usePlayer` works like `startFrom`, but plays only frames `from` to `to` and stops at `to`, with the same voicing, announcements and image sync.
2. If `visualization.story?.length`, show "Hear the story" above the playback controls. It opens an inline panel (not a modal).
3. The panel:
   - An `h2` "Chapter 1 of 4: A normal spring" with `tabIndex={-1}`, then the chapter text.
   - Buttons "Play this part", "Previous chapter", "Next chapter" and "Close story", 44 px, wrapping at 360 px.
   - Changing chapter moves focus to the heading.
   - It never moves on by itself, so it never talks over a screen reader.
   - After the last chapter, "Next chapter" becomes "Finish" and shows "The end of the story." followed by `describeSequence`.
   - "Close story" stops the sound and returns focus to "Hear the story".
4. While the story is open, the "Explore the map" toggle (T81) is disabled. If T81 is not merged yet, leave a `storyOpen` flag on the player for it to read.

**Done when:** the tests check that the panel shows only with a story, "Play this part" plays the right frame range (fake engine), focus moves to the heading on chapter change and back on close, and the last chapter shows the summary; a11y checks pass; layout checked at the three widths; a keyboard-only run through the synthetic-globe story is noted in the PR.

---

## T84: 3D spatial audio (Bhavish)

**After the cut line, Could.** Extends F13. Stereo panning stays the default and the fallback for speakers.

**Files:** `src/audio/pan.ts`, `src/audio/pan.test.ts`, `src/audio/engine.ts` (the panner node only; the team leader reviews, and if T80 A is still open, rebase onto it), `src/features/player/index.tsx` (one setting; Mohammad reviews), `docs/PLAN.md` §5.3 and §6.1.

**Do:**
1. **First, fix the plan.** PLAN.md §6.1 says "elevation, where north is a higher pitch". Pitch already means "warmer", the main cue, so north-as-pitch would make a cool northern cell sound like a warm southern one. Make elevation spatial (HRTF height) instead, with no pitch change, and update §6.1 in this PR.
2. `pan.ts` exports `placeFor(x, y)`, returning azimuth and elevation, and `createPanner(t, mode)`, which returns a `StereoPannerNode` for `'stereo'` and an HRTF `PannerNode` for `'3d'`.
3. Add optional `elevation?: number` (−1 south to +1 north) to `playCategory`'s options and to `SequenceStep` (interface change to §5.3). It is ignored in stereo mode.
4. A "3D sound (headphones)" toggle in the Listen settings, off by default, remembered like the sound style.
5. Integration line: the explorer passes `elevation` from the cell's row (see the table).

**Done when:** the pan tests cover `placeFor` at the corners and centre; the engine test shows `'3d'` creates an HRTF panner and `'stereo'` does not; stereo playback is unchanged; and the PR says whether north and south could be told apart on two pairs of headphones.

---

## T85: Real NASA data (Dhruv + Team leader)

**Speed measurements by 10 Nov; real data 13 to 14 Nov, Must.** Covers F16 (a second, real visualization). The resources arrive on 13 Nov; steps 1 and 2 can be done now.

**Files:** `scripts/` (converter and stress options), `public/data/`, `docs/data-sources.md`, `docs/performance.md` (new), `src/data/types.ts` and `src/data/schema.ts` (only if the real data needs it, agreed with everyone who uses them), `src/analysis/` (team leader).

**Do:**
1. **Now: speed.** Add `--frames N --width W --height H --out DIR` to `scripts/make_synthetic_globe.py` and generate 60 frames at 1920 × 1080 into a folder in `.gitignore`; do not commit the images. In Chrome on a mid-range laptop and on a phone, measure the time from opening Listen to Play being enabled, the time for one `analyzeGrid`, and peak memory. Write the numbers in `docs/performance.md`.
2. **Now, only if Play takes over 5 s (Should, team leader):** make the analysis progressive, so the first dates become playable while the rest are analysed, with the same results for the same frame.
3. **13 Nov: converter.** Turn the real resources into our manifest format. Convert video to PNG frames offline; never play video in the app. Reject a legend that changes between frames, or a moving projection, with a readable message rather than guessing.
4. **Only what the real frames need:** a wider legend (a manifest change only, keeping C4 E4 G4 C5 E5); for sea ice, two categories, "open water" (C4) and "ice" (G4), with a two-stop legend.
5. **For every real data set:**
   - Set `mapArea` so legend bars, titles and logos are left out.
   - On two dates, check in the explorer that labels and coastlines read as "no data", not as values.
   - Curate 3 to 5 `comparisons` with known answers.
   - Write 3 to 5 `story` chapters. Every fact (a date, a record, a number) must be on the NASA source page, noted in `docs/data-sources.md`, and checked by a person.
   - Fill in the credit and licence exactly as the source page gives them.
6. Add each data set to `public/data/index.json`.

**Done when:** the speed numbers are written down; every real manifest validates and loads in Listen, the explorer, Compare and the story; its comparisons give the intended answers; and its legend, credit and story show.

---

## T86: Voice guide on ADK, rewording only (Mohammad, Roni reviews)

**CUT on 7 Nov.** The spike (`docs/adk-spike.md`) could not prove live voice or tool calls, and the planning repo's own ADK eval failed on free-tier quota (every call 503/429). The voice guide stays on the current bridge. Text below kept for the record only.

**After the cut line, Could, first to be cut.** The voice guide already works on the current bridge; this changes how it is built, not what judges see. Start only if T81 A is merged.

**Files:** a throwaway spike branch, then `server/app/api/assistant.py`, `server/app/assistant/`, `server/app/config.py`, `server/requirements.txt`, `render.yaml`, `server/tests/`, `docs/adk-spike.md` (new).

**Do:**
1. **Spike, one day at most.** On Python 3.12 within Render's free tier (512 MB), prove or disprove:
   - a Live voice session through our WebSocket with the same browser protocol;
   - tool calls, with their results reaching the browser as today;
   - transcripts and page context;
   - idle memory and cold-start time.

   Note the `google-adk` version. Write each answer, with numbers, in `docs/adk-spike.md`. If any answer is no, stop here; the README quotes the note.
2. **Build, only if the spike passes.** An ADK agent with the five existing tools and the same browser protocol, so the frontend does not change. `ASSISTANT_ENGINE=bridge|adk` chooses it; `bridge` stays the default. Pin the version.
3. **Rewording (F19).** The guide may rephrase the text from `src/describe/` at the listener's detail level, but never adds a number or a claim of its own. With the server off, the rules' words are used as they are.

**Done when:** the server tests pass in both modes; a test shows nothing under `server/app/study/` imports ADK; switching back needs only an environment change.

---

## T87: Evidence, write-up and submission (Roni, Team leader, Bhavish, Dhruv)

**Must.** Lands as small docs PRs, one per step. Unlike the others, this ticket's later steps need the features to exist. That is its nature, not a link between tickets: the "now" steps start today.

**Files:** `docs/tests/` (new), `docs/CREATIVE_PROCESS.md` (new), `docs/PLAYLIST.md` (new), `README.md`, `src/features/about/index.tsx` (one link; Roni).

**Do:**
1. **Now, Roni: testers.** Recruit at least one screen-reader user. The fallback is sighted volunteers with no screen; report it honestly either way.
2. **Now, Team leader: creative process draft** in `docs/CREATIVE_PROCESS.md`, linked from About. Cover:
   - Intent.
   - The pipeline with file pointers (frame → `valueAtPixel` → median, shares and grid → `voicingFor` → engine → `src/describe/`).
   - Every sound choice and why, citing `docs/SOUND_MAPPINGS.md`.
   - What we rejected and why.
   - Accessibility decisions.
   - Limits, and how to add a data set.
3. **12 Nov, Roni: practice listening test** on the deployed site, with 3 or more people, in `docs/tests/practice-2026-11-12.md`. Run the synthetic-ocean comparisons in test mode, once in Full and once in Simple, alternating which comes first. Also run "find the warmest place" in the explorer without looking, and the story question. **Decision rule:** if Full scores fewer correct than Simple, or two or more people cannot pick out the main note, the team leader makes `'simple'` the default in `src/audio/style.ts` by 13 Nov.
4. **13 Nov, Team leader: re-plan** against the judging guide the same day, and update PLAN.md.
5. **14 Nov, Roni: final check** in `docs/tests/final-check.md`:
   - Layout at 320, 360, 768, 1024 and 1280 px on the real data.
   - Lint, build and both test suites.
   - A keyboard-only journey: Home → Learn → Listen → explorer → story → Compare → About.
   - NVDA or VoiceOver on desktop, and TalkBack or VoiceOver on a phone.
   - WAV download on a phone; music pausing for the voice guide; everything but the voice guide working with the server off.
   - Every failure gets a fix or a ticket.
6. **14 Nov, Dhruv and Bhavish: playlist.** Use the Download button in the default style. Make one track per real data set and one for synthetic-globe, labelled as made-up. Bhavish publishes them as GitHub release `audio-v1`, not in the repository. `docs/PLAYLIST.md` gives each track:
   - its source, credit and licence;
   - its dates and region;
   - its length;
   - "What you hear", the `describeSequence` text.
7. **15 Nov:**
   - **Team leader:** the final creative-process write-up with the listening-test results, and the demo script and backup video. Demo: pick a data set → story → explore by keyboard → compare by ear → reveal → a playlist track → results → limits.
   - **Bhavish:** replace the Vite template `README.md` with the submission README. It covers what the app is, how to run it, the creative-process summary and link, the playlist link, the AI-tool disclosure, and limits (including no vibration on iOS).

**Done when:** each file above is merged before the feature freeze, and the README, playlist and video links all open in a private window.

---

## T111: v2: baseline in the manifest, and a synthetic data set with a known change (Dhruv)

**Should (v2 core), M, by 9 Nov, after T91's Must steps.** Team leader reviews `src/data/types.ts`. Covers F26 and PLAN.md §5.1.

**Files:** `src/data/types.ts`, `src/data/schema.ts`, `src/data/schema.test.ts`, `src/data/check.ts` and its test, `scripts/make_synthetic.py` (or a new `scripts/make_synthetic_change.py`), `scripts/convert_frames.py` and its test, `public/data/synthetic-change/` (new), `public/data/index.json`, `docs/data-sources.md`.

**Do:**
1. **Types and schema** exactly as PLAN.md §5.1: `baseline`, `frames[].baselineImage`, `mapping.changeSteps`, `mapping.contourLevels`. All optional, and the three mapping and baseline fields come together or not at all. `changeSteps` follow the same no-gap, no-overlap rule as `categories`; contour notes between C3 and C6. Every existing manifest must still validate unchanged.
2. **`check-data` rules,** each with a readable message:
   - `climatology`: every frame has a `baselineImage`; it exists, has the frame's width and height, and at least `minValidFraction` of its `mapArea` reads through the same legend.
   - `reference-date`: `frameId` names a real frame; no frame has a `baselineImage`.
   - `anomaly-product`: no `baselineImage`; the legend's range spans both signs (it is a change, not a temperature).
   - `noiseFloor` is at least twice the legend's rounding: the largest change in value per unit of RGB distance along any legend segment.
   - Never resample a mismatched image: reject it.
3. **A new synthetic data set, `synthetic-change`** (made-up, CC0). Do **not** change synthetic-ocean or synthetic-globe: T88's golden files must stay byte-for-byte the same.
   - Twelve monthly frames = a seasonal cycle **plus** a planted warm patch (+1.5 °C) that grows in the east over months 8 to 10.
   - `baseline: { kind: "climatology" }`, where each month's `baselineImage` is the seasonal cycle alone.
   - Five `changeSteps` (≤ −1, −1 to −0.25, ±0.25, +0.25 to +1, ≥ +1 °C) and `contourLevels` +1 °C (C5) and +2 °C (G5).
   - **At least two comparisons where the absolute answer and the change answer differ** (for example a normal August against a March that is 1.5 °C above normal). These are the test that v2 plays the change and not the season.
4. **Converter:** `--baseline-dir <dir>` pairs each frame with the file of the same name, writes `baselineImage`, and refuses a pair whose sizes differ. `--baseline-kind` and `--baseline-label` fill `baseline`; without them the converter writes no baseline.
5. `docs/data-sources.md`: a short section "Baselines", with the three kinds, the order to prefer them, and that a reference date is "change since <date>", never "anomaly".

**Done when:** schema tests cover each rule above, and the old manifests still pass; `npm run check-data` passes on all data sets and rejects a deliberately mismatched baseline image with a readable message; `synthetic-change` is in `index.json` and plays in Listen with today's sound (v1 ignores the new fields); the T88 golden files are unchanged.

---

## T112: v2: change field and change steps (Team leader)

**Should (v2 core), M, by 11 Nov, after T90 and T96 steps 1 and 2.** Covers F27 and PLAN.md §5.2 and §5.9. Pure code: nothing a listener hears changes.

**Files:** `src/analysis/field.ts` (new) and its test, `src/analysis/change.ts` (new) and its test, `src/analysis/analyze.ts` (region `changeStep`), `src/analysis/protocol.ts` and `worker.ts` (message kind `'change'`), `src/analysis/index.ts` (`analyzeChange`), `src/data/sound-regression.test.ts` (one added test), `src/data/__golden__/change.json` (new), `docs/performance.md`.

**Do:**
1. **Types first, in their own commit,** so T113 can build on them: `ValueField`, `Contour`, `Score` as in PLAN.md §5.9.
2. **`readField`**: each cell the median of a 3 × 3 lattice through `valueAtPixel`, so a field cell, a grid cell and a region never disagree about a pixel. About 180 × 90 over `mapArea`.
3. **`changeField`, `smoothField`, `summarizeChange`** exactly as §5.9. A point counts only if it is readable in **both** the frame and the baseline. `anomaly-product` passes the frame field through unchanged.
4. **Regions:** `analyzeFrame` adds `changeStep` and `medianChange` when the data set has a baseline: the median of (frame − baseline) over the region's lattice points that are readable in both, with the noise floor applied, then `changeSteps` ranges. `category` is untouched.
5. **Worker:** `analyzeChange(frame, visualization)` fetches the frame and its baseline (the `baselineImage`, the reference frame, or none) and returns a `Score` with `contours: []` until T113 merges (integration line).

**Done when:**
- Tests: NaN in either input gives NaN; |change| below the noise floor is 0; smoothing never turns a NaN cell into a value unless it has readable neighbours; a field with too few readable cells gives `"insufficient"`; each step boundary goes to the step above (the same rule as `categoryFor`); same input, same `Score`.
- **The season test:** on `synthetic-change`, the change steps follow the planted patch and **not** the seasonal cycle, and the comparisons from T111 step 3 come out with the change answer.
- `change.json` records each data set's `Score`; the T88 golden files are unchanged.
- `docs/performance.md` gives the time of one `analyzeChange` on the 1920 × 1080 stress frames (frame and baseline) on a mid-range laptop and a phone. Over 200 ms on the phone: drop to 120 × 60 cells and write that down.

---

## T113: v2: contour tracing with marching squares (Bhavish suggested; team leader reviews)

**Should, M, by 12 Nov.** `src/analysis/` is the team leader's, so the team leader reviews; Bhavish is suggested because his load is light and the output feeds his spatial code. Covers F18 (analysis) and PLAN.md §5.9. Builds on the types from T112 step 1 only; it can be developed and tested on hand-written fields before T112's functions merge.

**Files:** `src/analysis/contour.ts` (new), `src/analysis/contour.test.ts` (new); integration line in `src/analysis/worker.ts` (see the table).

**Do:**
1. **`traceContours(field, level)`**: classic marching squares. A corner counts as "above" when its value is **≥** `level` (one rule, written in the code). Linear interpolation along each crossed edge. Saddle cells resolved by the average of the four corners. A cell with any NaN corner gives no segment.
2. **Join** the segments into polylines in a fixed order (row-major scan from the north-west), so the output never depends on the order of a hash map. A line that closes on itself is `closed`. Count `brokenEnds`: an open end that stops next to a NaN cell (an end at the map's edge is not broken).
3. **Resample** each line to 64 points evenly spaced along its length. Convert to 0 to 1 fractions of the **whole image** (through `area`), the same space `panForPoint` uses.
4. Per point: `turn`, the signed turning angle from the previous to the next point; `front`, the change in value across the line (the field's gradient at that point, in variable units per cell).
5. **`pickContours(contours, perLevel = 1)`**: the longest line of each level; ties go to the first found.

**Done when:**
- Tests on hand-written fields: one raised cell gives one small closed loop; a straight front gives one open line with `turn` near 0 everywhere; an L-shaped front gives one `turn` near ±π/2; a saddle cell gives the same result every run; a NaN hole splits a line into two with `brokenEnds` 1 each; the map's edge gives `brokenEnds` 0; no point of any line lies inside a NaN cell; `pickContours` keeps the longest per level.
- On `synthetic-change`, the +1 °C line on months 8 to 10 outlines the planted patch (a golden file entry in `change.json`).
- One `traceContours` call on a 180 × 90 field takes under 10 ms on a laptop (written in the PR).

---

## T114: v2: the `"change"` sound style (Team leader, Bhavish)

**Should, L, after the cut line, by 13 Nov.** Team leader: `src/audio/`. Bhavish: the spatial path and the listening check. Depends on T112 (and T113 for step 3). Covers F28 and F18 (sound) and PLAN.md §6.2. Supersedes T105 to T107.

**Files:** `src/audio/style.ts` and its test, `src/audio/changeVoice.ts` (new, pure) and its test, `src/audio/engine.ts` and its test, `src/audio/index.ts`, `src/audio/pan.ts` only if a helper is needed (Bhavish), `src/data/sound-regression.test.ts` (additive), `src/data/__golden__/change.json`, `src/features/compare/TestMode.tsx` (never `"change"` yet; Mohammad reviews), `docs/PLAN.md` §5.3 and §5.7, `docs/SOUND_MAPPINGS.md`, `docs/performance.md`.

**Do:**
1. **The style.** Add `'change'` to `SoundStyle` (agreed with Mohammad and Roni). The default stays `'full'`; `readSoundStyle` returns `'change'` only if it was chosen on this device. `'full'` and `'simple'` must build exactly the same nodes as before (an engine test records them before and after), and the T88 golden files stay unchanged. TestMode plays full or simple only until the 13 Nov decision.
2. **The change bed.** A pure `bedFor(stepIndex, stepCount, medianChange, stepRange)` in `changeVoice.ts` returns `{ note, cutoffHz, gainDb }`:
   - `note` is the step's `note` (C3 to C4 register): pitch steps with the change.
   - The cutoff rises strictly with the step, and within a step a little with `medianChange`, never below 3 times the fundamental.
   - `gainDb` matches loudness across steps (measured in step 6).
   - In the engine: a sustained voice (sine plus a quiet sawtooth through a low-pass `Tone.Filter`), centred and wide, played for the step's length in sequences and Compare. A step with `changeStep: "insufficient"` plays the existing hiss. A step with no `changeStep` plays the category note as today.
3. **The contour voice.** A pure `contourEvents(contour, note, msPerUnit)` returns timed events:
   - duration from the line's length, clamped to 2 to 8 s;
   - at each point: `pan = panForPoint(x)`, and `elevation` from y (heard in 3D mode only);
   - an accent where |`turn`| > π/4, at least 125 ms apart (at most 8 a second);
   - brightness from `front`;
   - a short hiss at each broken end.

   `engine.traceContour(contour, onPoint)` plays them on one gliding voice at the level's note. Bhavish checks that the movement is heard where it should be, in stereo and in 3D.
4. **Master chain** for the `"change"` style only: a compressor, then a `Tone.Limiter` at −1 dBFS, so warmer is never louder and nothing clips. `dispose()` disposes them; T96's leak test passes in this style.
5. Same input, same sound: no randomness; `Freeverb` only; `renderToWav` uses the same voices, so a WAV of a sequence in this style matches live playback.
6. **Measured offline** (as T105 step 4), in the PR and `docs/performance.md`: every step's bed alone, 600 ms: peak at or below −1 dBFS, RMS within 1 dB of each other; a contour trace with accents: peak at or below −1 dBFS; the bed's pitch stays within 1% while the cutoff moves.
7. **Listening check, 13 Nov (Bhavish runs it).** At least three listeners on headphones, at least one who did not write the code, none told what the layers mean beyond one Learn-style sentence each.
   - 12 pairs from `synthetic-change` in v1 (full) and 12 in the change bed, alternating which block comes first: "Which date is further above normal?" Include T111's pairs where the absolute and change answers differ.
   - 6 contour traces: "Is the warm edge mostly on the left, in the middle or on the right?"
   - Comfort, 1 to 5, after one minute of sequences and three traces.
   - **Pass:** each listener scores at least 10 of 12 with the bed; at least 4 of 6 traces; every comfort rating 3 or more. Write the scores and headphone models in the PR, no names.
   - **Decision (PLAN.md §6.2):** pass → `"change"` becomes the default for data sets with a baseline and is used in the final listening test. Fail → it stays an opt-in style, or the contour voice alone is removed if only the traces failed.

**Done when:** the tests pass; `full` and `simple` are provably unchanged; the measurements and the listening results are in the PR; `docs/SOUND_MAPPINGS.md` has a v2 section with the cue table from PLAN.md §6.2.

---

## T115: v2: wiring, Compare, descriptions and Learn (Mohammad, Roni)

**Should, M, after the cut line, by 14 Nov.** Mohammad: Listen, the explorer, Compare. Roni: `src/describe/`, Learn, About. Depends on T114 (the fake engine lets most of it be built against T112's `Score` before T114 merges). Covers the wiring of F28 and the trace button of F18.

**Files:** `src/features/player/usePlayer.ts`, `src/features/player/index.tsx`, `src/features/player/player.test.tsx`, `src/features/explore/Explorer.tsx` and its test, `src/features/compare/judge.ts` and its test, `src/features/compare/index.tsx`, `src/features/compare/TestMode.tsx`, `src/describe/index.ts`, `src/describe/describe.test.ts`, `src/features/learn/index.tsx` and its test, `src/features/about/index.tsx`, `docs/PLAN.md` §5.4 (the `player` context gains `changeStep`).

**Do:**
1. **Listen.** The sound control becomes a radio group "Sound: Full, Simple, Change from normal". The third option shows only for a data set with a baseline, with the hint "Hear how far each date is from its normal, not the temperature itself." In that style, steps carry `changeStep` and `medianChange` from the analysis.
2. **"Trace the warm edge"** button (44 px, change style only, disabled when the current date has no contour) calls `engine.traceContour` for each picked contour in turn and announces `describeContour` after. In the sound map, `T` does the same. Escape or Stop ends it.
3. **Compare.** `judge` ranks by `changeStep` when both dates have one, otherwise by `category` as today. Question wording for a data set with a baseline: "Which date is further above its normal?" The reveal names the baseline's `label`.
4. **Descriptions (Roni).** `describeChange` and `describeContour` as in PLAN.md §5.8, rules only, with the concise and rich levels from T82. A `reference-date` baseline always says "change since <date>"; nothing ever says "anomaly" unless the kind is `anomaly-product` or `climatology`. Places are compass sectors, never sea or country names.
5. **Learn (Roni).** Two cards, shown only with the change style available: "Change from normal" (play the five bed steps in order, then two dates) and "The warm edge" (trace one line from `synthetic-change`, then its description).
6. **About (Roni).** For each data set: the baseline kind and label, and one line on why we play the change, not the temperature.

**Done when:** the player test shows steps carry `changeStep` in the change style and not in the others; the trace button calls `traceContour` and announces; `judge` tests cover change ranking, the fallback to category, and `"insufficient"`; describe tests cover both functions at both detail levels and the "change since" wording; the a11y check passes; layout is checked at 360, 768, 1024 and 1280 px; a keyboard-only run of Listen → trace → Compare is in the PR.

---

## UI overhaul: Material 3 Expressive (T116, T117)

Restyle the whole app in [Material 3 Expressive](https://m3.material.io/blog/building-with-m3-expressive) (M3E), Google's newest version of Material Design. The work is split into two tickets that **don't block each other**: they edit different files, and each one works whether or not the other has merged. T116 builds the foundations and the app shell (tokens, base styles, header, navigation); T117 builds the components and the voice guide panel.

[`docs/UI_FOLLOWUP.md`](UI_FOLLOWUP.md) lists every UI element and its problems; each ticket says which of its sections it covers. No new packages (rule 5 above): Material Web (`@material/web`) is in maintenance mode and has no M3E components, so both tickets write plain CSS against the M3 token names. Colors were generated with `@material/material-color-utilities` 0.4.0 (2025 spec, the M3E color spec), run outside the repo.

### Shared contract (T116 implements it, T117 reads it)

**Token names** follow Material's own, so the M3 docs and Material Theme Builder exports map one to one.

| Group | Names | Notes |
|---|---|---|
| Color | `--md-sys-color-<role>`, for every M3 role (`primary`, `on-primary`, `primary-container`, …, `surface-container-highest`, `outline-variant`, `inverse-surface`, `scrim`) | Purple on black: seed `#8a1fe0`, Vibrant scheme for the accents with neutral grey (chroma 0) surfaces, 2025 spec (changed from ocean blue on 9 Nov). Light, dark, and high-contrast versions of both (`prefers-contrast: more`) |
| Type | `--md-sys-typescale-<role>-<size>-{size,line-height,weight,tracking}` for display, headline, title, body and label in large, medium and small, plus `--md-sys-typescale-emphasized-weight` | Body text uses **body-large (16 px)**, never body-medium, because of the 16 px rule in `AGENTS.md` |
| Shape | `--md-sys-shape-corner-{none,extra-small,small,medium,large,large-increased,extra-large,extra-large-increased,extra-extra-large,full}` | The M3E corner scale: 0, 4, 8, 12, 16, 20, 28, 32 and 48 px, plus full |
| Elevation | `--md-sys-elevation-level{0..5}` | `box-shadow` values |
| Motion | `--md-sys-motion-spring-{fast,default,slow}-{spatial,effects}` and the same names with `-duration` | M3E springs written as CSS `linear()` easings. Spatial (position, size, shape) overshoots slightly; effects (color, opacity) doesn't. With reduced motion, durations become 0 |
| State | `--md-sys-state-{hover,focus,pressed,dragged}-state-layer-opacity` | 0.08, 0.10, 0.10, 0.16 |
| Target | `--control-size` | 48 px (M3's target size; above our 44 px floor) |

**Legacy tokens stay.** Every page's CSS uses the old names (`--text`, `--text-h`, `--bg`, `--border`, `--code-bg`, `--accent`, `--accent-strong`, `--accent-bg`, `--accent-border`, `--on-accent`, `--error`, `--error-bg`, `--focus`, `--shadow`). T116 keeps all of them as aliases of M3 roles, so every page picks up the new look without anyone editing it. Remove them only after nothing uses them, in a later ticket.

**How the two stay independent:**

| | T116 | T117 |
|---|---|---|
| Edits | `index.html`, `public/`, `src/index.css`, `src/styles/tokens.css` (new), `src/styles/tokens.test.ts`, `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, `src/components/Icon.tsx` (new), `src/components/Mascot.tsx` and its test (new) | All other files in `src/components/`, `src/styles/components.css`, `src/VoiceAssistant.tsx`, `src/styles/assistant.css`, page CSS and markup where a page adopts a new component |
| Never edits | Anything in T117's column | Anything in T116's column |
| If the other hasn't merged | Pages and components get the new colors through the legacy aliases | Writes every token with a fallback: `var(--md-sys-color-primary, var(--accent))`, `var(--md-sys-shape-corner-full, 999px)`. It looks right on the old tokens and better on the new ones |

`Icon.tsx` is a new file that T116 creates and **doesn't** add to `src/components/index.ts`, which belongs to T117. Import it by path (`./components/Icon`). T117 can switch `VoiceAssistant` to it once T116 has merged; until then `VoiceAssistant` keeps its own icons. `Mascot.tsx` works the same way: T116 creates it, and T117 imports `Echo` from it by path.

---

## T116: UI: Material 3 Expressive tokens and app shell (Mohammad)

**Should, M, by 8 Nov. Built 9 Nov on `feature/ui-material-you`, in review as [PR #1](https://github.com/raghavburtony-creator/nasa/pull/1).** `src/index.css` and `src/styles/` belong to Roni, who reviews them. Depends on nothing. Covers `docs/UI_FOLLOWUP.md` §1.1 to 1.6 (1.6 is the skip link), §2.1 to 2.5, §3.1 and 3.2.

**Files:** the T116 column of the table above.

**Do:**
1. **Tokens:** add `src/styles/tokens.css` with every token in the contract, and import it first in `index.css`. Light and dark follow `prefers-color-scheme`; high contrast follows `prefers-contrast: more`.
2. **Legacy aliases** in `index.css`: `--text` → on-surface-variant, `--text-h` → on-surface, `--bg` → surface, `--border` → outline-variant, `--code-bg` → surface-container-high, `--accent` → primary, `--accent-bg` → secondary-container, `--accent-border` → outline, `--on-accent` → on-primary, `--error` → error, `--error-bg` → error-container, `--focus` → secondary, `--shadow` → level 2.
3. **Base styles:** drop the global `text-align: center` and the side borders on `#root`; fluid type from the type scale, with `clamp()` for headings; paragraph spacing, h3 and list styles; one focus ring (3 px, secondary color, 2 px offset); move `.sr-only` from `App.css` into `index.css`; keep the reduced-motion block.
4. **Top app bar:** the wordmark becomes a link to `#home` with a small logo. The voice guide toggle becomes an M3E toggle button: tonal when off; filled when on, its corners morphing from full to medium on a spatial spring; the mascot's head as its icon (step 9). Closing the guide returns focus to the toggle.
5. **Navigation** (breakpoints as in `AGENTS.md`):
   - Below 768 px, an M3E navigation bar: an icon in a pill-shaped active indicator, with a short label under it ("Home", "Learn", "Listen", "Compare", "About"). The full title stays the accessible name. The bar keeps `--bottom-nav-height` and the safe-area padding.
   - From 768 px, horizontal nav items in the header: icon and full label in one pill.
   - The current page has a cue that isn't color: a filled icon, the indicator, and a bolder label.
   - Links keep `?data=` (T54), so a chosen data set survives a click.
6. **Main area:** a skip link to `<main>`; the `h1` uses an emphasized headline style and keeps its focus behavior; `document.title` follows the page ("Listen · Earth Jukebox"); the data load error uses `Notice` (error).
7. **Icons:** add `src/components/Icon.tsx`, built from Material Symbols paths (Apache 2.0) as `VoiceAssistant` already does: the outlined and filled nav icons, mic, mic_off, and play, pause, stop and replay for later use.
8. **Template leftovers:** replace the Vite favicon with an Earth Jukebox one (purple sound bars on a black circle); delete the unused `public/icons.svg`; add a meta description and `theme-color` (light and dark) to `index.html`.
9. **Mascot** (added 9 Nov; concepts in `docs/design/mascot-concepts.html`): `src/components/Mascot.tsx` draws the astronaut, *Echo* (full body, poses idle, listening, talking and thinking) and *Sonny* (the head in a badge). Both are `aria-hidden` decoration. Sonny is the voice guide toggle's icon: 28 px on phones, so the wordmark and the toggle still share one row at 360 px, and 32 px from 768 px.
10. **Phone tab bar and header** (added 9 Nov; layout ideas from the Wear&Go app):
    - The bottom bar is a frosted capsule floating 12 px above the bottom edge and the home indicator. One highlight slides to the current tab. A strip of page background behind it stops the page showing in the gap.
    - Dragging along the bar moves the highlight with the thumb and opens the tab on release (`src/useNavDrag.ts`). It is a shortcut only: a tap, the keyboard and screen readers use the links.
    - The header stays at the top and is frosted. Its blur sits on a `::before` layer, because a `backdrop-filter` on the header would stop the fixed bar floating.
    - Tapping the current tab or the wordmark scrolls back to the top and focuses the heading. A new page always opens at its top.
    - The header and bar adapt to their real width with container queries, so a scrollbar or a wider font cannot make them wrap. The toggle reads "Voice guide", then "Guide", then the mascot alone; its name is always "Voice guide". Tab labels go to 12 px when the bar is narrow.
    - Solid colours under `prefers-reduced-transparency`; no motion under `prefers-reduced-motion`.
    - Write `backdrop-filter` once and let the build add `-webkit-`: with both written, the build kept only the `-webkit-` one, which Chrome ignores.

**Done when:**
- `tokens.test.ts` checks, in light, dark and both high-contrast schemes: every `on-X` / `X` pair at 4.5:1 or more; the legacy pairs, resolved through the aliases; the focus ring at 3:1 or more against the surface.
- `App` tests cover the skip link, `document.title`, focus returning to the toggle, `aria-current` with short mobile labels, and links keeping the data set.
- `npm test`, `npm run lint` and `npm run build` pass.
- Screenshots at 360, 768, 1024 and 1280 px, in light and dark, show no sideways scroll and nothing hidden by the bar. (PR #1 checked 360, 768 and 1280 px in dark; 1024 px and light are still to do.)

---

## T117: UI: Material 3 Expressive components and voice guide panel (Roni)

**Should, L, by 12 Nov (M3).** The voice guide files belong to Mohammad, who reviews them. Depends on nothing (see the fallback rule in the contract). Branch `feature/T117-m3e-components`. Covers `docs/UI_FOLLOWUP.md` §3.3, §4.1 to 4.9 and §6.1.

**Files:** the T117 column of the table above. Page files change only where a page swaps in a new component, and without changing behavior.

**Do:**
1. **Button:** M3E variants (filled, tonal, outlined, text, elevated); sizes small (default, 48 px target), medium and large; a state layer for hover, focus and pressed; the shape squares a little while pressed, on a fast spatial spring; a toggle (`pressed`) uses the selected shape and color. Today's props keep working: `variant="primary"` means filled and `"secondary"` means outlined, so no page has to change.
2. **IconButton** (new): standard, filled, tonal and outlined; a toggle form; a 48 px target. `aria-label` is required by its type.
3. **ButtonGroup** (new): a *connected* single-choice group built on native radio inputs, so it keeps radio semantics and arrow-key behavior; and a *standard* group, where neighbors squeeze when one is pressed.
4. **Slider:** the M3E look (a track with a gap around a tall handle, and a value indicator) on the native `<input type="range">`. The API stays the same.
5. **Card:** filled, elevated and outlined variants, with large corners. The API stays the same.
6. **Notice:** info, warning and error, in container colors from the tokens; an optional action button ("Try again"). Keep its roles and the "Error:" prefix.
7. **LoadingIndicator** (new): the M3E morphing-shape indicator, with a text label and `role="status"`. With reduced motion it is a static shape.
8. **Form fields:** an outlined style for `select`, `textarea` and text inputs (including the data set picker), and M3 radio and checkbox styles, as classes the pages can use.
9. **Voice guide panel:**
   - A surface-container-high card with extra-large corners. On mobile it's a bottom sheet above the nav bar.
   - Escape closes it. Use `dvh` everywhere. All text at 16 px or more.
   - The mute button gets a fixed label with `aria-pressed`, and the mic_off icon when muted.
   - The status orb becomes an M3E shape, with a separate level meter.
   - Suggestion chips send sample questions ("What am I listening to?", "Play this year").
   - The silent-microphone warning uses `Notice`. In the error state, the start button reads "Try again". Explain why the input is disabled while idle.
   - The mascot (added 9 Nov): `Echo` from T116's `Mascot.tsx` stands beside the open panel from 768 px, its pose following the guide (connecting → thinking, listening → listening, speaking → talking). Hidden on phones, where the panel is a bottom sheet. No animation under reduced motion; decoration only, since the status line says the same in words.
10. **Adopt on the pages,** with no change in behavior: player speed → connected ButtonGroup; Compare answer and test-mode choices → connected ButtonGroup or M3 radios; Compare's `select` and the test-mode comment → outlined fields; "Analyzing the images…" → LoadingIndicator.
11. **Layout fixes from the 9 Nov visual audit** (320 to 1280 px):
    - Listen controls: on a phone, Play spans the width, Stop and Replay share a row, and Explore the map gets its own row. With room (a container query at 36rem), all four share one row. No label wraps.
    - Speed and Description: the label sits above the options, so the choices share one row and line up with Volume.
    - Sound options: on a phone each button has its explanation under it; with room, they sit side by side, and Download (no explanation) takes its own row.
    - About: `grid-template-columns: minmax(0, 1fr)`, so the tables' 16rem minimum no longer widens the page at 320 px. The table scrolls in its own region.
    - Buttons: room above and below a label that wraps.
    - Selected outlined toggles use the purple secondary container, not Material's inverse surface, which read as plain white or black in this theme. The squarer selected shape stays the second cue.

**Done when:**
- Each new or changed component has a test with an accessibility check (`expectNoA11yViolations`).
- The page tests that already exist pass **unchanged**.
- `npm test`, `npm run lint` and `npm run build` pass.
- Screenshots at 360, 768, 1024 and 1280 px, in light and dark.
- The voice guide panel is checked by eye in every state (it needs a click to open).

---

## Left out on purpose

- **F17 background drone.** Cut. Its idea returns as the v2 change bed (T114), which carries data (the change step) rather than a whole-frame average.
- **Region picker on Listen.** The explorer covers "listen somewhere else" across the whole map.
- **Compare with A in one ear and B in the other.** Too big a change to the listening test this close to it.
- **Speech inside story mode.** Screen-reader users have their own voice; two would talk over each other.
- **Sounds that combine data sets.** They need several real data sets, which arrive on 13 Nov, two days before the end.

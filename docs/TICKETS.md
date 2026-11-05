# Tickets: the work left in the plan

Written 5 Nov 2026 from [`docs/PLAN.md`](PLAN.md). It replaces the old `docs/tickets/` folder, so it is the only ticket list. It lists only work that is **not built yet**, checked against the code on `main` (`4b3ea13`). Where this file and the plan disagree, fix the plan first.

Hand a ticket to your own AI like this:

> Read `AGENTS.md`, `docs/PLAN.md` and ticket `<ID>` in `docs/TICKETS.md`. Do only that ticket (or only its part A or part B), on branch `feature/<ID>-short-name`, and open a PR into `main`.

Every PR must meet the definition of done in PLAN.md §9, including the layout rule in `AGENTS.md` (check 360, 768 and 1280 px with the `responsive-layout` skill, and list the widths in the PR). If a ticket lists a file someone else owns (PLAN.md §4), that owner reviews the PR.

## Already built (no ticket)

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
| T80 | Musical engine and WAV rendering | Team leader | 9 Nov | A Must; B Should/Could | §5.7, F14 engine; B: F24, F18, F22 |
| T81 | Listen: sound-map explorer and player wiring | Mohammad | 10 Nov | A Must; B Should/Could | §5.6 explorer, F13 in use, F14 button, style toggle; B: F23, F25 |
| T82 | Learn the new sounds, and concise or rich descriptions | Roni | 11 Nov | A Must (Learn), Should (detail); B Could | Learn cards, F19 rules; B: F21 |
| T83 | Story mode | Bhavish | 11 Nov | Should | `story` chapters (§5.1) |
| T84 | 3D spatial audio | Bhavish | after 12 Nov | Could | F20 |
| T85 | Real NASA data | Dhruv + Team leader | 10 Nov (speed), 14 Nov (data) | Must | F16, real `mapArea`, story text, comparisons, speed |
| T86 | Voice guide on ADK, rewording only | Mohammad (Roni reviews) | after 12 Nov | Could, cut first | F19 ADK |
| T87 | Evidence, write-up and submission | Roni, Team leader, Bhavish, Dhruv | 12 to 15 Nov | Must | F11 evidence, playlist, creative process, README, demo |

### Integration lines

| Line | File | Done by whichever merges second of |
|---|---|---|
| The explorer passes `rhythm: rhythmFor(cell)` when it plays a cell | `src/features/explore/Explorer.tsx` | T80 B (F18) and T81 A |
| The explorer passes `elevation` from the cell's row | `src/features/explore/Explorer.tsx` | T84 and T81 A |
| The explorer pulses on a jump of two or more categories between cells | `src/features/explore/Explorer.tsx` | T82 B (F21) and T81 A |
| The explorer's announcements use the listener's detail level | `src/features/explore/Explorer.tsx` | T82 A and T81 A |
| The "Simple sound" toggle becomes a three-way choice with "Organic" | `src/features/player/index.tsx` | T80 B (F22) and T81 A |

## Order and cut line

- **By 12 Nov (M3, feature complete and deployed):** T80 A, T81 A (keyboard, sliders and row sweep at least), T82 A (Learn cards at least), T83, the T85 speed measurements, and the T87 steps marked "now".
- **After 12 Nov:** only part B, T84, T86, data, text, fixes and tests.
- **From 13 Nov:** T85's real data, then T87's playlist, final check and demo.
- **Features freeze 6 hours before the deadline** (PLAN.md §8).

**If time runs out, cut in this order** (first cut at the top): T86; T81 B F25; T80 B F22; T84; T82 B; T80 B F24; T80 B F18; T81 B F23; T83; T81 A pointer and touch drag (keep keyboard, sliders and sweeps); T81 A's Download button (keep `renderToWav`, so the playlist can still be made).

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

**Part B: after the cut line, Should (F24, F18) and Could (F22).** One PR each, in this order.
1. **F24 alarm.** A stronger version of the bell, not a new system: when the category moves `ALARM_STEPS` (3) or more steps, `voicingFor` also sets `alarm: true` and the engine plays a brighter, longer flare instead of the bell. Add `alarm?: boolean` to `SequenceStep` (interface change). It flows into Listen through `voicingFor` with no caller change. Test: a three-step jump gives `alarm`, a two-step jump gives only `bell`.
2. **F18 texture and rhythm.** In the worker, count edge density per grid cell with a Sobel filter on the values already read, and add `texture?: number` (0 to 1) to `GridCell`. Add a pure `rhythmFor(cell)` next to `voicingFor` that picks one of three fixed patterns in the current scale: slow quarter notes, eighths, or sixteenths with an arpeggio. Add `rhythm?` to `playCategory`'s options. Integration line: the explorer passes it (see the table). Listen-check before merging: if it sounds like noise, merge it behind the Full style only, or drop it (PLAN.md §11).
3. **F22 organic style.** Add `'organic'` to `SoundStyle`. This is an interface change: agree it with Mohammad and Roni first. Timbres: crackle for the warmest category, a water sweep for the coolest; everything else as Full. `readSoundStyle` accepts the new value. Integration line: the style control in Listen (see the table).

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
2. **F25 sound buoys (Could, last, with the team leader for the server).** A room per visualization over a WebSocket on the server; a sighted user drops a buoy on a cell, and the others hear a ping that gets louder and brighter as their cursor nears it. The explorer must work exactly as before when the server is off or asleep, and nothing else may depend on this. Keep the WebSocket code out of `src/analysis/`, `src/audio/` and `src/describe/` (the boundary test checks this).

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

**Part B: after the cut line, Could. F21 anomaly haptics.** In `src/features/player/vibration.ts`, add `vibrateForJump(previous, next, mapping)`: a stronger, longer pulse when the category moves two or more steps, and the normal pulse otherwise. Use it on Listen for date-to-date changes (one line in `usePlayer.ts`; Mohammad reviews). Integration line: the explorer between cells (see the table). Always paired with a sound, never the only cue; iOS Safari has no vibration API, so say so on About. Test with a stubbed `navigator.vibrate`.

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

## Left out on purpose

- **F17 background drone.** The T80 chord comes from the data and does the same job; a drone would be one more layer to mix under the melody. Mark F17 cut in PLAN.md §6 when T80 A merges.
- **Region picker on Listen.** The explorer covers "listen somewhere else" across the whole map.
- **Compare with A in one ear and B in the other.** Too big a change to the listening test this close to it.
- **Speech inside story mode.** Screen-reader users have their own voice; two would talk over each other.
- **Sounds that combine data sets.** They need several real data sets, which arrive on 13 Nov, two days before the end.

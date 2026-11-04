# Team leader tickets (heavy)

Frame analysis, the sound engine and the study API: the core logic everyone else builds on, plus the plan and demo.

Files you own: `src/data/types.ts`, `src/analysis/`, `src/audio/` (except `src/audio/pan.ts`), `server/app/study/`, `src/config.ts`.

---

## T00: Shared interfaces, stubs and tooling (day 1, merge first)

**Depends on:** nothing. **Unblocks:** every other ticket. Keep it small (a few hours) and merge it the same day.

**Do:**
1. **Packages (all of them, once):**
   - `npm install zod tone tonal`
   - `npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom vitest-axe`
   - Add the `"test": "vitest run"` and `"test:watch": "vitest"` scripts, a `vitest.config.ts` (environment jsdom), and `src/test/setup.ts` (registers jest-dom).
2. **Data interface:** `src/data/types.ts` with the TypeScript types from PLAN.md §5.1, written by hand. In `src/data/index.ts`, add stubs for `loadCatalog()` and `loadVisualization(id)` that fetch the JSON *without* validation (T30 adds validation), and a `DataError` class.
3. **Analysis interface:** `src/analysis/index.ts` exporting `FrameAnalysis`, `analyzeFrame(...)` and `analyzeAll(frames, region, colorScale, mapping)`. The stub picks a category from the frame's month (January coolest, December warmest), and returns `"insufficient"` for any frame whose `note` contains "missing". On the fixture frames this agrees with what real pixel analysis will give.
4. **Sound interface:** `src/audio/index.ts` exporting the `SoundEngine` type from PLAN.md §5.3, plus `duck()` and `unduck()`, and `createSoundEngine(mapping)`. The stub logs each call. Its `playSequence` uses `setTimeout` to fire `onStep` at each `atMs`, and `pause`, `resume` and `stop` work, so the player can be built for real against it.
5. **Playback commands:** `src/features/player/controls.ts` exporting `type PlayerCommand = "play" | "pause" | "stop" | "replay" | "next" | "previous" | { setDate: string }` and a tiny emitter: `sendPlayerCommand(command)` and `onPlayerCommand(listener) → unsubscribe`. This is how the voice guide (T14) controls the player (T11).
6. **API address:** `src/config.ts` exporting `apiBase()`, which reads `import.meta.env.VITE_API_URL` and falls back to `""` so the dev proxy is used. Change `socketUrl()` in `src/hooks/useVoiceAssistant.ts` to use it: `ws(s)://` + the host from `apiBase()`, or the page's own host when it's empty.
7. **Page folders:** move each placeholder page out of `App.tsx` into `src/features/{home,learn,player,compare,about}/index.tsx`, each exporting a default component that receives `{ visualization: Visualization | null }`. `App.tsx` loads the catalog and the first visualization, then renders the current page.
8. **Fixture data:** `public/data/fixture/manifest.json` with 4 frames, 1 region, a 3-stop color scale, 5 categories (cold, cool, mild, warm, hot) and 1 comparison. Frames are 200 × 100 solid-color PNGs (cold blue, mild yellow, hot red, and a gray "missing" one), made by a short script, `scripts/make_fixture.py`. Add `public/data/index.json` listing `fixture`.
9. Add the voice guide's context fields and the playback command type to PLAN.md §5.4 if they change while you build.

**Done when:** `npm test`, `npm run build` and `npm run lint` pass; the app loads the fixture data; every page renders from its own folder; and a test proves the stub engine fires `onStep` in order.

---

## T01: Frame analysis core (M2)

**Files:** `src/analysis/analyze.ts`, `src/analysis/analyze.test.ts`.

**Do:**
1. Write a pure function, `analyzePixels(pixels, frame, region, colorScale, mapping): FrameAnalysis`, with no DOM.
2. For each region point, read the pixel at `(x × width, y × height)`.
   - If it's close to a `noData` color, skip it.
   - Otherwise find the closest point on the color scale, using RGB distance along the segments between neighboring stops, and interpolate the value.
   - If the distance is above `maxColorDistance`, count it as unmatched and skip it.
3. Take the median of the valid values. If `valid / sampled < minValidFraction`, return `"insufficient"`; otherwise return the category whose range contains the median.

**Done when:** tests on hand-made pixel arrays cover:
- an exact stop color
- a color halfway between two stops
- a no-data pixel
- an unmatched color
- the insufficient-data threshold
- a median with an even number of samples
- same input → same output

T00's fixture frames give the categories you'd expect. (Checking against Dhruv's synthetic `expected.json` happens in Roni's integration check, T46, not here.)

---

## T02: Frame analysis worker (M2)

**Do this after:** T01 (your own order).

**Files:** `src/analysis/worker.ts`, `src/analysis/index.ts` (swap the stub for the real thing).

**Do:**
1. Run `analyzePixels` in a Web Worker, using `createImageBitmap` and `OffscreenCanvas`. Fall back to the main thread when `OffscreenCanvas` isn't available.
2. Cache results by `frameId + regionId`.
3. Keep the exact exports T00 defined.

**Done when:** analyzing 24 frames doesn't freeze the UI, the results equal T01's, and the exports are unchanged (callers need no edits).

---

## T03: Sound engine: voices, cues, volume, ducking (M2)

**Files:** `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/audio/index.ts` (swap the stub).

**Do:**
1. Use Tone.js. Notes come from `mapping.categories[].note`, validated with Tonal; cooler is always lower.
2. Use a soft synth (for example sine or triangle waves with a gentle attack and release), a short quiet tick, and a missing-data cue that sounds clearly different from any category (for example filtered noise).
3. Nothing makes a sound before `unlock()` has been called from a click or key press.
4. `setVolume` ramps smoothly, with no clicks. `stop()` silences everything within 50 ms.
5. `playCategory` accepts an optional `pan` from −1 to 1; Bhavish's T20 computes the values.
6. `duck()` pauses whatever is playing and remembers its place. `unduck()` doesn't resume by itself.

**Done when:**
- Tests, with Tone mocked, check that each category plays its note, that nothing plays before `unlock`, that volume is limited to 0–1, and that `duck` pauses.
- In a browser check, the five categories are easy to tell apart.

---

## T04: Sound engine: sequences, pause, speed (M2)

**Do this after:** T03 (your own order).

**Do:**
1. Implement `playSequence(steps, onStep)` on `Tone.Transport`: each step plays its category (or the missing cue), then a tick.
2. Fire `onStep(index)` through `Tone.Draw`, so the image changes at the same moment as the sound.
3. `pause()` and `resume()` continue from the same step. Speed can change between plays.

**Done when:** a test sequence fires `onStep` in order, and pause, resume and stop behave the same as the T00 stub did (so the player keeps working unchanged).

---

## T05: Study API and database (M3)

**Files:** `server/app/study/{__init__,db,api}.py`, `server/tests/test_study.py`, `server/app/main.py` (one `include_router` line), `server/app/config.py` (new settings), `.gitignore` (`server/*.db`).

**Do:**
1. Use SQLite with Python's built-in `sqlite3`, and create the tables exactly as in PLAN.md §5.5 at startup. The file path comes from `STUDY_DB_PATH` (default `server/study.db`).
2. Endpoints, exactly as in PLAN.md §5.5. The export requires an `X-Team-Token` header matching `STUDY_EXPORT_TOKEN`. Validate every field with Pydantic.
3. Store no names, emails or IP addresses, and don't log request bodies. Comments are limited to 500 characters, and a session to 50 responses.
4. On Render, use a persistent disk if available; otherwise export the CSV after each session.

**Done when:** tests cover creating a session, adding responses, rejecting bad values, rejecting export without the token, and the CSV contents.

---

## T06: Re-plan against the judging guide (M4, 13 Nov)

**Do:** read the 2026 Judging & Awards Guide and the released challenge resources on the day they come out. Score the plan against each criterion. Update `docs/PLAN.md` (priorities and cuts) and tell the team what changed.

**Done when:** PLAN.md reflects the published criteria, and everyone knows their M5 priorities.

---

## T07: Demo script and backup video (M5)

**Do:**
1. Write the demo script:
   - the problem
   - the NASA source
   - teach the sounds
   - the audience compares two dates by ear
   - reveal the answer
   - the test results
   - honest limits
   Keep it within the event's time limit.
2. Record a backup video of the full demo on the live site.

**Done when:** you've rehearsed it twice and the video is saved in two places.

---

## T08: WAV export (M5, should)

**Do this after:** T04 (your own order).

**Do:** add `renderToWav(steps)` using `Tone.Offline` with the same voices as the live engine. It returns a WAV `Blob`. Tell Mohammad when it's merged, so the player can show a "Download audio" button.

**Done when:** the downloaded file plays in a normal audio player and sounds the same as the live sequence.

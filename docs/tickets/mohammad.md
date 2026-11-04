# Mohammad tickets (heavy)

The pages people actually use: the player, Compare, test mode, and voice control of the player.

Files you own: `src/App.tsx`, `src/pages.ts`, `src/features/player/`, `src/features/compare/`, `src/assistant/`, `src/hooks/useVoiceAssistant.ts`, `server/app/assistant/`, `server/app/api/`.

Build against T00's stubs: the fake sound engine fires `onStep` like the real one, and the fake analysis returns a fixed pattern. When the team leader's real versions land behind the same exports, your code shouldn't need changes.

---

## T10: Hash links and navigation (M2)

**Files:** `src/App.tsx`.

**Do:**
1. Keep the current page in the URL hash (`#listen`, `#compare`, …). A link opens that page, back and forward work, and unknown hashes go to Home. Test mode uses `#compare?test=1` (T13).
2. Keep the current behavior: the voice guide's `navigate` action changes the page, and focus moves to the heading after navigation (not on first load).

**Done when:** every page opens from its own link, back and forward work, the server test `test_pages_match_frontend` still passes, and a Vitest test covers the hash handling.

---

## T11: Player page (M2)

**Do this after:** T10 (your own order).

**Files:** `src/features/player/` (not `controls.ts`'s exports, which T00 defined).

**Do:**
1. **Viewer:**
   - the frame image with its `altText`
   - the date written out (for example "1 March 2024")
   - the region name, with an SVG outline over the image (`aria-hidden`)
   - the frame `note`, and the source credit
   - preload the next frame
2. **Analysis:** call `analyzeAll` when the page opens, and show a loading state until it finishes.
3. **Controls:**
   - Play/Pause toggle
   - Stop
   - Replay the current date
   - a date slider (`<input type="range">` with date labels)
   - Speed (slow / normal / fast)
   - Volume
4. **Keeping image and sound in step:** Play calls `playSequence`, and `onStep` moves the slider and image. Moving the slider while playing jumps to that date; while paused, it plays just that date.
5. **Announcements:** a polite live region announces each date and category in words ("March 2024: warm"), once per date.
6. **Keyboard:** while focus is in the player, Space plays or pauses and the arrow keys step through dates. Shortcuts never take over a focused text box.
7. **Voice guide context:** publish `useAssistantContext("player", {...})` with the PLAN.md §5.4 fields, and `announce: "playback_finished:<id>"` at the end of a sequence.
8. **Voice commands:** subscribe to `onPlayerCommand` (from T00), so the voice guide can control playback.

**Done when:** the four correctness checks in PLAN.md §9 hold on the fixture data, it works without a mouse, and tests cover play, pause, slider jumps and the live region (using the stub engine).

---

## T12: Compare page (M2)

**Files:** `src/features/compare/` (except the files T13 adds).

**Do:**
1. Choose one of the manifest's `comparisons`, or any two dates (A and B).
2. "Play date A" and "Play date B" use `playCategory` with the same scale. Use the analysis results for each frame. Don't import the player's components; keep this page self-contained.
3. The user answers "A is warmer", "B is warmer" or "About the same".
4. Reveal: both images, whether the answer was right, and the `explanation`. Images stay hidden until the reveal.
5. Publish `useAssistantContext("compare", {...})`, and `announce: "comparison_revealed:<id>"` on reveal.

**Done when:** the fixture comparison works from start to finish by keyboard, and tests cover answering and the reveal.

---

## T13: Listening-test mode UI (M3)

**Do this after:** T12 (your own order). It doesn't wait for the study API: build against PLAN.md §5.5 with a mocked `fetch`.

**Files:** `src/features/compare/TestMode.tsx`, `src/features/compare/studyClient.ts`.

**Do:**
1. Test mode opens only from `#compare?test=1`; there's nothing for it in the navigation.
2. Steps:
   1. consent, in plain words
   2. one question (sighted / blind or low vision / prefer not to say), plus whether they use a screen reader
   3. images on or off (default: audio only)
   4. each comparison in a fixed order: the answer, an optional confidence from 1 to 5, an optional comment
   5. a thank-you screen
3. `studyClient.ts` calls the §5.5 endpoints at `apiBase()` and sends each answer's response time in milliseconds. On a network failure it keeps answers in memory and retries, and never drops an answer silently.

**Done when:** tests with a mocked `fetch` cover a full session and a failed request that's retried. When the team leader's T05 is merged, check it once against a local server.

---

## T14: Voice guide playback tools (M3, should)

**Files:** `server/app/assistant/tools.py`, `server/app/assistant/knowledge.py`, `server/tests/test_assistant.py`, `src/hooks/useVoiceAssistant.ts`, `src/App.tsx`.

**Do:**
1. **Server:** add `control_playback` (play, pause, stop, replay, next, previous) and `set_date` (an ISO date). Each returns a client action `{ "action": "player", "command": ... }`. Update the guide's instructions and the tests.
2. **Client:** in `toAssistantAction`, accept only the known commands, then pass them to `sendPlayerCommand()` from T00. The player (T11) already listens for them.
3. **Ducking:** while the guide's status is `listening` or `speaking`, call the engine's `duck()` (it's in the T00 interface), so the music never plays over the guide.

**Done when:** server tests cover the new tools and reject bad commands, and a frontend test shows a `player` action reaching `sendPlayerCommand`. With a key set, "play" and "next date" work by voice.

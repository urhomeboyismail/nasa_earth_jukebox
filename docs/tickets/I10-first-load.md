# I10 First load: lazy voice panel, demo and v3 pipeline; bundle budget in CI

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN07 |
| **Hotspots** | app |
| **Branch** | `fix/I10-first-load` |

## Goal

The first page a visitor sees loads less code. The voice panel, the demo tour, the voice client and the v3 pipeline load when they are first used. A bundle budget runs in CI, so the first load cannot grow without someone noticing.

## Why

- `src/App.tsx:2` imports `VoiceAssistant` statically. It is shown only when the guide is open (`src/App.tsx:229`).
- `src/App.tsx:7` imports `DemoControl` statically. It is on every page, so its code is needed at once, but its tour (`src/features/demo/runDemo.ts`, `script.ts`) is needed only after a click.
- `src/App.tsx:13` imports `useVoiceAssistant` from `src/hooks/useVoiceAssistant.ts`. The hook runs on every page (`src/App.tsx:143`). It imports `frameLevel`, `SpeechPlayer` and `startRecorder` from `src/assistant/audio.ts` (line 9 of the hook), so the audio code loads on the first page too.
- `src/data/schema.ts:4` imports `tonal` and `:5` imports `zod`. `tonal` is used to validate note names. The first page needs `zod` to read the data, but `tonal` may only be needed by the sound code.
- Measured by the explore agent on 9 Nov, before this ticket: the entry chunk is about 388 KB raw and about 117 KB gzip. Tone.js is already lazy (a 341 KB chunk). Measure again before you start; the numbers in this ticket are only a starting point.
- CI (`.github/workflows/ci.yml`) has no bundle budget. It runs `npm run lint`, `npm run build` and `npm test` only.

## Reuse

- `React.lazy` and `Suspense`, as already used for the pages in `src/App.tsx:20` to `:23`.
- `npm run build` output in `dist/assets/`.

## Touches

- `src/App.tsx`: lazy imports.
- `src/hooks/useVoiceAssistant.ts`: move the audio imports to the place where a session starts.
- `src/data/schema.ts`: only if `tonal` can move out of the first page.
- `scripts/check-bundle.mjs` (new): the budget check.
- `package.json`: one script, `check-bundle`.
- `.github/workflows/ci.yml`: one step after `npm run build`.

## Steps

1. Measure first. Run `npm run build`, then `gzip -c dist/assets/index-*.js | wc -c` and `wc -c dist/assets/index-*.js`. Paste both numbers in the Result. List the entry chunk's imports with `npx vite-bundle-visualizer` if it is available, or by reading the build output.
2. Make `VoiceAssistant` a lazy import in `App.tsx`. Its `Suspense` boundary sits where the panel is rendered (`src/App.tsx:229`). Show nothing while it loads, but the loading state must be announced: use the same `role="status"` pattern as the page loader (`src/App.tsx:224`), with the text "Loading the voice guide…".
3. Make the audio code in `src/assistant/audio.ts` load with the first session. In `useVoiceAssistant.ts`, use `await import('../assistant/audio')` inside the function that starts a session. Keep the exports and their names. Keep `frameLevel` available to the panel's meter.
4. Make `DemoControl` load its tour on click: `await import('../features/demo/runDemo')` and the script when "Play the demo" is pressed. Keep the button and its caption in the same chunk as today, if they are small.
5. Check `tonal` in `src/data/schema.ts`. If it validates note names, move that check into a function that is loaded when a sound is first made, or keep it and report the size it costs. Do not change what data is accepted.
6. Write `scripts/check-bundle.mjs`. It reads `dist/assets/index-*.js`, computes its gzip size with `zlib`, and exits 1 when it is over the budget. The budget is in one constant. Set it to the measured size after this ticket, plus 5%. Print the number.
7. Add `"check-bundle": "node scripts/check-bundle.mjs"` to `package.json`. Add a step to the web job in `.github/workflows/ci.yml` after `npm run build`.
8. Measure again, and paste both numbers in the Result.

## Tests

- `App.test.tsx`: the voice panel is not in the document until the guide button is pressed, then it appears after the lazy load (`findByRole`). Use the existing guide test as the pattern.
- `App.test.tsx`: the demo button is in the document at once, and the tour's first caption appears after a click.
- The existing `useVoiceAssistant` and assistant tests pass unchanged.
- The bundle check: run `npm run check-bundle` after `npm run build`, and paste the output in the Result. There is no unit test for the script.

## Guardrails

Not applicable: no sound or visual change. The lazy loads show a text loading state, which is announced. Nothing plays before a click.

## Done when

- The entry chunk gzip size is lower than the measured size at the start, and the Result shows both numbers.
- `npm run check-bundle` passes locally and in CI, and fails when the budget is exceeded (show that once by setting the budget to 1 byte, then reset it).
- Each lazy module loads on the first use, not before (check in the App tests).
- `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-bundle
npx vitest run src/App.test.tsx src/hooks src/assistant src/features/demo
```

## Out of scope

- Splitting the v3 engine and pipeline. They load with Listen, which is already lazy, and SN07 decides how.
- Service workers and caching (F51 is parked).
- Image and font size.

## Result

Built by agent D on `fix/I10-first-load`, 13 Nov 2026, from `main` at `72bea67`.

**Sizes.** The entry chunk `dist/assets/index-*.js`, before (main) and after:

| | raw | gzip (`gzip -c`) | gzip (Node `zlib`, what `check-bundle` reads) |
|---|---|---|---|
| Before | 265,912 | 83,483 | 83,734 |
| After | 253,930 | 80,057 | 80,344 |

Everything the first page loads (the entry plus its preloaded chunks and CSS, from `dist/index.html`) went from 139,913 to 135,922 bytes gzip. That count includes the panel's 7.6 KB of CSS, which now loads with the panel. Rolldown now splits three small shared chunks (`schemas`, `context`, `pages`) that the first page still preloads; the totals include them. The 9 Nov numbers in **Why** (388 KB / 117 KB) were already out of date: the entry is mostly `react-dom` now (read from a sourcemap build).

**What changed**

- `src/App.tsx`: `VoiceAssistant` is a `React.lazy` import. While it loads, a `role="status"` paragraph (the page loader's pattern) says "Loading the voice guide…". The lazy factory also starts loading the guide's audio code, so it has normally arrived before Start is pressed.
- `src/hooks/useVoiceAssistant.ts`: `src/assistant/audio.ts` is no longer imported at the top (only its types are). `loadAssistantAudio()` imports it once and keeps it, and tries again after a failed load. **Not a plain `await import()` in `start`:** `open()` builds the `SpeechPlayer` and the recorder inside the click, because browsers (Safari strictest) only allow audio inside a user gesture ("Everything that needs the click's user activation happens before the first await"). So `open()` uses the loaded module synchronously. Only a click that beats the download shows "connecting" and goes on when the code arrives. Stop, another start or unmount cancel that wait (`openAttempt`, moved on by `teardown`). A failed load ends with "Echo could not connect. The rest of the app still works." The exports and their names in `audio.ts` are unchanged, and the meter still gets `frameLevel` through the recorder callback.
- `scripts/check-bundle.mjs` (new), `npm run check-bundle`, and a CI step after `npm run build`. Budget `BUDGET_BYTES = 84_362` (80,344 + 5%). Note: the budget sits above the old 83,734, as the ticket's "+5%" rule gives.
- `src/App.test.tsx`: new "First load (I10)" tests. The panel and audio modules have not loaded at first render. After a click, the loading status shows while the panel's load is held, then the panel appears (`findByRole`), and each module has loaded once. The demo button is there at once. On main's `App.tsx` and hook the first test fails (`expected { audio: 1, panel: 1 } to match { panel: 0, audio: 0 }`). One existing test now waits for the panel with `findByRole`. The hook and assistant tests pass unchanged.

**Not done, and why**

- **Step 4 (demo tour on click): skipped.** The click handler is in `src/features/demo/DemoControl.tsx`, which is not in this ticket's Touches. I measured it in a throwaway build: lazy-loading `runDemo.ts` and `script.ts` saves 280 bytes gzip (83,483 → 83,203). That's too little to justify editing a file outside Touches. A later ticket that touches `DemoControl.tsx` can do it in a few lines.
- **Step 5 (`tonal`): kept, with its size reported.** `schema.ts` uses `Note.midi` inside the manifest's parse, to check `changeSteps` and `contourLevels` note names and ranges. Running that check later would change when a bad manifest is rejected. Swapping `Note.midi` for something smaller could change what is accepted. Cost, measured by building without it: the first-load `data` chunk shrinks from 37,468 to 29,191 bytes gzip (8.3 KB, 23.5 KB raw). Importing `@tonaljs/note` alone might keep most of that saving, but it is not a direct dependency (`package.json` is limited to one script here).
- The app has no error boundary, so a lazy chunk that fails to download (offline) throws. That is already true for the lazy pages; this ticket adds the panel to the same pattern. Out of scope here.

**Checks.** On this laptop the default `npm test` (8 vmThreads workers) runs out of memory (about 650 MB free), so the suite ran as `npx vitest run --pool=forks --maxWorkers=1`. Same tests, one process.

```
$ npm run lint
> moon-heist@0.0.0 lint
> oxlint
(exit 0)

$ npx vitest run --pool=forks --maxWorkers=1
 Test Files  133 passed (133)
      Tests  2236 passed (2236)
   Duration  445.73s

$ npm run build
dist/assets/audio-D3ds3KIB.js               3.09 kB │ gzip:  1.40 kB
dist/assets/VoiceAssistant-CGPfSKSl.js      9.28 kB │ gzip:  3.11 kB
dist/assets/index-DKQbD16p.js             253.93 kB │ gzip: 81.20 kB
✓ built in 857ms

$ npm run check-bundle
index-DKQbD16p.js: 80344 bytes gzip (78.5 KB), within the budget of 84362 bytes (82.4 KB).

$ # with BUDGET_BYTES = 1, then reset
index-DKQbD16p.js: 80344 bytes gzip (78.5 KB), over the budget of 1 bytes (0.0 KB) by 80343.
(exit 1)

$ # with no dist/
Expected one entry chunk (index-*.js) in dist/assets, found 0. Run npm run build first.
(exit 1)

$ npx vitest run src/App.test.tsx src/hooks src/assistant src/features/demo --pool=forks --maxWorkers=1
 Test Files  8 passed (8)
      Tests  155 passed (155)
```

CI will show whether `check-bundle` passes there once the branch is pushed.

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

- `src/App.tsx`: lazy imports. Review: Mohammad.
- `src/hooks/useVoiceAssistant.ts`: move the audio imports to the place where a session starts. Review: Mohammad.
- `src/data/schema.ts`: only if `tonal` can move out of the first page. Review: Dhruv (`src/data/` except `types.ts`).
- `scripts/check-bundle.mjs` (new): the budget check.
- `package.json`: one script, `check-bundle`. Review: the team leader.
- `.github/workflows/ci.yml`: one step after `npm run build`. Review: Bhavish (`.github/`).

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
- Mohammad, Bhavish and Dhruv (for `schema.ts`, if touched) have reviewed their parts.

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

Not started.

# I04 zod at the boundaries: study client, context data, welcome storage

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `fix/I04-zod-boundaries` |

## Goal

Data that comes from outside the page (the study server's answer, the stored welcome choice, and the data sent to the app's context) is checked with zod before the code uses it. No `as` cast stands in for a check.

## Why

- `src/features/compare/studyClient.ts:166`: `((await result.json()) as { id: string }).id`. Nothing checks that the server sent an `id`. A wrong answer becomes a session ID of `undefined`.
- `src/features/welcome/storage.ts:32` to `:36`: the stored value is checked by hand, and `path as WelcomePath` is a cast.
- `src/features/demo/DemoControl.tsx:32` and `src/features/welcome/Welcome.tsx:26`: `(update.data as { playing?: boolean } | null)?.playing`. The context data is `unknown` (`src/assistant/context.ts:8`), and each reader casts it.
- `src/assistant/context.ts:7`: `ContextKey` is written by hand and must match the server's `CONTEXT_KEYS` (`server/app/api/assistant.py:34`). No test checks that they match. That drift test belongs to G06, not here.
- `src/data/schema.ts` already uses zod (lines 4 and 5 import `tonal` and `zod`). The rule in `.claude/rules/frontend.md` says to validate data from outside with zod.

## Reuse

- `zod` (already a dependency).
- The existing messages: "The server sent an answer we could not read." (`studyClient.ts`), and the defaults in `storage.ts`.

## Design

Put the small schemas in a new file, `src/data/boundaries.ts`, exported from `src/data/index.ts`. Do not put them in `src/data/schema.ts`: that file is the `schema` hotspot, used by SN05 and F48. `frontend.md` names `schema.ts` for data files. These are not data files, so a sibling file is the right place. Say so in the pull request.

Schemas (names are a suggestion):

- `studyCreated`: `z.object({ id: z.string().min(1) })`.
- `playerUpdate`: `z.object({ playing: z.boolean().optional() }).passthrough()`, for the player context. Its result is used only as "is it playing".
- `storedWelcome`: `done`, `speech` as booleans, `path` as an enum of the three paths, `volume` as a number from 0 to 1. Unknown or wrong fields fall back to the current defaults, which is what the code does today.

## Touches

- `src/data/boundaries.ts` (new), `src/data/index.ts`.
- `src/features/compare/studyClient.ts`.
- `src/features/welcome/storage.ts`, `src/features/welcome/Welcome.tsx`.
- `src/features/demo/DemoControl.tsx`.
- The tests next to each file.

## Steps

1. Write `src/data/boundaries.ts` with the three schemas, and a unit test file `src/data/boundaries.test.ts`.
2. In `studyClient.ts`, parse the JSON with `studyCreated.safeParse`. On failure, call the existing `this.fail(...)` with the same message as today, and store no session ID.
3. In `storage.ts`, replace the hand check with `storedWelcome.safeParse`. On failure, return `null`, as now. Keep the same results for valid data, and for the fields that are missing.
4. In `Welcome.tsx` and `DemoControl.tsx`, replace the cast with `playerUpdate.safeParse(update.data)`. Use `success && data.playing`.
5. Check with `grep -rn " as " src/features/compare/studyClient.ts src/features/welcome src/features/demo src/data/boundaries.ts`. The list should be empty, apart from `as const`.
6. Run the tests.

## Tests

- `studyClient.test.ts`: an answer without `id`, or with an empty `id`, fails with the existing message, and no session is started.
- `studyClient.test.ts`: a valid answer still starts the session. Stub `fetch` with `vi.stubGlobal` and restore it in `afterEach`.
- `storage.test` (the existing test of `storage.ts`, or a new one next to it): a stored value with a wrong `path` falls back to no path, and a `volume` of 2 is dropped. A valid value round-trips.
- `boundaries.test.ts`: each schema accepts a valid value and rejects a wrong one.
- `DemoControl.test.tsx` and `welcome.test.tsx` still pass unchanged.

## Guardrails

Not applicable: no sound or visual change. The welcome's sound check and the demo's pause behave as before; the existing tests cover them.

## Done when

- No cast remains at the places listed in Why.
- A wrong server answer does not start a session. A corrupted stored welcome is ignored.
- All existing tests pass unchanged, apart from new tests. `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/data src/features/compare src/features/welcome src/features/demo
```

## Out of scope

- The `ContextKey` drift test (G06).
- Validating the server's other messages (V03 covers the voice client).
- Changing the study server (I05 covers it).

## Result

Built by agent D on `fix/I04-zod-boundaries` (2026-11-12).

- `src/data/boundaries.ts` (new) holds `studyCreated`, `playerUpdate` (`z.looseObject`, zod 4's name for `.passthrough()`) and `storedWelcome`, exported from `src/data/index.ts`. They sit beside `schema.ts`, not in it: `schema.ts` is the `schema` hotspot and is for data files, and these are not data files.
- `studyClient.ts`: the created-session answer goes through `studyCreated.safeParse`. A missing or empty `id` now fails with "The server sent an answer we could not read." and stores no session ID, so nothing is posted to `/tests/undefined/responses`; the client retries as for any other failure.
- `storage.ts`: the hand check is now `storedWelcome.safeParse`. Each wrong field falls back to its default (`done`/`speech` false, `path`/`volume` left out), and text that is not JSON or not an object gives `null`, as before. Results are unchanged for valid data (the new `storage.test.ts` uses `toStrictEqual`, so no `undefined` keys appear).
- `Welcome.tsx`, `DemoControl.tsx`: `playerUpdate.safeParse(update.data)` replaces the cast; `success && data.playing`.
- `src/data` was already in the first load (`App.tsx` imports `loadCatalog`), so the new imports add no chunk.

Step 5, `grep -rn " as " src/features/compare/studyClient.ts src/features/welcome src/features/demo src/data/boundaries.ts`, with `as const` and test files left out: only the English word "as" in comments remains.

```
src/features/welcome/storage.ts:38:  // Fields that fell back are left out rather than stored as `undefined`.
src/features/welcome/Welcome.tsx:71:  /** One plain note from a side (the middle category, as "Test sound" plays). ...
src/features/demo/script.ts:8:  /** Shown as a caption and read out, so the tour makes sense without seeing the screen. */
src/data/boundaries.ts:9:/** The player's context summary, read only for whether it is playing. The rest of the summary is kept as it is. */
```

Red first: before `boundaries.ts` existed, `boundaries.test.ts` failed to import and the two new `studyClient` cases failed (the client went on past the missing `id` and reported "could not start the test (error 503)").

Checks (Windows laptop; the default 8 Vitest workers, and on this run 2, run out of memory here, so the full suite ran with `--maxWorkers=1`):

```
$ npm run lint
> moon-heist@0.0.0 lint
> oxlint
(exit 0, no findings)

$ npx vitest run --maxWorkers=1
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
AssertionError: expected '{\n  "notes": {\n    "categories": {\…' to be '{\r\n  "notes": {\r\n    "categories"…' // Object.is equality
 Test Files  1 failed | 112 passed (113)
      Tests  1 failed | 1870 passed (1871)
   Duration  161.76s

$ npm run build
> tsc -b && vite build
✓ built in 914ms

$ npx vitest run --maxWorkers=2 src/data src/features/compare src/features/welcome src/features/demo
 FAIL  src/data/sound-regression.test.ts > sound regression baseline > notices when one legend stop of the fixture changes
 Test Files  1 failed | 22 passed (23)
      Tests  1 failed | 351 passed (352)
```

The one failure is environmental and not from this ticket: with `core.autocrlf=true`, `src/data/__golden__/fixture.json` is checked out with CRLF (191 lines end in `\r`), and the test compares it with LF text. Neither file is changed here. With this ticket's changes stashed (a clean `main` tree), it fails the same way:

```
$ git stash -u && npx vitest run --maxWorkers=1 src/data/sound-regression.test.ts
     × notices when one legend stop of the fixture changes 31ms
      Tests  1 failed | 4 passed (5)
``` `DemoControl.test.tsx` and `welcome.test.tsx` pass unchanged.

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

Not started.

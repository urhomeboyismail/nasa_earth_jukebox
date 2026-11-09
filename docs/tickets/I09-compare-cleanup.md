# I09 Compare clean-up

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | compare |
| **Branch** | `fix/I09-compare-cleanup` |

## Goal

The Compare page reads the test-mode flag once, from the App. It has no non-null assertions (`!`) that can crash, and no state update inside an effect that could be derived.

## Why

- `src/features/compare/index.tsx:20` to `:32`: `useTestMode` parses `window.location.hash` again, with its own `hashchange` listener. `src/App.tsx:97` already computes `testMode` and the page could receive it.
- `src/features/compare/TestMode.tsx:39` to `:41`: the effect calls `update()`, which calls `setStatus(client.status)`. That is a state update inside an effect, which `.claude/rules/frontend.md` forbids. The status can be read on each render, or set in the subscription callback.
- Non-null assertions that crash when the data does not match:
  - `src/features/compare/index.tsx:97` and `:98`: `frames.find(...)!`, when a comparison names a frame the data set does not have;
  - `src/features/compare/index.tsx:147`: `results!`;
  - `src/features/compare/TestMode.tsx:84`: `participant!`;
  - `src/features/compare/TestMode.tsx:192` and `:193`: `frames.find(...)!`;
  - `src/features/compare/TestMode.tsx:204`: `results!`.
- `src/features/compare/index.tsx:159`: `(visualization as ChangeVisualization).baseline`. That cast is removed by I06; leave it to I06 unless it is simpler to do here.

## Reuse

- `PageProps` in `src/features/types.ts` (`visualization: Visualization | null`).
- `Notice` (`src/components/Notice.tsx`) for "This date is not in the data set".
- The comparison and test-mode tests in `src/features/compare/*.test.tsx`.

## Touches

- `src/App.tsx` (pass the flag to the page).
- `src/features/types.ts` (add an optional `testMode?: boolean` to `PageProps`). It is shared by all pages, so keep the field optional.
- `src/features/compare/index.tsx`, `src/features/compare/TestMode.tsx`.
- `src/features/compare/*.test.tsx`.

## Steps

1. In `src/features/types.ts`, add `testMode?: boolean` to `PageProps`.
2. In `src/App.tsx`, pass `testMode={testMode}` to the page component. The value is already computed at line 97. Check that the other pages ignore it.
3. In `compare/index.tsx`, remove `useTestMode`, and read the prop. Remove the `hashchange` listener. Check the compare tests that toggle test mode, and make them render with the prop instead.
4. In `TestMode.tsx`, remove `update()` from the effect. Keep the subscription, and derive or set the status in the callback. For the first value, use `useState(() => client.status)` (already there) and let the subscription update it.
5. For each `!` in the list, check whether the value can be missing. If it can, render a `Notice` (or return early) with a plain sentence. If it can never be missing, make the type say so, and add a short comment. Do not leave a `!` that can crash.
6. Add the tests below.
7. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

- `compare.test.tsx`: a comparison that names a frame missing from the data set shows the notice and does not throw. Use a copy of the fixture (`public/data/fixture/manifest.json`) with one frame id changed, and render with it.
- `compare.test.tsx`: the test-mode page opens when the prop is `true`, and the normal page when it is `false`. Check by role (heading or button names used in test mode).
- `test-mode.test.tsx`: the status line updates when the client's status changes (use the existing fake client).
- `await expectNoA11yViolations(container)` on the notice state.

## Guardrails

Not applicable: no sound or visual change. Compare plays the same sounds as before. The existing judge tests (`judge.test.ts`) must pass unchanged.

## Done when

- `grep -rn "useTestMode\|hashchange" src/features/compare` shows nothing.
- No `!` remains in `src/features/compare/` apart from the ones with a comment that says why they cannot fail.
- The new tests pass. The existing compare and test-mode tests pass with no change to their expectations, except for how the flag is passed.
- `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/features/compare src/App.test.tsx
```

## Out of scope

- The shared hooks (I07) and the analysis memory (I06).
- The listening test's flow and its data (the team leader and H03).
- Any change to the answer text.

## Result

Not started.

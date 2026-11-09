# I07 Shared hooks: sound engine, frame analysis, stored settings

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | I06 |
| **Hotspots** | player, compare, learn |
| **Branch** | `fix/I07-shared-hooks` |

## Goal

Three pieces of repeated code become one hook each: creating the sound engine, analysing a data set's frames, and reading and writing a stored setting. Behaviour does not change. The code that is replaced by the v3 work keeps the same exports, so the v3 work can swap the engine behind the hook.

## Why

- The sound engine is created in a `useMemo` with a `try`/`catch` copied five times: `src/features/learn/index.tsx:42` (`useEngine`), `src/features/player/usePlayer.ts:74`, `src/features/compare/index.tsx:61`, `src/features/compare/TestMode.tsx:54`, and `src/features/welcome/Welcome.tsx:46`.
- The "analyse every frame" effect is copied three times: `src/features/compare/index.tsx:69`, `src/features/compare/TestMode.tsx:63`, and `src/features/player/usePlayer.ts:88`. Each one starts `analyzeAll(frames, region, colorScale, mapping, ...)` and handles cancel and error.
- Stored settings are read and written by hand in six places, each with its own `try`/`catch` for blocked storage:
  - `src/audio/style.ts:20` (`useSoundStyle`);
  - `src/audio/pan.ts:60` (`useSpatialMode`);
  - `src/features/player/vibration.ts:51` (the vibration switch);
  - `src/describe/detail.ts:40` (`useDescriptionDetail`);
  - `src/features/help/mascotSetting.ts:37` (`useMascotOn`);
  - `src/features/welcome/storage.ts:88` (`useWelcome`).
- A comment is wrong. `src/audio/style.ts:27` and `src/audio/pan.ts:66` say "Not remembered, but the choice still holds for this visit." The choice is held in state. But when storage is blocked, the state is read again on the next page, from `readSoundStyle` and `readSpatialMode`, which return the default. So the choice does not hold across pages. Fix the comment, or fix the behaviour, and say which.

## Reuse

- `createSoundEngine(mapping)` from `src/audio/index.ts`.
- `analyzeAll` from `src/analysis/index.ts`, with the concurrency limit from I06.
- `src/test/fakes.ts` (`installFakeAudioContext`) and the existing `vi.mock('../audio', ...)` pattern in the tests.
- `@testing-library/react`'s `renderHook`.

## Design

- `useSoundEngine(mapping): { engine: SoundEngine | null; engineError: string }` in `src/audio/useSoundEngine.ts`. It returns the same shape the five copies return today. The engine is created once per mount, and `null` with an error text when creation fails. The v3 engine (SN04) replaces what `createSoundEngine` returns, so the hook keeps its name and shape.
- `useFrameAnalysis(visualization, region, options)` in `src/analysis/useFrameAnalysis.ts`. It returns `{ results, error }` and cancels when the inputs change. It is the effect from the three copies. Use it in place of each copy. Place it in `src/analysis/` as a hook file, so that `src/analysis/index.ts` exports only functions.
- `useStoredValue<T>(key, parse, fallback)` in `src/hooks/useStoredValue.ts`. It reads with `parse`, writes with `JSON.stringify` (or the plain string for the existing settings, so that existing keys keep their values), and works when storage is blocked. Keep each setting's key, so no stored value is lost.

## Touches

- `src/audio/useSoundEngine.ts` (new), `src/analysis/useFrameAnalysis.ts` (new), `src/hooks/useStoredValue.ts` (new), and their tests.
- The five engine copies, the three analysis copies and the six storage copies listed in Why.

## Steps

1. Write `useStoredValue` and its tests first. Migrate one setting (`useSoundStyle`), run its tests, then migrate the rest.
2. Write `useSoundEngine` and migrate the five copies. Keep each page's error message.
3. Write `useFrameAnalysis` and migrate the three copies. Keep the cancel behaviour: a result that arrives after the inputs change is dropped.
4. Fix the comment in `src/audio/style.ts:27` and `src/audio/pan.ts:66` to say what really happens, or change the behaviour so the choice holds for the visit (and say so in the pull request).
5. Check with `grep -rn "createSoundEngine\|localStorage" src --include="*.ts" --include="*.tsx"`. The engine should appear only in `useSoundEngine.ts` (and its tests), and `localStorage` only in `useStoredValue.ts` and the existing files that define keys.

## Tests

- `useStoredValue.test.ts`: reads a stored value through `parse`; falls back when `parse` throws or the value is missing; writes and reads back; works when `localStorage.setItem` throws (stub it to throw).
- `useSoundEngine.test.tsx`: returns an engine when `createSoundEngine` works; returns `engineError` with the message when it throws; creates the engine once across re-renders (mock `../audio` as in the existing tests).
- `useFrameAnalysis.test.tsx`: returns results for the frames; drops a result that arrives after the inputs change (use a deferred promise); reports an error.
- The existing tests for the pages pass unchanged.

## Guardrails

Not applicable: no sound or visual change. The behaviour is the same, and the golden tests (`src/data/sound-regression.test.ts`, `src/data/change-regression.test.ts`) prove the sound is unchanged. The one behaviour that may change, the choice held across pages (Steps 4), is stated in the pull request.

## Done when

- `grep -rn "createSoundEngine" src` shows the hook and the tests only (plus the module that defines it).
- `grep -rln "localStorage" src` shows `useStoredValue.ts` and the files that define keys.
- Each of the five engine copies and three analysis copies is gone.
- All existing tests pass, apart from new tests. The golden tests pass with no change.
- `npm run lint && npm test && npm run build` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/audio src/analysis src/hooks src/features/learn src/features/player src/features/compare src/features/welcome src/features/help src/describe src/data
```

## Out of scope

- Changing what the engine plays, or how the analysis works.
- Adding a `dispose` method to the engine (the v3 work decides that).
- Changing any stored key's name.

## Result

Not started.

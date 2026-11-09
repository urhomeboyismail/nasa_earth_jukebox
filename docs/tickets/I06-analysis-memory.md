# I06 Analysis memory: bounded concurrency, cache eviction, dead casts

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | player, explorer, compare |
| **Branch** | `fix/I06-analysis-memory` |

## Goal

Analysing a data set uses bounded memory: a bounded number of frames is read at once, and each cache has a size limit. The casts that hide type mismatches are gone, and the type says what the code needs.

## Why

- `src/analysis/index.ts:141` to `:143`: `analyzeAll` calls `Promise.all(frames.map(...))`. Every frame's image is decoded at once. `docs/performance.md` measures about 650 MB for 60 full-HD frames, and says that is "likely too much for a phone tab".
- Caches with no limit:
  - `src/analysis/index.ts:123`: `const cache = new Map<string, Promise<FrameAnalysis>>()`;
  - `src/analysis/index.ts:145`: `gridCache` (module level);
  - `src/analysis/index.ts:164`: `scoreCache`;
  - `src/features/explore/useExplorer.ts:67`: `gridCache = useRef(new Map<string, FrameGrid>())`, one per mounted explorer, never cleared.
- Casts that hide a type gap. `src/analysis/types.ts:54` to `:55` defines `ChangeFrame = Frame` and `ChangeVisualization = Visualization`, so each `as ChangeVisualization` does nothing. Those casts are at `src/features/player/usePlayer.ts:91`, `:106`, `:296`, `src/features/compare/index.tsx:72`, `:159`, and `src/features/player/index.tsx:144`. Also `src/analysis/index.ts:72`, `:74`, `:85`, `:89` and `:92`: the worker's results are cast to `T` without a check.
- `src/features/player/usePlayer.ts:215`: `({} as Partial<FrameAnalysis>)`.
- `src/features/player/usePlayer.ts:108`: `.catch(() => { /* No score for this date ... */ })` drops the error. The listener sees a disabled trace button with no reason.
- `src/analysis/index.ts:167`: the comment says the contours are "empty until T113 traces them". T113 is done, so the comment is stale.

## Reuse

- The worker in `src/analysis/index.ts` (`getWorker`, `pending`).
- `src/test/fakes.ts` `installFakeWorker(handler)` for the worker tests.
- `src/analysis/*.test.ts` for the existing analysis tests.

## Design

- A small concurrency limit for frame analysis. Read at most `N` frames at once (start with `N = 3`) with a queue inside `analyzeAll`. The result array keeps the frame order.
- A small LRU (least recently used) helper, `src/analysis/lru.ts`, with a `get`, `set` and `size`. Use it for the three module caches and the explorer's grid cache. Start with a limit of 128 entries per cache. An evicted entry is recomputed on the next request.
- Typed results instead of casts: the worker request-to-result map. Each request kind names its result type, so `request` and `result` agree without `as T`.
- `ChangeVisualization` goes away. Functions that need the baseline take `Visualization` and check `visualization.baseline` at run time, and return a "no change" result when it is missing. Rename the types in the callers.

## Touches

- `src/analysis/index.ts`, `src/analysis/types.ts`, `src/analysis/lru.ts` (new), and their tests. Review: the team leader (`docs/PLAN.md` §4).
- `src/features/player/usePlayer.ts`, `src/features/player/index.tsx`: review Mohammad. Note: `usePlayer.ts` is replaced by the v3 work (SN07). Keep the change small and keep every export the same.
- `src/features/explore/useExplorer.ts`: review Mohammad.
- `src/features/compare/index.tsx`: review Mohammad.

## Steps

1. Write `src/analysis/lru.ts` and its tests. No dependency.
2. Replace the three module caches in `src/analysis/index.ts` with the LRU, keeping the same keys.
3. Replace the explorer's `useRef(new Map())` with the LRU, created once per mount.
4. Add a concurrency limit to `analyzeAll`. The worker calls stay the same; only the scheduling changes.
5. Type the worker requests and results so that the five `as T` casts go. Keep `analyzeFrame`, `analyzeAll`, `analyzeGrid`, `analyzeChange` and `baselineSource` with the same names and results.
6. Delete `ChangeFrame` and `ChangeVisualization`. Change their uses to `Visualization` and check `baseline` where it is needed. Remove the casts at the places listed in Why.
7. In `usePlayer.ts:108`, keep the trace button disabled, and store the error text in state. The player shows it under the button (a `Notice`) and announces it through `useAnnounce`. Do not swallow it.
8. Fix the stale comment at `src/analysis/index.ts:167`.
9. Run the tests and the build. Check the output of `npm run build` for type errors.

## Tests

- `lru.test.ts`: a set beyond the limit evicts the least recently used entry; a `get` refreshes it; `size` never exceeds the limit.
- `src/analysis/index.test.ts`: with `installFakeWorker`, at most 3 requests are in flight at any time, and `analyzeAll` returns results in frame order. Count the in-flight requests in the fake handler.
- A cache test: after the limit is passed, the first frame is analysed again (the fake worker records a second request).
- `usePlayer` or `player.test.tsx`: when `analyzeChange` rejects, the trace button stays disabled, and the page shows the reason in text (role or text query). `await expectNoA11yViolations` on the page.
- The existing tests for analysis, Listen, Compare and Explore pass with no change to their expectations.

## Guardrails

Not applicable: no sound or visual change. The same input gives the same features, sound and analysis results, which the golden tests check. The new message on a failed trace is text, not sound.

## Done when

- `grep -rn "as T\b\|ChangeVisualization\|ChangeFrame" src` prints nothing.
- No `Map` cache in `src/analysis` or `src/features/explore` grows without a limit.
- `analyzeAll` never has more than 3 frames in flight (test).
- The golden tests (`src/data/sound-regression.test.ts`, `src/data/change-regression.test.ts`) pass with no change.
- `npm run lint && npm test && npm run build` pass.
- The team leader and Mohammad have reviewed their parts.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/analysis src/data src/features/player src/features/explore src/features/compare
```

## Out of scope

- The shared hooks (I07): the analysis effect is moved there, after this ticket.
- Measuring memory in a browser. Note the peak in `docs/performance.md` if you measure it.
- Any change to the sound or to the change maths.

## Result

Not started.

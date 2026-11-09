# F48 Region picker

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | I06 |
| **Hotspots** | player, compare, schema |
| **Branch** | `feature/F48-region-picker` |

## Goal

A data set with more than one region in its manifest lets the listener choose one. Listen has a region picker. Compare plays each predefined comparison in its own region, and its custom pairs use the region the listener chose. The rule that only the first region can be used is removed. The Listening test keeps the first region, and it says so.

## Why

- Only the first region is ever used. Each of these reads `regions[0]`:
  - `src/features/player/usePlayer.ts:52`;
  - `src/features/compare/index.tsx:46` (destructured) and `:72`;
  - `src/features/compare/TestMode.tsx:65`;
  - `src/features/about/index.tsx:18`;
  - `src/features/ask/facts.ts:60`.
- `src/data/schema.ts:155` to `:161` enforces it: a comparison's `regionId` must be `regions[0].id`, with the message "Compare and the listening test use the first region only". That rule is what the schema says, and it is the thing to remove.
- The schema already checks that each comparison names a real region (`schema.ts:158`). The types are fine: `Comparison.regionId` (`src/data/types.ts:93`) and `regions: Region[]` (`types.ts:122`).
- Regions are in every manifest that has them. `synthetic-ocean` uses `open-ocean` for three comparisons, and `synthetic-globe` uses `north-east-patch` (`public/data/*/manifest.json`).

## Reuse

- `hashFor(page, params)` and `parseHash` in `src/route.ts`: the picker's choice goes into the address as `region=<id>`, the same way `data=` works.
- `DatasetPicker` (`src/components/DatasetPicker.tsx`) as the model for a labelled picker. It is a list of options with a visible label.
- `Notice` for "This region is not in the data set".
- The analysis functions in `src/analysis/index.ts`, which take a `region` argument already.

## Design

- **`primaryRegion(visualization): Region`** in a new file `src/data/regions.ts`, exported from `src/data/index.ts`. It returns `visualization.regions[0]`. Build this first: every current use of `regions[0]` (see Why, and `docs/PLAN.md` §4 says `src/data/` belongs to Dhruv) calls it, so the later change is one edit per file.
- **`regionFor(visualization, id: string | null): Region`**: the region with that id, or `primaryRegion` when the id is missing or unknown.
- **Listen.** A `<label>` "Region" and a `<select>` of the regions' names, shown only when there are two or more. The choice is `region=<id>` in the address. Changing it restarts the analysis for that region. The page's heading stays the same.
- **Compare.** A predefined comparison plays `comparison.regionId`. A custom pair (`CUSTOM`, `src/features/compare/index.tsx:20`) uses the region the listener chose with the same picker. The region's name is shown in the comparison's caption.
- **Listening test (`TestMode.tsx`).** Uses `primaryRegion`. It shows only the comparisons whose `regionId` is the primary region, and says how many there are. If there are none, it says so and does not start.
- **About and Ask.** Use `primaryRegion`. Their text says "the first region" where it names one.
- **Schema.** Remove the rule at `schema.ts:155` to `:161` that forces `regionId` to be `regions[0].id`. Keep the check that the region exists. Document the change in `docs/data-sources.md` under "Manifest fields", because the rule changes what a manifest may say (`.claude/rules/phases.md`).
- **Analysis cache.** Check that the cache keys in `src/analysis/index.ts` include the region id. If they do not, add it, or the second region shows the first region's numbers. This is the team leader's file.

## Touches

- `src/data/regions.ts` (new), `src/data/index.ts`, `src/data/schema.ts`, `src/data/schema.test.ts`, `docs/data-sources.md`. Review: Dhruv.
- `src/features/player/usePlayer.ts`, `src/features/player/index.tsx`, the player tests. Review: Mohammad. `usePlayer.ts` is replaced by the v3 work (SN07): keep the change small and keep the exports.
- `src/features/compare/index.tsx`, `TestMode.tsx`, the compare tests. Review: Mohammad.
- `src/features/about/index.tsx`, `src/features/ask/facts.ts`. Review: Roni (about) and Mohammad (ask).
- `src/analysis/index.ts`, only for the cache key. Review: the team leader.

## Steps

1. Add `src/data/regions.ts` with `primaryRegion` and `regionFor`, and their tests. Export them from `src/data/index.ts`.
2. Replace the five uses of `regions[0]` with `primaryRegion(...)` (Why). Run the tests. Nothing should change. Commit this step on its own within the branch.
3. Add the region picker to Listen. Read `region` from the route. Use `regionFor` to pick the region. Pass the region into `usePlayer` (an option, with the default `primaryRegion`).
4. Add the picker to Compare, as described in Design.
5. In `TestMode.tsx`, filter the comparisons to the primary region, and show the count.
6. Remove the schema rule and update the schema test. Update `docs/data-sources.md`.
7. Check the cache keys (Design). Fix if needed.
8. Add the tests below.
9. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

- `regions.test.ts`: `primaryRegion` returns the first; `regionFor` returns the one with the id, or the first when the id is missing or unknown.
- `schema.test.ts`: a manifest whose comparison uses the second region is accepted. A comparison that names an unknown region is still rejected.
- Listen (`player.test.tsx`): with the fixture modified to have two regions, the picker appears, with its label "Region" (query by role `combobox`). Choosing the other region changes `region=` in the address (`window.location.hash`). The picker is absent when there is one region.
- Compare (`compare.test.tsx`): a predefined comparison in the second region is analysed for that region (check the call to `analyzeAll` through a mock, with the region id).
- Listening test (`test-mode.test.tsx`): only comparisons in the primary region are listed. With none, a sentence says so.
- `await expectNoA11yViolations(container)` with the picker shown.
- The existing tests for the fixture (one region) pass unchanged.

## Guardrails

- The sound follows the region the listener chose. The same rules apply to every region: the sound and the picture stay the same for the same input.
- The picker is a native `<select>` with a visible label. Nothing flashes or moves.
- No sound plays before a click or key press. Changing the region does not start the sound by itself.

## Done when

- A manifest with two regions shows the picker on Listen, and the choice is in the address.
- Compare plays each predefined comparison in its own region, and custom pairs in the chosen one.
- The listening test uses the primary region only, and says how many comparisons it has.
- The schema no longer forces `regionId` to be the first region. The fixture and the synthetic data sets still pass `npm run check-data`.
- `npm run lint && npm test && npm run build` pass, and `npm run check-data` passes.
- Dhruv, Mohammad, and the team leader (for the cache key) have reviewed their parts.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
npx vitest run src/data src/analysis src/features/player src/features/compare src/features/about src/features/ask
```

## Out of scope

- A region picker on the sound map (Explore). Its region is the map area.
- Drawing region outlines on the map (a separate change to `Viewer.tsx`).
- Choosing regions in the listening test. The test uses the primary region on purpose.

## Result

Not started.

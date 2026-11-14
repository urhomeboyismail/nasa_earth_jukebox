# UI10 Compare: a written and sounded summary of what changed from A to B

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | compare |
| **Branch** | `feature/UI10-compare-summary` |

## Standalone

It builds on Compare as it is on `main`, where each date is described on its own (`src/features/compare/index.tsx:292`). It does not wait for any other ticket.

## Goal

Under the two dates, a "What changed" summary says in one or two sentences how B differs from A: the overall direction, the region that changed most, and by how much in the manifest's words and unit. A "Hear the change" button plays A's value then B's for that region.

## Why

- The master prompt asks for "an automated delta summary (audio + text)" in Compare.
- Compare describes A and B separately (`index.tsx:292`). The listener has to hold both sentences in mind and subtract.
- The words for a change already exist: `describeChange` and `signedValue` (`src/describe/change.ts:15`, `:45`), and `higherPhrase` and `variableWords` (`src/data`).

## Design

- `src/describe/compare.ts` (pure): `describeDelta(visualization, a, b, options): string` from the two frames' `FrameAnalysis`.
  - Overall: the mean value's change, signed with the unit ("Overall 1.2 °C warmer").
  - The largest regional change by absolute value, using the manifest's regions ("most in the north-east, 3.4 °C").
  - "Little change" below the manifest's `changeSteps` first step (or 2% of the range when it has none).
  - It respects `useDescriptionDetail` (concise: one sentence).
- `index.tsx`: a "What changed" `Card` under the dates showing that text. It is announced through `useAnnounce` when either date changes (debounced by the announcer). Next to it, "Hear the change" plays two notes through the existing engine (`useSoundEngine`) for that region, A then B, with the existing pan.

## Reuse

`describeChange`, `signedValue`, `higherPhrase`, `variableWords`, `regionFor`, `useDescriptionDetail`, `useFrameAnalysis`, `useSoundEngine`, `Card`, `Button`.

## Touches

- `src/describe/compare.ts` and `compare.test.ts` (new)
- `src/features/compare/index.tsx`, `compare.test.tsx`

## Steps

1. `describeDelta` with tests on `synthetic-change` and `fixture`.
2. The card, the announcement and the button.

## Tests

- `compare.test.ts`: a known warming gives the signed overall and the right top region; equal frames give "Little change"; concise is one sentence.
- `compare.test.tsx`: choosing two dates shows and announces the summary; "Hear the change" plays two notes (fake engine); `expectNoA11yViolations`.

## Guardrails

The template's guardrails, and:

- No sound before the button. The summary is the text equivalent of the two notes.
- Nothing specific to one data set in `src/`: units, words and regions come from the manifest.

## Done when

- Comparing two dates shows, announces and can sound what changed. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Two data sets (that is Remix, UI09). The change style itself.

## Result

Branch `feature/UI10-compare-summary`.

```
npm run lint   -> oxlint, no warnings or errors
npm test       -> Test Files 214 passed (214); Tests 3089 passed (3089)   (before the last test-mock typing fix)
npm run build  -> tsc -b clean; vite build: built in 1.45s (only the usual chunk-size notice)
npx vitest run src/features/compare -> Tests 98 passed (98)               (after the typing fix)
```

What was built
- `src/describe/compare.ts`: `describeDelta`, `deltaBetween`, `littleChange`. Overall change = mean of the per-region changes; the biggest change is the region with the largest size. Words, unit and place names come from the manifest.
- Compare: a "What changed" card (text plus a "Hear the change" button: the top region's note for A, then for B, panned with `panFor`). Dates A and B are read in every region by `analyzeAll` (cached), so the page's own analysis is unchanged.

Decisions to check
- "Little change" threshold: the top of the near-normal change step (the step that holds 0) when the manifest has `changeSteps`, else 2% of the colour scale's range. The ticket's "first step" would be the most-below-normal step, which is not a sensible limit.
- A ready-made comparison's card appears only after "Reveal the answer" (it would give the answer away) and is not announced then, so it does not talk over the result. For the listener's own dates it shows at once.
- The announcement waits one announcer gap (1.6 s) after a date changes, so the slider's own "Date A: …" message is spoken first and is not replaced.
- `region.test.tsx` (not in Touches): its `lastRegionAnalysed` helper now looks at the page's read of every date, because the summary adds reads of dates A and B per region. One line, no behaviour change.

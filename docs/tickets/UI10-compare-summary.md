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

Filled in by the agent.

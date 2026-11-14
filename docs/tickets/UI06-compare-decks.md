# UI06 Compare and Remix as two glass decks, with a dual-handle date scrubber

| | |
|---|---|
| **Priority** | P3 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | UI01 |
| **Hotspots** | compare |
| **Branch** | `feature/UI06-compare-decks` |

## Goal

Compare (two dates) and its "Two data sets" mode (Remix, built as Fusion) look like two glass decks with a crossfader between them, and both dates can be set from one shared scrubber with two handles.

## Why

- Remix exists as Fusion: two decks and a crossfader (`src/features/compare/Fusion.tsx:126`, `:141`). Compare plays two dates (`src/features/compare/index.tsx`). Draft Ticket 6 asks for a dual-deck look and a shared dual-handle scrubber, which doesn't exist.
- A two-thumb slider is hard to make accessible by hand. Radix's Slider supports several thumbs with keyboard and ARIA built in (`UI-OVERHAUL.md` §3).

## Design

- **Decks:** each side is a `.ui-glass` deck with a `.ui-label` ("DECK A", "DECK B"), its frame and the date in mono. The crossfader (`Fusion.tsx:141`) keeps its label and words, restyled as a telemetry fader with A and B at its ends.
- **`RangeSlider`** (new house component, `src/components/RangeSlider.tsx`):
  - wraps `@radix-ui/react-slider` with two thumbs, styled with tokens through `data-*` attributes;
  - each thumb has its own name ("Date A", "Date B") and a value text with the formatted date (`dateFormatterFor`);
  - arrow keys step one date, Page Up and Page Down step five, Home and End go to the ends;
  - the thumbs may not cross (`minStepsBetweenThumbs={1}`).
- In Compare, the scrubber sets the two dates that the existing date choosers set today; both stay in sync. Each change is announced through `useAnnounce` at the existing rate.
- Captions for fused sound keep `fuseFrames` as they are.
- The listening test (`TestMode.tsx`) is **not** restyled here: its fixed questions must not change during a study.

## Reuse

- `Fusion.tsx`, `fuseFrames`, `Slider`, `dateFormatterFor`, `useAnnounce`.
- `.ui-glass`, `.ui-label` and `.ui-pill` (UI01).

## Touches

- `package.json`, `package-lock.json` (`@radix-ui/react-slider`)
- `src/components/RangeSlider.tsx`, `RangeSlider.test.tsx` (new), `src/components/index.ts`, `src/styles/components.css` (its block only)
- `src/features/compare/index.tsx`, `Fusion.tsx`, `compare.css`, `compare.test.tsx`, `Fusion.test.tsx`

## Steps

1. Add `@radix-ui/react-slider` and build `RangeSlider` with its test.
2. Restyle Compare and Fusion as decks.
3. Put the shared scrubber into Compare, wired to the two dates.

## Tests

- `RangeSlider.test.tsx`:
  - two sliders found by name;
  - keys move each thumb as specified;
  - the thumbs never cross;
  - value text is the date;
  - `expectNoA11yViolations`.
- `compare.test.tsx`: moving "Date A" changes deck A's date and is announced; the old date choosers stay in sync.
- `Fusion.test.tsx` and `test-mode.test.tsx` pass unchanged.

## Guardrails

- The template's guardrails. The listening test is unchanged.

## Done when

- Compare and Remix look like two glass decks in both themes, the shared scrubber works fully by keyboard and screen reader, and every compare test passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- New pairings or `pairsWith` changes (data, not code), a stacked layout (layout is deferred), restyling the listening test.

## Result

Filled in by the agent.

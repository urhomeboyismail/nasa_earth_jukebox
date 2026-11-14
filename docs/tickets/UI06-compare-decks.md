# UI06 Compare and Remix as two glass decks, with a dual-handle date scrubber

| | |
|---|---|
| **Priority** | P3 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | compare |
| **Branch** | `feature/UI06-compare-decks` |

## Standalone

Built on Compare and Fusion as they are on `main` (`src/features/compare/`). It does not wait for any other ticket and adds the one new component it needs (`RangeSlider`).

## Goal

Compare (two dates) and its "Two data sets" mode (Remix, built as Fusion) look like two glass decks with a crossfader between them, and both dates can be set from one shared scrubber with two handles.

## Why

- Remix exists as Fusion: two decks and a crossfader (`src/features/compare/Fusion.tsx`). Compare plays two dates (`src/features/compare/index.tsx`). A dual-deck look and a shared dual-handle scrubber don't exist.
- A two-thumb slider is hard to make accessible by hand. Radix's Slider supports several thumbs with keyboard and ARIA built in (`docs/planning/UI-OVERHAUL.md` §3).

## Design

- **Decks:** each side is a glass deck with a mono label ("DECK A", "DECK B"), its frame and the date in mono. The crossfader in `Fusion.tsx` keeps its label and words, restyled as a fader with A and B at its ends.
- **`RangeSlider`** (new house component, `src/components/RangeSlider.tsx`):
  - wraps `@radix-ui/react-slider` with two thumbs, styled with tokens through `data-*` attributes;
  - each thumb has its own name ("Date A", "Date B") and a value text with the formatted date (`dateFormatterFor`);
  - arrow keys step one date, Page Up and Page Down step five, Home and End go to the ends;
  - the thumbs may not cross (`minStepsBetweenThumbs={1}`).
- In Compare the scrubber sets the same two dates the existing date choosers set; both stay in sync. Each change is announced through `useAnnounce` at the existing rate.
- `fuseFrames` and the captions for fused sound stay as they are.
- The listening test (`TestMode.tsx`) is **not** restyled: its fixed questions must not change during a study.

Write the glass as a local class in this feature's CSS, on the existing `--md-sys-color-*` tokens: a translucent `surface-container` with `backdrop-filter: blur(24px)`, a 1 px lit top edge, and a solid `surface-container-high` with a 2 px outline under `prefers-contrast: more`, `prefers-reduced-transparency: reduce` and `@supports not (backdrop-filter: blur(1px))`. If `.ui-glass`, `.ui-pill` and `.ui-label` already exist in `src/styles/components.css` on `main` when you start, use them instead and write no local copy. Do not edit `tokens.css`, `components.css` or `index.css` (the `theme` hotspot).

## Reuse

- `Fusion.tsx`, `fuseFrames`, `Slider`, `dateFormatterFor`, `useAnnounce`.

## Touches

- `package.json`, `package-lock.json` (`@radix-ui/react-slider`)
- `src/components/RangeSlider.tsx`, `RangeSlider.test.tsx` (new), `src/components/index.ts`
- `src/features/compare/index.tsx`, `Fusion.tsx`, `compare.css`, `compare.test.tsx`, `Fusion.test.tsx`
- The range slider's own CSS goes in `compare.css` or a new `src/components/range-slider.css`, not `components.css`.

## Steps

1. Add `@radix-ui/react-slider` and build `RangeSlider` with its test.
2. Restyle Compare and Fusion as decks.
3. Put the shared scrubber into Compare, wired to the two dates.

## Tests

- `RangeSlider.test.tsx`: two sliders found by name; keys move each thumb as specified; the thumbs never cross; value text is the date; `expectNoA11yViolations`.
- `compare.test.tsx`: moving "Date A" changes deck A's date and is announced; the old date choosers stay in sync.
- `Fusion.test.tsx` and `test-mode.test.tsx` pass unchanged.

## Guardrails

The template's guardrails, and:

- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`); colours and text come from the manifest.
- No sound before a click or key press. Nothing flashes. Every sound has a text equivalent.

- The listening test is unchanged.

## Done when

- Compare and Remix look like two glass decks in both themes, the scrubber works fully by keyboard and screen reader, and every compare test passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- New pairings or `pairsWith` changes (data, not code), a stacked layout (layout is deferred), restyling the listening test.

## Result

Filled in by the agent.

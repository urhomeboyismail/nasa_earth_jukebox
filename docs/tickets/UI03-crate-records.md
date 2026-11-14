# UI03 Vinyl Crate in glass, with a 10-second preview of the data

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/UI03-crate-records` |

## Standalone

Built on the Crate that is on `main` today (`src/features/home/Crate.tsx`). It adds no dependency on another open ticket and touches only `src/features/home/`.

## Goal

Home's Crate shows each data set as a record in a glass sleeve: artwork made from its own data, pills, and a "Play 10 seconds" preview that plays the data set's own sound.

## Why

- The Crate already does search, "Saved on this device", the recent row and save/remove (`src/features/home/Crate.tsx`). It is a plain list.
- The UI blueprint lists "no Play 10 seconds button" as not built (`docs/planning/UIUX-BLUEPRINT.md:15`).
- `playSample` (`src/features/player/soundSample.ts`) plays five notes of a style, not the data. A preview built on it would sound like data but isn't. The preview must play the data set's own frames.

## Design

- **Record card:** a glass sleeve holding a disc. The disc's label is the data set's colour scale as a conic gradient, ringed in its accent (`mascot.accent`, `src/data/schema.ts`, chosen as `src/features/mascot/accent.ts` does). The disc is decoration (`aria-hidden`); the card's text says everything:
  - title (as a heading);
  - summary;
  - a pill row: "Saved on this device" when saved, and the number of dates;
  - buttons "Play 10 seconds", "Open in Listen" (the existing `hashFor('listen', …)` link), and Save/Remove.
- **Recent row:** pill links, as today, restyled. **Saved filter:** the existing checkbox, styled as a pill switch.
- **Preview:**
  - On click, load the manifest (`loadVisualization`, `src/data/index.ts`) and analyse the first frames (`analyzeAll`, `src/analysis/index.ts`).
  - Play them through the ensemble as the Listen page does, at Fast speed, for at most 10 s.
  - While loading the button says "Preparing…"; while playing it says "Stop preview". Announce "Preview of <title>, 10 seconds" at the start and "Preview ended" at the end.
  - One preview at a time; leaving Home stops it. No autoplay.
  - The logic is a helper, `src/features/home/preview.ts`, that imports from the player and analysis modules and never edits them.
- The catalogue is still read through `loadCatalog` and `catalogSchema`, unchanged.

Write the glass as a local class in this feature's CSS, on the existing `--md-sys-color-*` tokens: a translucent `surface-container` with `backdrop-filter: blur(24px)`, a 1 px lit top edge, and a solid `surface-container-high` with a 2 px outline under `prefers-contrast: more`, `prefers-reduced-transparency: reduce` and `@supports not (backdrop-filter: blur(1px))`. If `.ui-glass`, `.ui-pill` and `.ui-label` already exist in `src/styles/components.css` on `main` when you start, use them instead and write no local copy. Do not edit `tokens.css`, `components.css` or `index.css` (the `theme` hotspot).

## Reuse

- `loadCatalog`, `loadVisualization`, `analyzeAll`, and the ensemble the player uses (read the player to find the music-frame step; don't copy it).
- `src/features/home/recent.ts`, `src/data/offline.ts` (save state), `hashFor`. `Button`, `useAnnounce`.

## Touches

- `src/features/home/Crate.tsx`, `home.css`, `Crate.test.tsx`
- `src/features/home/preview.ts`, `preview.test.ts` (new)

## Steps

1. Restyle the list as record cards; keep the semantics: a `ul` of cards with headings, real buttons and links.
2. Build `preview.ts`: load, analyse the first frames, play at most 10 s, stop, dispose. One preview at a time.
3. Wire the button, its states and the announcements.

## Tests

- `Crate.test.tsx`: cards are found by heading; "Play 10 seconds" changes to "Preparing…", then "Stop preview", and announces; a second preview stops the first; leaving the page stops it; `expectNoA11yViolations` with a preview playing.
- `preview.test.ts`: with the fixture data set and the sound engine's fake, it plays only the first frames, stops by 10 s (fake timers), and disposes.

## Guardrails

The template's guardrails, and:

- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`); colours and text come from the manifest.
- No sound before a click or key press. Nothing flashes. Every sound has a text equivalent.

- The preview is the data's own sound.

## Done when

- The Crate looks like a crate of records in both themes. Every record previews its own data for up to 10 seconds by keyboard, and every existing Crate test passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A cover-flow carousel (layout is deferred), new cache tiers, `tracks.json`.

## Result

Filled in by the agent.

# UI03 Vinyl Crate in glass, with a 10-second preview of the data

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | UI01 |
| **Hotspots** | — |
| **Branch** | `feature/UI03-crate-records` |

## Goal

Home's Crate shows each data set as a record in a glass sleeve: artwork made from its own data, mono pills, and a "Play 10 seconds" preview that plays the data set's own sound. Muninn's glass cards and pills are the model.

## Why

- The Crate already does search, "Saved on this device", the recent row and save/remove (`src/features/home/Crate.tsx:14`, `:40`, `:67`, `:78`). It is a plain list (`:85`). The drafts and Muninn's `ResurfacingCard.tsx` (glass card, mono badge, footer row) want records.
- The blueprint lists "no Play 10 seconds button" as not built (`docs/planning/UIUX-BLUEPRINT.md:15`).
- `playSample` (`src/features/player/soundSample.ts:21`) plays five notes of a style, not the data. A preview built on it would sound like data but isn't, which is the same mistake as Muninn's decorative `Waveform.tsx`. The preview has to play the data set's own frames.

## Design

- **Record card:** a `.ui-glass` sleeve holding a disc. The disc's label is the data set's colour scale drawn as a conic gradient, ringed in its accent (`mascot.accent`, `src/data/schema.ts:130`, chosen as `src/features/mascot/accent.ts` does). The disc is decoration (`aria-hidden`); the card's text says everything:
  - title (Title role);
  - summary;
  - a `.ui-pill` row: "Saved on this device" when saved, and the number of dates;
  - buttons "Play 10 seconds", "Open in Listen" (the existing `hashFor('listen', …)` link), and Save/Remove.
- **Recent row:** `.ui-pill` links, as today (`Crate.tsx:68-70`), restyled. **Saved filter:** the existing checkbox, styled as a pill switch.
- **Preview:**
  - On click, load the manifest (`loadVisualization`, `src/data/index.ts:61`) and analyse the first frames (`analyzeAll`, `src/analysis/index.ts:161`).
  - Play them through the ensemble, as the Listen page does, at Fast speed, for at most 10 s.
  - While loading, the button says "Preparing…". While playing it is "Stop preview". Start and end are announced ("Preview of <title>, 10 seconds", then "Preview ended").
  - One preview at a time; leaving Home stops it. No autoplay.
  - The preview logic is a helper in `src/features/home/preview.ts`. It imports from the player and analysis modules but never edits them.
- The catalogue is still read through `loadCatalog` and `catalogSchema` (`src/data/schema.ts:315`), unchanged.

## Reuse

- `loadCatalog`, `loadVisualization`, `analyzeAll`, and the ensemble the player uses (read the player to find the music-frame step; don't copy it).
- `src/features/home/recent.ts`, `src/data/offline.ts` (save state), `hashFor`.
- `.ui-glass`, `.ui-pill` and `.ui-label` (UI01). `Button`, `useAnnounce`.

## Touches

- `src/features/home/Crate.tsx`, `home.css`, `Crate.test.tsx`
- `src/features/home/preview.ts`, `preview.test.ts` (new)

## Steps

1. Restyle the list as record cards; keep the semantics: a `ul` of cards with headings and real buttons and links.
2. Build `preview.ts`: load, analyse the first frames, play at most 10 s, stop, dispose. One preview at a time.
3. Wire the button, its states and the announcements.

## Tests

- `Crate.test.tsx`:
  - cards are found by heading;
  - "Play 10 seconds" changes to "Preparing…", then "Stop preview", and announces;
  - a second preview stops the first;
  - leaving the page stops it;
  - `expectNoA11yViolations` with a preview playing.
- `preview.test.ts`: with the fixture data set and the sound engine's fake, it plays only the first frames, stops by 10 s (fake timers), and disposes.

## Guardrails

- The template's guardrails. No sound before a click. The preview is the data's own sound.
- Nothing specific to one data set in `src/`: colours come from the manifest.

## Done when

- The Crate looks like a crate of records in both themes. Every record can preview its own data for up to 10 seconds by keyboard, and every existing Crate test still passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A cover-flow carousel (layout is deferred), new cache tiers, `tracks.json`.

## Result

Filled in by the agent.

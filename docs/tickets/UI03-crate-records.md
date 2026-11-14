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

Built on `feature/UI03-crate-records` (agent D, 2026-11-14). Files changed: `src/features/home/Crate.tsx`, `home.css`, `Crate.test.tsx`, and new `preview.ts`, `preview.test.ts`. Nothing else.

**What it does**

- Each data set is a record: a glass sleeve (local CSS on the `--md-sys-color-*` tokens, solid and outlined under `prefers-contrast: more`, `prefers-reduced-transparency: reduce` and without `backdrop-filter`), with a disc whose label is the colour scale as a conic gradient, ringed in `mascotTheme(...).accent`. The disc is `aria-hidden`. Title is a heading; pills show "Saved on this device" and the date count; buttons are "Play 10 seconds", "Open in Listen" and Save/Remove. The recent row is pill links and the saved filter is a pill switch (still a real checkbox).
- `.ui-glass`, `.ui-pill` and `.ui-label` do not exist in `components.css` on `main`, so the glass is a local copy, as the ticket says. `tokens.css`, `components.css` and `index.css` are untouched.
- The preview reads the data set's own checked frames with `FrameSequenceSource` (the reader Listen uses when there is no video), turns each into a `MusicFrame` with `toMusicFrame`, and plays it with `createEnsemble`, at Fast speed, for at most 10 s counted from the first sound. If the frames run out first it ends 0.5 s after the last one. It uses the listener's saved style, bass and muted voices, and the manifest's voices and timbre.
- Button states: "Play 10 seconds" → "Preparing…" → "Stop preview". Announced: "Preview of <title>, 10 seconds." and "Preview ended.". One preview at a time; leaving Home stops it; nothing sounds before a press.
- Manifests are loaded once per page (`loadManifest`, cached, retried after a failure) to paint the discs and to play the preview.

**Deviations to review**

1. The ticket says to analyse the first frames with `analyzeAll`. That gives per-frame categories, not the `FrameFeatures` the ruleset and ensemble need, so the preview uses `FrameSequenceSource` (analysis module, called not edited) instead.
2. The "Open" link is now "Open in Listen" and its accessible name is "Open in Listen: <title>" (it must contain the visible words, WCAG 2.5.3). The one existing assertion that looked it up as "Open <title>" was changed to the new name. No other existing Crate test changed.

**Checks**

```
npx oxlint src/features/home                 -> exit 0, no findings
npx vitest run --pool=forks --maxWorkers=1 src/features/home
  Test Files 3 passed (3), Tests 39 passed (39)      (preview.test.ts: 15, Crate.test.tsx: 17, 10 of them new; home.test.tsx: 7)
npx vitest run --pool=forks --maxWorkers=1   (whole suite)
  Test Files 1 failed | 206 passed (207), Tests 4 failed | 2983 passed (2987)
  The 4 failures are all src/features/compare/Fusion.test.tsx (see below).
npm run lint   -> 2 errors, both src/sonify/fuse.ts:31 and :39 (consistent-type-assertions), a file this ticket does not touch
npm run build  -> fails in tsc: Fusion.tsx / fusion.ts casing clash (below); no error in any file of this ticket
```

The `Fusion` failures and the build error come from `src/features/compare/` holding both `Fusion.tsx` and `fusion.ts` (and `Fusion.test.tsx`): on this case-insensitive Windows checkout `./Fusion` resolves to `fusion.ts`, so `Fusion` is not exported. They are on `main` as it is, in files outside this ticket's Touches; I did not change them. `npm run lint` fails on `fuse.ts` for the same reason: unchanged by this ticket. `npm run build` therefore could not be shown passing here; CI on Linux should be checked.

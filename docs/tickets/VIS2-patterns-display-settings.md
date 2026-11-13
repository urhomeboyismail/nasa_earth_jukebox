# VIS2 Colour-vision patterns and display settings

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app, explorer |
| **Branch** | `feature/VIS2-patterns-display-settings` |


## Goal

Two things a listener can switch on, and remember, without changing the data or the sound:

1. **Colour-vision patterns.** Six patterns that differ without colour, drawn over the sound map and in the legend, one per category and one for missing data.
2. **Display settings.** An easier-to-read font (Atkinson Hyperlegible, served from this site) and a high-contrast scheme: yellow and cyan on black, used only on black.

## Why

- The map's colours are the only key to the categories (`src/components/Legend.tsx`). A listener who cannot tell two colours apart has no other key. Patterns are the key without colour.
- There is no display setting (the archived T101) and no pattern (archived T102). The specs are in `docs/archive/PRE-HACKATHON-TICKETS.md` at lines 582-636. This ticket keeps their rules and takes out two parts (below).
- Roboto Flex is shipped in `public/fonts/` with its licence, but nothing loads it (VIS3 fixes that).

**Not in this ticket:** the single-column layout from T101 (its "tunnel vision" flag). It is a layout change, and `.claude/rules/platform.md` defers all layout to the team lead's pass. The voice-guide path to these settings (T103) is also not here.

## Design

**Flags.** `src/display/flags.ts` holds the names and defaults in one list: `readable` (false), `highContrast` (false), `patterns` (false). `src/display/useDisplaySettings.ts` reads and writes `earth-jukebox:display` through zod, with a try/catch so that blocked storage still works for the visit. With nothing stored, `highContrast` follows `prefers-contrast: more`. A provider near the root (`DisplaySettingsProvider`) gives `{ flags, setDisplay(changes), reset() }`. `setDisplay` is the only setter. Each change is announced politely ("High contrast on.") through `useAnnounce`.

**Classes.** The flags add `display-readable`, `display-high-contrast` and `display-patterns` to `document.documentElement`. These are new names; the archived T101 names are not used.

**Readable.** `public/fonts/AtkinsonHyperlegible-Regular.woff2` and `-Bold.woff2`, Latin subset, at most 100 KB together, with the licence file beside them (`OFL-AtkinsonHyperlegible.txt`). Get them from the official release (Braille Institute, or the Google Fonts project), and record the source URL, the version and the SHA-256 of each file in `docs/data-sources.md`. The licence is believed to be SIL Open Font License 1.1: check the licence text in the release and write what it says. No CDN. `@font-face` with `font-display: swap`. Under `.display-readable`, the body font becomes Atkinson Hyperlegible and the body line height becomes 1.6. The font is requested only when the class is on, because the rule that names it is under the class.

**High contrast.** A block in a new file `src/styles/display.css`, loaded from `src/index.css`. Under `.display-high-contrast`: background #000, text #fff (21:1), focus rings #ffe600 (16.6:1 on black), selected and pressed states #00ffff (16.8:1 on black), borders at least 3 px. The two accents are used only on black surfaces, never on white, and never on each other. The map image is not recoloured. The explorer's light and dark ring stays (VIS1 and T92 rules).

**Patterns.** `src/components/PatternLayer.tsx` (new): six SVG `<pattern>`s, stroke only, so they are safe in greyscale by construction. By the category's rank in the mapping, from the coolest: rank 0 wide diagonal lines, rank 1 narrow diagonal lines, rank 2 crosshatch, rank 3 small dots, rank 4 large dots; not enough data: a wavy line. A rank above 4 uses large dots, and the test says so. Under high contrast the strokes are white with a black outline.
- The layer is drawn over the explorer's grid, one `<rect>` per cell, with `fill="url(#…)"`, when `patterns` is on and the explorer is on. With the explorer off, the legend still shows the patterns, and the map says "Turn on Explore the map to see the patterns."
- The layer is `aria-hidden="true"`. The categories are already said in words by the explorer.
- `Legend.tsx` shows the matching pattern next to each category's colour when `patterns` is on.

**The analysis never reads the overlay.** The worker decodes the frame file itself. The overlay is an SVG in the page. A test checks that the grid read is the same with patterns on and off.

**The control.** A "Display" button in the header (`src/App.tsx`; 44 by 44 px touch target, `aria-expanded`). It opens a panel with three switches ("Easier reading font", "High contrast", "Colour-vision patterns") and "Reset display". Escape closes the panel and returns focus to the button. It works by keyboard alone.

## Reuse

- `src/components/Legend.tsx` (add the pattern swatch), `src/components/components.test.tsx`.
- `src/styles/tokens.css` (the tokens stay; the high-contrast block overrides them under its class only).
- `src/styles/tokens.test.ts`: extend it, do not replace it.
- `src/features/explore/Explorer.tsx`: the grid from `useExplorer`.
- `src/components/useAnnounce.ts`, `src/components/Button.tsx`.
- Archived T101 and T102 text (`docs/archive/PRE-HACKATHON-TICKETS.md:582-636`) for the rules.

## Touches

- `src/display/` (new): `flags.ts`, `useDisplaySettings.ts`, `DisplaySettings.tsx`, `display.test.tsx`.
- `src/styles/display.css` (new), `src/index.css` (one import line, `@font-face` for Atkinson Hyperlegible).
- `src/styles/tokens.test.ts`: the contrast checks for the high-contrast pairs.
- `src/components/PatternLayer.tsx` (new), `Legend.tsx`, `components.test.tsx`.
- `src/features/explore/Explorer.tsx`, `Explorer.test.tsx` (the layer).
- `src/App.tsx`: the header button and the provider (one provider, near the root; the app-level change is small).
- `public/fonts/` (the two WOFF2 files and the licence text), `docs/data-sources.md` (the font entry).

## Steps

1. Write `flags.ts` and `useDisplaySettings.ts` with the tests for each flag, the combinations, the storage and the system default.
2. Add the classes and the `@font-face`. Add the font files and the licence text; record the source in `docs/data-sources.md`.
3. Write `display.css` with the high-contrast block under its class, and extend `tokens.test.ts` for each pair.
4. Write `PatternLayer.tsx`: the six patterns and the rank mapping, with a test for the six distinct ids.
5. Add the layer to the explorer surface and the pattern swatch to the legend.
6. Add the "Display" button and the panel to the header.

## Tests

- `display.test.tsx`: each flag alone sets its class; the combinations readable + high contrast, readable + patterns, high contrast + patterns, all three; the choice survives a reload; blocked storage still works for the visit; `prefers-contrast: more` turns high contrast on when nothing is stored; "Reset display" clears all.
- `tokens.test.ts`: white on black is at least 4.5:1 (21:1); #ffe600 on black and #00ffff on black are at least 3:1 (focus and borders); the accents never appear on a white surface in the high-contrast block.
- `components.test.tsx`: six pattern ids, all distinct; the category rank maps to the expected pattern; the layer is `aria-hidden`; the legend shows a pattern swatch per category when the flag is on.
- `Explorer.test.tsx`: with patterns on, `analyzeGrid` is called with the same arguments as with them off.
- The font: the file exists and is a WOFF2 under the size budget; `docs/data-sources.md` names its source, version and SHA-256 (a test reads both).
- `expectNoA11yViolations` on the panel, with every switch on and off.

## Guardrails

- The same frame and the same input give the same grid and the same sound. The display settings change only how things look.
- Nothing flashes; the patterns are still.
- Under `prefers-reduced-motion` nothing moves; the settings do not add motion.
- Every pattern has its text: the category's name in the legend and in the explorer's words.
- Changes are announced through `useAnnounce`.
- No data-set name, unit or colour in `src/`. The patterns are general.
- Layout is not checked here (`.claude/rules/platform.md`).

## Done when

- Each switch works by keyboard, is remembered, and is announced when changed.
- The six patterns are distinct and the legend and the map show them when on.
- The grid read is unchanged with every setting.
- The font files are served from this site, with their licence and source recorded.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The single-column layout (T101's "tunnel vision" flag): a layout change, deferred to the team lead's pass.
- The voice-guide path to the settings (T103).
- The dyslexia-coloured background (#F5F2EB) of T101: it is not one of the requested schemes; the request is yellow and cyan on black.
- Any width or layout check.

## Result

Built on `feature/VIS2-patterns-display-settings` (agent E, 2026-11-13).

- `src/display/`: `flags.ts`, `useDisplaySettings.ts` (context, zod-checked storage, `prefers-contrast: more` default), `DisplaySettings.tsx` (`DisplaySettingsProvider` and the header `DisplayButton` with three switches and "Reset display"), `display.test.tsx`.
- `src/styles/display.css` (readable font, high-contrast scheme, pattern strokes, panel), one import and two `@font-face` in `src/index.css`.
- `src/components/PatternLayer.tsx` and `patterns.ts` (six stroke-only patterns, rank mapping), `Legend.tsx` (pattern swatch per category and for missing data).
- `src/features/explore/Explorer.tsx` (layer over the grid; "Turn on Explore the map to see the patterns." when the explorer is off), `src/App.tsx` (provider and header button).
- `public/fonts/AtkinsonHyperlegible-{Regular,Bold}.woff2` (34.7 KB together) and `OFL-AtkinsonHyperlegible.txt`; source, version and SHA-256 in `docs/data-sources.md`.
- **One change outside Touches:** `src/features/explore/useExplorer.ts` now also returns `mapping`, because `ExplorerSurface` needs the category order and the other route (a prop) would edit `src/features/player/index.tsx`, which agent D holds (IX03).

```
npm run lint   -> oxlint, no warnings or errors
npm test       -> Test Files 153 passed (153), Tests 2441 passed (2441)
npm run build  -> tsc -b clean, vite build: built in 719ms
(cd server && .venv/Scripts/python -m pytest -q) -> 296 passed, 2 skipped
```

`public/data/` is unchanged, so `check-data` was not needed. Layout was not checked (platform.md). Not done by a person: the font was not looked at in a browser, and the high-contrast scheme was checked by contrast ratios only.

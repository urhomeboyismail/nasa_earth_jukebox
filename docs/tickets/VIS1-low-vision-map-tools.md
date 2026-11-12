# VIS1 Low-vision map tools: magnifier, big cursor, high-contrast outline, forced colours

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | explorer |
| **Branch** | `feature/VIS1-low-vision-map-tools` |


## Goal

A low-vision listener can see the cursor and the place under it on the sound map: a magnifier lens, a larger cursor with crosshair lines, an outline mode in black and white, and a forced-colours block so Windows High Contrast shows the map's controls. None of these changes what is analysed or sounded.

## Why

- The map cell can be about 12 px on a small screen, and the cursor is a 3 px white outline with a black inset (`src/features/explore/explore.css:20-27`, `min-inline-size: 0.75rem`). A listener with low vision cannot find it.
- The focus ring over the map is a `box-shadow` (`explore.css:14-18`). Forced-colours mode removes `box-shadow`, so the focus is invisible there.
- Nothing in the code uses `forced-colors`. The app's tokens and components never get the system colours.
- No magnifier and no high-contrast map overlay exist (`docs/archive/PRE-HACKATHON-TICKETS.md` T101 and T102 asked for both; this ticket is the map part only).

## Design

- **Magnifier.** `src/features/explore/Magnifier.tsx`: a lens (9rem square, corner radius `--md-sys-shape-corner-large`) next to the cursor, showing the same frame image at 3 times the size. It is a CSS background of the frame's `image`, with `background-size` set to three times the map's size and `background-position` from the cursor's fraction. `image-rendering: pixelated` keeps the cells sharp. The lens is `aria-hidden` and has no transition. It is on or off from a button in `ExplorerPanel`, "Magnifier", with `aria-pressed`, stored under `earth-jukebox:magnifier`.
- **Bigger cursor and crosshair.** The cursor's minimum size goes to 1.25rem. Its outline is a 3 px black outline with a 2 px white inner ring, so it shows on any map colour. Two lines, one across the row and one down the column of the cursor's cell, run the whole length of the map: 2 px white with a 1 px black edge. Both are `aria-hidden` and `pointer-events: none`. The crosshair is on by default.
- **High-contrast outline mode.** A button "High-contrast outline" with `aria-pressed`, stored under `earth-jukebox:map-outline`. When on: the cursor outline is 4 px black with a 2 px white inner ring, and the crosshair lines are solid black with a white edge. Black and white only: yellow and cyan are never placed on the map image (`docs/archive/PRE-HACKATHON-TICKETS.md` T101).
- **Forced colours.** A block in `src/index.css`: `@media (forced-colors: active)` with the explorer's cursor and focus ring drawn with `outline` in `CanvasText` (the box-shadow ring is replaced by an outline, which forced colours keeps), the slider thumb and track in `CanvasText`, the legend's swatches and bar with a `CanvasText` border, and the Viewer's region outline in `CanvasText`. Do not set `forced-color-adjust: none` anywhere.
- **Nothing else changes.** The grid is read exactly as before; the settings only add elements and classes on the surface.

## Reuse

- `src/features/explore/explore.css`: the existing classes (`explorer__surface`, `explorer__cursor`), extended, not replaced.
- `src/features/explore/Explorer.tsx`: `ExplorerSurface` and `ExplorerPanel`.
- `src/features/explore/useExplorer.ts`: `cursor`, `grid`, `area`, the frame's `image`.
- `src/styles/tokens.css`: `--md-sys-shape-corner-large`.
- `src/components/Button.tsx` (`pressed` for `aria-pressed`), `src/components/Slider.tsx`.

## Touches

- `src/features/explore/Magnifier.tsx` (new), `Magnifier.test.tsx`.
- `src/features/explore/Explorer.tsx`, `explore.css`, `Explorer.test.tsx`.
- `src/index.css` (the forced-colours block).
- `src/features/player/Viewer.tsx`: the region outline's stroke class only (for forced colours).

## Steps

1. Write `Magnifier.tsx`: a pure helper for the background position from the cursor's cell (`lensPosition(cell, grid)`), with a test.
2. Add the magnifier, the crosshair and the outline button to `ExplorerSurface` and `ExplorerPanel`. Settings read from and written to `localStorage` with a try/catch.
3. Add the classes for the cursor sizes and the outline mode in `explore.css`.
4. Add the forced-colours block to `src/index.css`. Keep it at the end of the file with a comment naming the rule it serves.
5. Check that the grid read and the sounds are unchanged (a test with the same `analyzeGrid` arguments).

## Tests

- `Magnifier.test.tsx`: the button "Magnifier" toggles `aria-pressed`; the lens is `aria-hidden`; the lens position changes with the cursor cell; the setting survives a remount; blocked storage works for the visit.
- `Explorer.test.tsx`: the crosshair elements are present, `aria-hidden`, and move with the cursor; "High-contrast outline" toggles its class.
- With the magnifier and the outline on, `analyzeGrid` is called with the same arguments as with them off (the read is not changed by the view).
- A test reads `src/index.css` and checks that the `forced-colors: active` block exists and uses `CanvasText`, and that `forced-color-adjust: none` appears nowhere in `src/`.
- `expectNoA11yViolations` on the surface and the panel with both settings on.

## Guardrails

- The same frame and the same input give the same grid and the same sound. These tools only change the view.
- Nothing animates, and nothing flashes. Under `prefers-reduced-motion` the lens and crosshair do not move smoothly (they follow the cursor's cell, which is a step, not a glide).
- The image never animates beyond its own frames.
- Every control has a text name; the lens is decorative and says nothing, because the place is spoken or read with `I` (IX02).
- No data-set name, unit or colour in `src/`.
- Yellow and cyan are never placed on the map (black and white only over the map).

## Done when

- The magnifier, the crosshair and the outline are on or off from buttons, remembered on the device, and hidden from screen readers.
- Under forced colours the cursor, the focus ring, the sliders and the legend swatches all have a visible system-colour edge.
- The grid and the sound are the same with every setting.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The display settings and the high-contrast colour scheme for the whole app (VIS2).
- The colour-vision patterns over the map (VIS2).
- Any layout or size check at a given screen width (`.claude/rules/platform.md`: layout is deferred to the team lead's pass).

## Result

Agent E, 2026-11-12. Magnifier (`Magnifier.tsx`), crosshair, bigger cursor, high-contrast outline and the forced-colours block are built.

Two choices to review:
- `src/features/explore/useExplorer.ts` is not under Touches. One field was added to its return value, `image: frame.image`, because `ExplorerSurface` only receives `explorer` and the magnifier needs the frame's picture. Without it the player (SN07's hotspot) would have had to pass a new prop.
- `src/features/player/Viewer.tsx` is unchanged. The forced-colours block in `src/index.css` styles the region outline through `.player__frame svg rect/circle`, so no class was needed. Its rules start with `:root` so they win over the lazily loaded player and component CSS.

The settings buttons and tests that need the mocked player are in `Explorer.test.tsx`; `Magnifier.test.tsx` holds the component tests and the two CSS checks. Layout was not checked (platform.md).

```
npx vitest run src/features/explore -> Test Files 4 passed, Tests 107 passed (14 new)
npm run lint                        -> clean, no warnings
npm test                            -> Test Files 115 passed (115), Tests 1944 passed (1944)
npm run build                       -> tsc -b && vite build, built in 542ms
```


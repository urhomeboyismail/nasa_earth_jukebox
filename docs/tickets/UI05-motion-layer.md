# UI05 Motion layer (CSS and the Web Animations API, no Anime.js): press, sky, drawer and sweep helpers, Echo's flight

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | tour |
| **Branch** | `feature/UI05-motion-layer` |

## Standalone

A new module, `src/motion/`, plus three one-line hooks into code that is on `main` today. It does not wait for any other ticket. The tour files are in the `tour` hotspot (the tour's start and finish are edited by JB09); this ticket starts when no ticket holds `tour`. It does not edit `src/App.tsx`, the theme files or the player.

## Goal

One small motion module, on CSS keyframes, the browser's Web Animations API (`element.animate`) and `requestAnimationFrame`, with no animation library, gives the app a physical feel: a springy press, an animated sky behind the app, drawer and theme-sweep helpers ready to use, and Echo's tour flight. Under `prefers-reduced-motion` every part of it is still.

## Why

- Muninn's motion is one file of helpers on Anime.js (`frontend/src/lib/animations.ts`). None of them checks reduced motion, so they are ported, not copied, and the master prompt (14 Nov 2026) rules out Anime.js: the ports use `element.animate` instead.
- Our motion is hand-written `requestAnimationFrame` (`src/features/mascot/MascotDock.tsx`, `TourOverlay.tsx`) with its own reduced-motion check (`src/features/mascot/tour.ts`). There is no shared gate.
- The expressions exist (`src/features/mascot/expressionFor.ts`) and so does the flight path (`flightPath.ts`, pure).

## Design

- No new dependency. Springs and elastic eases are `cubic-bezier` or `linear()` easings passed to `element.animate`; anything driven by a value (the flight, the scroll boost) is a `requestAnimationFrame` loop. Nothing is added to Home's first load (`.claude/rules/frontend.md`).
- `src/motion/index.ts`:
  - `reducedMotion()`: true under `prefers-reduced-motion: reduce` or where `matchMedia` is missing. `tour.ts` is changed to use it.
  - `pressRecoil(el)`: scale 0.94 → 1 with an elastic ease, 300 ms.
  - `slideDrawer(el, side, open)`: translate and fade, 240 ms. Exported and tested; wiring it into a drawer belongs to the ticket that builds the drawer.
  - `themeSweep(apply)`: a short horizon sweep, then calls `apply()`. Exported and tested; wiring it to a theme switch belongs to the ticket that builds the switch.
  - `drawPath(svgPath, ms)`: stroke-dashoffset draw.
  - `flyAlong(el, path, ms)`: moves Echo along the tour's SVG path.
  - Every helper returns a promise that resolves when the animation finishes. It is a no-op that resolves at once when `reducedMotion()` or where `element.animate` is missing, and never throws.
- `SkyBackdrop` (`src/motion/SkyBackdrop.tsx`): a fixed, `aria-hidden` canvas behind the app:
  - a slow starfield on dark colour schemes, an atmosphere glow on light ones, at most 30 fps;
  - stops when the tab is hidden (`visibilitychange`);
  - a static gradient under reduced motion, `prefers-reduced-transparency` or `prefers-contrast: more`;
  - drawn at no more than 12% alpha, so text on `--md-sys-color-surface` keeps 4.5:1.
  - It mounts from `src/main.tsx`, not `src/App.tsx`.
- **Hooks into existing parts, each one line:** `Button` calls `pressRecoil` on pointer-down; the tour moves Echo with `flyAlong` where that is simpler than its own frame loop.
- **Scroll boost:** one passive scroll listener with a frame-limited update feeds the dock's existing boost state. No boost under reduced motion.

## Reuse

- `flightPath.ts` (pure, unchanged), `expressionFor.ts`, `useFaceState.ts`, the dock and tour. `Button`.

## Touches

- `src/motion/index.ts`, `SkyBackdrop.tsx`, their tests (new), `src/main.tsx` (mounting the backdrop)
- `src/components/Button.tsx` (one line)
- `src/features/mascot/tour.ts`, `TourOverlay.tsx`, `MascotDock.tsx` (only what moves onto `src/motion/`)

## Steps

1. Write `src/motion/` with the gate and the helpers on `element.animate`.
2. Write `SkyBackdrop`.
3. Wire the press; move the tour flight and scroll boost onto the helpers.

## Tests

- `src/motion/index.test.ts`, with `matchMedia` stubbed and `Element.prototype.animate` spied: under reduced motion every helper resolves at once and never calls `animate`; otherwise each calls it once with the expected keyframes; where `animate` is missing, each resolves quietly.
- `SkyBackdrop.test.tsx`: `aria-hidden`; no animation frame under reduced motion; stops on `visibilitychange` to hidden.
- Existing mascot and tour tests pass. The tour under reduced motion still jumps to each stop.

## Guardrails

The template's guardrails, and:

- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`); colours and text come from the manifest.
- No sound before a click or key press. Nothing flashes. Every sound has a text equivalent.

- Nothing flashes more than 3 times a second; under reduced motion nothing moves. The NASA image is never animated.
- Motion never delays a sound or an announcement: the answer stays within 50 ms (§6.3).

## Done when

- Buttons spring, the sky moves and the tour flies; with reduced motion on, all of it is still. `package.json` gains no dependency.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Anime.js, Framer Motion, Tailwind, a custom cursor, runes, shockwave, motion on the data image, and wiring `slideDrawer` or `themeSweep` into pages that don't have a drawer or switch yet.

## Result

Built on `feature/UI05-motion-layer` (14 Nov, agent D). New: `src/motion/index.ts` (`reducedMotion`, `pressRecoil`, `slideDrawer`, `themeSweep`, `drawPath`, `flyAlong`, all on `element.animate`), `sky.ts` (pure drawing), `SkyBackdrop.tsx`, and their tests. Hooks: `src/main.tsx` mounts `SkyBackdrop`; `Button` calls `pressRecoil` on pointer-down; `tour.ts` takes its reduced-motion check from `src/motion/` (`prefersReducedMotion` is now `reducedMotion`). No dependency added.

Not done, on purpose:
- **Scroll boost.** The dock has no boost state to feed (nothing in `src/` matches "boost"). Asked on the board: R-20261114-UI05-1.
- **Tour flight on `flyAlong`.** The ticket says "where that is simpler". The tour's CSS `offset-path` flight already works and respects reduced motion, so it is unchanged. `flyAlong` is exported and tested for the next user.
- `slideDrawer` and `themeSweep` are exported and tested but not wired (out of scope in the ticket).

Checks:

```
$ npm run lint      -> oxlint, no warnings or errors
$ npm run build     -> tsc -b clean; vite build: built
$ npx vitest run --pool=forks --maxWorkers=1
 Test Files  218 passed (218)
      Tests  3147 passed (3147)
   Duration  752.71s
```

(The default worker count runs out of memory on this 8 GB laptop, hence `--pool=forks --maxWorkers=1`.) Not checked by eye: the sky in a real browser. Under jsdom the canvas is faked, so the look and the 4.5:1 contrast at 12% alpha rest on the alpha cap, which a test checks, not on a screenshot.

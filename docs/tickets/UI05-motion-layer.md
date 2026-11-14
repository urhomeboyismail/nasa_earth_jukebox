# UI05 Motion layer on Anime.js: press, drawers, sky, theme sweep and Echo's flight

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | UI01, JB09 |
| **Hotspots** | — |
| **Branch** | `feature/UI05-motion-layer` |

## Goal

One small motion module, `src/motion/`, built on Anime.js and loaded on demand, gives the app Muninn's physical feel: a springy press, sliding drawers, an animated sky behind the glass, the Night/Day sweep, and Echo's tour flight. Under `prefers-reduced-motion` every part of it is still.

## Why

- Muninn's motion lives in one file of helpers on Anime.js (`frontend/src/lib/animations.ts`: `elasticRecoil`, `slideInDrawer`, `slideOutDrawer`, `drawSvgPath`, `initAtmosphericSky`, `initGalaxyCanvas`). **None of them checks reduced motion**, so they are ported, not copied.
- Our motion is hand-written `requestAnimationFrame` (`src/features/mascot/MascotDock.tsx:142-149`, `TourOverlay.tsx:29`), with its own reduced-motion check (`src/features/mascot/tour.ts:69`). There is no shared gate.
- Draft Ticket 5 asks for the scroll boost, expressions (happy, searching, eq_active, alert) and the tour flight. The expressions exist (`src/features/mascot/expressionFor.ts:24-28`); the flight path exists (JB05, `flightPath.ts`, pure). JB09 (claimed by B) changes `TourOverlay.tsx`, so it lands first.

## Design

- `animejs` is added as a dependency and only ever loaded with `import('animejs')`, so it is never in Home's first load (`.claude/rules/frontend.md`).
- `src/motion/index.ts`:
  - `reducedMotion()`: true under `prefers-reduced-motion: reduce` or where `matchMedia` is missing. `tour.ts:69` is changed to use it.
  - `pressRecoil(el)`: scale 0.94 → 1 with an elastic ease, 300 ms.
  - `slideDrawer(el, side, open)`: translate and fade, 240 ms; resolves at once when motion is reduced.
  - `drawPath(svgPath, ms)`: stroke-dashoffset draw.
  - `flyAlong(el, path, ms)`: moves Echo along JB05's SVG path.
  - Every helper is a no-op that resolves at once when `reducedMotion()`, and never throws (a failed import is no motion).
- `SkyBackdrop` (`src/motion/SkyBackdrop.tsx`): a fixed, `aria-hidden` canvas behind the app:
  - a slow starfield (Night) or atmosphere glow (Day), at most 30 fps;
  - stops when the tab is hidden (`visibilitychange`);
  - a static gradient under reduced motion, `prefers-reduced-transparency`, or `prefers-contrast: more`;
  - never brighter than the tokens allow for text over glass (UI01's test colours).
- **Hooks into existing parts, each one line:**
  - `Button` calls `pressRecoil` on pointer-down;
  - UI04's mixer drawer uses `slideDrawer`;
  - `ThemeSwitch` (UI01) runs a short horizon sweep (Muninn's `CelestialAtmosphereTransition`) before setting `data-theme`;
  - the tour moves Echo with `flyAlong` instead of its own frame loop, where that is simpler.
- **Scroll boost:** reads scroll speed with one passive listener and a frame-limited update, and feeds the existing dock's boost state. Under reduced motion there is no boost.

## Reuse

- `flightPath.ts` (pure, unchanged), `expressionFor.ts`, `useFaceState.ts`, the dock and tour from JB01, JB02, JB05 and JB09.
- `Button`, `ThemeSwitch` (UI01), the drawer (UI04, if merged; otherwise only the helper and its test).

## Touches

- `package.json`, `package-lock.json` (`animejs`)
- `src/motion/index.ts`, `SkyBackdrop.tsx`, their tests (new)
- `src/components/Button.tsx` (one line), `src/components/ThemeSwitch.tsx` (the sweep)
- `src/features/mascot/tour.ts`, `TourOverlay.tsx`, `MascotDock.tsx` (only what moves onto `src/motion/`)
- `src/App.tsx` is not touched: `SkyBackdrop` mounts from `src/main.tsx`, or a post on `docs/AGENT-BOARD.md` asks the `app` owner

## Steps

1. Add `animejs`; write `src/motion/` with the gate and the helpers, lazily importing Anime.js.
2. Write `SkyBackdrop`.
3. Wire the press, the sweep and the drawer; move the tour flight and scroll boost onto the helpers.

## Tests

- `src/motion/index.test.ts`, with `matchMedia` stubbed:
  - under reduced motion every helper resolves at once and never imports `animejs` (spy on the import);
  - otherwise each starts one animation;
  - a failed import resolves quietly.
- `SkyBackdrop.test.tsx`:
  - `aria-hidden`;
  - no animation frame under reduced motion;
  - stops on `visibilitychange` to hidden.
- Existing mascot and tour tests pass. The tour under reduced motion still jumps straight to each stop.

## Guardrails

- The template's guardrails: nothing flashes more than 3 times a second; under reduced motion nothing moves. The NASA image is never animated.
- Motion never delays a sound or an announcement: the interaction answer stays within 50 ms (§6.3).

## Done when

- Pressing buttons, opening the mixer, switching theme and the tour all have Muninn's physical motion; with reduced motion on, all of it is still. Anime.js is absent from Home's first-load bundle (check `npm run build` output).

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A custom cursor, Muninn's runes and shockwave, motion on the data image, Framer Motion.

## Result

Filled in by the agent.

# MC02 Accessibility pass on the Mission Control look

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent+👤 (an agent audits and fixes; a person does the screen reader pass) |
| **Needs** | — |
| **Hotspots** | theme |
| **Branch** | `chore/MC02-a11y-mission-control`, from `chore/jpl-hud-theme` |

## Goal

The Mission Control look keeps every accessibility promise the app makes: text contrast on the HUD panels over the backdrop, visible focus, fallbacks for more contrast and reduced transparency, a still backdrop under reduced motion, and nothing new for a screen reader.

## Base

Like every MC ticket, this one branches from `chore/jpl-hud-theme` (commits `4581857`, `f5ad5bf`, not yet on `main`), and the person merges it back there. MC05 opens the pull request into `main`.

## Why

- So far the only check was a Lighthouse snapshot (99, Listen, mobile), and that covers only part of WCAG.
- `src/styles/tokens.test.ts:250-257` pins the `.ui-glass` fallbacks, but nothing pins the new `.nasa-hud-card` fallbacks in `src/styles/components.css` (the rules after `.nasa-hud-card {`).
- The backdrop is `#040812` under panels filled with `--glass-bg`. The contrast test assumes the old backdrops. It needs checking with the new colour behind the glass.
- Reduced motion was not checked in a browser. The logic is in `public/nasa-bg.js` (`sync`, the `calm` query).

## Reuse

- `ecc:frontend-a11y` or `ecc:accessibility` for the audit.
- The contrast helpers in `src/styles/tokens.test.ts` (`ratio`, `block`).
- `expectNoA11yViolations` from `src/test/a11y.ts`.

## Touches

`src/styles/components.css`, `src/styles/tokens.test.ts`, `public/nasa-bg.js` (only if reduced motion or hiding is wrong).

## Steps

1. Branch from `chore/jpl-hud-theme`.
2. Audit Home, Learn, Listen, Compare and About in Night theme: keyboard order, visible focus, text contrast on HUD panels, and the reduced-motion still frame.
3. Add tests to `tokens.test.ts`: the `.nasa-hud-card` fallbacks exist (more contrast, reduced transparency, no backdrop-filter, the app's high contrast), and text on `--glass-bg` over `#040812` reaches 4.5:1.
4. Fix what fails.
5. Leave a short screen-reader checklist in **Result** for the person (VoiceOver or NVDA).

## Tests

`src/styles/tokens.test.ts`, in the style of its `.ui-glass` checks.

## Guardrails

- Under `prefers-reduced-motion` everything is still.
- Nothing flashes more than 3 times a second.

## Done when

- The new tests pass, and every audit failure is fixed or listed with a reason.
- **👤** A person has checked one page with a screen reader. Flag this; it does not block `ready`.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The layout pass. Code review findings (MC01).

## Result

Branch `chore/MC02-a11y-mission-control` (from `chore/jpl-hud-theme` at `14b29ce`), commit `7882adb`. Claim kept local, not pushed (the person's choice, 14 Nov 2026).

**Audit (Chrome, Night theme, 1440 wide, dev server)**

| Check | Result |
|---|---|
| Lighthouse accessibility, desktop snapshot | Home 99, Learn 98, Listen 99, Compare 99, About 99. The one failure on every page is `skip-link` ("No skip link target"): `a.app-skip` in `src/App.tsx:272`, from `dd3e834` (UI T50), not this look. Its `href` is a route and its click handler focuses the page heading, so keyboard users still land on the heading; axe cannot see that. Left alone: `App.tsx` is the `app` hotspot and outside this ticket. Worth its own small ticket. |
| Visible focus inside HUD panels | Pass. Tab into the page, then focus Play in the player transport (a `.nasa-hud-card`): `:focus-visible` holds, 3px solid `rgb(0, 220, 252)` outline, 2px offset, and the panel does not clip it (`overflow: visible`). |
| Reduced motion | Pass. With `matchMedia('(prefers-reduced-motion: reduce)')` made to match before load, the canvas drew one frame, then stayed identical across 800 ms even after `setJukeboxEnergy(1)`. Without it, frames changed. |
| Text contrast on HUD panels over the backdrop | Pass, now tested (below). The backdrop is `#040812`; glass over it is lighter than glass over pure black, which the existing test already covered. |
| Screen reader exposure | Unchanged: the canvas is `aria-hidden="true"`; the only markup changes are class names. |
| Mono readouts | Dates, counts and slider values read in JetBrains Mono with tabular figures ("January 2024: cold", "80 percent"). |

Nothing in the look failed, so the change is the tests that keep it that way. New tests in `src/styles/tokens.test.ts`:

- Text on the glass over deep space: `on-surface`, `on-surface-variant` and `primary` reach 4.5:1 on the glass over the backdrop's own `SPACE` colour, read from `public/nasa-bg.js`. These run for Night only (the backdrop never draws in Day or high contrast), which is the 9 skipped below.
- `.nasa-hud-card` fallbacks exist for more contrast and reduced transparency, no `backdrop-filter`, and the app's high contrast switch.
- `.nasa-hud-card` blurs at least 14px. That blur is what stops stars (1 to 1.6px) and the horizon line from showing through text as bright points. Without blur support the panel turns solid, so see-through without blur never happens.

**👤 Still for a person (does not block `ready`):** one page with a screen reader (VoiceOver or NVDA), in Night theme:

1. The backdrop is never announced (no "image", "canvas" or "graphic").
2. Tab from the top: the skip link, the nav, then the page. Focus is always visible on the HUD panels.
3. On Listen, Play, then Stop: the player's announcements read as before, and nothing new speaks over them.
4. The date and volume readouts read as words, not character by character.

**Checks**

```
npm run lint   → 0 errors (only the existing src/features/compare/Fusion.tsx warnings)
npm test       → Test Files 220 passed (220); Tests 3167 passed | 9 skipped (3176)
npm run build  → ✓ built in 918ms
```

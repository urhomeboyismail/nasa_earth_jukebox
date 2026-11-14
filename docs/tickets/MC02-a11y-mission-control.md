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

Filled in by the agent.

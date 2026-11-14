# MC01 Code review of the Mission Control look, and its fixes

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | theme, player |
| **Branch** | `chore/MC01-review-mission-control`, from `chore/jpl-hud-theme` (not `main`; see Base) |

## Goal

The Mission Control look (deep-space backdrop, energy hook, HUD cards, mono readouts) has been reviewed line by line, and every confirmed finding is fixed with a test where the logic allows one.

## Base

The look is on the local branch `chore/jpl-hud-theme` (commits `4581857`, `f5ad5bf`), not yet on `main`. The MC tickets (MC01 to MC04) branch from it, and the person merges each one back into `chore/jpl-hud-theme`. MC05 then opens the single pull request into `main`. This is the one exception to "build on `main`".

## Why

Built in one session with no review. Suspects to confirm or dismiss:

- `src/audio/level.ts:29-31`: the energy timer runs 30 times a second for as long as the ensemble graph exists, including while paused, while the tab is hidden, under reduced motion, and in Day theme (where the backdrop is hidden and ignores it).
- `public/nasa-bg.js:199` with `:50`/`:63`: every `resize` event rebuilds the random star field, so dragging a window edge makes the stars jump.
- `public/nasa-bg.js:202`: the MutationObserver calls `sync()` on every class change of `<html>`, which restarts the loop and resets `last` (a dropped frame each time).
- `src/styles/components.css:582` overrides `.ui-card--filled` and `.ui-card--outlined` (`:367-368`), so the three Card variants now look the same. The `Card` prop says they differ (`src/components/Card.tsx`).
- `public/nasa-bg.js` is plain JS outside the TypeScript build and lint, so nothing type-checks it.

## Reuse

- `ecc:code-review` (or `/code-review`) on the range `fc6e8eb..chore/jpl-hud-theme`.
- `hasLevelSource`, `readBands`, `setLevelSource` in `src/audio/level.ts` and their tests in `level.test.ts` (fake timers, `FakeAnalyserNode` from `src/test/fakes.ts`).
- `reducedMotion()` in `src/motion/index.ts`.

## Touches

`public/nasa-bg.js`, `src/audio/level.ts`, `src/audio/level.test.ts`, `src/styles/components.css`, `src/index.css`, `index.html`, `src/main.tsx`, `src/components/Card.tsx`, `src/components/components.test.tsx`, and the class-name lines in `src/features/landing/Landing.tsx`, `src/features/learn/VoiceCardsSection.tsx`, `src/features/player/index.tsx`, `src/features/player/Symphony.tsx`.

## Steps

1. Branch from `chore/jpl-hud-theme`.
2. Run the review on the range above and list each finding with a verdict (confirmed or dismissed, with the reason).
3. Fix the confirmed ones, smallest change first.
4. Add or extend a test for each fix in TypeScript. `nasa-bg.js` has no test harness, so say how each fix there was checked in a browser.

## Tests

Next to the code. Fake timers for the energy timer (copy the energy test in `level.test.ts`). Card variant tests in `components.test.tsx` by role, with `expectNoA11yViolations`.

## Guardrails

- No sound changes: the analyser stays a read-only tap (`level.ts`, header comment).
- Under `prefers-reduced-motion` the backdrop draws one still frame. Nothing flashes more than 3 times a second.
- Nothing specific to one data set.

## Done when

- Every suspect above and every review finding has a verdict in **Result**.
- Confirmed findings are fixed and the checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Accessibility audit (MC02), the real-audio check (MC03), the flaky App test (MC04), opening the pull request (MC05).
- The phone and desktop layout pass (`.claude/rules/platform.md`).

## Result

Filled in by the agent.

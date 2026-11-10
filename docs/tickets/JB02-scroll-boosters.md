# JB02 Scroll-driven air boosters: tilt, thrust and retro-burn

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | JB01 |
| **Hotspots** | — |
| **Branch** | `feature/JB02-scroll-boosters` |

## Goal

When the page scrolls, the docked Echo leans forward and fires its boots. The flames grow with the scroll speed, and a fast stop gives a short retro-burn before Echo floats again. Under reduced motion nothing moves.

## Why

- F58 gives `Echo` the `motion` (`idle`, `boosting`, `retro`, `pointing`) and `thrust` props and the CSS for them (`src/components/mascot.css`). JB01 docks Echo in `src/features/mascot/MascotDock.tsx`. Nothing drives `motion` from scrolling yet.
- The spec asks for the boosters within 100 ms of the scroll starting. A passive listener plus one requestAnimationFrame is well inside that.
- The house style: "every motion has a cause" and all motion is CSS inside the reduced-motion block (`docs/archive/ui-overhaul/UI-B-stageshow-craft-and-motion.md:14` and `:77`). Here the cause is the user's own scrolling.

## Design

`src/features/mascot/useScrollVelocity.ts` (new):

```ts
export const BOOST_START = 0.4     // px per ms: above this, boosting
export const BOOST_FULL = 3        // px per ms: thrust 1
export const RETRO_FROM = 1.5      // px per ms: a stop from at least this speed gives a retro-burn
export const RETRO_MS = 400
export function useScrollVelocity(): { motion: 'idle' | 'boosting' | 'retro'; thrust: number }
export function thrustFor(speed: number): number   // pure: 0 below BOOST_START, 1 at BOOST_FULL, linear between
```

- A passive `scroll` listener on `window` records `scrollY` and `performance.now()`. One requestAnimationFrame per frame computes |ΔY|/Δt from the last two samples. The loop runs only while scroll events keep arriving, and stops one frame after they stop.
- When the speed passes `BOOST_START`, it reports `boosting` in that same frame.
- When scrolling stops (no event for 120 ms) after a top speed of at least `RETRO_FROM`, it reports `retro` for `RETRO_MS`, then `idle`. A slow stop goes straight to `idle`.
- Under `prefers-reduced-motion: reduce` (read with `matchMedia`, kept up to date with its `change` event) it returns `{ motion: 'idle', thrust: 0 }` and adds no listener.
- `MascotDock` passes `motion` and `thrust` to `Echo`. While JB05's tour is pointing, the tour's motion wins.

## Reuse

- `Echo`'s `motion` and `thrust` props and `mascot.css` (F58).
- `MascotDock` (JB01).
- The `matchMedia` reduced-motion check used in `src/App.tsx:155`.

## Touches

- `src/features/mascot/useScrollVelocity.ts` and `useScrollVelocity.test.ts` (new).
- `src/features/mascot/MascotDock.tsx`: pass the two props.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Write `thrustFor` and its test.
2. Write the hook with a fake clock and a fake requestAnimationFrame in the test.
3. Wire it into the dock.
4. Run the checks.

## Tests

- `thrustFor`: 0 below the start, 1 at and above full, monotonic between.
- The hook, with `vi.useFakeTimers()`, a stubbed `requestAnimationFrame` and scroll events dispatched on `window`:
  - a fast scroll gives `boosting` on the next frame;
  - a stop after a fast scroll gives `retro`, then `idle` after 400 ms;
  - a slow scroll then a stop gives `idle` with no `retro`;
  - with `matchMedia('(prefers-reduced-motion: reduce)')` stubbed true, it always returns `idle` and no listener is added;
  - unmount removes the listener and cancels the frame.
- `MascotDock.test.tsx` keeps passing; `await expectNoA11yViolations(container)`.

## Guardrails

- Motion only under `prefers-reduced-motion: no-preference`. The flame flicker stays at 3 Hz or less (WCAG 2.3.1).
- No sound, no announcement (scrolling is not news).
- A passive listener only. Never call `preventDefault` or change scrolling.

## Done when

- Scrolling makes Echo lean and fire in proportion to speed; a fast stop gives a retro-burn; a slow stop doesn't.
- Nothing moves under reduced motion. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Page transitions (navigating between pages) as a boost trigger. A follow-up can add it if the team wants.
- The tour's flight (JB05).

## Result

Not started.

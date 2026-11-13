# JB05 Guided tour flight path with a glowing jet trail

| | |
|---|---|
| **Priority** | P2 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | JB01, JB02 |
| **Hotspots** | player |
| **Branch** | `feature/JB05-tour-flight-path` |

## Goal

"Show me around" starts a guided tour: Echo leaves its dock and flies along a smooth path across the screen to each key control in turn: the data set picker, then Play, then Export. It boosts while flying, points at each control on arrival, and leaves a glowing jet trail that fades. Each stop has a caption that screen readers hear, and Next, Back and Stop buttons. Under reduced motion Echo appears beside each control with no flight.

## Why

- The demo already walks through pages with captions: `DemoStep` (`src/features/demo/script.ts:6`), `DEMO_STEPS` (`:16`), and the pure runner `runDemo` with injected dependencies (`src/features/demo/runDemo.ts:6` and `:16`). `DemoControl.tsx` shows the caption in an `aria-live` region and stops on Esc. It moves between pages but never points at anything.
- JB01 gives the dock an `onTour` slot and `useMascotGuide().pointAt`. F58 gives `Echo` the `boosting` and `pointing` motions, and JB02 the thrust.
- The Play and Export buttons are in the player (`src/features/player/index.tsx`, the `player` hotspot), so they need a stable `data-tour` attribute. The picker is `src/components/DatasetPicker.tsx`.
- PLAN §6.3: "the listener in control". So the tour never takes focus and can always be stopped.

## Design

**Steps.** Add an optional field to `DemoStep`:

```ts
target?: string   // a CSS selector, e.g. '[data-tour="play"]'; when set, Echo flies there and points
```

Add one dependency to `DemoDeps`: `pointAt(selector: string | null): Promise<void>`, which resolves when Echo arrives. A new `TOUR_STEPS` in `script.ts` covers the picker → Play → Export, each with a short caption. The texts are general, with no data-set names.

**Targets.** Add `data-tour="dataset-picker"` (`DatasetPicker.tsx`), `data-tour="play"` and `data-tour="export"` (player). Those are the only player edits.

**The flight** (`src/features/mascot/TourOverlay.tsx` and `flightPath.ts`, new):

```ts
export function flightPath(points: Array<{ x: number; y: number }>): string   // an SVG path `d`: a smooth cubic (Catmull-Rom → Bézier) through the points
export function anchorFor(target: DOMRect, viewport: { w: number; h: number }): { x: number; y: number; side: 'left' | 'right' }   // beside the target, inside the viewport
```

- The overlay is a `position: fixed` full-viewport `<svg aria-hidden>` that ignores the pointer (`pointer-events: none`), above the page and below dialogs.
- Flying from point A to B: Echo (a second `Echo` inside the overlay; the dock hides during the tour) moves along the path segment with CSS `offset-path: path(…)` and `offset-distance` from 0% to 100% over about 900 ms, with `motion="boosting"` and `thrust` 1. On arrival it switches to `motion="pointing"`, faces the target, and a ring (`outline` on a positioned box) frames the target.
- The jet trail is the same path as a glowing stroke in `--mascot-accent` (JB04, or F58's default), drawn with `stroke-dashoffset` and fading out over about 1.5 s.
- If the user scrolls or resizes, the positions are recomputed (one requestAnimationFrame), and the target is scrolled into view (`block: 'nearest'`) before flying.
- A target that is missing (for example, no data set loaded yet) is skipped, and its caption says what to do.

**Controls.** The tour bar (in `DemoControl` or a sibling) has **Back**, **Next** and **Stop tour** buttons and the caption in the existing `aria-live` region. Esc stops. Focus stays where the user put it; "Next" doesn't move focus to the target. Steps advance only on Next (no timers), except where an existing demo step plays sound.

**Starts from.** The dock's "Show me around" (JB01's `onTour`), and the welcome's last screen if it offers a tour (one link, no other welcome change).

**Reduced motion.** No flight and no trail: Echo appears beside each target in `pointing`, and the ring is static.

## Reuse

- `DemoStep`, `runDemo` and `DemoControl` (`src/features/demo/`). Extend them, don't write a second runner.
- `Echo` props (F58), `MascotDock`'s `onTour` and `pointAt` (JB01), `useScrollVelocity`'s motion values (JB02).
- `useAnnounce` for the caption if `DemoControl`'s live region isn't reachable.

## Touches

- `src/features/demo/script.ts`, `runDemo.ts`, `DemoControl.tsx` and their tests.
- `src/features/mascot/TourOverlay.tsx`, `flightPath.ts` and their tests (new); `src/features/mascot/MascotDock.tsx` (pass `onTour`, hide during the tour).
- `src/components/DatasetPicker.tsx`: one `data-tour` attribute.
- `src/features/player/index.tsx`: two `data-tour` attributes (the `player` hotspot).
- `src/features/welcome/Welcome.tsx`: one "Show me around" link, only if it fits the last screen.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Write `flightPath` and `anchorFor` with tests.
2. Extend `DemoStep` and `runDemo` (`target` and `pointAt`), with runner tests.
3. Add the `data-tour` attributes.
4. Write `TourOverlay` and the Back, Next and Stop bar.
5. Wire "Show me around" in the dock.
6. Run the checks; try the tour in the browser with motion on and with reduced motion.

## Tests

- `flightPath`: two points give a valid `d` starting at the first point and ending at the last; three points give a path through the middle one.
- `anchorFor`: a target at the right edge puts Echo on its left; it is always inside the viewport.
- `runDemo`: `pointAt` is called once per step with that step's `target`, and with `null` at the end; aborting stops it.
- The tour (Testing Library): "Show me around" starts it; the caption is in the live region; Next and Back move between steps; Esc and "Stop tour" end it and the dock comes back; focus doesn't move on Next; a missing target is skipped. `await expectNoA11yViolations(container)`.
- The existing demo tests (`DemoControl.test.tsx`) and player tests keep passing.

## Guardrails

- The listener stays in control: no focus stealing, Esc always stops, no auto-advance timers.
- Every step has a text caption announced politely, never over a screen reader.
- Motion only under `prefers-reduced-motion: no-preference`; the trail fades and doesn't flash (WCAG 2.3.1). The overlay never blocks clicks.
- Nothing specific to one data set in the captions or in `src/`.

## Done when

- The tour flies Echo from the dock to the picker, Play and Export, pointing at each, with a fading trail, and works by keyboard and screen reader.
- Under reduced motion it works without any flight. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- IX11's onboarding game (a separate ticket; this tour is optional and short).
- New pages or new demo steps beyond the three targets.

## Result

Built on `feature/JB05-tour-flight-path`.

- `npm run lint`: no warnings or errors.
- `npx tsc -b`: clean.
- `npm test`: 193 files, 2848 tests passed (one earlier run under load timed out in `change-regression.test.ts` and a player test; the re-run passed).
- `npm run build`: built.

Differences from the ticket, for the reviewer:

- **No Export button exists in the player** (`src/features/player/index.tsx` has Play, Stop, Replay, Explore the map and others, no Export). The third stop points at **Explore the map** (`data-tour="explore"`) instead; the two attributes in the player are `play` and `explore`.
- **`App.tsx` is not in Touches** (and JB08 holds it), so `App` still does not pass `onTour`. The dock now runs the tour itself, and "Show me around" is always offered; `onTour` stays as an optional callback. The tour state is in `src/features/mascot/tour.ts` (outside React), because the dock is keyed by page and remounts when the tour changes page.
- The welcome's last screen is unchanged (the ticket said only if it fits).
- A missing target is not flown to: its caption gets a note saying what to do, and the step still waits for Next.
- The runner is extended, not duplicated: `runDemo` calls `pointAt` per step. Back restarts it from the previous step; a step ends on Next instead of a timer.
- Not tried in a real browser (motion on and reduced); the flight uses CSS `offset-path`, which jsdom cannot show.


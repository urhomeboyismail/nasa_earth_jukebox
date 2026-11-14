# JB09 The tour starts after the welcome, and Echo flies home when it ends

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/JB09-tour-from-welcome` |

## Goal

A sighted first-time visitor who finishes the welcome goes straight into the guided tour. When the tour finishes, Echo boosts back along a curve into its corner dock instead of vanishing.

## Why

- The tour (JB05) only starts from the dock's "Show me around" (`src/features/mascot/MascotDock.tsx:205`). The welcome ends on "Yes, this is comfortable" or "Skip the sound check" (`src/features/welcome/Welcome.tsx:204`, `:209`), which call `finish` (`:122`) and go to Listen. A new listener never learns that the tour exists.
- When the tour ends, `runDemo` calls `pointAt(null)`, which clears the stop (`src/features/mascot/tour.ts`, `pointAt`). Echo disappears from the last control and the dock reappears, with no flight back.

## Design

**Start from the welcome.** In `finish`, after saving, call `startTour(announce)` only when `path === 'map'` ("I can see the map"):

- the `screen-reader` path goes to Learn, and the tour is a visual pointer tour;
- the `play` path autoplays and starts IX11's onboarding game, and a tour on top of that would talk over both.

"Skip the welcome" never starts it. The tour's own step goes to Listen, which `finish` already opened, and `TourLayer` puts focus on Next (the welcome has just unmounted, so focus would be lost otherwise).

**Fly home.** In `run`'s completion in `tour.ts`, when the tour *finished* (not stopped), motion is allowed and Echo has a last point:

```ts
// TourStop.selector becomes string | null; null = no target and no ring (the flight home).
set({ caption: 'The tour has finished.', stop: { key, from: lastPoint, to: dockPoint(), side, path: flightPath([from, bend(from, to), to]), selector: null, phase: 'flying', reduced: false } })
await wait(FLIGHT_MS, signal)   // then IDLE as today
```

Stop tour and Esc still end it at once ("Skip" means now). Under reduced motion it ends at once as today. `TourStopView` measures nothing and draws no ring when `selector` is null.

## Reuse

`startTour`, `flightPath`, `bend`, `dockPoint`, `wait`, `FLIGHT_MS` (`tour.ts`); the existing trail and `data-flying` styles (`tour.css`).

## Touches

- `src/features/mascot/tour.ts`, `TourOverlay.tsx`, `TourOverlay.test.tsx`.
- `src/features/welcome/Welcome.tsx`, `welcome.test.tsx`.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Make `TourStop.selector` nullable and fly home on finish.
2. Start the tour from the welcome's map path.
3. Tests, checks, and a try in the browser with motion on and reduced.

## Tests

- Finish with motion allowed: the bar stays while Echo flies with a trail and no ring, then the tour ends, says "The tour has finished." and the dock gets focus back.
- Stop tour: ends at once, no flight home.
- Welcome: finishing the map path starts the tour (the "Guided tour" region and Step 1 caption appear); the screen-reader and play paths and "Skip the welcome" do not. `expectNoA11yViolations`.

## Guardrails

- The listener stays in control: Esc and Stop tour end it at once; nothing auto-advances.
- Motion only without `prefers-reduced-motion`; the trail fades and doesn't flash.
- Nothing specific to one data set.

## Done when

- Finishing the welcome on the map path starts the tour; finishing the tour flies Echo back to the dock. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Retargeting the third stop to the mixer (JB10, the `player` hotspot).
- Renaming Echo or the buttons.

## Result

Filled in by the agent.

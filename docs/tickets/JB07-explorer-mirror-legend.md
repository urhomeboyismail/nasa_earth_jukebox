# JB07 Echo mirrors the explorer; the legend becomes playable

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | JB01, SN09, IX02 |
| **Hotspots** | explorer |
| **Branch** | `feature/JB07-explorer-mirror-legend` |

## Goal

Echo becomes the face of the sight interpreter. While someone explores the map by mouse, finger or keys, Echo's visor shows `searching` and its chest bar follows the value under the cursor, and the "What's here?" words appear in Echo's bubble when it is opened. The legend becomes playable too: hovering or focusing a colour stop plays its tone and announces its label and value. That covers the idea's "chart nodes", since the legend is the app's only chart.

## Why

- The sight interpreter itself is already planned and must not be built twice. **SN09** plays a continuous tone and slope cue for the value under the cursor (`probeTone`, `slopeAt`, `src/sonify/probe.ts`). **IX02** gives "What's here?" words on demand, through an `aria-live` route.
- The idea asks for "pitch-modulated tones and verbal descriptions when hovering over map pixels or chart nodes". There are no charts in `src/`. `src/components/Legend.tsx:25` is the only chart-like display, and today it is silent.
- JB01 docks Echo and gives `useMascotGuide()`. F58 gives the `searching` expression and the chest bars.
- The explorer's state lives in `src/features/explore/useExplorer.ts` (the `explorer` hotspot).

## Design

**Explorer → Echo.**

- `useExplorer` publishes `{ exploring: boolean, value: number | null, position: 0..1 | null }` on the context bus under a new key `'explore'`. Add `'explore'` to `ContextKey` in `src/assistant/context.ts:7`.
- `MascotDock` subscribes. While exploring, the expression is `searching`, the chest shows one tall bar at `position × 255`, and the bubble text (if opened) is IX02's latest "What's here?" sentence.
- No sound or speech from Echo: SN09 plays the tone and IX02 owns the words.

**Playable legend** (`src/components/Legend.tsx`):

- Each stop (or category) becomes focusable (`tabIndex=0` on a list item with role `listitem`, or a `button` if it is clickable), with an accessible name of its label and value.
- On hover, or on focus by keyboard, play that stop's tone through SN09's probe path, at its position in the scale. Do this only after the first user gesture (the engine is unlocked by then), and stop the tone on leave or blur.
- Announce "<label>: <value>, <higher or lower> pitch" through `useAnnounce` with `{ busy: true }` (rate-limited, `src/components/announceRate.ts`).
- Arrow keys move between stops when one has focus.

## Reuse

- SN09's `probeTone` and its audio glue (`src/features/explore/probeAudio.ts`); IX02's sentence builder.
- `useAnnounce` with `busy`; `publishContext` and `subscribeContext`.
- `colourAt` (`src/components/colourAt.ts`) for a stop's value.

## Touches

- `src/features/explore/useExplorer.ts` (the `explorer` hotspot): one publish.
- `src/assistant/context.ts`: the `'explore'` key.
- `src/components/Legend.tsx` and its test.
- `src/features/mascot/MascotDock.tsx` and its test.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Add the context key and the explorer publish, with a test.
2. Make the dock mirror the explorer.
3. Make the legend focusable and playable, with tests.
4. Run the checks; try it with a screen reader and the keyboard only.

## Tests

- Exploring publishes `exploring: true` and values; stopping publishes `exploring: false`.
- The dock shows `searching` while exploring (check `data-expression`) and goes back after.
- Legend: Tab reaches the first stop, and arrow keys move between stops. Focus announces "<label>: <value>…" once (busy-limited). The probe is called with the stop's value, and nothing plays before a user gesture. Blur stops the tone. `await expectNoA11yViolations(container)`.
- The explorer and player tests keep passing.

## Guardrails

- A sound answer within 50 ms of hover or focus (PLAN §6.3 principle 1). No sound before a click or key press (WCAG 1.4.2).
- Sound first, words on request: legend announcements are short and rate-limited, and Echo adds no speech.
- Every tone has a text equivalent. Nothing specific to one data set: labels and values come from the manifest.
- Motion only under `prefers-reduced-motion: no-preference`.

## Done when

- Exploring the map changes Echo's face and chest in step with the probe.
- The legend can be played by mouse and keyboard, with tones and announcements. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The probe tone and the "What's here?" words themselves (SN09, IX02).
- New chart types.

## Result

Not started.

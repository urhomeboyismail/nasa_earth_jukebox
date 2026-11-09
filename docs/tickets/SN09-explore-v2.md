# SN09 Explore v2: continuous tone and slope cue under the cursor or finger

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN03, SN04 |
| **Hotspots** | explorer |
| **Branch** | `feature/SN09-explore-v2` |

## Goal

On the map explorer, the value under the cursor, finger or keyboard focus is heard as a **continuous tone**, which glides from cell to cell, and a **slope cue** (a brighter or duller sound) tells the listener whether the values rise towards the place they are moving to. Where there is no data, the dropout cue plays once. The tone updates at most 20 times a second, and every answer comes within 50 ms. The old one-note-per-cell sound stays for listeners who turn the continuous tone off, and for data sets without a `sonification` block.

## Why

- `src/features/explore/useExplorer.ts` plays one category note per cell through the old engine (`playCategory` at its lines around 150, 206 and 296). A cell is heard as a step, so a gentle slope is not heard at all.
- The grid is already there: `analyzeGrid` (`src/analysis/index.ts`, 24 columns, `FrameGrid`). This ticket uses the same grid, so a cell and its sound never disagree.
- `PLAN.md` §6.3 asks for "the cursor or a finger plays a continuous tone for the value under it, plus a slope cue towards higher values". Interaction principle 1: a sound answer within 50 ms.

**Order.** The queue's Needs column lists SN04. This ticket also needs SN03 (`presetFor`, `snapToScale`, `Preset`) and the `ensemble.hold` method of SN04. Merge SN03 and SN04 first. Hotspot `explorer`: no other explorer ticket (VIS1, IX07 later) at the same time.

## Design

### The probe (`src/sonify/probe.ts`, pure)

```ts
export const PROBE_LOW_MIDI = 48          // C3: the lowest value
export const PROBE_SPAN = 36              // three octaves: up to C6
export const PROBE_LEVEL = 0.6
export const SLOPE_SCALE = 0.25           // a neighbour a quarter of the legend's range higher is a full slope
export function probeTone(colorScale: ColorScale, grid: FrameGrid, col: number, row: number, preset: Preset): HeldTone | null
export function slopeAt(colorScale: ColorScale, grid: FrameGrid, col: number, row: number): number   // −1 to +1
```
- `probeTone` returns `null` for a cell without a value (the caller plays the dropout cue instead). Otherwise: `position = (value − stops[0].value) / (last − first)`, clamped to 0 to 1. `midi = snapToScale(PROBE_LOW_MIDI + position × PROBE_SPAN, preset, PROBE_LOW_MIDI, PROBE_LOW_MIDI + PROBE_SPAN)`. `level = PROBE_LEVEL`. `pan = panForPoint((col + 0.5) / grid.cols)`, `elevation = elevationForPoint((row + 0.5) / grid.rows)`, `brightness = 0.5 + slope / 2`.
- `slopeAt`: the mean over the cell's readable neighbours (up, down, left, right) of `(neighbour − cell) / (range × SLOPE_SCALE)`, clamped to −1 to +1. 0 when the cell has no readable neighbour. Rising towards a higher neighbour is positive, so the tone is brighter.
- `grid` is `FrameGrid` (`src/analysis/index.ts`), read with `cells[row × cols + col]`.

### The glue (`src/features/explore/probeAudio.ts`, new)

- `createProbeAudio(ensemble, preset)` returns `{ point(col, row), leave(), key(col, row), dispose() }`.
  - `point` is called on pointer move over a cell, and on the first touch. It calls `ensemble.hold(tone, atTime)` where `tone = probeTone(...)`, or `ensemble.playDropout()` (once per entry to an empty cell) plus `hold(null)` for an empty cell.
  - **Throttle.** `hold` is called at most every `MIN_APPLY_GAP_S` (0.05 s, from SN04). A move inside the gap updates the pending tone and is sent at the next allowed time. The last position always wins (never queued).
  - `leave()` (pointer up, pointer leaves the map, Escape) calls `hold(null)`.
  - `key(col, row)` (arrow keys): holds the tone for the cell for `KEY_TONE_MS` (300 ms), and releases it with a timer unless another key moves in the meantime.
- Latency: `hold` is called with the default `atTime` (now + `INTERACTIVE_LOOKAHEAD_S`), so the note sounds within 50 ms of the event (SN04).
- Where the continuous tone is on, the explorer's old `playCategory` calls for a cell are not made. Where it is off, they are, unchanged.

### The switch and its default

- A checkbox **Continuous tone** on the explorer (and **Slope cue** as a second checkbox, default on when the tone is on). Stored under `earth-jukebox:explore-tone` with guarded storage (as `src/audio/style.ts`).
- Default: **on** when the data set has a `sonification` block, **off** otherwise. The fixture has none, so the existing explorer tests see the old behaviour.
- Turning the tone on does not start sound: the first pointer down or key press does (`ensemble.start()` from that gesture).

### The explorer (`useExplorer.ts`, `Explorer.tsx`)

- `useExplorer` gains an option `probe?: ProbeAudio | null`. When it is present, cell moves call `probe.point`/`probe.key`, and the pointer and key handlers call `leave`. When it is `null` (tone off or no ensemble), nothing changes.
- The announcements already in the explorer stay as they are. The probe adds no announcements (SN10 writes the rate-limited words).

## Reuse

- `FrameGrid`, `GridCell`, `analyzeGrid` (`src/analysis/index.ts`).
- `probeTone` helpers: `snapToScale`, `presetFor`, `Preset` (`src/sonify/`, SN03).
- `panForPoint`, `elevationForPoint` (`src/audio/pan.ts`).
- `useEnsemble` (`src/audio/ensemble/useEnsemble.ts`, SN04) at the explorer's own preset; `hold`, `playDropout`, `MIN_APPLY_GAP_S`, `INTERACTIVE_LOOKAHEAD_S` (SN04 constants).
- `useExplorer.ts` `moveTo` (about line 160) and `onKeyDown` (about line 325), and the existing `playCategory` calls; keep them.

## Touches

- New: `src/sonify/probe.ts` and `probe.test.ts`; `src/features/explore/probeAudio.ts` and `probeAudio.test.ts`; the switch component (`ProbeSwitch.tsx`) if the explorer panel needs one.
- Edit: `src/features/explore/useExplorer.ts` (the option and the calls), `Explorer.tsx` (the switch and the wiring). Keep `Explorer.test.tsx` passing unchanged.
- Hotspot: `explorer`. Reviewer: Mohammad (`src/features/explore/`); the team leader for `src/sonify/probe.ts`.

## Steps

1. Write `probe.ts` and its tests (on a hand-made `FrameGrid` and `ColorScale`).
2. Write `probeAudio.ts` with a fake ensemble: the throttle, the dropout once, the release, the arrow-key timer.
3. Add the option to `useExplorer.ts` and the wiring in `Explorer.tsx`; add the switch and its stored default.
4. Run `Explorer.test.tsx` before and after: it passes unchanged.
5. Manual check: a data set with `sonification`, the cursor across a warm edge: the tone glides and brightens towards the warmer side. Record in Result.

## Tests

- **Probe.** A warm cell is higher than a cool one; a cell with no value gives `null`; `brightness` is above 0.5 for a cell with warmer neighbours and below 0.5 for cooler ones; the midi is in the scale and in range.
- **Slope.** A flat field gives 0; a step gives a positive slope towards the warm side; a cell with no readable neighbour gives 0.
- **Throttle.** Moves 10 ms apart: one `hold` at the first, the latest tone at the gap's end; never more than 20 `hold` calls in a second of moves.
- **Dropout.** Entering an empty cell calls `playDropout` once; staying in it does not repeat.
- **Release.** Pointer up, leaving the map and Escape each call `hold(null)`.
- **Keys.** Arrow keys hold the tone for 300 ms, then release; a key in between extends it, not restarts it with a new release.
- **Latency.** With a fake clock, the `atTime` of each `hold` is at most 50 ms after `now()`.
- **Off means old.** With the tone off, `playCategory` is called as before and `hold` is never called.
- **Stored default.** A data set without `sonification` starts with the tone off; with `sonification`, on; a stored choice wins.
- **Accessibility.** The switch is labelled and keyboard operable; `expectNoA11yViolations` on the explorer with the switch.
- **Existing explorer tests** pass unchanged.

- **Golden.** `src/sonify/__golden__/probe.json`: `probeTone` and `slopeAt` for every cell of the fixture's first frame, on the explorer's own grid (`analyzeGrid`, with the fixture's `colorScale`), recorded per cell as (midi, level, pan, elevation, brightness, slope).

## Guardrails

- No sound before a click or key press: the first pointer down or key press starts the ensemble.
- Every answer within 50 ms: `hold` uses the interactive look-ahead.
- Nothing flashes: no visual change on the map from the probe (the existing cursor outline stays as it is).
- Words are not in the probe; the explorer's existing text and the rate-limited events (SN10) carry them.
- No model, no network. The grid is the same grid the explorer already reads.
- Nothing data-set-specific in `src/`.

## Done when

- The continuous tone and the slope cue work with the mouse, a touch and the keyboard, with the throttle, the dropout and the release as above.
- The switch and its default work and are remembered.
- `Explorer.test.tsx` and the other explorer tests pass unchanged.
- The manual check is recorded in Result.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The scan (SN08), the Find game (IX04), "What's here?" (IX02), follow mode (IX03).
- Locking a place and scrubbing time (F23 is built and stays as it is).
- The words for a cell (SN10 and `describeCell`, unchanged).

## Result

Not started.

# SN08 Scan mode: sweep a frame so shapes become audible

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01, SN03, SN04, SN07 |
| **Hotspots** | player |
| **Branch** | `feature/SN08-scan-mode` |

## Goal

**Scan** is a third Listen mode. One frame is swept from west to east in about five seconds. Each column of the 64 × 32 grid becomes a short chord of up to eight notes: rows map to the scale (north is high), and each cell's value sets the loudness and the brightness. A column with nothing readable plays the dropout cue. A thin scan line on the picture shows where the sweep is. Shapes such as a warm patch, a front or an edge can then be heard, not only seen.

## Why

- Symphony follows the sequence of frames; nothing lets a listener hear the shape of one frame (`docs/PLAN.md` §6.3, "Ways to listen": Scan).
- The old map explorer (`src/features/explore/`) reads cells by hand, one at a time (`useExplorer.ts`), and is SN09's job. A sweep is a separate, automatic reading of the whole frame.
- The ensemble's `playNotes` (SN04) plays arbitrary notes through a scan bank, so this ticket does not add a second synth.

**Order.** The queue's Needs column lists SN04 only. This ticket also needs SN01 (`FrameFeatures.grid`, `extractInWorker`), SN03 (`snapToScale`, `presetFor`), and SN07 (it adds a mode to the Listen page and to `listenMode.ts`, which SN07 creates). Merge SN07 first. Hotspot `player`: SN07 and this ticket must not run at the same time.

## Design

### The plan (`src/sonify/scan.ts`, pure)

```ts
export const SCAN_BANDS = 8                 // rows are grouped into 8 bands of 4 cells (32 / 8)
export const SCAN_MS_PER_COLUMN = 80        // 64 columns: about 5.1 s
export const SCAN_LOW_MIDI = 48             // C3: the lowest band
export const SCAN_SPAN = 24                 // up to C5: two octaves
export const SCAN_NOTE_SECONDS = SCAN_MS_PER_COLUMN / 1000 * 1.5   // overlaps the next column a little
export const SCAN_MIN_LEVEL = 0.15

export type ScanColumn = {
  column: number
  atMs: number
  /** Silent when nothing in the column can be read; the caller plays the dropout cue then. */
  dropout: boolean
  notes: { midi: number; level: number; pan: number; elevation: number; brightness: number; seconds: number }[]
}
export function scanPlan(features: FrameFeatures, preset: Preset, msPerColumn?: number): ScanColumn[]
```
- The features are `FrameFeatures` (SN01); the cells are `features.grid.position` (0 to 1, row-major, row 0 north, 64 columns and 32 rows).
- For band `k` (0 is the north), the note is `snapToScale(SCAN_LOW_MIDI + round((SCAN_BANDS − 1 − k) × SCAN_SPAN / (SCAN_BANDS − 1)), preset, SCAN_LOW_MIDI, SCAN_LOW_MIDI + SCAN_SPAN)`. The bands are the same at every frame, so a listener learns "the top note is north".
- The band's value is the median of its readable cells in that column (`position`). No readable cell in the band: no note for it.
- `level = SCAN_MIN_LEVEL + (1 − SCAN_MIN_LEVEL) × position`; `brightness = position`. Higher values are louder and brighter.
- `pan = panForPoint((column + 0.5) / 64)`, `elevation = elevationForPoint(band centre y)`. Both from `src/audio/pan.ts`.
- `dropout` is true when the column has no readable cell; then `notes` is empty.
- `atMs = column × msPerColumn`, `column` from 0 to 63.

### The player (`Scan.tsx`, in `src/features/player/`)

- Button **Scan from the west edge** starts the sweep (`ensemble.start()` first, from the click). **Stop scan** (and Esc) stops it: `ensemble.stop()` for the scan.
- The features are for the date on screen. `scanFeatures(visualization, frameIndex)` reads the checked PNG (`readPixels`, or `createImageBitmap(blob)` and `extractInWorker('scan', bitmap, input)` from SN01), caches the result by frame id, and returns `FrameFeatures`. Scan is for checked frames only; live video is not scanned.
- Playback: `start = ensemble.now() + SCHEDULE_LOOKAHEAD_S`. For each column, `ensemble.playNotes(column.notes, start + atMs / 1000)`, or `ensemble.playDropout(start + atMs / 1000)` when `column.dropout`.
- **Scan line.** A thin vertical line over the picture at the current column, `aria-hidden="true"`. The column is `floor((ensemble.now() − start) × 1000 / msPerColumn)`, read in a `requestAnimationFrame` loop that stops when the scan ends. The line moves across the picture; it never blinks.
- The scan ends after column 63. Then the status is `idle` and the line is removed.
- Announcements (through `useAnnounce`): start ("Scanning from the west edge. About five seconds."), end ("Scan finished."), and the pause or the stop ("Scan stopped."). No announcement per column.
- A sighted listener sees the line; a screen-reader user hears the start and end, and can read the scan's summary in the "Now" line of SN07 (the summary of the frame's music, which is unchanged).

### The mode (`listenMode.ts`, `index.tsx`)

`ListenMode` gains `'scan'`. The radio group "Listen as" gets a third choice, **Scan**. Changing mode stops whatever is playing first.

## Reuse

- `FrameFeatures`, `extractInWorker`, `readPixels`, `pixelsFromBitmap` (`src/analysis/features/`, `src/analysis/pixels.ts`).
- `presetFor`, `snapToScale`, `Preset` (`src/sonify/`, SN03).
- `panForPoint`, `elevationForPoint` (`src/audio/pan.ts`).
- `createEnsemble` / `useEnsemble`, `playNotes`, `playDropout`, `now`, `SCHEDULE_LOOKAHEAD_S` (`src/audio/ensemble/`, SN04).
- `useAnnounce` (`src/components/useAnnounce.ts`). `Button` (`src/components/Button.tsx`).
- The `Viewer` (`src/features/player/Viewer.tsx`) shows the picture; the line goes on top of it.

## Touches

- New: `src/sonify/scan.ts`, `src/sonify/scan.test.ts`, `src/features/player/Scan.tsx`, `Scan.test.tsx`, `src/features/player/scanFeatures.ts` (the cache and the read).
- Edit: `src/features/player/listenMode.ts` (the `'scan'` value), `src/features/player/index.tsx` (the third choice and its render only).
- Do not edit `usePlayer.ts`, `Viewer.tsx`, `controls.ts` or the existing player tests.
- Hotspot: `player`.

## Steps

1. Write `scan.ts` (the plan) with its tests, against hand-made features.
2. Write `scanFeatures.ts` (the read and the cache), with the worker stubbed in tests.
3. Write `Scan.tsx`: the button, the playback loop, the line, the announcements.
4. Add `'scan'` to `listenMode.ts` and the third choice in `index.tsx`. Run `player.test.tsx`, `change.test.tsx`, `vibration.test.tsx` before and after: they pass unchanged.
5. Manual check: `npm run dev`, a checked frame with a clear warm patch: the sweep plays higher notes where the patch is brighter (record what was heard, in Result, for at least one listener, if one is available).

## Tests

- **Plan.** 64 columns; `atMs` is `column × 80`; the north band is the highest note; a column with a warm patch has louder notes in its patch's rows; a column with no readable cell is `dropout` with no notes; all notes are in the preset's scale and between `SCAN_LOW_MIDI` and `SCAN_LOW_MIDI + SCAN_SPAN`.
- **Pan.** The west column pans to −1 side, the east column to +1 side (both use `panForPoint`); the first column's pan is near −1.
- **Determinism.** The same features and preset give `toEqual` plans.
- **Playback.** With a fake ensemble: `playNotes` is called once per non-dropout column at `start + atMs`, `playDropout` for dropout columns, in order; `start` is called from the click only, never on mount.
- **Line.** The column is computed from `now()`; at `now() = start + 2.5 s` the line is at column 31.
- **Announcements.** Start and end are announced once each (through an `AnnouncerProvider` in the test); no announcement per column.
- **Stop.** Esc and "Stop scan" call `stop()`, remove the line and announce "Scan stopped."
- **Accessibility.** The scan panel has no violations (`expectNoA11yViolations`); the line is `aria-hidden`.
- **Existing player tests** still pass unchanged.

- **Golden.** `src/sonify/__golden__/scan.json`: `scanPlan` for the fixture's first frame and for `synthetic-storm`'s frame 0 (after SN01 is on `main`), at the default `msPerColumn`, recorded column by column (the dropout flag and the notes).

## Guardrails

- No sound before a click or key press: the scan starts only from its button (`ensemble.start()` from the click).
- Shapes are heard as notes, never as noise; a column with no data plays the seeded dropout cue, and the caption and the announcement say "not enough data" for the whole scan only if every column is dropped.
- Nothing flashes: the line moves smoothly across the picture; it does not blink, and nothing else on the picture animates.
- Reduced motion: the line jumps to its column at each step (no sliding) when `prefers-reduced-motion: reduce` is set.
- The scan is a reading of checked frames, so nothing is guessed from live video.
- Nothing data-set-specific in `src/`; the bands and ranges are fixed numbers in `scan.ts`.
- No model, no network beyond the same-origin PNG.

## Done when

- Scan plays from the west edge of a checked frame, with the line, the announcements and Stop, by mouse and keyboard.
- The plan's tests pass, and the existing player tests pass unchanged.
- The manual check is recorded in Result.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A draggable scan line, scanning from any column, or scanning a globe around (IX06).
- Explore under the cursor (SN09).
- A scan of live video.
- Recording a scan as a WAV (SN12 renders the playlist; IX08 records explorations).

## Result

Built on `feature/SN08-scan-mode` (agent E, 2026-11-12).

**Files.** New: `src/sonify/scan.ts`, `scan.test.ts`, `__golden__/scan.json`; `src/features/player/Scan.tsx`, `Scan.test.tsx`, `scanFeatures.ts`. Edited: `listenMode.ts` (the `'scan'` value), `index.tsx` (the third choice and its render only).

**Two things outside Touches, for the reviewer.**
- `src/features/player/listenMode.test.ts` used the string `'scan'` as its example of "a remembered value it does not know". `'scan'` is now a known mode, so that one line became `'karaoke'`. Nothing else in the test changed.
- The scan line is styled inline in `Scan.tsx` (white, 3 px, a dark outline that survives forced colours), because `symphony.css` is not in Touches. `Scan.tsx` reuses `symphony.css` for the status line and the Listen-as look.

**Decisions where the ticket was silent.**
- Date: a Date slider (hidden for a one-frame data set), disabled while a scan runs.
- Focus: pressing Scan disables it, so focus moves to Stop scan and returns to Scan when the scan ends; Escape works from anywhere (a document listener while a scan runs), not only inside the panel.
- A scan in which every column is a dropout does not sweep: one dropout cue, and the words "Not enough data to scan this date." (status line and announcement). Some columns missing: the sweep plays and each missing column plays the cue.
- A natural end leaves the ensemble on so the last notes ring out; only Stop, Escape or the browser pausing the sound call `ensemble.stop()`.
- The line is placed inside `mapArea`, because the grid covers the map area, not the whole picture.

**Checks.**

```
npm run lint   -> oxlint, no findings
npm run build  -> built in 1.94s
npm test       -> Test Files 1 failed | 132 passed (133); Tests 1 failed | 2233 passed (2234)
```
The one failure is `src/App.test.tsx > App shell > loads the first visualization and shows it on each page` (`expect(element).toBeEnabled()`). It fails the same way on a clean `main` (checked with my changes stashed), so it is not from this ticket. `player.test.tsx`, `change.test.tsx`, `vibration.test.tsx` and the Symphony tests pass unchanged. (`MascotDock.test.tsx` timed out once under full-suite load and passes on its own and on the next full run.)

New tests: 17 in `scan.test.ts` (plan, pan, determinism, golden for the fixture and `synthetic-storm` frame 0) and 25 in `Scan.test.tsx` (no sound before a click, one chord per column at `start + atMs`, dropout columns, line at column 31 at 2.5 s, reduced motion, start and end announced once and nothing per column, Stop and Escape, focus, hidden page, axe, the third radio in the Listen page, and `scanFeatures` caching).

**Manual check (step 5): not done.** This session has no speakers and no listener, so nothing was heard. Still to do by a person: `npm run dev`, Listen, choose Scan on a frame with a clear warm patch, and note whether the notes are louder and brighter where the patch is. Record what was heard here.

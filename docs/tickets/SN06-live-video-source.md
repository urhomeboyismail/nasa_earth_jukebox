# SN06 Live video source: read each displayed EIC frame as it plays

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01, SN05 |
| **Hotspots** | — |
| **Branch** | `feature/SN06-live-video-source` |

## Goal

When a data set has a `video` (SN05), the frame the listener sees is the frame that is read: a same-origin `<video>` plays, each frame it shows is drawn to an `ImageBitmap`, a worker extracts `FrameFeatures` from it (SN01), and the result carries the date that frame maps to and a confidence. When the browser cannot do this, or the video fails, the checked PNG frames are stepped through instead, and the listener is told which one is in use. Frames are dropped, never queued.

## Why

- Today the player shows checked PNG frames and analyses them once (`src/analysis/index.ts` `analyzeFrame`, cached per frame). Nothing reads the picture as it is shown. The v3 design asks for the live reading (`docs/PLAN.md` §6.3, "Pipeline").
- `requestVideoFrameCallback` runs once per frame the browser presents, with `metadata.mediaTime`, which is what the date mapping needs. It is supported in Chromium 83+, Safari 15.4+ and Firefox 132+. An older browser needs the fallback below.
- H.264 changes colours a little (the encoder's colour conversion), so a live pixel may differ from the checked PNG. The live reading uses `LIVE_COLOUR_TOLERANCE` (SN01) and reports `confidence`. It must never guess a cell: a cell below the threshold is missing (`PLAN.md` §6.3).
- The worker and the bitmap path do not exist yet: `src/analysis/worker.ts` only takes URLs (`protocol.ts`). SN01 adds the bitmap path; this ticket uses it.

**Order.** This ticket needs `extractInWorker` and `FrameFeatures` from SN01 (the queue's Needs column lists only SN05). SN01 must be on `main` first. It also needs `dateOfVideoFrame` from SN05.

## Design

Files, all new, in `src/analysis/video/` (team leader's `src/analysis/`, `PLAN.md` §4):

| File | Contents |
|---|---|
| `clock.ts` | Pure: `videoIndexFor(mediaTime, fps)`, `FRAME_RATE_CAP_HZ`, `MIN_FRAME_GAP_S`. |
| `liveSource.ts` | `LiveSource`: the `<video>` reader (rVFC, with the animation-frame fallback), back-pressure, dates, confidence. |
| `frameSequence.ts` | `FrameSequenceSource`: the checked PNG frames, stepped through at a set speed. |
| `useLiveSource.ts` | Hook for React: starts and stops a source, reports status, disposes on unmount. |

### Constants (`clock.ts`)

```ts
/** The most frames a second are read, live or stepped. Above this a frame is dropped, not queued. */
export const FRAME_RATE_CAP_HZ = 20
export const MIN_FRAME_GAP_S = 1 / FRAME_RATE_CAP_HZ
/** If the video has not started producing frames this long after play, the checked frames are used instead. */
export const VIDEO_START_TIMEOUT_MS = 3000
/** Frames stepped per second in the fallback, by playback speed (the same speeds as the player's STEP_MS). */
export const SEQUENCE_STEP_MS = { slow: 1600, normal: 1000, fast: 500 } as const
```
`videoIndexFor(mediaTime, fps) = Math.round(mediaTime × fps)`. Rounding (not flooring) keeps a frame at its own time when the browser reports a time a fraction early.

### Types

```ts
export type LiveFrame = {
  features: FrameFeatures          // SN01
  date: string                     // dateOfVideoFrame(video, videoIndex) (SN05), or the frame's own date in sequence mode
  videoIndex: number | null        // null in sequence mode
  mediaTime: number | null
  confidence: number               // features.confidence, repeated here for the status line
}

export type SourceStatus = 'idle' | 'video' | 'frames' | 'stopped' | 'error'
//  video: the <video> is producing frames; frames: the checked PNG frames are in use (say why in the status text)

export type LiveSourceOptions = {
  video: HTMLVideoElement
  visualization: Visualization     // reads `video` (SN05), `frames`, `colorScale`, `mapping`, `mapArea`, `legend`, `baseline`
  onFrame(frame: LiveFrame): void
  onStatus(status: SourceStatus, reason?: string): void
  /** Test seam: replaces the worker call. Defaults to extractInWorker (SN01). */
  extract?(stream: string, bitmap: ImageBitmap, input: ExtractInput): Promise<FrameFeatures>
}

export class LiveSource {
  constructor(options: LiveSourceOptions)
  /** Must be called from the Play click (WCAG 1.4.2). Starts the video and the reading. */
  start(): void
  /** Pauses the reading and the video. The next start() continues. */
  stop(): void
  /** Stops, removes listeners and closes any bitmap still held. */
  dispose(): void
  /** Frames dropped because a reading was still in progress (back-pressure). */
  readonly dropped: number
}
```
`FrameSequenceSource(options: { visualization, onFrame, onStatus, step: keyof typeof SEQUENCE_STEP_MS, extract? })` has `start()`, `stop()`, `dispose()`, and `seek(index)` for the scrub.

### The live path

1. `start()` calls `video.play()` and then uses `requestVideoFrameCallback` if the method exists; otherwise `requestAnimationFrame`.
2. **With `requestVideoFrameCallback`:** each callback gives `metadata.mediaTime`. `videoIndex = videoIndexFor(mediaTime, video.fps)`, `date = dateOfVideoFrame(spec, videoIndex)`. The frame is read only if `now − lastAccepted ≥ MIN_FRAME_GAP_S`, otherwise it is dropped.
3. **Without it (the fallback):** each animation frame, if `video.currentTime` has changed and at least `MIN_FRAME_GAP_S` has passed, `createImageBitmap(video, { colorSpaceConversion: 'none' })` is taken and the video index is `videoIndexFor(video.currentTime, fps)`. This is the same reading, a little less exact in time.
4. **Back-pressure.** At most one reading is in flight. While one is in flight, a new frame is dropped: its bitmap is closed and `dropped` goes up by one. Nothing waits in a queue.
5. **Reading.** `extract('live', bitmap, input)` with `input = { frameId: date, date, mode: legendOf(v), colorScale, mapping, area: v.mapArea ?? whole image, colourTolerance: LIVE_COLOUR_TOLERANCE, baseline (when the data set has one, as the frame path builds it) }`. The baseline in live mode is the frame's own normal for the same date, read from the checked files, or the data set has no baseline. A live reading with no baseline has `change` null.
6. `onFrame({ features, date, videoIndex, mediaTime, confidence: features.confidence })` runs for each accepted reading. Status is `'video'`.
7. **Fallback to the frames.** If the video has not produced a frame within `VIDEO_START_TIMEOUT_MS` after `play()`, or it fires `error`, or `video.readyState` stays below 2, `onStatus('frames', reason)` is called and `FrameSequenceSource` takes over from the current frame's date. The reason is a plain sentence ("The video did not start, so the checked frames are used.").

### The sequence path (`frameSequence.ts`)

The checked frames (`visualization.frames`, in date order) are read with `readPixels` and `pixelsFromBitmap` (SN01), or through `extract` with the image URL, one at a time, at the step time in `SEQUENCE_STEP_MS`. The reading is the same as the live one, with `colourTolerance` 1 (checked frames) and `frameId` the frame's id. The date is the frame's date. The next frame is read only after the last one finished (no queue), so a slow phone skips a step instead of falling behind.

### Dates and confidence

- The date shown with a live reading is `dateOfVideoFrame`. A date that is not a dated frame of the data set is still shown (a video can have more frames than the checked set); the listener is not told "missing".
- `confidence` (0 to 1, SN01) is passed through. Showing it (a line such as "Reading confidence 84%") is SN07's job; this ticket only supplies it. The status for a low confidence (below 0.6) is the reason the reading may be less exact: `onStatus('video', 'Colours from the video are a little off; readings may be less exact.')`.

## Reuse

- `extractInWorker`, `FrameFeatures`, `ExtractInput`, `LIVE_COLOUR_TOLERANCE`, `resetStream` (`src/analysis/features/`, SN01).
- `readPixels` (`src/analysis/pixels.ts`), for the sequence path's PNG frames.
- `dateOfVideoFrame`, `videoFrameOf`, `legendOf` (`src/data/`, SN05).
- `installFakeWorker` (`src/test/fakes.ts`).
- `SEQUENCE_STEP_MS` values match `STEP_MS` in `src/features/player/usePlayer.ts`. Do not import from it (that is the player's hotspot); copy the numbers into `clock.ts` and test that they match.

## Touches

- New: `src/analysis/video/**` (all files above), with tests.
- Do not touch the player (`src/features/player/**`): SN07 wires this into the Listen page.
- Do not edit `src/analysis/index.ts` or `pixels.ts`.
- Reviewer: team leader (`src/analysis/`); Mohammad when SN07 wires it.

## Steps

1. Write `clock.ts` and its tests (the index rounding, the constants).
2. Write `liveSource.ts` with the rVFC path first, against a fake `<video>`. Then the animation-frame fallback. Then back-pressure and the bitmap closing.
3. Write the fallback to the frames (`frameSequence.ts`) and the switch on timeout or error.
4. Write `useLiveSource.ts`: create on mount, `stop()` and `dispose()` on unmount; status with `useSyncExternalStore`.
5. Add the H.264 check to the manual list: play a real EIC01 MP4 (EIC01 output) in Chromium, Safari and Firefox, and record which path runs (`video` or `frames`), and the frame rate, in Result.

## Tests

Use a fake `<video>` (a plain object with `play`, `currentTime`, `readyState`, `error`, `requestVideoFrameCallback` that records its callback). Use `vi.useFakeTimers()` for timeouts. `createImageBitmap` is stubbed to return `{ close: vi.fn(), width, height }`. The worker is the `extract` seam, or `installFakeWorker` for the path test.

- **Date mapping.** `mediaTime` 1.0 at 10 fps gives index 10; the date is `firstFrameDate + 10 × frameStepDays`. `mediaTime` 0.04 at 25 fps rounds to index 1.
- **Back-pressure.** Five callbacks arrive while one reading is pending: one `extract` call, four drops (`dropped` is 4), every bitmap that was not read is closed.
- **Rate cap.** Two callbacks 10 ms apart: the second is dropped; 60 ms apart: both are read.
- **Fallback path.** With no rVFC, the animation-frame loop reads a new `currentTime` only once.
- **Fallback to frames.** No frame within `VIDEO_START_TIMEOUT_MS`: `onStatus('frames', …)` with a sentence, and the sequence source runs. An `error` event does the same at once.
- **Sequence.** Frames are read in date order; the next is not read until the last one finished; `seek` moves to the frame's index.
- **Confidence.** A reading below 0.6 raises the status reason.
- **Stop and dispose.** `stop()` pauses the video and ends the loop; `dispose()` closes the bitmap in flight and removes the listeners; no callback fires after `dispose()`.
- **Clock constants.** `SEQUENCE_STEP_MS` equals the player's `STEP_MS` (a test reads both and compares; this is the only test that touches the player module, and it only reads it).
- **Boundary.** `src/boundary.test.ts` already covers `analysis/**`; nothing in `video/` may call `fetch` directly (the PNG reads go through `readPixels`) or import the assistant.

- **Golden.** `src/analysis/video/__golden__/sequence.json`: the frame-sequence path run on the fixture's four frames (with `extract` injected), and on `synthetic-storm` (after SN02): for each frame, its date, the `videoIndexFor` of its time at 10 fps, and the `LiveFrame` fields other than the features (the features are SN01's golden).

## Guardrails

- Nothing starts before a click or key press: `start()` is called only from the Play handler (SN07). The status is `idle` until then.
- Nothing flashes: the reading does not change the picture. The video plays the NASA frames as they are; no effect is added.
- Under `prefers-reduced-motion` the video is still played by the listener's own choice (the play button); this ticket adds no motion.
- Frames are dropped, never queued: a slow device loses frames, not time. The date always comes from the video's own time.
- Colours from H.264 may differ: the tolerance is wider for video, and a cell that does not match is missing, never guessed.
- No model, no network beyond the same-origin video and PNG files.

## Done when

- The live path reads frames from a `<video>` with rVFC, and the fallback reads them with the animation-frame loop; both drop frames rather than queue them.
- The fallback to the checked frames runs on a timeout, an error or no video, and says why.
- Dates come from `dateOfVideoFrame`; confidence is passed through.
- The tests pass, and the manual browser check (Step 5) is recorded in Result for at least Chromium and one other browser.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- The Listen page, its buttons and the status line (SN07).
- Writing the MP4 (EIC01) and its check (SN05).
- Any change to the checked-frame analysis (`src/analysis/index.ts`).
- Reading a video that is not same-origin: the site serves its own files only.

## Result

Not started.

# SN12 Offline render: byte-identical WAV, captions file, playlist of every data set

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN01, SN03, SN04 |
| **Hotspots** | about |
| **Branch** | `feature/SN12-offline-render-playlist` |

## Goal

A data set can be rendered to a file, from its **checked frames**, through the same ensemble graph that plays live. The output is three files per data set: a 16-bit stereo WAV, a WebVTT caption file (one cue per date, with the caption words), and a JSON sidecar that maps each cue to its date and its music. Rendering the same data set twice gives the same bytes. **Render the playlist** renders every data set in the catalogue in turn.

## Why

- `src/audio/engine.ts` `renderToWav` renders the old one-note sequence (`Tone.Offline`, `encodeWav`). There is no render of the v3 music, so the WAV a listener downloads would not be the sound they hear.
- `src/audio/wav.ts` `encodeWav` is pure and already writes the bytes by hand (16-bit PCM). Reuse it; do not write another encoder.
- The engine's noise hiss is random (`engine.ts` `missingNoise`, a `NoiseSynth`), so its WAV is not repeatable. The ensemble uses no noise (SN04), so its output can be byte-identical.
- The team's listening check and the video need the same sound as the app. A downloadable, captioned file also helps listeners who want to keep the sound (the "playlist of original generated audio" objective in `CHALLENGE.md`).

**Order.** The queue lists SN04. This ticket also needs SN01 (`extractFeatures`, `extractInWorker`), SN03 (`toMusicFrame`, `presetFor`, `MusicFrame`) and the catalogue (`loadCatalog`, `loadVisualization`). Merge those first.

## Design

### Files

| File | Contents | Pure? |
|---|---|---|
| `src/sonify/schedule.ts` | `buildSchedule(musicFrames, stepSeconds)` and `stepSecondsFor(frameCount)`. | yes |
| `src/sonify/vtt.ts` | `toVtt(cues)`: WebVTT text. | yes |
| `src/sonify/sidecar.ts` | `toSidecar(input)`: the JSON mapping. | yes |
| `src/features/playlist/renderSequence.ts` | `renderSequence(visualization, options, deps)`: reads the checked frames, extracts, plans, renders, encodes. | no (browser) |
| `src/features/playlist/renderPlaylist.ts` | `renderPlaylist(entries, options, deps)`: each data set in turn, with progress. | no |
| `src/features/playlist/PlaylistPanel.tsx` | The button, the progress line, the download links. | no |

`src/sonify/` stays pure (boundary). The browser-side code is in `src/features/playlist/` (a new folder; no owner yet).

### Constants

```ts
export const RENDER_SAMPLE_RATE = 44100
export const RENDER_MAX_SECONDS = 170           // under the ensemble's 180-second limit, with room for the tail
export const RENDER_STEP_SECONDS = 1            // one date a second at most
export const RENDER_TAIL_SECONDS = 1.5
export const RENDER_DETAIL: DetailLevel = 'full'
```
`stepSecondsFor(frameCount) = min(RENDER_STEP_SECONDS, RENDER_MAX_SECONDS / frameCount)`. A data set with 200 dates renders at 0.85 s a date; the rule is written down, so the same data set always gives the same length.

### The steps (`renderSequence`)

1. **Features.** For each checked frame in date order: read the PNG (`readPixels`, as the frame path does), and `extractFeatures(pixels, input, previous)` (SN01) with `previous` carried. The `input` is built the same way as the live path's: `mode = legendOf(v)`, the `colorScale`, `mapping`, `area` (`mapArea` or the whole image), and `baseline` when the data set has one, read from the checked baseline images. `colourTolerance` is 1 (the checked frames). The result is the same as the Listen page's features for the same frame.
2. **Music.** `toMusicFrame(features, preset, previous)` for each frame, with `preset = presetFor(visualization.sonification?.preset ?? 'major')`.
3. **Schedule.** `buildSchedule(musicFrames, stepSeconds)` returns `{ frame, atSeconds: i × stepSeconds }`. Pure.
4. **Render.** `ensemble.renderOffline(schedule, { detail: RENDER_DETAIL, sampleRate: 44100, tailSeconds: 1.5 })` returns `[left, right]`. `encodeWav([left, right], 44100)` (`src/audio/wav.ts`) gives the file.
5. **Captions.** `toVtt(cues)`: one cue per frame, from `atSeconds` to `atSeconds + stepSeconds`, identifier = the frame id, text = the frame's `summary`, and on the next line the audible `caption` lines joined by a space (only the voices that are not `''`). The header is `WEBVTT`, then a blank line, then the cues, in order, with `HH:MM:SS.mmm` timestamps.
6. **Sidecar.** `toSidecar({ id, title, preset: preset.id, detail: RENDER_DETAIL, sampleRate, stepSeconds, dropoutSeed: DROPOUT_SEED, frames: [...] })`. Each frame entry: `frameId`, `date`, `atSeconds`, `confidence`, `dropout`, `missing`, `summary`, `hotspotIds` (the tracked ids, which is what the marker and event words use). **No timestamp of the render, no host name, no random id**: the file must be the same every time.
7. **Output.** `{ id, wav: Blob, vtt: string, sidecar: string }`. The WAV's file name is `<id>.wav`, the captions `<id>.vtt`, the sidecar `<id>.json`.

### The playlist (`renderPlaylist`)

- Reads `public/data/index.json` (`loadCatalog`), then renders each entry with `renderSequence`, one after another (never in parallel: memory). Before each one it reports progress: "Rendering 2 of 5: <title>."
- Returns the outputs in catalogue order, plus `playlist.json`: `{ items: [{ id, title, file: "<id>.wav", seconds }] }`, with no time stamp.
- A data set that fails (a frame cannot be read) is listed with its message and the others still render; the playlist says which one failed.

### The panel (`PlaylistPanel.tsx`)

- A button **Render the playlist**, in the About page (one line in `src/features/about/index.tsx`). While it runs, the button is disabled and the progress line is shown; the progress is also announced through `useAnnounce` at each step.
- When done: a list of download links, one WAV, VTT and JSON per data set, and `playlist.json`. Each link has a name in words ("Download Synthetic motion as a WAV file"). Links are blob URLs, revoked when the panel unmounts.
- No file is created until the button is pressed.

## Reuse

- `encodeWav` (`src/audio/wav.ts`), pure, byte-exact.
- `createEnsemble`, `renderOffline`, `DROPOUT_SEED` (`src/audio/ensemble/`, SN04).
- `extractFeatures`, `extractInWorker`, `FrameFeatures` (`src/analysis/features/`, SN01), `readPixels` (`src/analysis/pixels.ts`).
- `toMusicFrame`, `presetFor`, `MusicFrame` (`src/sonify/`, SN03).
- `loadCatalog`, `loadVisualization` (`src/data/index.ts`).
- `useAnnounce`, `Button`.
- For the tests: `createHash` from `node:crypto` (vitest runs in Node; the test file may import it, as `src/data/change-regression.test.ts` imports `node:fs`).

## Touches

- New: `src/sonify/schedule.ts`, `vtt.ts`, `sidecar.ts` and their tests; `src/features/playlist/**` with tests; `src/features/playlist/__golden__/` (none needed: the byte test is a hash).
- Edit: `src/features/about/index.tsx` (one line mounting `PlaylistPanel`).
- Do not edit `src/audio/engine.ts` (its `renderToWav` stays for the old one-note sound, unchanged).

## Steps

1. Write `schedule.ts`, `vtt.ts`, `sidecar.ts`, each with its tests (pure).
2. Write `renderSequence.ts` with `deps` for the renderer and the reader, so a test can give a stub renderer.
3. Write `renderPlaylist.ts` and its progress and failure rules.
4. Write `PlaylistPanel.tsx` and mount it on About.
5. Run the checks, then the manual check in a browser: render one data set twice, and compare the two WAV files with `shasum -a 256` (the two hashes must match). Check the peak with the command in SN04 (−1.00 dBFS or lower). Record both in Result.

## Tests

- **Byte identity.** `renderSequence` on the fixture, with a stub `renderOffline` that makes deterministic samples from the schedule (for example a sine per frame, from its midi), run twice; the WAV bytes are equal, and their SHA-256 (`createHash('sha256')`) is equal. The stub is the test's own, so this tests the pipeline (features, music, schedule, encoding), not Tone.
- **WAV header.** The file starts with `RIFF`, `WAVE`, has 2 channels, 44100 samples a second, 16 bits. The data length is the number of frames × 4 bytes.
- **Schedule.** `atSeconds` is `i × stepSeconds`, in date order; `stepSecondsFor(12) = 1`; `stepSecondsFor(400) = 0.425`.
- **VTT.** Starts with `WEBVTT`; one cue per frame; timestamps are `HH:MM:SS.mmm --> HH:MM:SS.mmm` and increase; cue identifiers are the frame ids; no empty cue text (a dropout date says the dropout sentence).
- **Sidecar.** Parses as JSON; has one entry per frame; contains no time stamp or host or random id (a test renders twice and compares the strings).
- **Playlist.** Renders in catalogue order; progress is reported before each item; a failing data set is listed with its message and the rest still render.
- **Panel.** The button is disabled while running; download links have names in words; `expectNoA11yViolations` on the panel.
- **Length limit.** A schedule longer than `RENDER_MAX_SECONDS` is never produced by `stepSecondsFor`.

- **Golden.** `src/sonify/__golden__/render.json`: for the fixture and `synthetic-storm` (after SN02), the VTT text and the sidecar JSON from `renderSequence` with the test renderer, plus the SHA-256 of the WAV, all recorded as text. A change in any of them shows in the diff.

## Guardrails

- The same data always gives the same bytes: no random, no time stamp, no host name, no ids from the browser. The noise is never used (SN04).
- The peak stays at or below −1 dBFS (the ensemble's limiter; checked in the manual step).
- Captions are text in the file, so a listener who downloads the sound also gets the words.
- Nothing is created until the listener presses the button, and nothing is uploaded: the files are made in the browser.
- No model, no network beyond the same-origin PNG and JSON.
- Nothing data-set-specific in `src/`: the playlist reads the catalogue.

## Done when

- `renderSequence`, `buildSchedule`, `toVtt` and `toSidecar` pass their tests, including the byte-identity test.
- The playlist renders every catalogue entry, in order, with the failure rule.
- The panel works and is on About.
- The manual check (two renders with equal hashes; peak −1.00 dBFS or lower) is recorded in Result.
- `npm run lint && npm test && npm run build` pass with their real output in Result.

## Checks

```bash
npm run lint && npm test && npm run build
```

Manual, after `npm run dev` (paste the real output into Result):

```bash
shasum -a 256 <first>.wav <second>.wav        # the two hashes must be equal
python3 -c "import wave,array,math,sys; w=wave.open(sys.argv[1]); a=array.array('h',w.readframes(w.getnframes())); p=max(abs(x) for x in a)/32768; print('peak dBFS', round(20*math.log10(p),2))" <first>.wav
```

## Out of scope

- A ZIP file of the playlist (each file is downloaded on its own).
- Rendering the scan (SN08) or a listener's own exploration (IX08).
- Video output (the MP4 is EIC01's, and it is not rendered from the sound).
- Changing the old engine's `renderToWav`.

## Result

Not started.

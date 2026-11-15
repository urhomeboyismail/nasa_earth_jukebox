# EIC06 ECCO2 (SVS 3912): multi-region sonification JSONs and synced moving visuals

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (four sub-tickets, one per subagent) |
| **Who** | agent+👤 (agents build; a person reviews the generated text and listens) |
| **Needs** | — |
| **Hotspots** | `src/sonify/`, the `/listen` stage, `/compare` |
| **Branch** | `feature/EIC06-ecco2-jsons` |
| **Status** | local only: not in `docs/TICKETS.md`, not claimed on `origin/main` |
| **Spec** | `current_visual.md` (the person's brief, followed as written by the person's choice on 15 Nov 2026) |

## Goal

Turn NASA SVS 3912 (ECCO2 model, 2007-03-25T12:00Z to 2008-03-03T12:00Z) into an offline precompute:

- six JSON timelines in `public/data/json_output/` (the five crops of the global video plus the Pacific globe), with an `index.json` manifest;
- matching web MP4s and posters in `public/media/`;
- a front end that plays each video in sync with Tone.js, reading `timeline[step]` and the 16 × 8 `spatial_grid`.

The work is done by four subagents in `.claude/agents/`.

## Why

The source files are in `~/Downloads/`, staged in `Consumption/Ocean/SVS/ecco2/` and ignored by git. They were checked with ffprobe on 15 Nov 2026:

| File | What it is |
|---|---|
| `ecco2_sst_flow.mp4` | H.264, 2048 × 1024 equirectangular (−180° to 180°), 30 fps, **2,001** decoded frames (the brief says 2,002), 66.7 s. The camera is fixed: land overlaps 0.976 between frames 0 and 1,990. |
| `pacificcurrents_no_overlay_1080p30_2.mp4` | H.264, 1920 × 1080, 30 fps, 2,031 frames, 67.7 s. A globe that drifts: land overlaps 0.676. The brief gives no dates for it. |
| `sst_ecco2_cbar.png` | 310 × 95. "Sea Surface Temp (°C)", 0 / 10 / 20 / 32 °C. The coloured body is at x 14 to 291, y 28 to 68, and the scale is linear (the ticks are evenly spaced). |

## Known conflicts with the repo rules (accepted by the person)

- `public/data/json_output/` and `public/media/` sit beside the zod-checked `public/data/<id>/manifest.json` system. `npm run check-data` does not see them.
- Sub-ticket T4 puts mappings for this one data set into `src/` (`phases.md`).
- Sub-ticket T3 has a model write `accessibility_text` and `echo_callout` (ADR-0005). A person must review every line before merge.
- New Python dependency: `opencv-python-headless` (Farneback flow), added to `scripts/requirements.txt`.

## Sub-tickets (one per subagent, in order)

| # | Subagent (`.claude/agents/`) | Output | Needs |
|---|---|---|---|
| **T1** | `vision-etl-extractor` | `scripts/ecco2_extract.py` and its test; six `public/data/json_output/ecco2_*.json`, without the text fields | — |
| **T2** | `visual-media-processor` | `public/media/ecco2_*.mp4` (1280 × 640 global; the crops at the same boxes; `+faststart`, no audio) and `*_poster.jpg` | T1's boxes |
| **T3** | `science-narrator-rag` | `accessibility_text` and `echo_callout` on every step, `what_you_will_try`, and `public/data/json_output/index.json` | T1 |
| **T4** | `frontend-visual-audio-binder` | `/listen` plays `visual_assets.video_url` in sync with the Tone.js transport (play, pause, scrub, loop, 0.5× to 2×); the audio mapping (low-pass 250 to 3,500 Hz, pitch, LFO, chorus, panner); `/compare` by `iso_date`. Tests and a11y checks as `frontend.md` says. | T1 to T3 |

### T1 details (the extractor)

- **Sampling:** 2 steps a second, which is every 15th video frame: 134 steps for the global video and 136 for the Pacific. `time_sec = frame / 30`. `iso_date = start + frame × (end − start) / 2001`, which is about 4.126 h a frame.
- **Lookup table:** the bar's middle row (y 48, x 16 to 289) gives 0 to 32 °C linearly. A pixel's temperature is its nearest bar colour in RGB.
- **Ocean mask:** a pixel is ocean if its brightness varies over time (std > 8 across the sampled frames) **and** it is saturated in that frame (a coloured streak). This drops grey land, the black between streaks and the space around the globe.
- **Metrics per step and region:**
  - `sst_celsius_mean`, `sst_celsius_min`, `sst_celsius_max`: the min and max are the 2nd and 98th percentiles, which drops stray antialiasing pixels.
  - `sst_normalized` = mean / 32.
  - `current_velocity_norm`: the mean Farneback magnitude between frames n and n + 1 at half size, divided by that region's 99th-percentile value over the timeline and clipped to 0 to 1.
  - `eddy_vorticity_norm`: the mean |∂v/∂x − ∂u/∂y|, normalised the same way.
  - `thermal_anomaly`: (mean − the timeline's mean) / the largest |deviation|, from −1 to 1. The data is under a year long, so the "annual rolling mean" is the whole-timeline mean.
  - `intensity_marker`: the mean of `sst_normalized`, `current_velocity_norm` and `eddy_vorticity_norm`. The brief does not define it; this is the agent's choice and can be changed.
- **`spatial_grid`:** 8 rows × 16 columns, each cell `[sst_norm, velocity_norm]`, or `null` where a cell has no ocean.
- **Regions** (lon/lat boxes on the global video; `normalized_crop_box` = `[x, y, w, h]`):

| id | box (W, S, E, N) |
|---|---|
| `ecco2_global_ocean` | −180, −90, 180, 90 |
| `ecco2_gulf_stream` | −82, 25, −40, 50 |
| `ecco2_equatorial_pacific` | −170, −15, −80, 15 |
| `ecco2_indian_ocean_mauritius` | 30, −40, 85, −5 (as the brief gives: crop box 0.583, 0.527, 0.153, 0.194) |
| `ecco2_antarctic_circumpolar` | −180, −70, 180, −40 |
| `ecco2_pacific_globe` | the whole Pacific frame (`bbox_lon_lat: null`). Its dates are **assumed** to be the same as 3912's; 👤 must confirm. |

- `metadata.source` is "NASA SVS 3912 (ECCO2 Model)". `calibration` uses the brief's constants.

## Touches

- New: `.claude/agents/{vision-etl-extractor,visual-media-processor,science-narrator-rag,frontend-visual-audio-binder}.md`, `scripts/ecco2_extract.py`, `scripts/tests/test_ecco2_extract.py`, `public/data/json_output/**`, `public/media/**`.
- Edit: `scripts/requirements.txt` (OpenCV); T4's `src/` files (listed in T4's result).
- Staged, never committed: `Consumption/Ocean/SVS/ecco2/**`.

## Guardrails

- No sound before a click or key press. Peak ≤ −1 dBFS. Every sound has a text equivalent, announced through `useAnnounce`.
- Nothing flashes more than 3 times a second. Under `prefers-reduced-motion` the video does not autoplay.
- Plain CSS with the tokens in `src/styles/tokens.css`. No Tailwind, no Anime.js.
- The same input gives the same JSON. The extractor uses no randomness.
- Credit "NASA/Goddard Space Flight Center Scientific Visualization Studio", with a link to SVS 3912. 👤 confirms it.

## Checks

```bash
.venv/bin/python -I -m pytest scripts/tests -q
npm run lint && npm test && npm run build
du -sh public/data/json_output public/media
```

## Result

### T1 (vision-etl-extractor)

Done by the main agent, 15 Nov 2026, following `.claude/agents/vision-etl-extractor.md`. Not committed and not pushed.

- `scripts/ecco2_extract.py` and `scripts/tests/test_ecco2_extract.py` (4 tests: the crop box matches the brief's Mauritius box, the lookup table is linear, the dates span 2007-03-25T12:00Z to 2008-03-03T12:00Z at 4.126 h a frame, and the grid is NaN where there is no ocean). `opencv-python-headless` was added to `scripts/requirements.txt` and installed in `.venv` (cv2 5.0.0).
- Run: `.venv/bin/python -I scripts/ecco2_extract.py --src Consumption/Ocean/SVS/ecco2 --out public/data/json_output`, 5 min 52 s. Six files, 1.6 MB in all:

| file | steps | mean °C range | aspect | grid cells with ocean (step 0) |
|---|---|---|---|---|
| `ecco2_global_ocean` | 134 | 21.2 to 22.7 | 2:1 | 108 / 128 |
| `ecco2_gulf_stream` | 134 | 16.8 to 27.5 | 119:71 | 106 |
| `ecco2_equatorial_pacific` | 134 | 26.7 to 29.6 | 256:85 | 128 |
| `ecco2_indian_ocean_mauritius` | 134 | 23.8 to 28.4 | 52:33 | 120 |
| `ecco2_antarctic_circumpolar` | 134 | 4.7 to 7.3 | 1024:85 | 119 |
| `ecco2_pacific_globe` | 136 | 24.6 to 26.2 | 16:9 | 88 |

- Every step of every file has ocean. The velocity, vorticity and anomaly values span 0 to 1 (−1 to 1 for the anomaly) as specified.
- Global video dates: 2007-03-25T12:00Z to 2008-03-03T07:52Z. The last step is frame 1,995; the video's last frame (2,000) is 2008-03-03T08:00Z, because ffprobe decodes 2,001 frames, not the brief's 2,002.
- Pacific globe dates are spread over its own 2,031 frames and are **assumed** to be 3912's dates (👤 to confirm).
- Caveats:
  - The global mean (about 22 °C) is a mean over pixels that show streaks. It is not area-weighted, so it is not the true global mean SST (about 18 °C).
  - The velocity is the speed of the streak animation in pixels a frame, normalised per region. It shows relative change, not m/s.
- Checks: `.venv/bin/python -I -m pytest scripts/tests -q` gives the line below.

**Next:** T2 `visual-media-processor` (the MP4s and posters).
116 passed, 1 skipped in 6.53s

### T2 (visual-media-processor)

The `visual-media-processor` agent made all six first-pass encodes and posters (crf 26), then stopped before it could re-encode two oversized files or report. The main agent finished T2 on 15 Nov 2026. Not committed.

| file | crop (source px) | output | frames | crf | MiB |
|---|---|---|---|---|---|
| `ecco2_global_ocean` | 2048×1024 at 0,0 | 1280×640 | 2001 | 32 | 14.2 |
| `ecco2_gulf_stream` | 238×142 at 557,228 | 238×142 | 2001 | 26 | 3.4 |
| `ecco2_equatorial_pacific` | 512×170 at 57,427 | 512×170 | 2001 | 26 | 11.0 |
| `ecco2_indian_ocean_mauritius` | 312×198 at 1195,540 | 312×198 | 2001 | 26 | 7.5 |
| `ecco2_antarctic_circumpolar` | 2048×170 at 0,740 | 1280×106 | 2001 | 26 | 7.7 |
| `ecco2_pacific_globe` | 1920×1080 at 0,0 | 1280×720 | 2031 | 35 | 14.4 |

- Total `du -sh public/media`: 59M. Six posters (`*_poster.jpg`, frame 0, `-q:v 4`) as well.
- All six videos: H.264, yuv420p, 30 fps, no audio stream, `moov` before `mdat` (faststart). The frame counts match the sources, so `time_sec` = `currentTime`.
- Re-encoded to get under 15 MiB: the global map was 38.7 MB at crf 26, now 14.2 MiB at crf 32. The Pacific globe was 56.6 MB at crf 26 and 22.7 MiB at crf 32, now 14.4 MiB at crf 35. Detail in the streaks is softer at crf 35; check it by eye.
- The small crops stay at their source size; nothing is scaled up (Gulf Stream 238×142, Mauritius 312×198). The Antarctic strip is 1280×106, a very wide band.
- The command for one file: `ffmpeg -i ecco2_sst_flow.mp4 -vf 'scale=1280:640:flags=lanczos' -c:v libx264 -pix_fmt yuv420p -crf 32 -preset slow -an -movflags +faststart public/media/ecco2_global_ocean.mp4` (the crops add `crop=w:h:x0:y0,` before the scale).

**Next:** T3 `science-narrator-rag`.

### T3 (science-narrator-rag)

Done by the main agent, 15 Nov 2026, as a deterministic script rather than free model text, so every claim comes from the metrics and the text can be regenerated after T1 is re-run. Not committed.

- `scripts/ecco2_narrate.py` and `scripts/tests/test_ecco2_narrate.py` (6 tests). Run: `python3 -I scripts/ecco2_narrate.py --dir public/data/json_output`.
- Every step (806 in all) has `accessibility_text`: the date, the mean °C with the 2nd to 98th percentile range, and words for the warmth, speed, eddies, tone and pulse.
- `echo_callout` is on 5 or 6 steps per file: the intro, warmest, coolest, fastest, most eddies, and the biggest change between two steps. Events that fall on the same step are merged; every other step is `null`.
- `metadata.what_you_will_try` is set in each file, and `public/data/json_output/index.json` has 6 entries in the brief's Step 2A shape.
- Speed and eddies use a 5-step rolling median, and events skip the first 2 and last 2 steps. That is because T1 measures them from **one frame pair per step**, so they jitter with the streak animation: at step 2, `current_velocity_norm` is 1.0 in every crop at once, and the globe's last two steps are 0.
- **Follow-up for T1:** average the flow over several frame pairs per step. Even after smoothing, "fastest" and "most eddies" land on step 76 (7 Oct 2007) in four separate regions, which suggests a video-wide effect, not ocean physics. Until that is fixed, treat the "fastest" and "eddies" callouts as unreliable.
- 👤 to review (ADR-0005): the 6 summaries and 6 `what_you_will_try` lines in `REGION_TEXT` (agent-written), and the callout templates. Merged callouts run to 25 words, about 8 to 9 s spoken, a little over the 8 s target.
- Checks: `.venv/bin/python -I -m pytest scripts/tests -q`: 122 passed, 1 skipped.

**Next:** T4 `frontend-visual-audio-binder`.

### T4 (frontend-visual-audio-binder)

Done by the `frontend-visual-audio-binder` agent, 15 Nov 2026. Not committed.

**Files.** New, all in `src/features/ocean/`: `schema.ts` (zod for `index.json` and a track; loaders), `mapping.ts` (step, cutoff, pentatonic pitch, pulse, swirl, pan, grid lookup, reticle moves; pure), `sound.ts` (Tone graph: synth → low-pass → tremolo → chorus → panner → level → limiter at -1 dBFS; Transport bpm = 120 × rate, so one quarter = one step), `useOceanSound.ts`, `useOceanTracks.ts`, `OceanStage.tsx`, `OceanListen.tsx`, `OceanCompare.tsx`, `TrackPicker.tsx`, `Credit.tsx`, `ocean.css`, and tests `schema.test.ts`, `mapping.test.ts`, `sound.test.ts`, `OceanStage.test.tsx` (20 tests). Edited: `src/features/player/index.tsx` and `src/features/compare/index.tsx` (a lazy `#…?ocean=1` view plus one link after the existing content; nothing else changes for the manifest data sets), `src/audio/ensemble/toneMock.ts` (`make` exported, test-only). No new page, so `src/pages.ts`, `knowledge.py` and the server tests are not touched.

**Try it.** `npm run dev`, then `#listen?ocean=1` (or the link "Ocean video tracks" at the end of Listen), `#listen?ocean=1&track=ecco2_gulf_stream`, and `#compare?ocean=1`.

**Behaviour.** The video is the clock. Play/Pause, a Date slider (valuetext = `display_date`), Loop, speed 0.5×/1×/1.5×/2× (`playbackRate` and Transport bpm together). Seeks, stalls (`waiting`/`playing`) and drift of more than 0.3 s move the Transport. Every parameter uses rampTo (0.25 s, level 0.3 s). Explore puts a focusable reticle over the video (pointer or arrow keys). It reads `spatial_grid[row][col]` for the filter and pitch, pans by column from -1 to 1, and goes silent on a null cell; the cell is shown as text and announced on key moves. `echo_callout` steps show an "Echo:" caption for 7 s, duck the sound by 9 dB and announce the callout plus `accessibility_text` (busy-rate-limited). Pause and scrub announce `accessibility_text`. The visible line shows the date and the mean °C. Tone loads on the first Play, Explore or Hear click. The video is muted and playsInline, with a poster and no autoplay; under reduced motion it uses `preload="none"`. Compare: one track, two `iso_date` selects, both videos seeked to `time_sec`, metrics side by side, and "Hear <date>" (2.5 s preview).

**Checks** (15 Nov 2026):
- `npm run lint`: exit 0, warnings only, in `.claude/skills/impeccable/` and the existing `Fusion.tsx`. None in the new files.
- `npm test`: `Test Files 1 failed | 224 passed (225)`, `Tests 1 failed | 3198 passed (3199)`. The one failure is `src/data/datasets.test.ts > atmospheric-rivers`: TODO alt text in EIC05's uncommitted `public/data/atmospheric-rivers/manifest.json`, not this ticket. In an earlier run, `ArtPanel.test.tsx` "imports a valid file" failed once and then passed alone (flaky). The compare keyboard test that the first link placement broke is fixed: the link now comes after the existing content.
- `npm run build`: `✓ built in 1.52s`. The ocean chunks load on demand (OceanListen 6.1 kB, OceanCompare 3.2 kB, css 1.8 kB). There is the existing >500 kB chunk warning.

**Not done.** Not checked in a real browser (no listening, no look at sync accuracy or the layout). There are no global keyboard shortcuts (Space or K) for the ocean stage. The Explore reticle does not follow the video's object-fit letterbox (the overlay covers the whole box, and the box has the video's aspect ratio, so they match). The Pacific globe's grid assumes a fixed camera, and that globe drifts.

**Risks.**
- `sound.ts` sets Tone's one shared Transport's bpm and puts it back to 120 on dispose. The ocean view replaces the Listen and Compare content, so no other engine runs at the same time. Still, do not mount it beside another Transport user.
- Velocity and vorticity jitter per step (T3's note). The ramps smooth the sound, but the pulse rate still moves a lot.
- The callout and `accessibility_text` wording is generated and still needs 👤 review (ADR-0005). The credit needs 👤 confirmation.
- Code specific to this data set is in `src/features/ocean/` (accepted by the person).

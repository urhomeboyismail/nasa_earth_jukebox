# Performance (T85, step 1)

How long Listen takes to become playable, how long the sound map takes to appear, and how much memory it uses, for a heavy
data set. The numbers below were measured by Claude in **headless Chromium on a cloud machine with CPU throttling**. That is
a rough stand-in, not the real devices the ticket asks for. The two empty rows at the bottom are for the team to fill in.

## What was measured

Data: `public/data/stress-globe/`, made by

```bash
python3 -I scripts/make_synthetic_globe.py --frames 60 --width 1920 --height 1080 --out public/data/stress-globe
```

It is ignored by git (`public/data/stress-*/` in `.gitignore`). Do not commit it. The same script without options still writes
the committed 12-frame data set, byte for byte as before. The baseline is the committed `synthetic-globe` (12 frames, 1200 × 600).

| Measure | How |
|---|---|
| **Play ready** | From opening `#listen?data=<id>` to the Play button being enabled, which is when `analyzeAll` has read every frame |
| **Sound map** | From pressing "Explore the map" to the column slider appearing, which is one `analyzeGrid` (24 columns) plus drawing |
| **Browser memory** | Sum of resident memory (RSS) of all Chromium processes, sampled every 100 ms, minus the start of an empty browser. Includes the page, the worker and the GPU process, so shared pages may be counted twice |

Play ready and Sound map are the median of 3 runs. Memory is one run. "CPU ×4" and "CPU ×6" are Chrome DevTools CPU
throttling of the page, meant to look like a mid-range laptop and a phone. Throttling slows the page's main thread; it may
not slow the analysis worker in the same way, so the throttled numbers are probably too kind.

## Results

| Data set | Frames | Size | CPU | Play ready | Sound map |
|---|---|---|---|---|---|
| synthetic-globe | 12 | 1200 × 600 | none | 0.35 s | 0.33 s |
| synthetic-globe | 12 | 1200 × 600 | ×4 | 0.83 s | 0.42 s |
| synthetic-globe | 12 | 1200 × 600 | ×6 | 1.6 s | 1.8 s |
| stress-globe | 60 | 1920 × 1080 | none | 1.9 s | 0.40 s |
| stress-globe | 60 | 1920 × 1080 | ×4 | 2.4 s | 1.3 s |
| stress-globe | 60 | 1920 × 1080 | ×6 | 2.6 s | 1.8 s |

| Data set | Browser memory above an empty browser (peak) |
|---|---|
| synthetic-globe (12 frames, 1200 × 600) | about 320 MB |
| stress-globe (60 frames, 1920 × 1080) | about 650 MB |

The page's own JavaScript heap stays at about 8 MB in every case, so the cost is in the image decoding, not in our code.

## What it means

- **Play stays under the 5 s line** (ticket step 2) in every run here, so progressive analysis is **not** triggered by these
  numbers. It is not needed yet.
- **Download size is not the problem here, and the test understates it.** The 60 stress frames are 9.7 MB because these
  made-up images are smooth. Real NASA frames have noise and text and will be several times larger. Measure again with the
  real files on 13 Nov.
- **Memory is the risk, not time.** About 650 MB for 60 full-HD frames fits a laptop but is likely too much for a phone tab.
  The cause is visible in `src/analysis/index.ts`: `analyzeAll` starts every frame at once with `Promise.all`, so all 60 images
  can be decoded at the same time (60 × 1920 × 1080 × 4 bytes is about 500 MB if they overlap). Limiting this to a few frames
  at a time would give identical results (same frame, same answer) with a much lower peak, at a small cost in time. This is a
  change in `src/analysis/` (the team leader's), so it is suggested here and not made. Check it on a real phone first.
- **The real data decides.** If the real frames are 1920 × 1080 or larger and there are more than about 30, plan for the
  limit above, or scale the frames down when converting (the sample points are fractions of the image, so a smaller image
  gives the same answers).

## To fill in on real devices (by 10 Nov)

Open the Vercel site (or `npm run build && npm run preview`) with `?data=stress-globe` after copying the stress folder into
`dist/data/`, in Chrome. Read memory from Chrome's Task Manager (Shift+Esc) for the tab, or `chrome://memory-internals`.

| Device | Play ready | Sound map | Peak memory | Did the tab survive? |
|---|---|---|---|---|
| Mid-range laptop (model, RAM): _not measured_ | | | | |
| Phone (model, browser): _not measured_ | | | | |

## Sound pipeline v2: `analyzeChange` (T112)

One `analyzeChange` reads the frame and its baseline into two 180 × 90 fields (`readField`: nine pixels per cell, 16 200 cells, each
through `valueAtPixel`), subtracts them and summarises the result (`scorePixels` in `src/analysis/score.ts`). Contours are not in
this number yet; T113 adds them.

**Measured by Claude** on the cloud machine (4 cores, Node, no browser, no CPU throttling): `scorePixels` on two synthetic
1920 × 1080 frames already decoded to RGBA, median of 12 runs: **53 ms** (min 51, max 77). That is the maths only. It leaves out
fetching and decoding the two PNGs, which in a browser costs more than the maths and is shared with `analyzeFrame` and
`analyzeGrid` (the worker keeps the last two decoded images, so a frame and its baseline are each decoded once).

| Where | One `analyzeChange` (maths only) | Over 200 ms? |
|---|---|---|
| Cloud machine, Node, unthrottled | 53 ms | no |
| Mid-range laptop (model): _not measured_ | | |
| Phone (model, browser): _not measured_ | | |

**Read this before trusting it.** The cloud machine is not a phone. Scaling 53 ms by the ×6 slowdown used above for "a phone"
gives about 320 ms, which would be over the ticket's 200 ms limit; that is a guess from a different kind of measurement, not a
result. Measure on a real phone with `?data=stress-globe` once `synthetic-change`-style data with a baseline can be opened in
Listen. **If it is over 200 ms on the phone, drop to 120 × 60 cells** (`CHANGE_COLS` in `src/analysis/score.ts`, one number; the
golden file `src/data/__golden__/change.json` is rewritten with `npx vitest run -u src/data/change-regression.test.ts`) and write
the new time here. Cutting the cells to two thirds of the width cuts the work to about 44%.

**Contours (T113).** `traceContours` on a 180 × 90 field with 18 lines (a wavy test field, one level), cloud machine, Node, unthrottled:
median **1.4 ms** over 30 runs (the slowest run was 12 ms, the first one, before the code was warmed up). The ticket's limit is 10 ms on a
laptop; a real laptop and phone are _not measured_. `analyzeChange` now also smooths the field and traces each level, so its
total is a little more than the 53 ms above; re-measure it on the real devices in T85.

## Sound pipeline v2: the `"change"` style, measured offline (T114)

**Measured by Claude** in headless Chromium on the cloud machine, rendering the real engine code offline (`Tone.Offline`, 44 100 Hz, stereo, the master
compressor and limiter in the path). Each bed is one step alone for 600 ms (`renderToWav`, the same voices as live playback); the level is read from 0.1 s to
0.55 s, after the 50 ms attack. Three changes per step (bottom, middle, top of its range).

| Step | Note | Peak (dBFS) | RMS (dBFS) | Pitch measured |
|---|---|---|---|---|
| much-below | C3 | −6.7 to −6.9 | −10.9 to −11.1 | 130.75 Hz |
| below | E3 | −6.6 to −6.7 | −11.2 to −11.3 | 164.75 Hz |
| near | G3 | −7.3 | −11.3 to −11.4 | 196.0 Hz |
| above | A3 | −6.8 | −11.4 | 220.0 Hz |
| much-above | C4 | −7.1 | −11.4 | 261.75 Hz |

- **Loudness:** the RMS of all fifteen beds is within **0.52 dB** (limit 1 dB); the highest peak is −6.6 dBFS (limit −1 dBFS). The first version routed the bed
  through the shared reverb and measured **2.6 dB** apart: a held pure tone in `Freeverb` is louder or quieter by pitch. The bed now skips the reverb, and
  `bedFor`'s levelling is enough.
- **Pitch:** within 0.1% of each step's note (limit 1%), and the same at the bottom and top of a step while the cutoff moves.
- **Contour trace** (64 points, 8 s, 8 accents and a hiss at both broken ends, the front going from soft to steep): peak **−3.8 dBFS** for a +1 line (C5) and
  **−6.4 dBFS** for a +2 line (G5), limit −1 dBFS. The +2 line is about 4 dB quieter in RMS (−18.8 against −14.5): it sits higher and goes through the reverb. It is
  not louder than the +1 line, which is the direction that matters.
- **Not measured:** a real laptop or phone, and any listener. The numbers say nothing about whether the layers are *understood*; that is the 13 Nov listening check.
  The harness is a throw-away script, not in the repository; it bundles `src/audio/engine.ts` with Vite and calls `renderToWav` and `scheduleTrace` in the page.

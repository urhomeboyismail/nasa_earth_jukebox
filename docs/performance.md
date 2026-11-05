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

# NASA data sources (T32)

**Status: incomplete.** On 5 Nov 2026 I could not find the Earth Information Center (EIC) Sea Surface Temperature visualization, or the released challenge resources (they arrive on 13 Nov). Everything below was seen on a NASA page; anything not seen is listed under "Still to find out" and is **not** guessed. Dhruv: use this as a starting list, not as settled facts.

## What was and was not found

- **earth.gov** (the EIC home page) loads, but it has no link to a sea surface temperature, Arctic sea ice or global temperature anomaly visualization. It links to other tools (Hometown Dashboard, Mobile Climate Mapper, GEOS Earth Now, Global Sea Level Change) and to theme pages such as `https://earth.gov/themes/sea-level-change`. The theme pages were not opened.
- Searches for the three topics all returned pages on **NASA's Scientific Visualization Studio (SVS, `svs.gsfc.nasa.gov`)**, not earth.gov. EIC visualizations may be hosted or mirrored there; that is unconfirmed.
- The 2026 Space Apps resources and judging guide are not out yet (13 Nov).

## Candidates seen on SVS (search results only; pages not opened in full)

| Topic | Page | What the search result said |
|---|---|---|
| Sea surface temperature | [Earth Day 2020: SST from January 2016 through March 2020](https://svs.gsfc.nasa.gov/4809) | A video of that period; colour scale 0 to 32 °C. |
| Sea surface temperature | [Sea Surface Temperature (SST) – Near Real Time](https://svs.gsfc.nasa.gov/api/5265) | Uses JPL's MUR (Multi-scale Ultra-high Resolution) SST analysis. |
| Arctic sea ice | [Arctic Sea Ice Minimum 2024](https://svs.gsfc.nasa.gov/5382) | Lists Sea Ice Concentration [DMSP: SSM/I] and Comiso's September Minimum Sea Ice Concentration as datasets; the minimum was 3.67 million km². |
| Arctic sea ice | [Arctic Sea Ice Minimum 2025](https://svs.gsfc.nasa.gov/5583), [2023](https://svs.gsfc.nasa.gov/5162/), [2022](https://svs.gsfc.nasa.gov/5030/) | Yearly series; the 2025 animation runs from the March maximum to the September minimum. |
| Arctic sea ice | [Annual Arctic Sea Ice Minimum Area 1979–2024, with graph](https://svs.gsfc.nasa.gov/5395) | Minimum for each year 1979–2024, from passive microwave data. |

Sea ice extent, as these pages define it, is the total area where ice concentration is at least 15%.

**Credit wording seen:** SVS pages ask that items be credited to NASA's Scientific Visualization Studio; the 2024 sea ice page also credits the Blue Marble data to Reto Stockli (NASA/GSFC). Check each page's own credit and licence line before using an image.

## Still to find out (for each of: Sea Surface Temperature, Arctic sea ice, global temperature anomaly)

Fill these in from the released resources or the page itself. Do not assume.

- [ ] Frame format and size (PNG, JPEG, video; pixel size)
- [ ] Number of dated frames, and how far apart (daily, monthly, yearly)
- [ ] Whether the legend values can be read: is there a colour bar with numbers, and is it the same on every frame?
- [ ] Link to the underlying dataset
- [ ] Licence and credit wording
- [ ] One or two date pairs from the same season that show real change
- [ ] Anything that breaks our assumptions: no fixed legend, a map projection that shifts between frames, text or land drawn over the ocean, frames that are videos not images

## What to watch for (from what we already know)

- Our method (see `docs/PLAN.md`) needs a **fixed colour legend with readable values** and the **same region at the same pixel position on every frame**. A video, a changing legend or a moving projection would each need extra work in T33.
- Sea ice is often shown as **ice or no ice** (white on dark), not as a gradient. If we pick it, the sound mapping may need to follow area or concentration, not a colour scale.
- SST legends seen run **0 to 32 °C**, wider than our synthetic data's 0 to 30; the category ranges in `mapping` would need to be rescaled.

## Manifest fields (T89)

Start from `scripts/templates/manifest.template.json`. Every `TODO` is something a person fills in from the source page. `npm run check-data` fails while any `TODO` is left, and also checks the frame files and sizes, date order, that each legend stop reads back as its own value, that no no-data colour lies on the legend line, and that the categories cover the legend. Each message names the file and the field. "Converter" means `scripts/convert_frames.py` (T91; see "Converting frames" below).

| Field | Filled by | Where it comes from |
|---|---|---|
| `id` | person | The folder name under `public/data/`; also the id in `index.json` |
| `title`, `summary`, `description` | person | Written in plain language from the source page |
| `variable.name`, `variable.unit` | person | The source page or colour bar label |
| `variable.words` (optional) | person | The words the app uses to compare values and to say what a date shows more of. Any of `higher`, `lower`, `highest`, `lowest`, `edge` (the line the change style traces) and `thing` (what a date shows more of; may be empty, so `higher: "more ice"` reads "which date shows more ice"). Missing words use neutral defaults ("higher", "lower", "highest", "lowest", "edge", "values"), which name no temperature. A temperature data set should set all six: `"higher": "warmer", "lower": "cooler", "highest": "warmest", "lowest": "coolest", "edge": "warm edge", "thing": "water"`, as the data sets in the repo do |
| `source.name`, `source.url`, `source.credit`, `source.license` | person | Copied exactly from the source page. `url` is empty only for made-up data |
| `source.retrievedOn` | person | The day the frames were downloaded, YYYY-MM-DD |
| `colorScale.stops` | converter, from `legend.json` | Read off the colour bar, in order of value, each stop's colour exactly as in the image |
| `colorScale.noData` | person | Colours of land, labels and missing pixels; none may lie within `maxColorDistance` of the legend line |
| `colorScale.maxColorDistance` | person | Start at 40; lower it if land is read as a value |
| `regions` (`id`, `name`, `description`, `points`) | person (the converter writes 30 starting `points`) | `points` are fractions 0 to 1 of the image, over water the legend colours; the first region is the one Compare and the listening test use |
| `frames` (`id`, `date`, `image`, `width`, `height`) | converter | From the file names and the PNG header; frames in date order, one per date |
| `frames[].altText`, `frames[].note` | person | Describe the picture; `note` only for a frame with missing data |
| `mapping.scale`, `tick`, `missingCue` | template | Leave as in the template: missing data is always the noise hiss |
| `mapping.minValidFraction` | template | 0.5 unless there is a reason |
| `mapping.categories` | converter, then person | The converter splits the legend's span into five equal ranges; a person checks them. Five, coolest first, each starting where the one before ends, covering the legend's lowest to highest value; notes C4 E4 G4 C5 E5 |
| `comparisons` | person | Checked against the NASA source (T85 step 5). `regionId` must be the first region's until T98 |
| `mapArea` | converter or person | The map without legend bar or titles, as fractions 0 to 1 |
| `story` | person | Optional chapters; each runs forward in time |
| `baseline`, `mapping.changeSteps`, `mapping.contourLevels`, `frames[].baselineImage` | converter (`--baseline-*`), then person | v2, optional, all three of the first together or none (see "Baselines" below). `changeSteps` are five steps of change from normal, most below first, each starting where the one before ends, with a note C3 to C4 rising step by step; `contourLevels` are the fixed changes to trace, lowest first, notes C3 to C6 |

### v3 fields (SN05)

Three optional fields for the v3 sonification (`docs/PLAN.md` §6.3). Their defaults keep every data set as it is: a manifest without them validates and plays exactly as before. `scripts/eic_ingest.py` (EIC01) writes them; a person checks them.

| Field | Default when left out | What it does |
|---|---|---|
| `legend` | `"data"` | `"data"`: the colour bar decodes values through `colorScale`. `"picture"`: true-colour imagery with no measured values, so the extractor reads brightness and colour. `colorScale` is still required for a picture data set |
| `video` | none: Symphony reads the checked frames | The animation for live reading: `{ src, fps, firstFrameDate, frameStepDays }`. `src` is relative to the manifest (for example `video/<id>.mp4`), an H.264 MP4 the site serves itself. `fps` is above 0 and at most 60. `firstFrameDate` (YYYY-MM-DD) is the date shown in the first video frame, and `frameStepDays` (a whole number, 1 or more) the days between video frames, so video frame n shows `firstFrameDate + n × frameStepDays` |
| `sonification` | preset `"major"`, detail `"standard"`, all seven voices | `{ preset, detail?, voices? }`. `preset` is one of `major`, `dorian`, `pentatonic`; `detail` one of `calm`, `standard`, `full`; `voices` a non-empty list of distinct voices from `melody`, `harmony`, `bass`, `hotspots`, `rhythm`, `motion`, `time`. A voice left out is never sounded for this data set |

**The date grid.** When `video` is given, every frame's `date` must be on the video's grid: `firstFrameDate` plus a whole number of `frameStepDays`, and not before `firstFrameDate`. A frame off the grid is reported by name, for example `frames.3.date: 2026-01-04 is not on the video's grid: the first video frame is 2026-01-01 and frames are 7 days apart`.

`video` and `sonification` are strict: a field inside them that the schema does not know (a typo such as `frameStep`) is reported, not dropped. `npm run check-data` also checks that the video file exists and is an MP4 (it has an `ftyp` box). The video is not decoded, so its frame count is not checked.

### Echo's look (JB04)

One optional field chooses how Echo, the guide, looks while this data set is open: the colour of its boots, headphones and jet trail, and the trail's style. It changes nothing else: a manifest without it validates and plays exactly as before.

| Field | Default when left out | What it does |
|---|---|---|
| `mascot` | accent from `colorScale`, trail `"sparks"` | `{ accent?, trail? }`. `accent` is a colour written `"#rrggbb"`, for example `"#00ffcc"`. `trail` is one of `sparks`, `bubbles`, `ions`, `pulse`: a style, never the name of a data set |
| `pairsWith` | none | `[{ id, note }]`: data sets this one can be heard together with in Compare → "Two data sets". `id` is another entry of `index.json`; `note` says, in one sentence, why hearing them together is honest (same region, same dates). The pairing is a decision about the data, so it lives here and never in `src/`. Only dates both data sets have are played |

**The accent and its contrast.** Echo uses the first of these with a contrast of at least 3:1 against its visor (`#0f2233`, WCAG 1.4.11): the manifest's `accent`, then the most saturated stop of `colorScale` (ties go to the stop with the higher value), then the theme's primary colour. A manifest `accent` below 3:1 is not an error, but `npm run check-data` prints a warning that names it and its ratio, and Echo will not use it. `mascot` is strict like `sonification`: a misspelt field is reported. The colour is never the only signal: each trail has its own shape (dashes, small rings, long streaks, a wide ring), and every state of Echo is also in text. Which accent and trail suit which kind of data is in `docs/DATASET-PLAYBOOK.md`, step 4.

## Converting frames (T91)

`scripts/convert_frames.py` turns a folder of dated frames into `public/data/<id>/`: the frames as plain PNGs and a `manifest.json` from the template above, with `TODO` left in every field a person fills in. It is step 3 of the 30-minute checklist at the top of `docs/archive/PRE-HACKATHON-TICKETS.md`.

Set up once (from the repository root):

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
```

Run, with a `legend.json` you wrote by reading the colour bar:

```bash
.venv/bin/python -I scripts/convert_frames.py --id <id> --frames <dir> --legend legend.json --map-area x0,y0,x1,y1 --out public/data/<id>
```

or let it sample the colour bar (and check the bar is the same on every frame):

```bash
.venv/bin/python -I scripts/convert_frames.py --id <id> --frames <dir> --legend-box x0,y0,x1,y1 --legend-values 0,32 --map-area x0,y0,x1,y1 --out public/data/<id>
```

| Option | What it does |
|---|---|
| `--id` | Lower-case letters, digits and hyphens. Also the folder name and the id in `index.json` |
| `--frames` | Folder with one PNG or JPEG per date. Other files are ignored; keep it outside the repository |
| `--date-pattern` | Regular expression that finds the date in each file name, with named groups `year`, `month`, `day` (month and day may be left out and then count as 1). Default: `2024-01-15`, `2024_01_15`, `2024.01.15` or `20240115` anywhere in the name. Example for `minimum-1979.png`: `--date-pattern 'minimum-(?P<year>\d{4})'` |
| `--legend` | `legend.json`: `[{ "value": 0, "rgb": [r, g, b] }, ...]` (or `{ "stops": [...] }`), each colour exactly as in the image, read with a colour picker. Any order; the converter sorts by value |
| `--legend-box` | The colour bar in pixels of the original frames, inclusive. **Along the bar, run exactly from the low end's pixel to the high end's pixel** (a box that starts a few pixels in shifts every value); across it, stay inside the bar, clear of its border. A bar wider than tall is horizontal; otherwise vertical |
| `--legend-values` | `min,max`: the values at the two ends. Horizontal bar: left then right. Vertical: bottom then top. Needs `--legend-box`. Write `max,min` for a bar that runs the other way |
| `--legend-steps` | How many evenly spaced stops to sample (default 9). A bar with flat colour steps needs `legend.json` instead, one stop per step |
| `--map-area` | `x0,y0,x1,y1`, the map without legend bar, titles or logos. Fractions 0 to 1, or pixels of the original frames if any number is above 1. Default: the whole image |
| `--max-width` | Scale wider frames down to this width, nearest-neighbour only (smoothing would make colours that are not on the legend). Use it if frames are much larger than 1920 px (`docs/performance.md`) |
| `--baseline-kind` | `climatology`, `reference-date` or `anomaly-product`: add a baseline (see "Baselines"). Without it no baseline is written, exactly as before |
| `--baseline-dir` | Climatology only: a folder with one picture per frame, each with the same file name as its frame (the file type may differ). Each must be exactly the frame's size: the converter refuses a pair that differs and never resamples |
| `--baseline-label` | What the change is measured against, as it is said and shown: `the 1991 to 2020 August average`. Needed for a climatology or a reference date; an anomaly product has none |
| `--baseline-frame` | Reference date only: the frame's date, `YYYY-MM-DD` |
| `--baseline-noise-floor` | A change smaller than this is legend rounding and counts as 0, in the variable's unit. Default: twice the legend's rounding, rounded up to 0.01. A smaller number is rejected |
| `--force` | Overwrite an existing `manifest.json` (and remove frames from an earlier run that are no longer in the folder). Without it the converter refuses, so a filled-in manifest is never lost |

What it writes: `frames/<date>.png`, 8-bit RGB, not interlaced, with no colour profile or gamma chunks (only IHDR, IDAT and IEND), so the browser and `npm run check-data` read the same colours; and `manifest.json` with the dates, sizes, legend stops, `mapArea`, a first region of 30 points (6 × 5) spread over the map area, and the five template categories over the legend's span. Running it twice on the same input gives identical files.

What it rejects, before writing anything: a file name without a date, a date that does not exist, two frames with the same date, frames of different sizes, a colour bar that differs by more than 3 on any channel between frames (only checked when `--legend-box` is given), and frames with transparent pixels (flatten them onto the land colour first; RGB would turn them into colours the app might read).

**JPEG** works, but compression blends colours, so more points are off the legend and read as "not enough data". The converter says so. Use PNG if the source has it.

**Video:** the app never plays video. Extract PNG frames first, then rename each with its date (the frame number is not a date):

```bash
mkdir frames && ffmpeg -i video.mp4 frames/frame_%04d.png
```

Video compression blends colours like JPEG, often worse (colour is stored at half resolution), so check the legend round trip and the land colours with extra care.

### Checklist after converting

1. Fill in every field the converter lists as `TODO` (title, summary, description, variable and unit, source name, URL, credit and licence copied exactly from the source page, retrieved date, region id, name and description, one alt text per frame).
2. Check the fields it lists under "Also check": `colorScale.noData` (the land, coastline and label colours; the template's grey is a placeholder), `maxColorDistance`, the 30 region points (move any on land), and the category ranges and labels.
3. Add `{ "id": "<id>", "title": "...", "summary": "..." }` to `public/data/index.json`.
4. `npm run check-data`, and fix what it names.
5. `npm run dev`, open `#listen?data=<id>`, and listen (step 7 of the checklist).

A rehearsal data set goes in `public/data/rehearsal-<name>/`, which git ignores. It may be listed in `index.json` while you check it; take it out again before committing.

## Baselines (v2, T111)

A **baseline** is what a frame's change is measured against. With one, the data set can play "how far from normal" (the `"change"` sound style, `docs/PLAN.md` §6.2) as well as the temperature. Without one it plays exactly as before: every old manifest still validates and sounds the same.

**Three kinds. Prefer them in this order:**

1. **`anomaly-product`**: NASA has already subtracted the normal, so the legend itself shows a change. No pictures, no label. The legend must run below and above 0; if it shows a temperature, it is not one of these.
2. **`climatology`**: a long-term average for **the same calendar month** as each frame, one picture per frame (`frames[].baselineImage`), the same size, map area and legend as the frame. Give it a `label` such as "the 1991 to 2020 August average".
3. **`reference-date`**: one earlier frame of the same data set (`frameId`). It is always called "change since <date>" and **never "anomaly"**, because across months it measures the season, not the climate. Use it only when nothing better exists, and compare like months where you can.

**Rules** (checked by the schema and by `npm run check-data`, each message naming the file and the field):

- `baseline`, `mapping.changeSteps` and `mapping.contourLevels` come together or not at all.
- A climatology needs a `baselineImage` on every frame; a reference date or an anomaly product has none; a data set with no baseline has none.
- A `baselineImage` must exist, be exactly its frame's width and height, and read through the same legend: at least `mapping.minValidFraction` of its `mapArea` must be readable. A picture of another size is **rejected, never resampled**.
- `noiseFloor` (climatology and reference date) is in the variable's unit and at least twice the legend's rounding: the largest change in value per unit of RGB distance along any legend segment. A change smaller than the floor is legend rounding and counts as 0. For a legend of 0 to 30 °C over eight stops that is about 0.13 °C; the converter works it out for you.
- `changeSteps` follow the same no-gap, no-overlap rule as `categories`. Notes sit in C3 to C4 and rise with each step, because pitch means "further above normal". `contourLevels` rise, with notes C3 to C6. JSON cannot hold infinity, so write the outer steps with a large finite edge (the made-up data uses -50 and 50).

**Made-up example: `synthetic-change`** (`scripts/make_synthetic_change.py`). Twelve months of a seasonal cycle, each with its own normal, and a warm patch that grows in the east from August to October (up to +1.5 °C). The season is bigger than the patch, so February (no patch) is the warmest date, while October is far above its own normal. Its comparisons show the two answers: `answer` is by temperature, which the app plays by default; `expected.json` lists the answer by change too. `src/data/synthetic-change.test.ts` runs the real analysis on the real pictures and checks both. A real data set with a baseline needs the same two things: a comparison whose two answers differ, and its Scores recorded in `src/data/__golden__/change.json` (`src/data/change-regression.test.ts`).

**Converting with a baseline:**

```bash
.venv/bin/python -I scripts/convert_frames.py --id <id> --frames <dir> --legend legend.json --map-area x0,y0,x1,y1 \
  --baseline-kind climatology --baseline-dir <normals dir> --baseline-label "the 1991 to 2020 August average" --out public/data/<id>
```

It writes `baselines/<date>.png` and `frames[].baselineImage`, and with any baseline it also writes default `changeSteps` and `contourLevels` for a change in degrees C (the schema needs all three together). **Check those numbers** if the variable or the size of its changes is different. `baselineImage` is resolved like `image` when the data set loads, so the manifest holds the relative path.


## Ingesting EIC material (EIC01)

`scripts/eic_ingest.py` turns an EIC (NASA Earth Information Center) MP4 animation, or a folder of frames, into a data set folder that `npm run check-data` can read. It calls `convert_frames.py` as a library, so the frames, the legend and the checks are the ones in "Converting frames (T91)", and it adds the frame rate, the dates, the colour bar search, the web video and the manifest's v3 fields (`video`, `legend`, `sonification`).

It needs ffmpeg and ffprobe on the PATH (system tools, not in `requirements.txt`) and Pillow and NumPy. The input is a file you downloaded; the script never uses the network.

**Run `--detect-only` first.** It prints the colour bar it found, which way it runs, the map area and the stops it would sample, and writes nothing.

```
python3 -I scripts/eic_ingest.py --id <id> --video animation.mp4 --out public/data/<id>     --start-date 2024-01-01 --step-days 1 --legend-min 0 --legend-max 30 --detect-only
```

Then run it again without `--detect-only` (add `--force` to overwrite an existing manifest).

| Flag | What it does |
|---|---|
| `--id`, `--out` | The data set's id (same rule as `convert_frames.py`) and the folder to write, `public/data/<id>`. |
| `--video` or `--frames` | Exactly one: an MP4, or a folder of PNG or JPEG frames in order. |
| `--start-date`, `--step-days` | Frame `k` gets the date `start + k x step` days. A video needs both. A folder may instead use `--dates` or the dates in its file names (`--date-pattern`). |
| `--dates` | A CSV with the columns `file,date` for a folder. The dates must be a whole, equal number of days apart, or the video cannot be written. |
| `--legend-min`, `--legend-max` | The values at the two ends of the colour bar, from NASA's legend. Required (the script cannot read them from the picture). Not needed with `--detect-only`. |
| `--legend-ticks N` | Stops sampled along the bar (default 9). |
| `--legend-box x0,y0,x1,y1`, `--map-area x0,y0,x1,y1` | Give the bar or the map by hand when detection is wrong (pixels of the original frame). |
| `--fps N` | Frames per second of the video. Default: the video's own, or 5 for a frame folder. At most 60. |
| `--every N` | Video only: keep every Nth frame as a dated frame. The web video keeps all of them. |
| `--max-width N` | Scale frames down, nearest-neighbour only. |
| `--preset`, `--detail` | Write `sonification.preset` (and `.detail`, which needs a preset). |
| `--legend picture` | Write `legend: "picture"`. The colour bar is still needed. |

What it does, in order: it checks every argument (nothing is written before they pass), makes the frames (`ffmpeg` for a video), dates them, finds the colour bar on the first frame, encodes the web video (`video/<id>.mp4`: H.264, yuv420p, even size, no sound, faststart), writes the frames and `manifest.json` through `convert_frames.py`, and adds the `video` field. The title, source, credit and licence stay `TODO` for a person to fill in from the NASA page.

**How the colour bar is found.** A horizontal bar is looked for in the bottom 30% of the rows, a vertical one in the right-hand 30% of the columns: a band of at least 5 rows (or columns) of saturated pixels that change by at most 12 per channel from one pixel to the next, at least 40% of the frame wide (or tall), whose colours change along its length. The longest wins. The box is the bar's bounds, 1 pixel inside its edge. A bar wider than tall is horizontal with its low end on the left; a taller bar is vertical with its low end at the bottom. The map area is the frame without the bar, 2 pixels clear of it. A bar that passes through white or grey (some diverging scales), or that sits at the top or left, is not found: use `--legend-box`.

### Checklist after ingesting

1. Does the printed direction of the bar match NASA's legend? If the low end is at the other end, the values are reversed: give `--legend-box` so that the box runs from the low end to the high end.
2. Is the map area right? Move it with `--map-area` if a title, logo or the colour bar's label is inside it.
3. Fill in every `TODO` from the source page, then do the checks in "Checklist after converting" above.
4. Add the data set to `public/data/index.json` and run `npm run check-data`.

Not covered here: choosing the visualisations (EIC02), turning the set into a finished data set (EIC03) and making the video small enough for a phone (H06).

## Known answers (D04)

`npm run check-data` checks that the legend reads back its own stops, but not that the picture means the same numbers as NASA's. A data set can add `public/data/<id>/known-answers.json`: points where NASA's own number is known. `src/data/known-answers.test.ts` reads each point from the frame's picture through the legend, using the app's own `valueAtPixel`, and fails when the result differs from NASA's number by more than the legend's rounding (`legendRounding` in `src/data/check.ts`). A data set without the file is not checked. The schema and the check are in `src/data/knownAnswers.ts`.

```json
{
  "id": "<the data set's id>",
  "map": { "projection": "equirectangular", "west": 55.0, "east": 65.0, "north": -10.0, "south": -22.0 },
  "checks": [
    {
      "frameId": "<a frame id of this data set>",
      "lat": -19.5, "lon": 57.5,
      "value": 27.4, "unit": "°C", "decimals": 1,
      "source": { "dataset": "<NASA short name>", "variable": "<variable in the file>", "time": "2023-04-03T00:00:00Z", "url": "<page or file>", "retrievedOn": "YYYY-MM-DD" }
    }
  ]
}
```

| Field | What it is |
|---|---|
| `id` | The data set's id; it must match the folder |
| `map` | Where the map sits on the globe. `"equirectangular"` with `west`, `east`, `north`, `south` in degrees, which covers `mapArea` (or the whole image). Or `"other"` with `control`: at least 4 points `{ lat, lon, x, y }` whose place in the whole image (fractions 0 to 1) is known, fitted bilinearly; they must spread over the map, not lie on one line. One form only |
| `checks` | At least 5. Spread them across the map, put at least one near each end of the legend, and keep them off land and at least one cell from a coast |
| `checks[].frameId`, `lat`, `lon` | The frame and the place, in degrees |
| `checks[].value`, `unit`, `decimals` | NASA's number as the source gives it, its unit, and how many decimals it has |
| `checks[].tolerance` (optional) | Extra allowed difference in the same unit. The limit is the larger of this and the legend's rounding. Only set it with a reason |
| `checks[].source` | Required for every check: the NASA data set's short name, the variable, the time of the value, the page or file address, and the day it was read |

**How to get a NASA number.** Open the NASA source for the data set: the data file (for example, through the provider's subsetting or OPeNDAP tool) or a value the source publishes for a stated place and time. Read the value at each chosen point and time, and write it down with its source. Never take a number from memory, estimate it, or read it off the picture: that would check the picture against itself.

**When a check fails**, the message names the frame, the place, NASA's number, the value read and the limit. A person decides whether the point moves (it was on land or a coast), whether NASA's number is read again, or whether the legend is wrong. A legend that disagrees with NASA's numbers stops the data set's sign-off: the legend is fixed, never the tolerance.

## Real data set: `mur-sst-mauritius` (T85)

Sea surface temperature around Mauritius, twenty 10-day maps from 23 January to 1 August 2023, from NASA's MUR analysis as drawn by NASA GIBS. Each frame is a 160 × 160 pixel crop (about 1.6 degrees across) with no legend, title or logo, so it has no `mapArea`. The island is flat grey, which the manifest declares as no data, and 2 February is entirely grey (no data at all).

- **Baseline:** `reference-date`, 23 January 2023, noise floor 0.3 °C. Over eight months this measures the season, not the climate, so "change" here mostly follows the warm season and the cooling after it. A same-month `climatology` would be better (the Baselines list above puts it first); it needs the same dates from earlier years.
- **Categories:** cold below 25 °C, cool 25 to 26, mild 26 to 27, warm 27 to 28, hot above 28. Across the twenty frames the region's median covers all five.
- **Comparisons:** five, with `answer` by temperature. `january-vs-june` is "same", six months apart; `february-vs-may` is "same" by temperature and a larger change for 23 May by change, which is the two-answers case a baseline data set needs.
- **Numbers in the comparisons and the story** are the app's own reading of the pictures' colours (`analyzePixels` on the real PNGs), so they are "about", not measurements from NASA's files. Nothing in them comes from outside the pictures.
- **Recorded Scores:** three frames (the warmest, the coolest and the empty one) in `src/data/__golden__/change.json`.

**Credit and licence, and what was checked.** The wording in the manifest uses only text read word for word on NASA pages on 9 Nov 2026:
- the dataset's title, "GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis (v4.1)", from https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1;
- GIBS's requested acknowledgement, "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).", from https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api;
- NASA's data use guidance, that data from NASA-led missions are licensed as Creative Commons Zero (CC0) unless marked with a restriction or licence, from https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance.

**Checks (T85 step 5):** (1) the PO.DAAC page states no licence of its own, so the CC0 licence rests on NASA's general data use guidance above; the CC0 line was confirmed by the team on 9 Nov 2026; (2) the PO.DAAC suggested citation ("JPL MUR MEaSUREs Project. 2015. ...", DOI 10.5067/GHGMR-4FJ04) was read on the live PO.DAAC page in a browser on 9 Nov 2026 (Citation tab) and is now in `source.credit`; the "accessed" date is the day the pictures were fetched (`retrievedOn`). (3) still to check by a person: the numbers and sentences in the story and comparisons, against the pictures.

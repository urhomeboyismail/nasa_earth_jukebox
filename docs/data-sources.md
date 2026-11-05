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

## Converting frames (T91)

`scripts/convert_frames.py` turns a folder of dated frames into `public/data/<id>/`: the frames as plain PNGs and a `manifest.json` from the template above, with `TODO` left in every field a person fills in. It is step 3 of the 30-minute checklist at the top of `docs/PRE-HACKATHON-TICKETS.md`.

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

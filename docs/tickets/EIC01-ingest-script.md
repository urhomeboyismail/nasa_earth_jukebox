# EIC01 `scripts/eic_ingest.py`: MP4 or PNG sequence in, frames, colour scale, web video and manifest out

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | SN05 |
| **Hotspots** | catalogue |
| **Branch** | `feature/EIC01-ingest-script` |

## Goal

One command turns an EIC (NASA Earth Information Center, from its Scientific Visualization Studio) MP4 animation, a PNG sequence or a frame folder into a data set folder that `npm run check-data` can check: dated frames made the way `convert_frames.py` makes them, a colour scale read from the colour bar, the map area, a same-origin H.264 web video for live reading (SN06), and a manifest that includes the `video`, `legend` and `sonification` fields (SN05). Anything a person must still write stays a `TODO`.

## Why

- `scripts/convert_frames.py` already turns dated PNG or JPEG frames into a data set (T91), with the guarantees that make the browser and the analysis read the same colours (8-bit RGB, no profile, nearest-neighbour scaling, one date per frame, a legend that does not change). It needs the frames already named by date and the legend typed in. Most EIC material arrives as an MP4 or a folder of frames named by the animation, not by date.
- `src/analysis/video/` (SN06) reads a same-origin video. No script writes one yet.
- `docs/data-sources.md` "Converting frames (T91)" lists the checklist the converter follows. The ingest follows it too.
- EIC visualisations often show a colour bar and text on the frame. Detection avoids typing the map area by hand, and an override keeps it honest when detection is wrong.

**Order.** The queue lists SN05 (the manifest fields it writes). The rest is Python and needs no TypeScript.

## Design

### Interface

```
python3 -I scripts/eic_ingest.py --id <id> (--video <file.mp4> | --frames <dir>) --out public/data/<id>
    [--start-date YYYY-MM-DD --step-days N | --dates <dates.csv>]
    [--legend-min V --legend-max V --legend-ticks N]
    [--legend-box x0,y0,x1,y1] [--map-area x0,y0,x1,y1]
    [--fps N] [--every N] [--max-width N] [--date-pattern RE]
    [--preset major|dorian|pentatonic] [--detail calm|standard|full] [--legend data|picture]
    [--detect-only] [--force]
```

- Exactly one of `--video` and `--frames`.
- `--start-date` and `--step-days` give each frame a date: frame `k` (0-based, in order) gets `start + k × step` days. `--dates` takes a CSV with the columns `file,date` (for `--frames`); its dates must be regular (one step) for a video to be written, or the script stops with: "The video needs dates a regular number of days apart. Use --start-date and --step-days."
- `--legend-min` and `--legend-max` are the values at the two ends of the colour bar, as NASA's legend gives them. The script cannot read them from the picture, so they are required, and it stops with a message that says so when they are missing.
- `--legend-ticks N` (default 9) is how many stops are sampled along the bar (`convert_frames.py`'s `--legend-steps`).
- `--detect-only` prints the detected colour bar, its orientation and the map area, and the stops it would sample, then exits without writing anything. Run it first.

### Steps (what the script does, in order)

1. **Check the arguments** with the same id rule as `convert_frames.py` (`[a-z0-9]+(-[a-z0-9]+)*`). Stop with a readable message on any error. Nothing is written before every check passes.
2. **Make the frames.**
   - `--video`: `ffprobe` gives the frame rate (unless `--fps`) and the size. `ffmpeg -i <video> -vf fps=<fps> -pix_fmt rgb24 <tmp>/f%06d.png` writes every frame. Frame `k` is then named `<date>.png` with its date from step 3.
   - `--frames`: every image in the folder (PNG or JPEG; `convert_frames.find_frames` rules), copied into `<tmp>` as `<date>.png`. Dates come from `--dates`, from `--start-date` and `--step-days` in sorted file order, or from the file names (the default pattern).
   - `--every N` (video only) keeps every Nth extracted frame as a dated frame. The video still uses all frames.
3. **Dates.** Frame `k` (in the order above) has date `start + k × step` when `--start-date` is given. Two frames with one date stop the script ("keep one frame per date", as `convert_frames` says).
4. **Find the colour bar** (`detect_colour_bar(rgb)`, unless `--legend-box` is given). On the first frame:
   - A **horizontal** bar: for each row in the bottom 30% of the frame, the runs of consecutive pixels that are saturated (max − min channel ≥ 40) and change by at most 12 per channel from one pixel to the next. A run counts when it is at least 40% of the width. The rows holding such a run in a band of at least 5 rows form a candidate; the longest candidate wins.
   - A **vertical** bar: the same on the right-hand 30% of the columns, with rows and columns swapped.
   - The box is the candidate's bounds, 1 pixel inside the bar's edge, inclusive. Orientation follows `convert_frames.bar_profile`: a bar wider than tall is horizontal (the low end on the left); a taller bar is vertical (the low end at the bottom). **Check the printed direction against the legend.**
   - No candidate: stop with "No colour bar found. Give --legend-box x0,y0,x1,y1 (the bar's pixels in the original frame)."
5. **Find the map area** (unless `--map-area` is given). The map is the frame without the colour bar: if the bar is a horizontal one in the bottom half, the map ends 2 pixels above it; in the top half, it starts 2 pixels below it; a vertical bar on the right ends the map 2 pixels to its left, on the left starts it 2 pixels to its right. Printed as pixels, as `convert_frames --map-area` accepts them. This is a rule, not a guarantee: `--detect-only` shows it, and `--map-area` overrides it.
6. **Write the data set** by calling `convert_frames.py` as a library: `args = cf.parse_args([...])` with `--id`, `--frames <tmp>`, `--out`, `--legend-box`, `--legend-values min,max`, `--legend-steps N`, `--map-area`, `--max-width` and `--force` as given, then `cf.convert(args)` and `cf.report(args, result)`. **Do not copy its logic.** Its checks, scaling and colour rules apply as they are.
7. **Video** (`--video` or a frame folder): `ffmpeg -y -i <source> -an -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=<fps>" -c:v libx264 -pix_fmt yuv420p -crf 23 -preset medium -movflags +faststart <out>/video/<id>.mp4`. The video has an even size, no sound, and the faststart flag, so it plays on the web. For a frame folder, the frames are first joined with `ffmpeg -framerate <fps> -i <tmp>/%06d.png`.
8. **Manifest.** Add `video: { src: "video/<id>.mp4", fps, firstFrameDate, frameStepDays }` (the video needs `--start-date` and `--step-days`), `legend: "picture"` when `--legend picture` is given, and `sonification: { preset, detail }` when `--preset` (and `--detail`) is given. Keep every `TODO` that `convert_frames` wrote. Write the file with `convert_frames.write_json`.
9. **Report.** The bar, the map area, the stops, the frame count, the video's size and frame rate, and the list of `TODO` fields (`cf.todo_fields`, `cf.summarise_todos`). Then the next step: `npm run check-data`.

### Files

- `scripts/eic_ingest.py` (new): the script. Imports `convert_frames` by path, as `scripts/tests/test_convert_frames.py` does (`sys.path.insert` for the script's folder).
- `scripts/tests/test_eic_ingest.py` (new): the tests (below).
- `docs/data-sources.md`: a new section "Ingesting EIC material (EIC01)" with the command, the flags, and the checklist. Only that section changes.
- `scripts/requirements.txt`: no change. ffmpeg and ffprobe are system tools; the script says so when they are missing ("Install ffmpeg, which provides ffmpeg and ffprobe, then run this again.").

## Reuse

- `scripts/convert_frames.py`: `parse_args`, `convert`, `report`, `find_frames`, `read_rgb`, `bar_profile`, `date_from_name`, `todo_fields`, `summarise_todos`, `write_json`, `ConvertError`, `TEMPLATE`. Import it; do not copy it.
- `scripts/make_synthetic.py` (only as a source of test frames if needed, through its functions); the tests draw their own small frames instead.
- ffmpeg and ffprobe for decoding and encoding.

## Touches

- New: `scripts/eic_ingest.py`, `scripts/tests/test_eic_ingest.py`.
- Edit: `docs/data-sources.md` (one new section).
- Do not edit `scripts/convert_frames.py`. If it lacks something you need, post on `docs/AGENT-BOARD.md` for Dhruv first.
- Do not write a data set in this ticket (EIC03 does that), and do not commit a `rehearsal-*` folder.
- Reviewer: Dhruv (`scripts/`, the data scripts).

## Steps

1. Write the argument checks and the frame making (MP4 and folder), with the date rules, and test them with `--detect-only`-style calls first.
2. Write `detect_colour_bar` and `map_area_for_bar`, with tests on generated frames (a horizontal bar, a vertical bar, no bar).
3. Write the call into `convert_frames` (`parse_args` and `convert`), and the video step.
4. Write the manifest additions and the report.
5. Write the tests (below) and run them: `.venv/bin/python -I -m pytest scripts/tests/test_eic_ingest.py` (install `pytest` into `.venv` with the requirements, as `scripts/tests/test_convert_frames.py` says).
6. Run `npm run check-data` on a rehearsal set (it must report only the TODO fields).

## Tests

Tests generate their own tiny frames (about 80 × 60 pixels: a map with a land patch, and a colour bar along the bottom, from blue to red, with a grey border). A test that needs ffmpeg uses `pytest.skip` with a message when `ffmpeg` is not on the PATH.

- **Detection.** The bar's box is found within 1 pixel of the drawn box; its orientation is horizontal; the map area ends above the bar; a frame with no bar gives the readable stop message.
- **Vertical bar.** A bar on the right is found as vertical, the map area ends left of it.
- **Arguments.** Both `--video` and `--frames`: stop. Neither: stop. No `--legend-min`/`--legend-max`: stop with "give --legend-min and --legend-max". An invalid id: stop.
- **Dates.** `--start-date` and `--step-days` give dates `start + k × step`; an irregular `--dates` CSV with `--video` stops with the regular-dates message; two frames with one date stop.
- **Video path.** From a generated MP4 (made with ffmpeg in the test from the frames): `--every 2` keeps half the dated frames; the manifest has `video.src` `video/<id>.mp4`, `fps`, `firstFrameDate`, `frameStepDays`; the file `video/<id>.mp4` exists; `ffprobe` reports `h264` and `yuv420p` (skipped without ffprobe).
- **Frame guarantees.** The written frames are 8-bit RGB PNGs with no colour profile chunks (`convert_frames` checks them; the test reads the chunk names).
- **TODO kept.** The title or source fields are still `TODO`, and the report lists them.
- **Detect only.** With `--detect-only`, nothing is written to `--out` (the folder does not exist afterwards).
- **Repeatability.** Running the script twice on the same input gives identical `manifest.json` and identical frame files.

## Guardrails

- Nothing is invented: every number in the manifest comes from the arguments, the picture or the converter. The source, credit, licence and title stay `TODO` for a person to fill from the NASA page (EIC02, EIC03).
- The script never resamples a frame in a way that changes colours (nearest-neighbour only, as `convert_frames`).
- No network access: the input is a file the person downloaded.
- Downloaded and extracted files are untrusted: the script reads them with Pillow and ffmpeg only, and runs with `python3 -I`. No file from the input is run.
- Nothing data-set-specific in the script: no names, units or dates are in the code (only in the arguments and the tests' examples).

## Done when

- `scripts/eic_ingest.py` ingests an MP4 and a frame folder into a data set folder that `check-data` reads, with only TODO fields left.
- The pytest file passes (or skips ffmpeg tests with a message on a machine without ffmpeg, and that is recorded).
- `docs/data-sources.md` has its new section.
- Result shows the real output of the tests and of `npm run check-data` on the rehearsal set.

## Checks

```bash
.venv/bin/python -I -m pytest scripts/tests/test_eic_ingest.py
.venv/bin/python -I -m pytest scripts/tests/test_convert_frames.py    # unchanged, must still pass
npm run lint && npm test && npm run build
npm run check-data                                                     # on a rehearsal-* set only; do not commit it
```

## Out of scope

- Choosing and checking the NASA visualisations (EIC02), and turning a set into a finished data set (EIC03).
- Automatic reading of the NASA legend, the source page or the licence from the web: they are typed by a person from the source page.
- A picture-mode colour scale: the script still needs a colour bar (the schema requires a colour scale for every data set). `--legend picture` only sets the field.
- Compressing the video for a phone (H06 measures it).

## Result

Not started.

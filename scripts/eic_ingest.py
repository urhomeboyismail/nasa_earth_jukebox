#!/usr/bin/env python3
"""Turn an EIC (NASA Earth Information Center) MP4 or a folder of frames into a data set folder (EIC01).

    python3 -I scripts/eic_ingest.py --id <id> --video animation.mp4 --out public/data/<id> \\
        --start-date 2024-01-01 --step-days 1 --legend-min 0 --legend-max 30

Run it first with --detect-only: it prints the colour bar and the map area it found and writes nothing.
The frames, the legend and the manifest come from scripts/convert_frames.py, called as a library, so its checks and its
colour rules apply as they are. This script adds: frames out of a video, dates, finding the colour bar, a same-origin H.264
web video for live reading (SN06), and the manifest's video, legend and sonification fields (SN05).

See docs/data-sources.md, 'Ingesting EIC material (EIC01)'. Needs ffmpeg and ffprobe on the PATH for videos.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import convert_frames as cf  # noqa: E402

SEARCH_FRACTION = 0.3  # the colour bar is looked for in the bottom 30% of the rows and the right-hand 30% of the columns
SATURATION = 40  # a bar pixel's largest channel is at least this far above its smallest
MAX_STEP = 12  # from one bar pixel to the next, no channel moves by more than this
MIN_LENGTH = 0.4  # the bar is at least this fraction of the frame's width (or height)
MIN_THICKNESS = 5  # rows (or columns) of bar, borders and anti-aliasing included
MIN_SPREAD = 60  # along the bar, some channel changes by at least this much: a flat patch of map is not a colour bar
DEFAULT_FRAME_FPS = 5  # playback speed of a video made from a frame folder, when --fps is not given
MAX_FPS = 60  # the schema's limit (src/data/schema.ts)
FFMPEG_MISSING = "Install ffmpeg, which provides ffmpeg and ffprobe, then run this again."
NO_BAR = "No colour bar found. Give --legend-box x0,y0,x1,y1 (the bar's pixels in the original frame)."
IRREGULAR = "The video needs dates a regular number of days apart. Use --start-date and --step-days."

Box = tuple[int, int, int, int]


# ---------------------------------------------------------------------------------------------------------------------
# Reading the options


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="eic_ingest.py",
        description="Turn an EIC MP4 animation or a folder of frames into public/data/<id>/ "
                    "(dated frames, colour scale, web video and manifest.json).",
        epilog="See docs/data-sources.md, 'Ingesting EIC material (EIC01)'. Run with --detect-only first.",
    )
    p.add_argument("--id", required=True, help="the data set's id, also its folder name under public/data/ (letters, digits, '-')")
    source = p.add_mutually_exclusive_group()
    source.add_argument("--video", type=Path, help="the MP4 animation (needs ffmpeg and ffprobe)")
    source.add_argument("--frames", type=Path, help="a folder of PNG or JPEG frames, in order")
    p.add_argument("--out", type=Path, help="where to write frames/, video/ and manifest.json, e.g. public/data/<id>")
    p.add_argument("--start-date", help="YYYY-MM-DD: the date of the first frame. Frame k then has the date start + k x step")
    p.add_argument("--step-days", type=int, help="days from one frame to the next (a whole number, 1 or more), with --start-date")
    p.add_argument("--dates", type=Path, help="--frames only: a CSV with the columns file,date giving each frame's date")
    p.add_argument("--date-pattern", default=cf.DEFAULT_DATE_PATTERN,
                   help="--frames only: regular expression that finds the date in each file name (as convert_frames.py)")
    p.add_argument("--legend-min", type=float, help="the value at the low end of the colour bar, as NASA's legend gives it")
    p.add_argument("--legend-max", type=float, help="the value at the high end of the colour bar")
    p.add_argument("--legend-ticks", type=int, default=cf.DEFAULT_LEGEND_STEPS,
                   help=f"how many stops to sample along the bar (default {cf.DEFAULT_LEGEND_STEPS})")
    p.add_argument("--legend-box", help="x0,y0,x1,y1: the colour bar's pixels in the original frame, instead of finding it")
    p.add_argument("--legend-image", type=Path, help="a picture of the colour bar, when the frames have none. --legend-box is then in "
                                                     "this picture's pixels, and both --legend-box and --map-area are needed")
    p.add_argument("--map-area", help="x0,y0,x1,y1: the map without bar, titles or logos, instead of the rule (as convert_frames.py)")
    p.add_argument("--fps", type=float, help="frames per second of the video. Default: the video's own, or "
                                             f"{DEFAULT_FRAME_FPS} for a frame folder")
    p.add_argument("--every", type=int, default=1, help="--video only: keep every Nth frame as a dated frame. The web video keeps all of them")
    p.add_argument("--max-width", type=int, help="scale frames wider than this down to this width, nearest-neighbour only")
    p.add_argument("--preset", choices=["major", "dorian", "pentatonic"], help="write sonification.preset to the manifest")
    p.add_argument("--detail", choices=["calm", "standard", "full"], help="write sonification.detail to the manifest (needs --preset)")
    p.add_argument("--legend", choices=["data", "picture"], help="'picture' writes legend: \"picture\" to the manifest")
    p.add_argument("--detect-only", action="store_true", help="print the colour bar, the map area and the stops, and write nothing")
    p.add_argument("--force", action="store_true", help="overwrite an existing manifest.json in --out (loses anything filled in there)")
    return p.parse_args(argv)


def parse_date(text: str, option: str) -> dt.date:
    try:
        return dt.date.fromisoformat(text)
    except ValueError:
        raise cf.ConvertError(f"{option} {text!r}: use a real date written YYYY-MM-DD") from None


def check_args(args: argparse.Namespace) -> None:
    """Everything that can be checked from the arguments alone. Nothing is written before this passes."""
    import re

    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.id):
        raise cf.ConvertError(f"--id {args.id!r}: use lower-case letters, digits and single hyphens, like sea-surface-2024")
    if (args.video is None) == (args.frames is None):
        raise cf.ConvertError("give exactly one of --video <file.mp4> and --frames <folder>")
    if args.out is None:
        raise cf.ConvertError("give --out, where to write the data set, like public/data/<id>")
    if args.step_days is not None and args.step_days < 1:
        raise cf.ConvertError("--step-days must be a whole number of days, 1 or more")
    if (args.start_date is None) != (args.step_days is None):
        raise cf.ConvertError("--start-date and --step-days go together: give both, or neither")
    if args.start_date is not None:
        parse_date(args.start_date, "--start-date")
    if args.dates is not None:
        if args.video is not None:
            raise cf.ConvertError("--dates is for --frames. For a video, give --start-date and --step-days")
        if args.start_date is not None:
            raise cf.ConvertError("give either --dates or --start-date with --step-days, not both")
    if args.video is not None and args.start_date is None:
        raise cf.ConvertError("a video has no dates in it: give --start-date and --step-days")
    if args.every < 1:
        raise cf.ConvertError("--every must be 1 or more")
    if args.every > 1 and args.video is None:
        raise cf.ConvertError("--every is for --video. A frame folder keeps every frame it is given")
    if args.fps is not None and not 0 < args.fps <= MAX_FPS:
        raise cf.ConvertError(f"--fps must be above 0 and at most {MAX_FPS}")
    if args.legend_ticks < 2:
        raise cf.ConvertError("--legend-ticks must be 2 or more")
    if args.detail is not None and args.preset is None:
        raise cf.ConvertError("--detail needs --preset: the manifest's sonification field always names a preset")
    if not args.detect_only:
        if args.legend_min is None or args.legend_max is None:
            raise cf.ConvertError("give --legend-min and --legend-max: the values at the two ends of the colour bar, from NASA's legend. "
                                  "The script cannot read them from the picture")
        if args.legend_min == args.legend_max:
            raise cf.ConvertError("--legend-min and --legend-max must differ")
    elif (args.legend_min is None) != (args.legend_max is None):
        raise cf.ConvertError("give both --legend-min and --legend-max, or neither")
    if args.legend_image is not None:
        if args.legend_box is None:
            raise cf.ConvertError("--legend-image needs --legend-box x0,y0,x1,y1: the colour bar's pixels in that picture")
        if args.map_area is None:
            raise cf.ConvertError("--legend-image needs --map-area x0,y0,x1,y1: the frames have no colour bar to leave out, "
                                  "so the map area cannot be worked out")
        if not args.legend_image.is_file():
            raise cf.ConvertError(f"--legend-image {args.legend_image}: there is no such file")
        legend_rgb = cf.read_rgb(args.legend_image)
        cf.box_in_pixels(args.legend_box, legend_rgb.shape[1], legend_rgb.shape[0])
    if args.video is not None and not args.video.is_file():
        raise cf.ConvertError(f"--video {args.video}: there is no such file")
    if args.frames is not None and not args.frames.is_dir():
        raise cf.ConvertError(f"--frames {args.frames}: there is no such folder")


# ---------------------------------------------------------------------------------------------------------------------
# ffmpeg


def need_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise cf.ConvertError(FFMPEG_MISSING)


def run_tool(command: list[str]) -> str:
    try:
        done = subprocess.run(command, capture_output=True, text=True, check=False)
    except OSError:
        raise cf.ConvertError(FFMPEG_MISSING) from None
    if done.returncode != 0:
        tail = "\n".join(done.stderr.strip().splitlines()[-5:])
        raise cf.ConvertError(f"{command[0]} failed on the input:\n{tail}")
    return done.stdout


def probe_video(path: Path) -> tuple[str, int, int]:
    """The video's frame rate as ffmpeg writes it (a fraction like 30000/1001), and its size."""
    out = run_tool(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate,width,height",
                    "-of", "json", str(path.resolve())])
    try:
        stream = json.loads(out)["streams"][0]
        rate, width, height = stream["r_frame_rate"], int(stream["width"]), int(stream["height"])
        top, bottom = (int(part) for part in rate.split("/"))
    except (KeyError, IndexError, ValueError, json.JSONDecodeError):
        raise cf.ConvertError(f"{path.name}: no video stream with a frame rate was found. Give --fps") from None
    if top <= 0 or bottom <= 0:
        raise cf.ConvertError(f"{path.name}: the frame rate could not be read. Give --fps")
    return rate, width, height


def fps_text(fps: float) -> str:
    return f"{fps:.6g}"


def manifest_fps(rate: str) -> float:
    top, bottom = (int(part) for part in rate.split("/"))
    return float(clean(round(top / bottom, 3)))


def clean(value: float) -> float | int:
    return cf.clean_number(value)


# ---------------------------------------------------------------------------------------------------------------------
# Finding the colour bar


def longest_run(row: np.ndarray, min_length: int) -> tuple[int, int] | None:
    """The longest stretch of saturated pixels that change little from one to the next: (first, last) index, or None."""
    row = row.astype(np.int16)
    if len(row) < 2:
        return None
    saturated = (row.max(axis=1) - row.min(axis=1)) >= SATURATION
    joined = saturated[:-1] & saturated[1:] & (np.abs(np.diff(row, axis=0)).max(axis=1) <= MAX_STEP)
    ids = np.cumsum(np.concatenate(([True], ~joined)))
    ids = np.where(saturated, ids, 0)
    counts = np.bincount(ids)
    counts[0] = 0
    best = int(counts.argmax())
    if counts[best] < min_length:
        return None
    where = np.nonzero(ids == best)[0]
    return int(where[0]), int(where[-1])


def best_band(region: np.ndarray) -> tuple[int, int, int, int] | None:
    """The longest horizontal bar in `region` (rows x columns x 3): (first row, last row, first column, last column), borders excluded.

    A bar is a band of at least MIN_THICKNESS consecutive rows that all hold a run at least MIN_LENGTH of the width, wider than the
    band is tall, whose colours change along its length (MIN_SPREAD)."""
    rows, width = region.shape[0], region.shape[1]
    minimum = max(2, int(np.ceil(MIN_LENGTH * width)))
    found = [(y, longest_run(region[y], minimum)) for y in range(rows)]
    best: tuple[int, int, int, int] | None = None
    y = 0
    while y < rows:
        if found[y][1] is None:
            y += 1
            continue
        top = y
        while y < rows and found[y][1] is not None:
            y += 1
        bottom = y - 1  # rows top..bottom all hold a run
        if bottom - top + 1 < MIN_THICKNESS:
            continue
        runs = [found[k][1] for k in range(top, bottom + 1)]
        first, last = max(r[0] for r in runs if r), min(r[1] for r in runs if r)
        length = last - first + 1
        if length < minimum or length <= bottom - top + 1:
            continue
        middle = region[(top + bottom) // 2, first:last + 1].astype(np.int16)
        if int((middle.max(axis=0) - middle.min(axis=0)).max()) < MIN_SPREAD:
            continue
        if best is None or length > best[3] - best[2] + 1:
            best = (top, bottom, first, last)
    return best


def detect_colour_bar(rgb: np.ndarray) -> Box | None:
    """The colour bar's box (x0, y0, x1, y1, inclusive, 1 pixel inside the bar's edge), or None when there is none.

    A horizontal bar is looked for in the bottom 30% of the frame, a vertical one in the right-hand 30%. The longest wins."""
    height, width = rgb.shape[0], rgb.shape[1]
    candidates: list[tuple[int, Box]] = []
    row_start = height - int(height * SEARCH_FRACTION)
    band = best_band(rgb[row_start:])
    if band is not None:
        top, bottom, first, last = band
        candidates.append((last - first + 1, (first, row_start + top, last, row_start + bottom)))
    col_start = width - int(width * SEARCH_FRACTION)
    band = best_band(np.transpose(rgb[:, col_start:], (1, 0, 2)))
    if band is not None:
        left, right, first, last = band
        candidates.append((last - first + 1, (col_start + left, first, col_start + right, last)))
    if not candidates:
        return None
    x0, y0, x1, y1 = max(candidates, key=lambda c: c[0])[1]
    x0, y0, x1, y1 = x0 + 1, y0 + 1, x1 - 1, y1 - 1  # 1 pixel inside the bar's edge
    return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None


def orientation_of(box: Box) -> str:
    """As convert_frames.bar_profile reads it: a bar wider than tall is horizontal, otherwise vertical."""
    x0, y0, x1, y1 = box
    return "horizontal" if x1 - x0 >= y1 - y0 else "vertical"


def map_area_for_bar(box: Box, width: int, height: int) -> Box:
    """The frame without the colour bar, 2 pixels clear of it, as pixels for convert_frames --map-area (x1 and y1 are exclusive ends).

    A rule, not a guarantee: --detect-only shows it, and --map-area overrides it."""
    x0, y0, x1, y1 = box
    area = [0, 0, width, height]
    if orientation_of(box) == "horizontal":
        if (y0 + y1) / 2 >= height / 2:
            area[3] = y0 - 2
        else:
            area[1] = y1 + 2
    elif (x0 + x1) / 2 >= width / 2:
        area[2] = x0 - 2
    else:
        area[0] = x1 + 2
    if area[2] <= area[0] or area[3] <= area[1]:
        raise cf.ConvertError(f"the colour bar at {x0},{y0},{x1},{y1} leaves no room for a map. Give --map-area x0,y0,x1,y1")
    return area[0], area[1], area[2], area[3]


def box_text(box: Box) -> str:
    return ",".join(str(v) for v in box)


# ---------------------------------------------------------------------------------------------------------------------
# Frames and dates


@dataclass(frozen=True)
class Source:
    path: Path
    date: str


def image_files(folder: Path) -> list[Path]:
    return [p for p in sorted(folder.iterdir()) if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in cf.IMAGE_SUFFIXES]


def read_dates_csv(path: Path, folder: Path) -> list[Source]:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except OSError as error:
        raise cf.ConvertError(f"--dates {path}: could not be read ({error})") from None
    reader = csv.DictReader(text.splitlines())
    if not reader.fieldnames or not {"file", "date"} <= {name.strip() for name in reader.fieldnames}:
        raise cf.ConvertError(f"--dates {path}: the first line must name the columns: file,date")
    sources = []
    for line, row in enumerate(reader, start=2):
        row = {key.strip(): (value or "").strip() for key, value in row.items() if key}
        file = folder / row["file"]
        if file.parent != folder or not file.is_file() or file.suffix.lower() not in cf.IMAGE_SUFFIXES:
            raise cf.ConvertError(f"--dates {path} line {line}: {row['file']!r} is not a PNG or JPEG file in {folder}")
        sources.append(Source(file, parse_date(row["date"], f"--dates {path} line {line}:").isoformat()))
    if not sources:
        raise cf.ConvertError(f"--dates {path}: no frames are listed")
    sources.sort(key=lambda s: (s.date, s.path.name))
    return sources


def folder_sources(args: argparse.Namespace) -> list[Source]:
    """The frames of a folder with their dates, in date order: from --dates, from --start-date and --step-days, or from the names."""
    if args.dates is not None:
        sources = read_dates_csv(args.dates, args.frames)
    elif args.start_date is not None:
        files = image_files(args.frames)
        if not files:
            raise cf.ConvertError(f"--frames {args.frames}: no PNG or JPEG files found")
        start = parse_date(args.start_date, "--start-date")
        sources = [Source(f, (start + dt.timedelta(days=k * args.step_days)).isoformat()) for k, f in enumerate(files)]
    else:
        frames, _ = cf.find_frames(args.frames, args.date_pattern)
        sources = [Source(f.path, f.date) for f in frames]
    for before, after in zip(sources, sources[1:]):
        if before.date == after.date:
            raise cf.ConvertError(f'"{before.path.name}" and "{after.path.name}" both have the date {after.date}; keep one frame per date')
    return sources


def regular_grid(dates: list[str]) -> tuple[str, int] | None:
    """(first date, days between frames) when the dates are a whole number of days apart, always the same; else None."""
    days = [dt.date.fromisoformat(d).toordinal() for d in dates]
    gaps = {b - a for a, b in zip(days, days[1:])}
    if not gaps:
        return dates[0], 1
    return (dates[0], gaps.pop()) if len(gaps) == 1 else None


def extract_video_frames(video: Path, fps_arg: str, out: Path, first_only: bool = False) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    command = ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", str(video.resolve()), "-vf", f"fps={fps_arg}", "-pix_fmt", "rgb24"]
    if first_only:
        command += ["-frames:v", "1"]
    run_tool(command + [str(out / "f%06d.png")])
    frames = sorted(out.glob("f*.png"))
    if not frames:
        raise cf.ConvertError(f"{video.name}: no frames could be read from it")
    return frames


# ---------------------------------------------------------------------------------------------------------------------
# The web video


def encode_video(source_args: list[str], fps_arg: str, target: Path) -> None:
    """H.264, yuv420p, even size, no sound, faststart: plays on the web from the same origin."""
    target.parent.mkdir(parents=True, exist_ok=True)
    run_tool(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", *source_args, "-an",
              "-vf", f"scale=trunc(iw/2)*2:trunc(ih/2)*2,fps={fps_arg}",
              "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23", "-preset", "medium", "-movflags", "+faststart", str(target)])


# ---------------------------------------------------------------------------------------------------------------------
# The whole run


@dataclass
class Plan:
    box: Box
    area: str  # as convert_frames.py --map-area takes it
    stops_text: list[str]
    bar_found: bool
    stops: list[dict]


def describe_bar(rgb: np.ndarray, args: argparse.Namespace) -> Plan:
    height, width = rgb.shape[0], rgb.shape[1]
    bar_rgb = cf.read_rgb(args.legend_image) if args.legend_image else rgb
    if args.legend_box:
        box = cf.box_in_pixels(args.legend_box, bar_rgb.shape[1], bar_rgb.shape[0])
        found = False
    else:
        detected = detect_colour_bar(rgb)
        if detected is None:
            raise cf.ConvertError(NO_BAR)
        box, found = detected, True
    if args.map_area:
        cf.map_area_fractions(args.map_area, width, height)  # checks it
        area_text = args.map_area
    else:
        area_text = box_text(map_area_for_bar(box, width, height))
    low, high = (args.legend_min, args.legend_max) if args.legend_min is not None else (0.0, 1.0)
    stops = cf.sample_legend(cf.bar_profile(bar_rgb, box), low, high, args.legend_ticks)
    label = "value" if args.legend_min is not None else "position along the bar (0 = low end, 1 = high end)"
    lines = [f"    {label} {s['value']}: rgb({s['rgb'][0]}, {s['rgb'][1]}, {s['rgb'][2]})" for s in stops]
    return Plan(box, area_text, lines, found, stops)


def describe_text(plan: Plan, width: int, height: int, args: argparse.Namespace) -> list[str]:
    direction = "low end on the left, high end on the right" if orientation_of(plan.box) == "horizontal" else "low end at the bottom, high end at the top"
    how = "from --legend-image" if args.legend_image else "found" if plan.bar_found else "given by --legend-box"
    where = f"in {args.legend_image}" if args.legend_image else f"in a {width} x {height} frame"
    return [
        f"Colour bar ({how}): {box_text(plan.box)} {where}, {orientation_of(plan.box)} ({direction}).",
        "  Check this against NASA's legend: if the low end of the legend is at the other end, the values will be reversed.",
        f"Map area{' (from --map-area)' if args.map_area else ''}: {plan.area} (the frame without the bar; pixels unless every number is 1 or less).",
        f"Stops it would sample ({len(plan.stops_text)}):",
        *plan.stops_text,
    ]


@dataclass
class Ingested:
    result: cf.Result
    plan: Plan
    size: tuple[int, int]
    video_fps: float
    video_size: tuple[int, int]
    video_frames: int


def ingest(args: argparse.Namespace, work: Path) -> tuple[Plan, Ingested | None, tuple[int, int]]:
    """Check everything, then write. Returns the plan, the written data set (None for --detect-only) and the frame size."""
    check_args(args)
    manifest_path = args.out / "manifest.json"
    if not args.detect_only and manifest_path.exists() and not args.force:
        raise cf.ConvertError(f"{manifest_path} already exists and may have fields filled in. Add --force to overwrite it, or choose another --out")
    is_video = args.video is not None
    needs_tools = is_video or not args.detect_only
    if needs_tools:
        need_ffmpeg()

    # 1. Frame rate, and the dated frames.
    rate: str | None = None
    if is_video:
        rate, _, _ = probe_video(args.video)
    fps_arg = fps_text(args.fps) if args.fps is not None else (rate if rate is not None else fps_text(DEFAULT_FRAME_FPS))
    fps_value = args.fps if args.fps is not None else (manifest_fps(rate) if rate is not None else DEFAULT_FRAME_FPS)
    if fps_value > MAX_FPS:
        raise cf.ConvertError(f"the video runs at {fps_value:g} frames a second; the manifest allows {MAX_FPS} at most. Give --fps {MAX_FPS} or less")

    dated = work / "dated"
    dated.mkdir()
    if is_video:
        raw = extract_video_frames(args.video, fps_arg, work / "raw", first_only=args.detect_only)
        start = parse_date(args.start_date, "--start-date")
        sources = [Source(p, (start + dt.timedelta(days=k * args.step_days)).isoformat()) for k, p in enumerate(raw)]
        grid: tuple[str, int] | None = (args.start_date, args.step_days)
        kept = sources[:: args.every]
    elif args.detect_only:  # only the first picture is looked at, so no dates are needed
        files = image_files(args.frames)
        if not files:
            raise cf.ConvertError(f"--frames {args.frames}: no PNG or JPEG files found")
        sources = kept = [Source(files[0], "")]
        grid = None
    else:
        sources = kept = folder_sources(args)
        grid = regular_grid([s.date for s in sources])
        if grid is None and not args.detect_only:
            raise cf.ConvertError(IRREGULAR)
    assert grid is not None or args.detect_only

    # 2. The colour bar and the map area, on the first frame.
    first_rgb = cf.read_rgb(sources[0].path)
    height, width = first_rgb.shape[0], first_rgb.shape[1]
    plan = describe_bar(first_rgb, args)
    del first_rgb
    if args.detect_only:
        return plan, None, (width, height)

    # 3. The web video, made before anything is written to --out, so a failure leaves it as it was.
    video_tmp = work / "video.mp4"
    if is_video:
        encode_video(["-i", str(args.video.resolve())], fps_arg, video_tmp)
    else:
        seq = work / "seq"
        seq.mkdir()
        for k, source in enumerate(sources, start=1):
            cf.save_png(cf.read_rgb(source.path), seq / f"{k:06d}.png")
        encode_video(["-framerate", fps_arg, "-i", str(seq / "%06d.png")], fps_arg, video_tmp)

    # 4. The dated frames, written the way convert_frames.py makes them.
    for source in kept:
        suffix = ".png" if is_video else source.path.suffix.lower()
        shutil.copyfile(source.path, dated / f"{source.date}{suffix}")
    if args.legend_image:  # the bar is not in the frames, so convert_frames.py gets the stops, not a box to sample
        legend_json = work / "legend.json"
        legend_json.write_text(json.dumps(plan.stops), encoding="utf-8")
        legend_args = ["--legend", str(legend_json)]
    else:
        legend_args = ["--legend-box", box_text(plan.box), "--legend-values", f"{args.legend_min!r},{args.legend_max!r}"]
    cf_args = cf.parse_args([
        "--id", args.id, "--frames", str(dated), "--out", str(args.out), *legend_args,
        "--legend-steps", str(args.legend_ticks), "--map-area", plan.area,
        *(["--max-width", str(args.max_width)] if args.max_width is not None else []),
        *(["--force"] if args.force else []),
    ])
    result = cf.convert(cf_args)

    # 5. The video file and the manifest's v3 fields.
    first_date, step = grid  # type: ignore[misc]
    target = args.out / "video" / f"{args.id}.mp4"
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(video_tmp, target)
    manifest = result.manifest
    manifest["video"] = {"src": f"video/{args.id}.mp4", "fps": clean(round(fps_value, 3)), "firstFrameDate": first_date, "frameStepDays": step}
    if args.legend == "picture":
        manifest["legend"] = "picture"
    if args.preset is not None:
        manifest["sonification"] = {"preset": args.preset, **({"detail": args.detail} if args.detail else {})}
    cf.write_json(args.out / "manifest.json", manifest)
    size = (width, height)
    return plan, Ingested(result, plan, size, fps_value, (width // 2 * 2, height // 2 * 2), len(sources)), size


def report(args: argparse.Namespace, done: Ingested) -> str:
    m = done.result.manifest
    lines = [cf.report(cf_args_for_report(args), done.result), ""]
    lines += describe_text(done.plan, done.size[0], done.size[1], args)
    lines += ["", f"Video: {args.out / m['video']['src']} ({done.video_frames} frames, {done.video_size[0]} x {done.video_size[1]}, "
                  f"{m['video']['fps']:g} frames a second, one frame every {m['video']['frameStepDays']} day(s) from {m['video']['firstFrameDate']})."]
    return "\n".join(lines)


def cf_args_for_report(args: argparse.Namespace) -> argparse.Namespace:
    return argparse.Namespace(out=args.out, id=args.id)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        with tempfile.TemporaryDirectory(prefix="eic-ingest-") as tmp:
            plan, done, size = ingest(args, Path(tmp))
    except cf.ConvertError as error:
        print(f"eic_ingest.py: error: {error}", file=sys.stderr)
        return 1
    if done is None:
        print("\n".join(describe_text(plan, size[0], size[1], args)))
        print("\nNothing was written (--detect-only). Run again without it to write the data set.")
        return 0
    print(report(args, done))
    return 0


if __name__ == "__main__":
    sys.exit(main())

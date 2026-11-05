"""Turn a folder of dated map frames into a data set for the app (ticket T91; the T85 checklist, step 3).

    .venv/bin/python -I scripts/convert_frames.py --id <id> --frames <dir> --legend <legend.json> \\
        --map-area x0,y0,x1,y1 --out public/data/<id>

Reads PNG or JPEG frames, takes each date from the file name, and writes `frames/<date>.png` plus a `manifest.json` filled in
from `scripts/templates/manifest.template.json`. Every field a person must still fill in keeps its `TODO`, and the script prints
them. Then `npm run check-data` tells you what is still wrong. Needs Pillow and NumPy (`scripts/requirements.txt`).

What it guarantees, so the browser and the test decoder read the same colours:
- 8-bit RGB PNGs, not interlaced, with no colour profile or gamma chunks (iCCP, gAMA, cHRM, sRGB): only IHDR, IDAT and IEND.
- Scaling down (`--max-width`) is nearest-neighbour only, so every pixel keeps a colour that was in the source frame.
- Running it twice on the same input gives identical files.

What it rejects, with a readable message: two frames with the same date, frames of different sizes, a file name without a
date, a colour bar that changes between frames (more than 3 per channel), and frames with transparent pixels.

Usage and the checklist: docs/data-sources.md, "Converting frames (T91)".
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "scripts" / "templates" / "manifest.template.json"

IMAGE_SUFFIXES = {".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg"}
DEFAULT_DATE_PATTERN = r"(?P<year>\d{4})[-_.]?(?P<month>\d{2})[-_.]?(?P<day>\d{2})"
LEGEND_TOLERANCE = 3  # per channel: how far the colour bar may differ between frames (T85 step 3)
LATTICE_COLUMNS, LATTICE_ROWS = 6, 5  # the default region: 30 points inside the map area
DEFAULT_LEGEND_STEPS = 9


class ConvertError(Exception):
    """A problem with the input that a person must fix. The message says what and how."""


@dataclass(frozen=True)
class Frame:
    path: Path
    date: str
    kind: str  # "png" or "jpeg"


# ---------------------------------------------------------------------------------------------------------------------
# Reading the options


def numbers(text: str, count: int, option: str) -> list[float]:
    parts = text.split(",")
    try:
        values = [float(p) for p in parts]
    except ValueError:
        values = []
    if len(values) != count:
        raise ConvertError(f"{option} needs {count} numbers separated by commas, like {','.join(['0'] * count)}; got {text!r}")
    return values


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="convert_frames.py",
        description="Turn a folder of dated PNG or JPEG map frames into public/data/<id>/ (frames and manifest.json).",
        epilog="See docs/data-sources.md, 'Converting frames (T91)'.",
    )
    p.add_argument("--id", required=True, help="the data set's id, also its folder name under public/data/ (letters, digits, '-')")
    p.add_argument("--frames", required=True, type=Path, help="folder holding the PNG or JPEG frames, one per date")
    p.add_argument("--out", required=True, type=Path, help="where to write frames/ and manifest.json, e.g. public/data/<id>")
    p.add_argument("--date-pattern", default=DEFAULT_DATE_PATTERN,
                   help="regular expression that finds the date in each file name. Use named groups year, month and day "
                        "(month and day may be left out: they then count as 1). Default: YYYY-MM-DD, YYYY_MM_DD, YYYY.MM.DD or YYYYMMDD")
    p.add_argument("--legend", type=Path, help='legend.json: stops [{"value": 0, "rgb": [r, g, b]}, ...] read off the colour bar')
    p.add_argument("--legend-box", help="x0,y0,x1,y1: the colour bar's pixels in the original frames (inclusive). Along the bar, "
                                         "the box runs exactly from the pixel of the low value to the pixel of the high value; "
                                         "across it, stay inside the bar, clear of its border. Used to sample the legend (with "
                                         "--legend-values) and to check it is the same on every frame")
    p.add_argument("--legend-values", help="min,max: the values at the bar's two ends. Horizontal bar: left end, then right end. "
                                            "Vertical bar: bottom end, then top end")
    p.add_argument("--legend-steps", type=int, default=DEFAULT_LEGEND_STEPS,
                   help=f"how many evenly spaced stops to sample from --legend-box (default {DEFAULT_LEGEND_STEPS})")
    p.add_argument("--map-area", help="x0,y0,x1,y1: the map without legend bar, titles or logos. Fractions 0 to 1 of the image, "
                                       "or pixels of the original frames if any number is above 1. Default: the whole image")
    p.add_argument("--max-width", type=int, help="scale frames wider than this down to this width, nearest-neighbour only")
    p.add_argument("--force", action="store_true", help="overwrite an existing manifest.json in --out (loses anything filled in there)")
    return p.parse_args(argv)


# ---------------------------------------------------------------------------------------------------------------------
# Finding the frames and their dates


def date_from_name(name: str, pattern: re.Pattern[str]) -> str | None:
    match = pattern.search(name)
    if not match:
        return None
    groups = match.groupdict()
    if groups.get("year") is None:
        raise ConvertError("--date-pattern must have a named group for the year, like (?P<year>\\d{4})")
    try:
        day = dt.date(int(groups["year"]), int(groups.get("month") or 1), int(groups.get("day") or 1))
    except ValueError as error:
        raise ConvertError(f'"{name}": {match.group(0)!r} is not a real date ({error})') from None
    return day.isoformat()


def find_frames(folder: Path, date_pattern: str) -> tuple[list[Frame], list[str]]:
    """The image files in `folder`, sorted by date, and the names of the other files (ignored)."""
    if not folder.is_dir():
        raise ConvertError(f"--frames {folder}: there is no such folder")
    try:
        pattern = re.compile(date_pattern)
    except re.error as error:
        raise ConvertError(f"--date-pattern is not a valid regular expression: {error}") from None

    frames: list[Frame] = []
    ignored: list[str] = []
    no_date: list[str] = []
    for path in sorted(folder.iterdir()):
        kind = IMAGE_SUFFIXES.get(path.suffix.lower())
        if not path.is_file() or path.name.startswith("."):
            continue
        if kind is None:
            ignored.append(path.name)
            continue
        date = date_from_name(path.name, pattern)
        if date is None:
            no_date.append(path.name)
        else:
            frames.append(Frame(path, date, kind))

    if no_date:
        listed = ", ".join(no_date[:5]) + (f" and {len(no_date) - 5} more" if len(no_date) > 5 else "")
        raise ConvertError(f"no date found in {len(no_date)} file name(s): {listed}. Rename them with the date "
                           f"(e.g. 2024-01-15.png) or give a --date-pattern that matches them")
    if not frames:
        raise ConvertError(f"--frames {folder}: no PNG or JPEG files found")

    frames.sort(key=lambda f: (f.date, f.path.name))
    for before, frame in zip(frames, frames[1:]):
        if before.date == frame.date:
            raise ConvertError(f'"{before.path.name}" and "{frame.path.name}" both have the date {frame.date}; '
                               f"keep one frame per date")
    return frames, ignored


# ---------------------------------------------------------------------------------------------------------------------
# Reading pixels


def read_rgb(path: Path) -> np.ndarray:
    """The frame's pixels as height x width x 3 bytes, exactly as stored: no colour profile or gamma is applied."""
    try:
        with Image.open(path) as image:
            image.load()
            mode = image.mode
            if mode in ("CMYK", "YCbCr", "LAB", "HSV") or mode.startswith("I") or mode == "F":
                raise ConvertError(f'"{path.name}" has image mode {mode}; save it as an 8-bit RGB PNG first')
            has_alpha = mode in ("RGBA", "LA", "PA", "RGBa", "La") or (mode == "P" and "transparency" in image.info)
            if has_alpha:
                rgba = np.asarray(image.convert("RGBA"), dtype=np.uint8)
                if int(rgba[..., 3].min()) < 255:
                    raise ConvertError(f'"{path.name}" has transparent pixels. Writing RGB would turn them into colours the app '
                                       f"might read as values; flatten the frame onto the land or no-data colour first")
                return np.ascontiguousarray(rgba[..., :3])
            return np.asarray(image.convert("RGB"), dtype=np.uint8)
    except ConvertError:
        raise
    except Exception as error:  # Pillow raises several kinds for a damaged or unknown file
        raise ConvertError(f'"{path.name}" could not be read as an image: {error}') from None


def image_size(path: Path) -> tuple[int, int]:
    try:
        with Image.open(path) as image:
            return image.size
    except Exception as error:
        raise ConvertError(f'"{path.name}" could not be read as an image: {error}') from None


def check_sizes(frames: list[Frame]) -> tuple[int, int]:
    sizes = [image_size(f.path) for f in frames]
    first = sizes[0]
    for frame, size in zip(frames, sizes):
        if size != first:
            raise ConvertError(f'"{frame.path.name}" is {size[0]} x {size[1]} pixels but "{frames[0].path.name}" is '
                               f"{first[0]} x {first[1]}; every frame must be the same size, with the map in the same place")
    return first


# ---------------------------------------------------------------------------------------------------------------------
# The legend


def box_in_pixels(text: str, width: int, height: int) -> tuple[int, int, int, int]:
    x0, y0, x1, y1 = (int(round(v)) for v in numbers(text, 4, "--legend-box"))
    if not (0 <= x0 <= x1 < width and 0 <= y0 <= y1 < height):
        raise ConvertError(f"--legend-box {text}: must lie inside the {width} x {height} frame with x0 <= x1 and y0 <= y1 "
                           f"(pixels, inclusive)")
    if x0 == x1 and y0 == y1:
        raise ConvertError(f"--legend-box {text}: is a single pixel; give the length of the colour bar")
    return x0, y0, x1, y1


def bar_profile(pixels: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    """The colour bar as one colour per pixel along its length, from the low end to the high end.

    A bar wider than tall is horizontal (low end on the left); otherwise vertical (low end at the bottom). Across the bar's
    thickness each channel takes the lower median, so a stray label pixel does not change the result."""
    x0, y0, x1, y1 = box
    area = pixels[y0:y1 + 1, x0:x1 + 1].astype(np.int16)
    if x1 - x0 >= y1 - y0:
        across = np.sort(area, axis=0)  # rows sorted per column
        profile = across[(area.shape[0] - 1) // 2]
    else:
        across = np.sort(area, axis=1)
        profile = across[:, (area.shape[1] - 1) // 2][::-1]  # bottom (low) first
    return profile


def clean_number(value: float) -> float | int:
    value = round(value, 6)
    return int(value) if value == int(value) else value


def sample_legend(profile: np.ndarray, low: float, high: float, steps: int) -> list[dict]:
    if steps < 2:
        raise ConvertError("--legend-steps must be at least 2")
    if steps > len(profile):
        raise ConvertError(f"--legend-steps {steps} is more than the {len(profile)} pixels along --legend-box; use fewer steps")
    stops = []
    for i in range(steps):
        position = int(round(i * (len(profile) - 1) / (steps - 1)))
        value = low + i * (high - low) / (steps - 1)
        stops.append({"value": clean_number(value), "rgb": [int(c) for c in profile[position]]})
    stops.sort(key=lambda s: s["value"])  # --legend-values max,min (a reversed bar) still gives stops in order of value
    for before, stop in zip(stops, stops[1:]):
        if before["rgb"] == stop["rgb"]:
            raise ConvertError(f"the colour bar has the same colour {stop['rgb']} at {before['value']} and {stop['value']}, so "
                               f"that colour has no single value. The bar may have flat steps: use fewer --legend-steps, "
                               f"or write legend.json with one stop per step")
    return stops


def read_legend_file(path: Path) -> list[dict]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ConvertError(f"--legend {path}: there is no such file") from None
    except json.JSONDecodeError as error:
        raise ConvertError(f"--legend {path}: is not valid JSON ({error})") from None
    raw = data.get("stops") if isinstance(data, dict) else data
    if not isinstance(raw, list) or len(raw) < 2:
        raise ConvertError(f'--legend {path}: needs a list of at least two stops, like [{{"value": 0, "rgb": [0, 0, 255]}}, ...]')
    stops = []
    for i, stop in enumerate(raw):
        value = stop.get("value") if isinstance(stop, dict) else None
        rgb = stop.get("rgb") if isinstance(stop, dict) else None
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ConvertError(f"--legend {path}: stop {i} needs a number \"value\"")
        if (not isinstance(rgb, list) or len(rgb) != 3
                or not all(isinstance(c, int) and not isinstance(c, bool) and 0 <= c <= 255 for c in rgb)):
            raise ConvertError(f"--legend {path}: stop {i} needs \"rgb\": three whole numbers from 0 to 255")
        stops.append({"value": clean_number(float(value)), "rgb": list(rgb)})
    stops.sort(key=lambda s: s["value"])
    for before, stop in zip(stops, stops[1:]):
        if before["value"] == stop["value"]:
            raise ConvertError(f"--legend {path}: two stops have the value {stop['value']}; each value appears once")
    return stops


def check_legend_unchanged(frames: list[Frame], box: tuple[int, int, int, int], first: np.ndarray) -> None:
    for frame in frames[1:]:
        profile = bar_profile(read_rgb(frame.path), box)
        difference = np.abs(profile - first)
        worst = int(difference.max())
        if worst > LEGEND_TOLERANCE:
            where = int(np.unravel_index(difference.argmax(), difference.shape)[0])
            raise ConvertError(
                f'the colour bar in "{frame.path.name}" differs from "{frames[0].path.name}" by {worst} (more than '
                f"{LEGEND_TOLERANCE}) at pixel {where} along --legend-box: {profile[where].tolist()} instead of "
                f"{first[where].tolist()}. A changing legend cannot be read with one set of stops; check --legend-box sits "
                f"on the bar in every frame, or split the frames into data sets that share one legend")


# ---------------------------------------------------------------------------------------------------------------------
# The manifest


def map_area_fractions(text: str | None, width: int, height: int) -> dict | None:
    if text is None:
        return None
    x0, y0, x1, y1 = numbers(text, 4, "--map-area")
    if max(x0, y0, x1, y1) > 1:  # pixels of the original frames
        if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
            raise ConvertError(f"--map-area {text}: as pixels, must lie inside the {width} x {height} frame with x0 < x1 and y0 < y1")
        x0, x1, y0, y1 = x0 / width, x1 / width, y0 / height, y1 / height
    elif not (0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1):
        raise ConvertError(f"--map-area {text}: as fractions, must lie between 0 and 1 with x0 < x1 and y0 < y1")
    return {key: clean_number(round(value, 4)) for key, value in (("x0", x0), ("y0", y0), ("x1", x1), ("y1", y1))}


def lattice(area: dict | None) -> list[dict]:
    """6 columns x 5 rows of points at the centres of equal cells inside the map area, top row first."""
    a = area or {"x0": 0, "y0": 0, "x1": 1, "y1": 1}
    points = []
    for row in range(LATTICE_ROWS):
        for column in range(LATTICE_COLUMNS):
            x = a["x0"] + (column + 0.5) / LATTICE_COLUMNS * (a["x1"] - a["x0"])
            y = a["y0"] + (row + 0.5) / LATTICE_ROWS * (a["y1"] - a["y0"])
            points.append({"x": clean_number(min(a["x1"], max(a["x0"], round(x, 4)))),
                           "y": clean_number(min(a["y1"], max(a["y0"], round(y, 4))))})
    return points


def categories_over(template: list[dict], low: float, high: float) -> list[dict]:
    """The template's categories (ids, labels, notes) with the legend's span split into equal ranges, each starting where the
    one before ends."""
    count = len(template)
    edges = [low] + [clean_number(low + k * (high - low) / count) for k in range(1, count)] + [high]
    return [{**c, "range": [edges[i], edges[i + 1]]} for i, c in enumerate(template)]


def build_manifest(template: dict, data_id: str, stops: list[dict], frames: list[Frame], size: tuple[int, int],
                   area: dict | None) -> dict:
    manifest = copy.deepcopy(template)
    manifest["id"] = data_id
    manifest["colorScale"]["stops"] = stops
    manifest["regions"] = [{**template["regions"][0], "points": lattice(area)}]
    example = template["frames"][0]
    manifest["frames"] = [
        {**example, "id": f.date, "date": f.date, "image": f"frames/{f.date}.png", "width": size[0], "height": size[1]}
        for f in frames
    ]
    manifest["mapping"]["categories"] = categories_over(template["mapping"]["categories"], stops[0]["value"], stops[-1]["value"])
    manifest.pop("mapArea", None)
    if area is not None:
        manifest["mapArea"] = area
    return manifest


def todo_fields(value: object, path: str = "") -> list[str]:
    if isinstance(value, str):
        return [path] if "TODO" in value else []
    if isinstance(value, dict):
        return [f for key, inner in value.items() for f in todo_fields(inner, f"{path}.{key}" if path else key)]
    if isinstance(value, list):
        return [f for i, inner in enumerate(value) for f in todo_fields(inner, f"{path}.{i}")]
    return []


def summarise_todos(fields: list[str]) -> list[str]:
    """frames.0.altText ... frames.11.altText as one line; the rest as they are."""
    lines: list[str] = []
    grouped: dict[str, int] = {}
    for field in fields:
        generic = re.sub(r"\.\d+\.", ".*.", field)
        if generic != field and generic.startswith("frames."):
            if generic not in grouped:
                lines.append(generic)
            grouped[generic] = grouped.get(generic, 0) + 1
        else:
            lines.append(field)
    return [f"{line} (one per frame, {grouped[line]} in all)" if line in grouped else line for line in lines]


# ---------------------------------------------------------------------------------------------------------------------
# Writing


def save_png(pixels: np.ndarray, path: Path) -> None:
    """An 8-bit RGB PNG, not interlaced, with only IHDR, IDAT and IEND. A fresh image carries no profile or gamma."""
    Image.fromarray(np.ascontiguousarray(pixels, dtype=np.uint8)).save(path, format="PNG", compress_level=9, optimize=False)


def scaled(pixels: np.ndarray, max_width: int | None) -> np.ndarray:
    height, width = pixels.shape[:2]
    if not max_width or width <= max_width:
        return pixels
    new_height = max(1, int(height * max_width / width + 0.5))
    image = Image.fromarray(pixels).resize((max_width, new_height), Image.Resampling.NEAREST)
    return np.asarray(image, dtype=np.uint8)


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


@dataclass
class Result:
    manifest: dict
    todos: list[str]
    jpeg_count: int
    ignored: list[str]
    scaled_from: tuple[int, int] | None
    legend_checked: bool


def convert(args: argparse.Namespace) -> Result:
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", args.id):
        raise ConvertError(f"--id {args.id!r}: use lower-case letters, digits and single hyphens, like sea-surface-2024")
    if args.max_width is not None and args.max_width < 1:
        raise ConvertError("--max-width must be a positive number of pixels")
    if args.legend is None and args.legend_values is None:
        raise ConvertError("give the legend: --legend legend.json, or --legend-box x0,y0,x1,y1 with --legend-values min,max")
    if args.legend_values is not None and args.legend_box is None:
        raise ConvertError("--legend-values needs --legend-box, the colour bar to sample")
    if args.legend is not None and args.legend_values is not None:
        raise ConvertError("give either --legend or --legend-values, not both")

    manifest_path = args.out / "manifest.json"
    if manifest_path.exists() and not args.force:
        raise ConvertError(f"{manifest_path} already exists and may have fields filled in. Add --force to overwrite it, "
                           f"or choose another --out")

    frames, ignored = find_frames(args.frames, args.date_pattern)
    width, height = check_sizes(frames)
    area = map_area_fractions(args.map_area, width, height)

    # Check everything before writing anything, so a rejected run leaves --out as it was.
    first_pixels = read_rgb(frames[0].path)
    box = box_in_pixels(args.legend_box, width, height) if args.legend_box else None
    first_profile = bar_profile(first_pixels, box) if box else None
    if args.legend is not None:
        stops = read_legend_file(args.legend)
    else:
        low, high = numbers(args.legend_values, 2, "--legend-values")
        if low == high:
            raise ConvertError("--legend-values: the two ends must differ")
        stops = sample_legend(first_profile, low, high, args.legend_steps)
    if box:
        check_legend_unchanged(frames, box, first_profile)
    del first_pixels

    out_frames = args.out / "frames"
    out_frames.mkdir(parents=True, exist_ok=True)
    written = set()
    out_size = (width, height)
    for frame in frames:
        pixels = scaled(read_rgb(frame.path), args.max_width)
        out_size = (pixels.shape[1], pixels.shape[0])
        name = f"{frame.date}.png"
        save_png(pixels, out_frames / name)
        written.add(name)
    for stale in sorted(out_frames.glob("*.png")):  # from an earlier run with other dates
        if stale.name not in written:
            stale.unlink()

    template = json.loads(TEMPLATE.read_text(encoding="utf-8"))
    manifest = build_manifest(template, args.id, stops, frames, out_size, area)
    write_json(manifest_path, manifest)
    return Result(
        manifest=manifest,
        todos=todo_fields(manifest),
        jpeg_count=sum(f.kind == "jpeg" for f in frames),
        ignored=ignored,
        scaled_from=(width, height) if out_size != (width, height) else None,
        legend_checked=box is not None,
    )


def report(args: argparse.Namespace, result: Result) -> str:
    m = result.manifest
    frames = m["frames"]
    stops = m["colorScale"]["stops"]
    lines = [f"Wrote {len(frames)} frames ({frames[0]['date']} to {frames[-1]['date']}, {frames[0]['width']} x "
             f"{frames[0]['height']}) and manifest.json to {args.out}"]
    if result.scaled_from:
        lines.append(f"  Scaled down from {result.scaled_from[0]} x {result.scaled_from[1]} (nearest-neighbour).")
    lines.append(f"  Legend: {len(stops)} stops from {stops[0]['value']} to {stops[-1]['value']}.")
    if not result.legend_checked:
        lines.append("  Not checked: whether the colour bar is the same on every frame. Add --legend-box to check it.")
    if result.ignored:
        lines.append(f"  Ignored {len(result.ignored)} file(s) that are not PNG or JPEG: {', '.join(result.ignored[:5])}")
    if result.jpeg_count:
        lines.append("")
        lines.append(f"WARNING: {result.jpeg_count} of {len(frames)} frames are JPEG. JPEG compression blends colours, so more points "
                     f"will be off the legend and read as 'not enough data'. Use PNG frames if the source has them.")
    lines.append("")
    lines.append(f"Still to fill in ({len(result.todos)} TODO fields in {args.out / 'manifest.json'}):")
    lines.extend(f"  - {line}" for line in summarise_todos(result.todos))
    lines.append("")
    lines.append("Also check (they have working values, so the check cannot tell they were never looked at):")
    lines.append("  - colorScale.noData: the colours of land, coastlines and labels (the template's grey is a placeholder)")
    lines.append("  - colorScale.maxColorDistance: start at 40; lower it if land or labels are read as values")
    lines.append(f"  - regions.0.points: {LATTICE_COLUMNS * LATTICE_ROWS} points spread over the map area; move any that fall on land")
    lines.append("  - mapping.categories: the legend's span split into equal ranges; check the labels suit the variable")
    lines.append("")
    lines.append("Then add the data set to public/data/index.json:")
    lines.append(f'  {{ "id": "{args.id}", "title": "...", "summary": "..." }}')
    lines.append("and run: npm run check-data")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        result = convert(args)
    except ConvertError as error:
        print(f"convert_frames.py: error: {error}", file=sys.stderr)
        return 1
    print(report(args, result))
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Write the synthetic globe dataset in public/data/synthetic-globe/ (ticket T66).

Twelve monthly 1200 x 600 frames of a pretend globe whose temperature we know exactly: warm at the equator, cold towards
the top and bottom, two grey land masses, a warm current along one coast, and a "marine heatwave" patch in the north-east
that grows from March to August and fades by November. In October a cloud hides most of the patch. The values are chosen
so the app's analysis can be checked against `expected.json`, and so a map explorer has something to explore before NASA's
data exists. It is practice data: every frame says so. Needs Pillow and NumPy:

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python -I scripts/make_synthetic_globe.py

Stress option (T85, speed): `--frames N --width W --height H --out DIR` writes N frames of W x H into DIR instead (for example
60 frames of 1920 x 1080 into public/data/stress-globe, which .gitignore leaves out), with a manifest and no change to
index.json or expected.json. The first 12 frames are the usual dates; later ones carry on month by month from 2025.

Running it twice gives identical files. `expected.json` is computed from the values the script draws at the sample points,
never by reading an image back. The legend, notes and helpers are shared with make_synthetic.py (loaded by path, because
`python -I` does not put this folder on the import path).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

_spec = importlib.util.spec_from_file_location("make_synthetic", Path(__file__).with_name("make_synthetic.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

ROOT = base.ROOT
ID = "synthetic-globe"
OUT = ROOT / "public" / "data" / ID
WIDTH, HEIGHT = 1200, 600
MAP_BOTTOM = 0.88  # the legend bar starts at y = 528 of 600; the app reads only the map above it
LEGEND_TOP = int(HEIGHT * MAP_BOTTOM)

# The temperature field, in degrees C. Latitude runs from +1 at the top of the map to -1 at the bottom.
BASE_SHIFT = -2.0     # moves the whole globe, chosen with SEASON_AMP so every sample stays clear of a category edge
SEASON_AMP = 5.0      # the northern half is warmer in the middle of the year
CURRENT_GAIN = 3.0    # the warm current off the east coast of the western land
PATCH_X, PATCH_V, PATCH_RX, PATCH_RV = 0.56, 0.159, 0.14, 0.09  # the heatwave patch (x across, v down the map)

# (date, heatwave strength in degrees C, cloud hides the patch, what is happening)
SCENARIOS = [
    ("2024-01-15", 0.0, False, "A normal winter"),
    ("2024-02-15", 0.0, False, "A normal winter"),
    ("2024-03-15", 0.5, False, "The patch starts to warm"),
    ("2024-04-15", 1.5, False, "The patch warms"),
    ("2024-05-15", 2.5, False, "The patch warms"),
    ("2024-06-15", 3.0, False, "The patch warms"),
    ("2024-07-15", 4.5, False, "The patch warms"),
    ("2024-08-15", 5.0, False, "The warmest the patch gets"),
    ("2024-09-15", 3.5, False, "The patch starts to fade"),
    ("2024-10-15", 2.0, True, "Cloud hides most of the patch: not enough data"),
    ("2024-11-15", 0.5, False, "The patch has almost gone"),
    ("2024-12-15", 0.0, False, "The patch has gone"),
]

# Land, as (x across, v down the map) fractions. West and east.
WEST_LAND = [(0.08, 0.30), (0.22, 0.22), (0.30, 0.40), (0.28, 0.62), (0.20, 0.78), (0.10, 0.70), (0.06, 0.50)]
EAST_LAND = [(0.72, 0.34), (0.84, 0.26), (0.93, 0.40), (0.90, 0.66), (0.80, 0.80), (0.72, 0.66), (0.70, 0.48)]

# A cloud over most of the heatwave patch in October: an ellipse in pixels (centre and radii) at 1200 x 600. It covers four of
# the six columns of sample points, 20 of 30, so fewer than half can be read and the date is "not enough data".
CLOUD_AT_1200 = (624, 84, 114, 48)
CLOUD = CLOUD_AT_1200

# Two regions of 30 points each, in open water: the patch (inside the heatwave) and the tropics (along the equator).
PATCH_POINTS = [(round(0.46 + 0.04 * i, 2), round(0.09 + 0.025 * j, 3)) for j in range(5) for i in range(6)]
TROPIC_POINTS = [(round(0.40 + 0.04 * i, 2), round(v * MAP_BOTTOM, 3)) for v in (0.46, 0.48, 0.50, 0.52, 0.54) for i in range(6)]
REGIONS = [
    ("north-east-patch", "North-east patch", "A grid of 30 points in the north-east ocean, where the marine heatwave grows and fades.", PATCH_POINTS),
    ("tropics", "Tropics", "A grid of 30 points along the equator in the middle of the ocean, which stays hot all year.", TROPIC_POINTS),
]

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
WORDS = {"cold": "deep blue, cold", "cool": "light blue, cool", "mild": "green, mild", "warm": "yellow to orange, warm", "hot": "deep red, hot"}
SOURCE = {"name": "Synthetic test data", "url": "", "credit": "Earth Jukebox team", "license": "CC0", "retrievedOn": "2026-11-05"}


def field(x, y, month: int, gain: float):
    """The temperature at fractions x, y of the image (numbers or arrays), in the given month with the given heatwave."""
    v = y / MAP_BOTTOM
    lat = 1 - 2 * v
    temperature = 1 + 27 * np.cos(np.pi * lat / 2) + BASE_SHIFT
    temperature = temperature + SEASON_AMP * lat * np.sin(2 * np.pi * (month - 4) / 12)
    temperature = temperature + CURRENT_GAIN * np.exp(-((x - 0.34) ** 2 / (2 * 0.035 ** 2) + (v - 0.50) ** 2 / (2 * 0.16 ** 2)))
    temperature = temperature + gain * np.exp(-((x - PATCH_X) ** 2 / PATCH_RX ** 2 + (v - PATCH_V) ** 2 / PATCH_RV ** 2))
    return temperature + base.spatial_offset(x, y)


def set_size(width: int, height: int) -> None:
    """Draws at another size. Everything is placed by fraction of the image, so the answers do not change."""
    global WIDTH, HEIGHT, LEGEND_TOP, CLOUD
    WIDTH, HEIGHT = width, height
    LEGEND_TOP = int(HEIGHT * MAP_BOTTOM)
    cx, cy, rx, ry = CLOUD_AT_1200
    CLOUD = (cx * width / 1200, cy * height / 600, rx * width / 1200, ry * height / 600)


def pixel(x: float, y: float) -> tuple[int, int]:
    """The pixel the app reads for a sample point: (x * width, y * height), rounded down."""
    return min(WIDTH - 1, int(x * WIDTH)), min(HEIGHT - 1, int(y * HEIGHT))


def under_cloud(px: int, py: int) -> bool:
    cx, cy, rx, ry = CLOUD
    return ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1


def land_polygon(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(x * WIDTH, v * MAP_BOTTOM * HEIGHT) for x, v in points]


def draw_frame(date: str, month: int, gain: float, cloud: bool) -> Image.Image:
    xn = np.arange(WIDTH)[None, :] / WIDTH
    yn = np.arange(HEIGHT)[:, None] / HEIGHT
    image = Image.fromarray(base.legend_rgb(field(xn, yn, month, gain) + np.zeros((HEIGHT, WIDTH))), "RGB")
    draw = ImageDraw.Draw(image)

    for land in (WEST_LAND, EAST_LAND):
        draw.polygon(land_polygon(land), fill=base.NO_DATA)
    if cloud:
        cx, cy, rx, ry = CLOUD
        draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=base.NO_DATA)

    k = WIDTH / 1200  # the label and the legend are laid out for 1200 x 600 and scaled from there
    draw.rectangle([8 * k, 8 * k, 420 * k, 34 * k], fill=(20, 20, 20))
    draw.text((14 * k, 11 * k), f"Synthetic globe (made-up)  {date}", fill=(255, 255, 255), font=base.font(max(8, round(15 * k))))

    # Legend bar along the bottom, with its own labels: below the map area.
    draw.rectangle([0, LEGEND_TOP, WIDTH, HEIGHT], fill=(20, 20, 20))
    bar_w, bar_h = max(2, round(900 * k)), max(2, round(24 * (HEIGHT / 600)))
    bar = base.legend_rgb(np.tile(np.linspace(0, 30, bar_w), (bar_h, 1)))
    left = round(150 * k)
    image.paste(Image.fromarray(bar, "RGB"), (left, LEGEND_TOP + round(12 * HEIGHT / 600)))
    for value in (0, 10, 20, 30):
        x = left + int(value / 30 * (bar_w - 1))
        draw.text((x - 8 * k, LEGEND_TOP + 42 * HEIGHT / 600), str(value), fill=(255, 255, 255), font=base.font(max(8, round(13 * k))))
    draw.text((1070 * k, LEGEND_TOP + 14 * HEIGHT / 600), "°C", fill=(255, 255, 255), font=base.font(max(8, round(15 * k))))
    return image


def drawn_value(month: int, gain: float, px: int, py: int) -> float:
    return float(field(np.array(px / WIDTH), np.array(py / HEIGHT), month, gain))


def expected_for(date: str, month: int, gain: float, cloud: bool, region_id: str, points: list[tuple[float, float]]) -> dict:
    values = []
    for x, y in points:
        px, py = pixel(x, y)
        if not (cloud and under_cloud(px, py)):
            values.append(drawn_value(month, gain, px, py))
    sampled, valid = len(points), len(values)
    if cloud and region_id == "north-east-patch":
        assert valid == 10, f"{date}: the cloud should leave 10 of 30 patch points readable, not {valid}"
    if valid / sampled < 0.5:
        return {"frameId": date, "regionId": region_id, "sampled": sampled, "valid": valid, "medianValue": None, "category": "insufficient"}
    median = float(np.median(values))
    for _, _, (low, high), _ in base.CATEGORIES:  # a frame too close to an edge would make the check unreliable
        assert abs(median - low) > 0.75 and abs(median - high) > 0.75, f"{date} {region_id}: median {median:.2f} is too close to a category edge"
    return {"frameId": date, "regionId": region_id, "sampled": sampled, "valid": valid, "medianValue": round(median, 4), "category": base.category_for(median)}


def all_expected() -> list[dict]:
    return [
        expected_for(date, month, gain, cloud, region_id, points)
        for month, (date, gain, cloud, _) in enumerate(SCENARIOS, start=1)
        for region_id, _, _, points in REGIONS
    ]


def describe(month: int, patch: dict, story: str) -> str:
    label = f"Synthetic globe map, {MONTHS[month - 1]} 2024. Made-up practice data: two grey land masses, west and east, with a warm current between them."
    if patch["category"] == "insufficient":
        return f"{label} Cloud hides most of the north-east patch, so there is not enough data to read a temperature there. {story}."
    return f"{label} The north-east patch is {WORDS[patch['category']]}, about {patch['medianValue']:.0f} °C. {story}."


def manifest(expected: list[dict]) -> dict:
    patch = {e["frameId"]: e for e in expected if e["regionId"] == "north-east-patch"}
    frames = []
    for month, (date, _, cloud, story) in enumerate(SCENARIOS, start=1):
        frame = {"id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT, "altText": describe(month, patch[date], story)}
        if cloud:
            frame["note"] = "Cloud hides most of the north-east patch on this date."
        frames.append(frame)

    t = lambda date: f"{patch[date]['medianValue']:.0f}"
    comparisons = [
        ("march-vs-august", "2024-03-15", "2024-08-15", "b", "Which date shows warmer water in the north-east patch?",
         f"Date B (15 August) is about {t('2024-08-15')} °C, warm on the legend: the heatwave is at its peak. Date A (15 March) is about {t('2024-03-15')} °C, cool."),
        ("august-vs-november", "2024-08-15", "2024-11-15", "a", "Which date shows warmer water in the north-east patch?",
         f"The heatwave faded. Date A (15 August) is about {t('2024-08-15')} °C; date B (15 November) is about {t('2024-11-15')} °C."),
        ("january-vs-december", "2024-01-15", "2024-12-15", "same", "Do these two dates show warmer water, or about the same?",
         f"Both are about {t('2024-12-15')} °C, cool, at the start and the end of the year. The difference of under half a degree is too small to hear as a change."),
    ]
    story = [
        {"id": "a-normal-spring", "title": "A normal spring", "fromFrame": "2024-01-15", "toFrame": "2024-03-15",
         "text": f"This is made-up practice data, not a real measurement. From January to March the north-east patch of ocean is cool, about {t('2024-01-15')} °C, the way it usually is at this time of year. Listen for a steady note."},
        {"id": "the-patch-warms", "title": "The patch warms", "fromFrame": "2024-03-15", "toFrame": "2024-08-15",
         "text": f"From March the patch warms faster than the sea around it. By August it is about {t('2024-08-15')} °C, warm on our scale, where it was about {t('2024-03-15')} °C in March. The notes climb with it."},
        {"id": "cloud-hides-the-sea", "title": "Cloud hides the sea", "fromFrame": "2024-10-15", "toFrame": "2024-10-15",
         "text": "In October cloud covers most of the patch, so there is not enough data to read a temperature. The app plays a hiss for a date like this, never a low note, because missing data is not cold."},
        {"id": "it-fades-for-now", "title": "It fades, for now", "fromFrame": "2024-09-15", "toFrame": "2024-12-15",
         "text": f"From September the patch cools again, and by December it is back to about {t('2024-12-15')} °C, close to where the year began. The heatwave has faded, for now."},
    ]
    return {
        "id": ID,
        "title": "Synthetic globe (made-up practice data)",
        "summary": "Twelve made-up monthly frames of a pretend globe with a marine heatwave, for practising the explorer and the story.",
        "description": "A pretend globe through one year: warm at the equator and cold towards the top and bottom, two grey land masses, a warm current, and a marine heatwave that grows in the north-east from March to August and fades by November. One date is hidden by cloud. Every temperature is chosen by us, so the right answer is always known. None of it is real data.",
        "variable": {"name": "Sea surface temperature", "unit": "°C"},
        "source": SOURCE,
        "colorScale": {"stops": [{"value": v, "rgb": list(c)} for v, c in base.STOPS], "noData": [list(base.NO_DATA)], "maxColorDistance": base.MAX_COLOR_DISTANCE},
        "regions": [{"id": rid, "name": name, "description": text, "points": [{"x": x, "y": y} for x, y in points]} for rid, name, text, points in REGIONS],
        "frames": frames,
        "mapping": {
            "scale": "C major arpeggio",
            "summary": "median",
            "minValidFraction": 0.5,
            "categories": [{"id": cid, "label": label, "range": list(rng), "note": note} for cid, label, rng, note in base.CATEGORIES],
            "tick": {"note": "C6", "durationMs": 60},
            "missingCue": {"type": "noise", "durationMs": 300},
        },
        "comparisons": [
            {"id": cid, "regionId": "north-east-patch", "frameA": a, "frameB": b, "question": q, "answer": answer, "explanation": why}
            for cid, a, b, answer, q, why in comparisons
        ],
        "mapArea": {"x0": 0, "y0": 0, "x1": 1, "y1": MAP_BOTTOM},
        "story": story,
    }


def write_stress(frames: int, out: Path) -> None:
    """N frames at the current size in `out`, for measuring speed. Frame k repeats scenario k % 12 with its own date."""
    expected = all_expected()
    data = manifest(expected)
    base_frames = data["frames"]
    (out / "frames").mkdir(parents=True, exist_ok=True)
    made = []
    for k in range(frames):
        month = k % 12 + 1
        date, gain, cloud, _ = SCENARIOS[k % 12]
        date = date if k < 12 else f"{2024 + k // 12}-{month:02d}-15"
        draw_frame(date, month, gain, cloud).save(out / "frames" / f"{date}.png", format="PNG", compress_level=6)
        made.append({**base_frames[k % 12], "id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT})
    data["frames"] = made
    data["id"] = out.name
    data["title"] = f"Stress test: {frames} frames, {WIDTH} x {HEIGHT} (made-up)"
    if frames < 12:  # the comparisons and the story name the first 12 dates
        data["comparisons"], data["story"] = [], []
    base.write_json(out / "manifest.json", data)
    print(f"Wrote {frames} frames of {WIDTH} x {HEIGHT} and manifest.json to {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Write the synthetic globe, or with --out a stress set for measuring speed.")
    parser.add_argument("--frames", type=int, default=12)
    parser.add_argument("--width", type=int, default=1200)
    parser.add_argument("--height", type=int, default=600)
    parser.add_argument("--out", type=Path, help="write a stress set here, leaving the committed data alone")
    args = parser.parse_args()
    if args.out is None and (args.frames, args.width, args.height) != (12, 1200, 600):
        parser.error("--frames, --width and --height need --out, so the committed data set is not overwritten")
    if args.frames < 1 or args.width < 200 or args.height < 100:
        parser.error("need at least 1 frame, 200 x 100 pixels")
    if args.out is not None:
        set_size(args.width, args.height)
        write_stress(args.frames, args.out.resolve())
        return
    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    for month, (date, gain, cloud, _) in enumerate(SCENARIOS, start=1):
        draw_frame(date, month, gain, cloud).save(OUT / "frames" / f"{date}.png", format="PNG", compress_level=9)
    expected = all_expected()
    base.write_json(OUT / "manifest.json", manifest(expected))
    base.write_json(OUT / "expected.json", {
        "note": "Computed from the values drawn at the sample points, not from the images. One entry per frame and region.",
        "frames": expected,
    })

    index_path = ROOT / "public" / "data" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    entry = {"id": ID, "title": "Synthetic globe (made-up practice data)", "summary": "Twelve made-up monthly frames of a pretend globe with a marine heatwave, for practice."}
    index = [e for e in index if e["id"] != ID] + [entry]
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(SCENARIOS)} frames, manifest.json and expected.json to {OUT}")


if __name__ == "__main__":
    main()

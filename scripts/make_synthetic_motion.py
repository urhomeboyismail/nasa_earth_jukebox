"""Write the synthetic motion dataset in public/data/synthetic-motion/ (ticket SN02).

Twelve daily 800 x 400 frames of a pretend current: six round patches (four warm, two cold) in a band across the middle of a flat sea,
and every day each patch moves east by exactly 25 pixels, which is exactly two cells of the feature extractor's 64 x 32 grid. So the
motion between any two frames is known exactly: two cells east, nothing north or south. Practice data: every frame says so.

The map is the whole picture (no legend bar, no label), so the extractor's grid covers all of it. Needs Pillow and NumPy:

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python -I scripts/make_synthetic_motion.py

Running it twice gives identical files. `expected.json` is computed from the values the script draws, never by reading an image back;
src/data/synthetic-feature-sets.test.ts then checks the real decoded images against it. The legend, land colour and helpers are shared
with make_synthetic.py (loaded by path, because `python -I` does not put this folder on the import path). No existing data set is touched.
"""
from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

_spec = importlib.util.spec_from_file_location("make_synthetic", Path(__file__).with_name("make_synthetic.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

ROOT = base.ROOT
ID = "synthetic-motion"
OUT = ROOT / "public" / "data" / ID
WIDTH, HEIGHT = base.WIDTH, base.HEIGHT
GRID_COLS = 64
CELL_PX = WIDTH / GRID_COLS  # 12.5 pixels: one cell of the extractor's grid

DATES = [f"2026-03-{day:02d}" for day in range(1, 13)]
BACKGROUND = 14.0  # one flat category (mild), no gradient
WARM, COLD = 27.0, 4.0  # each well inside its category (hot 24 to 30, cold 0 to 6)
RADIUS = 30  # pixels

# The current is the band of grid rows 8 to 23 (pixel rows 100 to 300). Six patches, west to east: (value, centre y in pixels).
# They sit at two heights so no patch hides another's edge, and every patch stays clear of the band's edges (130 to 270).
BLOBS = [(WARM, 160), (COLD, 240), (WARM, 160), (WARM, 240), (COLD, 160), (WARM, 240)]
START_X, STEP_PX, SPACING_PX = 50, 25, 70  # patch i, on day k, is centred at x = 50 + 25 k + 70 i; 25 pixels is exactly two cells
assert STEP_PX == 2 * CELL_PX
assert START_X + STEP_PX * (len(DATES) - 1) + SPACING_PX * (len(BLOBS) - 1) < 700  # the last patch never gets near the east edge

# A point that is background on every day (above the band), and the one region the app uses: 6 x 5 points, clear of the edges.
BACKGROUND_POINT = (0.5, 0.1)
REGION_POINTS = [(round(0.10 + 0.15 * i, 2), round(0.20 + 0.15 * j, 2)) for j in range(5) for i in range(6)]
SOURCE = {"name": "Made-up practice data", "url": "", "credit": "Made up for testing; not NASA data", "license": "Made up; no licence needed", "retrievedOn": "2026-11-09"}


def centre(day: int, blob: int) -> tuple[int, int]:
    return START_X + STEP_PX * day + SPACING_PX * blob, BLOBS[blob][1]


def draw_frame(day: int) -> Image.Image:
    xs = np.arange(WIDTH)[None, :] + 0.5  # the pixel's centre
    ys = np.arange(HEIGHT)[:, None] + 0.5
    pixels = np.tile(base.legend_rgb(np.array(BACKGROUND)), (HEIGHT, WIDTH, 1))
    for index, (value, _) in enumerate(BLOBS):
        cx, cy = centre(day, index)
        inside = np.hypot(xs - cx, ys - cy) <= RADIUS
        pixels[inside] = base.legend_rgb(np.array(value))
    return Image.fromarray(pixels, "RGB")


def fraction(pixel: int, size: int) -> float:
    """A sample point that lands on exactly this pixel (its centre), as the app reads it: (x * size), rounded down."""
    return round((pixel + 0.5) / size, 6)


def drawn_value(day: int, px: int, py: int) -> float:
    """The value drawn at this pixel, from the model of the picture (never read back from the image)."""
    for index, (value, _) in enumerate(BLOBS):
        cx, cy = centre(day, index)
        if math.hypot(px + 0.5 - cx, py + 0.5 - cy) <= RADIUS:
            return value
    return BACKGROUND


def region_answer(day: int) -> dict:
    """What the app's region reading must find: the median of the region's 30 points, and its category (the format every data set's expected.json shares)."""
    values = [drawn_value(day, min(WIDTH - 1, int(x * WIDTH)), min(HEIGHT - 1, int(y * HEIGHT))) for x, y in REGION_POINTS]
    median = float(np.median(values))
    return {"frameId": DATES[day], "regionId": "open-sea", "sampled": len(values), "valid": len(values), "medianValue": round(median, 4), "category": base.category_for(median)}


def expected_for(day: int) -> dict:
    value_at = [{"x": BACKGROUND_POINT[0], "y": BACKGROUND_POINT[1], "value": BACKGROUND}]
    hotspots = []
    for index, (value, _) in enumerate(BLOBS):
        cx, cy = centre(day, index)
        value_at.append({"x": fraction(cx, WIDTH), "y": fraction(cy, HEIGHT), "value": value})
        hotspots.append({"name": f"patch-{index + 1}", "band": "high" if value == WARM else "low", "centre": {"x": round(cx / WIDTH, 4), "y": round(cy / HEIGHT, 4)}})
    return {
        **region_answer(day),
        "date": DATES[day],
        "valueAt": value_at,
        "hotspots": hotspots,
        "motion": None if day == 0 else {"dx": 2, "dy": 0, "direction": 0},
    }


def manifest() -> dict:
    frames = [{
        "id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT,
        "altText": ("Synthetic motion map, " + date + ". Made-up practice data: a flat, mild sea with six round patches in a band across the middle, "
                    "four warm and two cold. Every day each patch has moved two grid cells east."),
    } for date in DATES]
    return {
        "id": ID,
        "title": "Synthetic motion (made-up practice data)",
        "summary": "Twelve made-up daily frames of a pretend current that moves east by exactly two grid cells a step, for practice and tests.",
        "description": ("A pretend sea with a current in a band across the middle: six round patches, four warm and two cold, on flat mild water. "
                        "Every day each patch moves east by exactly two grid cells and nothing else changes, so the motion between any two frames is "
                        "known exactly. Every value is chosen by us. None of it is real data."),
        "variable": {"name": "sea surface temperature (made up)", "unit": "°C"},
        "source": SOURCE,
        "colorScale": {"stops": [{"value": v, "rgb": list(c)} for v, c in base.STOPS], "noData": [list(base.NO_DATA)], "maxColorDistance": base.MAX_COLOR_DISTANCE},
        "regions": [{"id": "open-sea", "name": "Open sea", "description": "A grid of 30 points across the map, clear of the edges.", "points": [{"x": x, "y": y} for x, y in REGION_POINTS]}],
        "frames": frames,
        "mapping": {
            "scale": "C major arpeggio",
            "summary": "median",
            "minValidFraction": 0.5,
            "categories": [{"id": cid, "label": label, "range": list(rng), "note": note} for cid, label, rng, note in base.CATEGORIES],
            "tick": {"note": "C6", "durationMs": 60},
            "missingCue": {"type": "noise", "durationMs": 300},
        },
        "comparisons": [],
    }


def main() -> None:
    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    for day, date in enumerate(DATES):
        draw_frame(day).save(OUT / "frames" / f"{date}.png", format="PNG", compress_level=9)

    data = manifest()
    base.write_json(OUT / "manifest.json", data)
    base.write_json(OUT / "expected.json", {
        "id": ID,
        "note": ("Computed from the values drawn, not from the images. frameId, regionId, sampled, valid, medianValue and category: what the region reading "
                 "must find (the format every data set's expected.json shares). valueAt: the value at each sample point (a pixel centre). hotspots: the drawn centre "
                 "of each patch (the extractor's cell centroid may differ by one cell). motion: what the extractor must find between this frame and the "
                 "one before, in grid cells east (dx), south (dy), and the direction in radians (0 is east); null for the first frame."),
        "frames": [expected_for(day) for day in range(len(DATES))],
    })

    index_path = ROOT / "public" / "data" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    entry = {"id": ID, "title": data["title"], "summary": data["summary"]}
    index = [e for e in index if e["id"] != ID] + [entry]
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(DATES)} frames, manifest.json and expected.json to {OUT}")


if __name__ == "__main__":
    main()

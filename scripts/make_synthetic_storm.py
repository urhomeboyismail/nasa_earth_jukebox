"""Write the synthetic storm dataset in public/data/synthetic-storm/ (ticket SN02).

Ten daily 800 x 400 frames of a pretend sea with a warm storm that travels a known straight path (frames 0 to 8), a cold patch that
appears on frames 5 to 7 only, a coast of land on the east edge, and a last date (frame 9) that is all land: no data at all.
So where every hot spot is, and which one is which from day to day, is known exactly. Practice data: every frame says so.

The map is the whole picture (no legend bar, no label), so the extractor's grid covers all of it. Needs Pillow and NumPy:

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python -I scripts/make_synthetic_storm.py

Running it twice gives identical files. `expected.json` is computed from the values and the land mask the script draws, never by reading
an image back; src/data/synthetic-feature-sets.test.ts then checks the real decoded images against it. The legend, land colour and
helpers are shared with make_synthetic.py (loaded by path, because `python -I` does not put this folder on the import path). No
existing data set is touched.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

_spec = importlib.util.spec_from_file_location("make_synthetic", Path(__file__).with_name("make_synthetic.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

ROOT = base.ROOT
ID = "synthetic-storm"
OUT = ROOT / "public" / "data" / ID
WIDTH, HEIGHT = base.WIDTH, base.HEIGHT
GRID_COLS, GRID_ROWS = 64, 32
MIN_VALID_FRACTION = 0.5  # the manifest's mapping.minValidFraction
MIN_LATTICE_SAMPLES = 5 # the extractor's rule: a cell needs five of its nine samples (docs: src/analysis/field.ts)
LATTICE = (1 / 6, 1 / 2, 5 / 6)

DATES = [f"2026-03-{day:02d}" for day in range(1, 11)]
BACKGROUND = 14.0  # mild
STORM_VALUE, STORM_RADIUS = 28.0, 60  # hot (24 to 30)
STORM_START, STORM_END, STORM_LAST_FRAME = (0.25, 0.35), (0.62, 0.55), 8  # fractions of the image; centre(k) = start + (end - start) k / 8
COLD_VALUE, COLD_RADIUS, COLD_CENTRE, COLD_FRAMES = 2.0, 40, (0.80, 0.70), (5, 6, 7)  # cold (0 to 6)
LAND_FROM = 0.92  # land from this fraction of the width to the east edge
NO_DATA_FRAME = 9  # all land

# A point that is open water on every day but the last (above the storm's path), a point that is land on every day, and the one region the
# app uses: 6 x 5 points between x 0.1 and 0.85, clear of the land.
BACKGROUND_POINT = (0.5, 0.1)
LAND_POINT = (0.97, 0.5)
REGION_POINTS = [(round(0.10 + 0.15 * i, 2), round(0.20 + 0.15 * j, 2)) for j in range(5) for i in range(6)]
SOURCE = {"name": "Made-up practice data", "url": "", "credit": "Made up for testing; not NASA data", "license": "Made up; no licence needed", "retrievedOn": "2026-11-09"}


def storm_centre(frame: int) -> tuple[float, float]:
    """The storm's centre on this frame, in pixels: a straight line from the start to the end over frames 0 to 8."""
    t = frame / STORM_LAST_FRAME
    return ((STORM_START[0] + (STORM_END[0] - STORM_START[0]) * t) * WIDTH, (STORM_START[1] + (STORM_END[1] - STORM_START[1]) * t) * HEIGHT)


def cold_centre() -> tuple[float, float]:
    return COLD_CENTRE[0] * WIDTH, COLD_CENTRE[1] * HEIGHT


def disc(cx: float, cy: float, radius: float) -> np.ndarray:
    xs = np.arange(WIDTH)[None, :] + 0.5  # the pixel's centre
    ys = np.arange(HEIGHT)[:, None] + 0.5
    return np.hypot(xs - cx, ys - cy) <= radius


def land_mask(frame: int) -> np.ndarray:
    mask = np.zeros((HEIGHT, WIDTH), dtype=bool)
    mask[:, int(LAND_FROM * WIDTH):] = True
    if frame == NO_DATA_FRAME:
        mask[:, :] = True
    return mask


def draw_frame(frame: int) -> Image.Image:
    pixels = np.tile(base.legend_rgb(np.array(BACKGROUND)), (HEIGHT, WIDTH, 1))
    if frame <= STORM_LAST_FRAME:
        pixels[disc(*storm_centre(frame), STORM_RADIUS)] = base.legend_rgb(np.array(STORM_VALUE))
    if frame in COLD_FRAMES:
        pixels[disc(*cold_centre(), COLD_RADIUS)] = base.legend_rgb(np.array(COLD_VALUE))
    pixels[land_mask(frame)] = base.NO_DATA
    return Image.fromarray(pixels, "RGB")


def valid_share(frame: int) -> float:
    """The share of the extractor's 64 x 32 cells that can be read, from the drawn land mask: a cell needs five of its nine samples on water."""
    land = land_mask(frame)
    readable = 0
    for row in range(GRID_ROWS):
        for col in range(GRID_COLS):
            samples = [(int((col + fx) / GRID_COLS * WIDTH), int((row + fy) / GRID_ROWS * HEIGHT)) for fy in LATTICE for fx in LATTICE]
            readable += sum(not land[y, x] for x, y in samples) >= MIN_LATTICE_SAMPLES
    return round(readable / (GRID_COLS * GRID_ROWS), 6)


def fraction(pixel: int, size: int) -> float:
    """A sample point that lands on exactly this pixel (its centre), as the app reads it: (x * size), rounded down."""
    return round((pixel + 0.5) / size, 6)


def drawn_value(frame: int, px: int, py: int) -> float | None:
    """The value drawn at this pixel (None for land or missing data), from the model of the picture (never read back from the image)."""
    if land_mask(frame)[py, px]:
        return None
    if frame in COLD_FRAMES and np.hypot(px + 0.5 - cold_centre()[0], py + 0.5 - cold_centre()[1]) <= COLD_RADIUS:
        return COLD_VALUE
    if frame <= STORM_LAST_FRAME and np.hypot(px + 0.5 - storm_centre(frame)[0], py + 0.5 - storm_centre(frame)[1]) <= STORM_RADIUS:
        return STORM_VALUE
    return BACKGROUND


def region_answer(frame: int) -> dict:
    """What the app's region reading must find: the median of the region's readable points, and its category (the format every data set's expected.json shares)."""
    drawn = [drawn_value(frame, min(WIDTH - 1, int(x * WIDTH)), min(HEIGHT - 1, int(y * HEIGHT))) for x, y in REGION_POINTS]
    values = [v for v in drawn if v is not None]
    entry = {"frameId": DATES[frame], "regionId": "open-sea", "sampled": len(drawn), "valid": len(values)}
    if len(values) / len(drawn) < MIN_VALID_FRACTION:
        return {**entry, "medianValue": None, "category": "insufficient"}
    median = float(np.median(values))
    return {**entry, "medianValue": round(median, 4), "category": base.category_for(median)}


def expected_for(frame: int) -> dict:
    drawn_land = land_mask(frame)
    value_at = []
    for x, y in [BACKGROUND_POINT, LAND_POINT]:
        px, py = min(WIDTH - 1, int(x * WIDTH)), min(HEIGHT - 1, int(y * HEIGHT))
        value_at.append({"x": x, "y": y, "value": None if drawn_land[py, px] else BACKGROUND})
    hotspots = []
    if frame <= STORM_LAST_FRAME:
        cx, cy = storm_centre(frame)
        value_at.append({"x": fraction(int(cx), WIDTH), "y": fraction(int(cy), HEIGHT), "value": STORM_VALUE})
        hotspots.append({"name": "storm", "band": "high", "centre": {"x": round(cx / WIDTH, 4), "y": round(cy / HEIGHT, 4)}})
    if frame in COLD_FRAMES:
        cx, cy = cold_centre()
        value_at.append({"x": fraction(int(cx), WIDTH), "y": fraction(int(cy), HEIGHT), "value": COLD_VALUE})
        hotspots.append({"name": "cold-patch", "band": "low", "centre": {"x": round(cx / WIDTH, 4), "y": round(cy / HEIGHT, 4)}})
    return {**region_answer(frame), "date": DATES[frame], "valueAt": value_at, "hotspots": hotspots, "validShare": valid_share(frame)}


def alt_text(frame: int) -> str:
    text = f"Synthetic storm map, {DATES[frame]}. Made-up practice data: "
    if frame == NO_DATA_FRAME:
        return text + "the whole map is grey land or missing data: there is nothing to read on this date."
    text += "a flat, mild sea with grey land along the east edge"
    if frame <= STORM_LAST_FRAME:
        text += ", and a round warm storm that has moved further south-east each day"
    if frame in COLD_FRAMES:
        text += ", and a small round cold patch near the coast"
    return text + "."


def manifest() -> dict:
    frames = [{"id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT, "altText": alt_text(i)} for i, date in enumerate(DATES)]
    return {
        "id": ID,
        "title": "Synthetic storm (made-up practice data)",
        "summary": "Ten made-up daily frames of a warm storm that travels a known path, a cold patch and a day with no data, for practice and tests.",
        "description": ("A pretend sea with grey land along the east edge. A warm storm travels in a straight line from the north-west towards the "
                        "south-east over the first nine days. A small cold patch appears near the coast on the sixth, seventh and eighth days only. "
                        "On the tenth day the whole map is missing data. Every value and every place is chosen by us, so where each hot spot is on "
                        "each day is known exactly. None of it is real data."),
        "variable": {"name": "sea surface temperature (made up)", "unit": "°C"},
        "source": SOURCE,
        "colorScale": {"stops": [{"value": v, "rgb": list(c)} for v, c in base.STOPS], "noData": [list(base.NO_DATA)], "maxColorDistance": base.MAX_COLOR_DISTANCE},
        "regions": [{"id": "open-sea", "name": "Open sea", "description": "A grid of 30 points across the open water, clear of the land.", "points": [{"x": x, "y": y} for x, y in REGION_POINTS]}],
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
    for frame, date in enumerate(DATES):
        draw_frame(frame).save(OUT / "frames" / f"{date}.png", format="PNG", compress_level=9)

    data = manifest()
    base.write_json(OUT / "manifest.json", data)
    base.write_json(OUT / "expected.json", {
        "id": ID,
        "note": ("Computed from the values and the land mask drawn, not from the images. frameId, regionId, sampled, valid, medianValue and category: what the "
                 "region reading must find (the format every data set's expected.json shares). valueAt: the value at each sample point (null where it is land "
                 "or missing). hotspots: the drawn centre of each hot spot, with a name that stays the same from day to day (the extractor's cell "
                 "centroid may differ by one cell). validShare: the share of the 64 x 32 cells that can be read."),
        "frames": [expected_for(frame) for frame in range(len(DATES))],
    })

    index_path = ROOT / "public" / "data" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    entry = {"id": ID, "title": data["title"], "summary": data["summary"]}
    index = [e for e in index if e["id"] != ID] + [entry]
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(DATES)} frames, manifest.json and expected.json to {OUT}")


if __name__ == "__main__":
    main()

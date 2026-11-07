"""Write the synthetic change dataset in public/data/synthetic-change/ (ticket T111).

Twelve monthly 800 x 400 frames of a pretend sea whose temperature we know exactly. Every month has a seasonal cycle (warm in
February, cool in August) and a gentle north-south slope. From August to October a warm patch grows in the east, up to +1.5 degrees
at its peak in October. Each frame comes with its own normal: `baselines/<date>.png` is the same month drawn with the seasonal
cycle and the slope only, no patch. So "frame minus its normal" is the patch and nothing else, and the right answer is always known.

The season is much bigger than the patch on purpose. October, with its +1.5 degree patch, is still cooler than February with no patch
at all, so a listener who plays the temperature hears February as the "warmer" date, while one who plays the change from normal hears
October as further above normal. Several comparisons rest on that difference (`changeAnswer` in expected.json).

It is practice data: every frame says so. Needs Pillow and NumPy:

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python -I scripts/make_synthetic_change.py

Running it twice gives identical files. `expected.json` is computed from the values the script draws at the sample points, never by
reading an image back; src/data/synthetic-change.test.ts then checks the real analysis of the real images against it. The legend,
land colour and helpers are shared with make_synthetic.py (loaded by path, because `python -I` does not put this folder on the import
path). synthetic-ocean and synthetic-globe are not touched: their golden files (T88) stay byte-for-byte the same.
"""
from __future__ import annotations

import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

_spec = importlib.util.spec_from_file_location("make_synthetic", Path(__file__).with_name("make_synthetic.py"))
base = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(base)

ROOT = base.ROOT
ID = "synthetic-change"
OUT = ROOT / "public" / "data" / ID
WIDTH, HEIGHT = 800, 400
MAP_BOTTOM = 0.88  # the legend bar starts at y = 352 of 400; the app reads only the map above it
LEGEND_TOP = int(HEIGHT * MAP_BOTTOM)

# The temperature field, in degrees C. v runs from 0 at the top of the map to 1 at the bottom.
SEASON_MEAN, SEASON_AMP = 16.9, 4.0  # warm in February, cool in August; chosen so every sample stays clear of a category edge
SLOPE = 1.2                          # the north is a little warmer than the south: +0.6 at the top, -0.6 at the bottom

# The warm patch in the east: a flat top (full strength) inside the core radius, fading to nothing by the outer radius. Pixels.
# Big enough that about a tenth of the readable map is at least +1 degree in October, so describeChange can say so; small enough that its
# +1 line stays clear of the island, the label and the open-sea region.
PATCH_CENTRE = (620, 125)
PATCH_CORE, PATCH_OUTER = 75, 125
# Strength of the patch by month, in degrees C. It grows over August to October and is gone by November. Each one sits in the middle
# of its change step so a colour rounded to the nearest byte cannot tip a frame into the next step.
PATCH_GAIN = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.7, 1.5, 0.0, 0.0]

NOISE_FLOOR = 0.2  # at least twice the legend's rounding (about 0.065 degrees per colour step for this legend)

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
DATES = [f"2024-{m:02d}-15" for m in range(1, 13)]

# Land, as (x across, v down the map) fractions: a coast on the west edge, and a small island in the south-east.
WEST_LAND = [(0.0, 0.05), (0.12, 0.10), (0.16, 0.35), (0.13, 0.60), (0.17, 0.85), (0.0, 1.0)]
ISLAND = [(0.66, 0.74), (0.72, 0.70), (0.78, 0.74), (0.76, 0.84), (0.68, 0.84)]

# Two regions of 30 points each, all in open water. The first is the one Compare and the listening test use.
# The patch's 30 points sit inside its flat core (the corners are 36 pixels from the centre, the core is 75), so each reads the patch at full strength.
PATCH_POINTS = [(round((PATCH_CENTRE[0] - 30 + 12 * i) / WIDTH, 4), round((PATCH_CENTRE[1] - 20 + 10 * j) / HEIGHT, 4)) for j in range(5) for i in range(6)]
SEA_POINTS = [(round(0.30 + 0.05 * i, 2), round(0.40 + 0.04 * j, 2)) for j in range(5) for i in range(6)]
REGIONS = [
    ("east-patch", "East patch", "A grid of 30 points in the east, inside the warm patch that grows from August to October.", PATCH_POINTS),
    ("open-sea", "Open sea", "A grid of 30 points in open water west of the patch, which follows the seasons and nothing else.", SEA_POINTS),
]

# Five steps of "how far from normal", most below normal first. The outer edges are finite because JSON cannot hold infinity.
# Notes sit in the bed's register (C3 to C4), each higher than the one before; the widest gaps are near "normal".
CHANGE_STEPS = [
    ("much-below", "Much below normal", (-50, -1), "C3"),
    ("below", "Below normal", (-1, -0.25), "D3"),
    ("normal", "Near normal", (-0.25, 0.25), "F3"),
    ("above", "Above normal", (0.25, 1), "A3"),
    ("much-above", "Much above normal", (1, 50), "C4"),
]
CONTOUR_LEVELS = [(1, "C5"), (2, "G5")]

WORDS = {"cold": "deep blue, cold", "cool": "light blue, cool", "mild": "green, mild", "warm": "yellow to orange, warm", "hot": "deep red, hot"}
SOURCE = {"name": "Synthetic test data", "url": "", "credit": "Earth Jukebox team", "license": "CC0", "retrievedOn": "2026-11-07"}
CLIMATOLOGY_LABEL = "the made-up normal for each month"


def season(month: int) -> float:
    return SEASON_MEAN + SEASON_AMP * math.cos(2 * math.pi * (month - 2) / 12)


def patch_weight(px, py):
    """1 inside the core, 0 outside the outer radius, a smooth fade between (numbers or arrays, pixels)."""
    d = np.hypot(px - PATCH_CENTRE[0], py - PATCH_CENTRE[1])
    t = np.clip((PATCH_OUTER - d) / (PATCH_OUTER - PATCH_CORE), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def field(px, py, month: int, gain: float):
    """The temperature at pixel px, py (numbers or arrays) in the given month with the given patch strength."""
    v = (py / HEIGHT) / MAP_BOTTOM
    return season(month) + SLOPE * (0.5 - v) + gain * patch_weight(px, py)


def pixel(x: float, y: float) -> tuple[int, int]:
    """The pixel the app reads for a sample point: (x * width, y * height), rounded down."""
    return min(WIDTH - 1, int(x * WIDTH)), min(HEIGHT - 1, int(y * HEIGHT))


def land_polygon(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    return [(x * WIDTH, v * MAP_BOTTOM * HEIGHT) for x, v in points]


def draw_frame(label: str, month: int, gain: float) -> Image.Image:
    xs = np.arange(WIDTH)[None, :] + np.zeros((HEIGHT, WIDTH))
    ys = np.arange(HEIGHT)[:, None] + np.zeros((HEIGHT, WIDTH))
    image = Image.fromarray(base.legend_rgb(field(xs, ys, month, gain)), "RGB")
    draw = ImageDraw.Draw(image)
    for land in (WEST_LAND, ISLAND):
        draw.polygon(land_polygon(land), fill=base.NO_DATA)

    draw.rectangle([8, 8, 420, 34], fill=(20, 20, 20))
    draw.text((14, 11), label, fill=(255, 255, 255), font=base.font(15))

    # Legend bar along the bottom, with its own labels: below the map area.
    draw.rectangle([0, LEGEND_TOP, WIDTH, HEIGHT], fill=(20, 20, 20))
    bar_w, bar_h = 600, 14
    bar = base.legend_rgb(np.tile(np.linspace(0, 30, bar_w), (bar_h, 1)))
    left = 100
    image.paste(Image.fromarray(bar, "RGB"), (left, LEGEND_TOP + 8))
    for value in (0, 10, 20, 30):
        draw.text((left + int(value / 30 * (bar_w - 1)) - 6, LEGEND_TOP + 26), str(value), fill=(255, 255, 255), font=base.font(11))
    draw.text((715, LEGEND_TOP + 8), "°C", fill=(255, 255, 255), font=base.font(13))
    return image


def drawn(month: int, gain: float, x: float, y: float) -> float:
    px, py = pixel(x, y)
    return float(field(np.array(float(px)), np.array(float(py)), month, gain))


def category_for(value: float) -> str:
    return base.category_for(value)


def step_for(change: float) -> str:
    for sid, _, (low, high), _ in CHANGE_STEPS:
        if low <= change < high:
            return sid
    return CHANGE_STEPS[0][0] if change < 0 else CHANGE_STEPS[-1][0]


def expected_for(month: int, region_id: str, points: list[tuple[float, float]]) -> dict:
    gain = PATCH_GAIN[month - 1]
    frame_values = [drawn(month, gain, x, y) for x, y in points]
    normal_values = [drawn(month, 0.0, x, y) for x, y in points]
    # A value too close to a category edge would make the check against the images unreliable.
    for value in frame_values + normal_values:
        for _, _, (low, high), _ in base.CATEGORIES:
            assert abs(value - low) > 0.5 and abs(value - high) > 0.5, f"{DATES[month - 1]} {region_id}: {value:.2f} is too close to a category edge"
    changes = [0.0 if abs(f - n) < NOISE_FLOOR else f - n for f, n in zip(frame_values, normal_values)]
    value, normal, change = float(np.median(frame_values)), float(np.median(normal_values)), float(np.median(changes))
    for _, _, (low, high), _ in CHANGE_STEPS:  # a change near a step edge would do the same
        for edge in (low, high):
            assert abs(edge) > 49 or abs(change - edge) > 0.15, f"{DATES[month - 1]} {region_id}: change {change:.2f} is too close to a step edge"
    return {
        "frameId": DATES[month - 1],
        "regionId": region_id,
        "sampled": len(points),
        "valid": len(points),
        "medianValue": round(value, 4),
        "category": category_for(value),
        "normalValue": round(normal, 4),
        "medianChange": round(change, 4),
        "changeStep": step_for(change),
    }


def all_expected() -> list[dict]:
    return [expected_for(month, rid, pts) for month in range(1, 13) for rid, _, _, pts in REGIONS]


def describe(month: int, patch: dict) -> str:
    label = f"Synthetic change map, {MONTHS[month - 1]} 2024. Made-up practice data: grey land on the west edge and a small island in the south-east."
    change = patch["medianChange"]
    against = "about its normal for the month" if change == 0 else f"about {change:.1f} °C above its normal for the month"
    return f"{label} The east patch is {WORDS[patch['category']]}, about {patch['medianValue']:.0f} °C, {against}."


# Each comparison asks which date is warmer. `answer` is that, by temperature (what the app plays by default). `changeAnswer` is the
# same question asked as "which is further above its own normal", which the change style plays. Most differ on purpose, to show the
# change style hears the patch and not the season; january-vs-march is the control where they agree. Rows: id, month A, month B.
COMPARISONS = [
    ("february-vs-october", 2, 10),
    ("august-vs-march", 8, 3),
    ("june-vs-september", 6, 9),
    ("january-vs-march", 1, 3),
    ("june-vs-february", 6, 2),
]


def answer_between(a: dict, b: dict, rank) -> str:
    ra, rb = rank(a), rank(b)
    return "same" if ra == rb else "a" if ra > rb else "b"


def comparisons(expected: list[dict]) -> tuple[list[dict], list[dict]]:
    patch = {e["frameId"]: e for e in expected if e["regionId"] == "east-patch"}
    cat_rank = lambda e: [c[0] for c in base.CATEGORIES].index(e["category"])
    step_rank = lambda e: [s[0] for s in CHANGE_STEPS].index(e["changeStep"])
    label = lambda e: base.CATEGORIES[cat_rank(e)][1].lower()
    date_text = lambda m: f"15 {MONTHS[m - 1]}"
    manifest_rows, expected_rows = [], []
    for cid, ma, mb in COMPARISONS:
        a, b = patch[DATES[ma - 1]], patch[DATES[mb - 1]]
        answer, change_answer = answer_between(a, b, cat_rank), answer_between(a, b, step_rank)
        why = (f"Date A ({date_text(ma)}) is about {a['medianValue']:.0f} °C, {label(a)}; date B ({date_text(mb)}) is about {b['medianValue']:.0f} °C, "
               f"{label(b)}. By temperature, " + ("the two are about the same." if answer == "same" else f"date {answer.upper()} is warmer."))
        manifest_rows.append({"id": cid, "regionId": "east-patch", "frameA": DATES[ma - 1], "frameB": DATES[mb - 1],
                              "question": "Which date shows warmer water in the east patch?", "answer": answer, "explanation": why})
        expected_rows.append({"id": cid, "answer": answer, "changeAnswer": change_answer, "changeA": a["changeStep"], "changeB": b["changeStep"]})
    return manifest_rows, expected_rows


def manifest(expected: list[dict]) -> tuple[dict, list[dict]]:
    patch = {e["frameId"]: e for e in expected if e["regionId"] == "east-patch"}
    frames = []
    for month, date in enumerate(DATES, start=1):
        frames.append({
            "id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT,
            "altText": describe(month, patch[date]), "baselineImage": f"baselines/{date}.png",
        })
    rows, answers = comparisons(expected)
    data = {
        "id": ID,
        "title": "Synthetic change (made-up practice data)",
        "summary": "Twelve made-up monthly frames, each with its own normal, where a warm patch grows in the east, for practising the change from normal.",
        "description": ("A pretend sea through one year: it is warmest in February and coolest in August, a little warmer in the north, with grey land "
                        "on the west edge and a small island. From August to October a warm patch grows in the east, up to 1.5 °C above normal in "
                        "October, then goes. Each month comes with its own normal, the same picture without the patch, so the change from normal is "
                        "known exactly. The season is bigger than the patch, so the warmest date is not the date furthest above normal. "
                        "Every temperature is chosen by us. None of it is real data."),
        "variable": {"name": "Sea surface temperature", "unit": "°C"},
        "source": SOURCE,
        "colorScale": {"stops": [{"value": v, "rgb": list(c)} for v, c in base.STOPS], "noData": [list(base.NO_DATA)], "maxColorDistance": base.MAX_COLOR_DISTANCE},
        "regions": [{"id": rid, "name": name, "description": text, "points": [{"x": x, "y": y} for x, y in pts]} for rid, name, text, pts in REGIONS],
        "frames": frames,
        "mapping": {
            "scale": "C major arpeggio",
            "summary": "median",
            "minValidFraction": 0.5,
            "categories": [{"id": cid, "label": label, "range": list(rng), "note": note} for cid, label, rng, note in base.CATEGORIES],
            "tick": {"note": "C6", "durationMs": 60},
            "missingCue": {"type": "noise", "durationMs": 300},
            "changeSteps": [{"id": sid, "label": label, "range": list(rng), "note": note} for sid, label, rng, note in CHANGE_STEPS],
            "contourLevels": [{"value": value, "note": note} for value, note in CONTOUR_LEVELS],
        },
        "comparisons": rows,
        "mapArea": {"x0": 0, "y0": 0, "x1": 1, "y1": MAP_BOTTOM},
        "baseline": {"kind": "climatology", "label": CLIMATOLOGY_LABEL, "noiseFloor": NOISE_FLOOR},
    }
    return data, answers


def main() -> None:
    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    (OUT / "baselines").mkdir(parents=True, exist_ok=True)
    for month, date in enumerate(DATES, start=1):
        draw_frame(f"Synthetic change (made-up)  {date}", month, PATCH_GAIN[month - 1]).save(OUT / "frames" / f"{date}.png", format="PNG", compress_level=9)
        draw_frame(f"Normal for {MONTHS[month - 1]} (made-up)", month, 0.0).save(OUT / "baselines" / f"{date}.png", format="PNG", compress_level=9)

    expected = all_expected()
    data, answers = manifest(expected)
    base.write_json(OUT / "manifest.json", data)
    base.write_json(OUT / "expected.json", {
        "note": ("Computed from the values drawn at the sample points, not from the images. One entry per frame and region. medianValue and "
                 "category are by temperature; normalValue is the same point in the month's normal; medianChange and changeStep are the "
                 "change from that normal after the noise floor. comparisons gives each answer by temperature and by change."),
        "frames": expected,
        "comparisons": answers,
    })

    index_path = ROOT / "public" / "data" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    entry = {"id": ID, "title": data["title"], "summary": "Twelve made-up monthly frames, each with its own normal, where a warm patch grows in the east, for practice."}
    index = [e for e in index if e["id"] != ID] + [entry]
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(DATES)} frames, {len(DATES)} baselines, manifest.json and expected.json to {OUT}")


if __name__ == "__main__":
    main()

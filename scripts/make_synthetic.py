"""Write the synthetic ocean dataset in public/data/synthetic-ocean/ (ticket T31).

Twelve dated 800 x 400 frames of a pretend ocean whose temperature we know exactly, so the app's analysis can
be checked against `expected.json` before NASA's real data exists. Needs Pillow and NumPy:

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python -I scripts/make_synthetic.py

Running it twice gives identical files. `expected.json` is computed from the values the script draws at the
sample points, never by reading an image back.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ID = "synthetic-ocean"
OUT = ROOT / "public" / "data" / ID
WIDTH, HEIGHT = 800, 400

NO_DATA = (128, 128, 128)  # land and cloud: the app must never read these as a temperature

# Legend, 0 to 30 degrees C, blue (cold) to red (warm). None is near a no-data color.
STOPS = [
    (0, (8, 48, 160)),
    (5, (30, 120, 220)),
    (10, (60, 190, 230)),
    (15, (120, 215, 150)),
    (20, (250, 230, 60)),
    (24, (250, 160, 40)),
    (27, (235, 90, 40)),
    (30, (180, 20, 30)),
]
MAX_COLOR_DISTANCE = 40

# Same five categories and notes as the T00 fixture.
CATEGORIES = [
    ("cold", "Cold", (0, 6), "C4"),
    ("cool", "Cool", (6, 12), "D4"),
    ("mild", "Mild", (12, 18), "E4"),
    ("warm", "Warm", (18, 24), "G4"),
    ("hot", "Hot", (24, 30), "A4"),
]

# About 30 sample points (6 columns x 5 rows) in open water: clear of the land (right), the label (top left)
# and the legend (bottom).
POINTS = [(round(0.10 + 0.08 * i, 2), round(0.22 + 0.10 * j, 2)) for j in range(5) for i in range(6)]
# In the "missing data" frame a gray cloud (left, x <= 360) hides 25 of the 30 points.
CLOUD = (-10, 40, 360, 340)  # left, top, right, bottom in pixels, inclusive

# One entry per date: the regional temperature (degrees C) and a story line. Values stay at least 0.75 degrees
# from a category edge so quantised colours cannot tip a frame into the next category.
SCENARIOS = [
    ("2024-01-15", 3.0, "Steady warming begins"),
    ("2024-02-15", 5.0, "Steady warming"),
    ("2024-03-15", 8.0, "Steady warming"),
    ("2024-04-15", 10.5, "Steady warming"),
    ("2024-05-15", 14.5, "Steady warming"),
    ("2024-06-15", 19.5, "Warmest of the year"),
    ("2024-07-15", 16.0, "Recovery begins"),
    ("2024-08-15", 13.0, "Recovery"),
    ("2024-09-15", 9.5, "Recovery"),
    ("2024-10-15", None, "Most of the ocean is hidden by cloud: not enough data"),
    ("2024-11-15", 15.0, "About the same as the next date"),
    ("2024-12-15", 15.4, "About the same as the last date"),
]

COMPARISONS = [
    ("january-vs-june", "2024-01-15", "2024-06-15", "b",
     "Which date shows warmer water in the open ocean?",
     "Date B (15 June) is about 19.5 °C, a warm yellow-orange on the legend. Date A (15 January) is about 3 °C, deep blue."),
    ("june-vs-september", "2024-06-15", "2024-09-15", "a",
     "Which date shows warmer water in the open ocean?",
     "The water cooled after June. Date A (15 June) is about 19.5 °C; date B (15 September) is about 9.5 °C."),
    ("november-vs-december", "2024-11-15", "2024-12-15", "same",
     "Do these two dates show warmer water, or about the same?",
     "Both are about 15 °C. The difference of under half a degree is too small to hear as a change."),
]

SOURCE = {"name": "Synthetic test data", "url": "", "credit": "Earth Jukebox team", "license": "CC0", "retrievedOn": "2026-11-04"}


def spatial_offset(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """A gentle, fixed pattern (about +/- 0.5 degrees) so the ocean is not one flat color."""
    return 0.5 * np.sin(3 * np.pi * x) * np.cos(2 * np.pi * y)


def legend_rgb(values: np.ndarray) -> np.ndarray:
    """Temperatures to RGB by straight-line interpolation between the legend stops, rounded to whole bytes."""
    xs = [v for v, _ in STOPS]
    channels = [np.interp(values, xs, [c[k] for _, c in STOPS]) for k in range(3)]
    return np.rint(np.stack(channels, axis=-1)).astype(np.uint8)


def point_pixels() -> list[tuple[int, int]]:
    """The pixel the app reads for each sample point: (x * width, y * height), rounded down."""
    return [(min(WIDTH - 1, int(x * WIDTH)), min(HEIGHT - 1, int(y * HEIGHT))) for x, y in POINTS]


def drawn_value(temperature: float, px: int, py: int) -> float:
    return float(temperature + spatial_offset(np.array(px / WIDTH), np.array(py / HEIGHT)))


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.load_default(size=size)


def draw_frame(date: str, temperature: float | None, story: str) -> Image.Image:
    xn = np.arange(WIDTH)[None, :] / WIDTH
    yn = np.arange(HEIGHT)[:, None] / HEIGHT
    base = 15.0 if temperature is None else temperature
    pixels = legend_rgb(base + spatial_offset(xn, yn) + np.zeros((HEIGHT, WIDTH)))
    image = Image.fromarray(pixels, "RGB")
    draw = ImageDraw.Draw(image)

    # Land: no-data gray on the right.
    draw.polygon([(560, 0), (800, 0), (800, 340), (700, 320), (640, 250), (600, 170), (570, 90)], fill=NO_DATA)
    if temperature is None:
        # Cloud over most of the sample points. Drawn in the no-data color.
        draw.rectangle(CLOUD, fill=NO_DATA)

    # Label, top left, white on dark: outside the sample points.
    draw.rectangle([8, 8, 330, 34], fill=(20, 20, 20))
    draw.text((14, 11), f"Synthetic ocean  {date}", fill=(255, 255, 255), font=font(15))

    # Legend bar along the bottom, with its own labels: also outside the sample points.
    draw.rectangle([0, 352, WIDTH, HEIGHT], fill=(20, 20, 20))
    bar = legend_rgb(np.tile(np.linspace(0, 30, 600), (22, 1)))
    image.paste(Image.fromarray(bar, "RGB"), (100, 360))
    for value in (0, 10, 20, 30):
        x = 100 + int(value / 30 * 599)
        draw.text((x - 8, 383), str(value), fill=(255, 255, 255), font=font(12))
    draw.text((710, 365), "°C", fill=(255, 255, 255), font=font(14))
    return image


def category_for(value: float) -> str:
    for cid, _, (low, high), _ in CATEGORIES:
        if low <= value < high:
            return cid
    return CATEGORIES[0][0] if value < 0 else CATEGORIES[-1][0]


def describe(temperature: float | None, story: str) -> str:
    if temperature is None:
        return "Synthetic ocean map: cloud covers most of the open ocean, so there is not enough data to read a temperature."
    word = {"cold": "deep blue, cold", "cool": "light blue, cool", "mild": "green, mild", "warm": "yellow to orange, warm", "hot": "deep red, hot"}[category_for(temperature)]
    return f"Synthetic ocean map: the open ocean is {word}, about {temperature:g} °C. Land on the right is gray. {story}."


def expected_for(date: str, temperature: float | None) -> dict:
    sampled = len(POINTS)
    values = []
    for px, py in point_pixels():
        hidden = temperature is None and CLOUD[0] <= px <= CLOUD[2] and CLOUD[1] <= py <= CLOUD[3]
        if not hidden:
            values.append(drawn_value(15.0 if temperature is None else temperature, px, py))
    valid = len(values)
    if valid / sampled < 0.5:
        return {"frameId": date, "regionId": "open-ocean", "sampled": sampled, "valid": valid, "medianValue": None, "category": "insufficient"}
    median = float(np.median(values))
    for _, _, (low, high), _ in CATEGORIES:  # a frame too close to an edge would make the check unreliable
        assert abs(median - low) > 0.75 and abs(median - high) > 0.75, f"{date}: median {median:.2f} is too close to a category edge"
    return {"frameId": date, "regionId": "open-ocean", "sampled": sampled, "valid": valid, "medianValue": round(median, 4), "category": category_for(median)}


def manifest() -> dict:
    frames = []
    for date, temperature, story in SCENARIOS:
        frame = {"id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT, "altText": describe(temperature, story)}
        if temperature is None:
            frame["note"] = "Most of this frame is missing data."
        frames.append(frame)
    return {
        "id": ID,
        "title": "Synthetic ocean",
        "summary": "Twelve made-up frames with known answers, used to test the app before NASA's data.",
        "description": "A pretend ocean through one year: it warms for six months, cools back, has one cloudy date, and ends with two nearly identical dates. Every temperature is chosen by us, so the right answer is always known.",
        "variable": {"name": "Sea surface temperature", "unit": "°C"},
        "source": SOURCE,
        "colorScale": {"stops": [{"value": v, "rgb": list(c)} for v, c in STOPS], "noData": [list(NO_DATA)], "maxColorDistance": MAX_COLOR_DISTANCE},
        "regions": [{
            "id": "open-ocean",
            "name": "Open ocean",
            "description": "A grid of 30 points in open water, away from the land, the label and the legend.",
            "points": [{"x": x, "y": y} for x, y in POINTS],
        }],
        "frames": frames,
        "mapping": {
            "scale": "C major pentatonic",
            "summary": "median",
            "minValidFraction": 0.5,
            "categories": [{"id": cid, "label": label, "range": list(rng), "note": note} for cid, label, rng, note in CATEGORIES],
            "tick": {"note": "C6", "durationMs": 60},
            "missingCue": {"type": "noise", "durationMs": 300},
        },
        "comparisons": [
            {"id": cid, "regionId": "open-ocean", "frameA": a, "frameB": b, "question": q, "answer": answer, "explanation": why}
            for cid, a, b, answer, q, why in COMPARISONS
        ],
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    for date, temperature, story in SCENARIOS:
        draw_frame(date, temperature, story).save(OUT / "frames" / f"{date}.png", format="PNG", compress_level=9)
    write_json(OUT / "manifest.json", manifest())
    write_json(OUT / "expected.json", {"note": "Computed from the values drawn at the sample points, not from the images.", "frames": [expected_for(d, t) for d, t, _ in SCENARIOS]})

    index_path = ROOT / "public" / "data" / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    entry = {"id": ID, "title": "Synthetic ocean", "summary": "Twelve made-up frames with known answers, for testing."}
    index = [e for e in index if e["id"] != ID] + [entry]
    index_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(SCENARIOS)} frames, manifest.json and expected.json to {OUT}")


if __name__ == "__main__":
    main()

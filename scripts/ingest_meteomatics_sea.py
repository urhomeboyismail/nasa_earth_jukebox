"""Meteomatics sea surface temperature around Mauritius as an Earth Jukebox data set with a smooth animation (public/data/meteomatics-sea-mauritius/).

Needs METEOMATICS_USERNAME (or METEOMATICS_USER) and METEOMATICS_PASSWORD in the environment or in .env, plus ffmpeg, NumPy and Pillow
(scripts/requirements.txt):

    .venv/bin/python -I scripts/ingest_meteomatics_sea.py                    # the 60 days up to yesterday (UTC)
    .venv/bin/python -I scripts/ingest_meteomatics_sea.py --end 2026-11-10 --days 45

For each day it asks the Meteomatics API for the gridded sea surface temperature (t_sea_sfc:C, model mix, noon UTC), draws a frame with
our own colour scale (blue, green, yellow, orange: the look of Meteomatics' own animations, tuned to this sea's narrow range), a grey
island and a thin coastline, and joins the frames into a 10 fps H.264 video. The frames are the checked frames the app reads; the video
is what plays. Dates are whole days because a manifest's frame dates are (docs/data-sources.md, "Manifest fields").
"""

import argparse
import base64
import datetime as dt
import json
import math
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

API = "https://api.meteomatics.com"
DATASET_ID = "meteomatics-sea-mauritius"
LAT_N, LAT_S, LON_W, LON_E = -18.5, -22.0, 56.0, 59.5
GRID_DEG = 0.02
WIDTH, HEIGHT = 752, 800  # about the box's true shape: 3.5 degrees of latitude by 3.5 x cos(20 degrees) of longitude
FPS = 10
ANCHORS = [(0.0, (38, 52, 148)), (0.25, (44, 150, 222)), (0.5, (70, 196, 140)), (0.72, (250, 228, 60)), (0.88, (250, 150, 30)), (1.0, (205, 50, 40))]
LAND = (128, 128, 128)  # the colour scale's noData
COAST = (18, 24, 32)
STOP_STEP = 0.1  # degrees between legend stops; a fine legend keeps the colours-to-value reading accurate
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / DATASET_ID
CATEGORIES = [("cold", "Cold", "C4"), ("cool", "Cool", "E4"), ("mild", "Mild", "G4"), ("warm", "Warm", "C5"), ("hot", "Hot", "E5")]


def credentials() -> str:
    env = dict(os.environ)
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                env.setdefault(key.strip(), value.strip().strip("\"'"))
    user = env.get("METEOMATICS_USERNAME") or env.get("METEOMATICS_USER")
    password = env.get("METEOMATICS_PASSWORD")
    if not user or not password:
        sys.exit("Set METEOMATICS_USERNAME and METEOMATICS_PASSWORD in the environment or in .env.")
    return base64.b64encode(f"{user}:{password}".encode()).decode()


def fetch_grid(token: str, day: dt.date) -> np.ndarray:
    """One day's grid, rows from north to south, columns from west to east; land is NaN."""
    url = f"{API}/{day}T12:00:00Z/t_sea_sfc:C/{LAT_N},{LON_W}_{LAT_S},{LON_E}:{GRID_DEG},{GRID_DEG}/csv"
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": f"Basic {token}"}), timeout=120) as response:
                text = response.read().decode()
            break
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 404):
                sys.exit(f"Meteomatics answered {error.code} for {day}; check the credentials and what the subscription covers.")
            time.sleep(2 * (attempt + 1))
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(2 * (attempt + 1))
    else:
        sys.exit(f"Could not fetch {day} from Meteomatics.")
    rows = [line.split(";") for line in text.strip().splitlines()]
    body = [row for row in rows if row[0] not in ("validdate", "parameter", "data")]
    grid = np.array([[float(v) if v not in ("", "NaN", "nan") else np.nan for v in row[1:]] for row in body])
    if grid.size == 0:
        sys.exit(f"Meteomatics sent no grid for {day}.")
    grid[grid < -100] = np.nan  # land comes back as the fill value -666, not as NaN
    return grid


def colour_stops(lo: float, hi: float) -> list[dict]:
    count = int(round((hi - lo) / STOP_STEP)) + 1
    xs = [a[0] for a in ANCHORS]
    stops = []
    for i in range(count):
        t = i / (count - 1)
        rgb = [int(round(np.interp(t, xs, [a[1][c] for a in ANCHORS]))) for c in range(3)]
        stops.append({"value": round(lo + i * (hi - lo) / (count - 1), 4), "rgb": rgb})
    return stops


def smooth(grid: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The grid as WIDTH x HEIGHT values (bicubic) and a land mask (nearest). Land is filled from its sea neighbours first, so it does not drag the coast to NaN."""
    land = np.isnan(grid)
    filled = grid.copy()
    if land.any():
        from_idx = np.argwhere(~land)
        for r, c in np.argwhere(land):  # grids are small (about 175 x 175), so the plain search is fast enough
            d = (from_idx[:, 0] - r) ** 2 + (from_idx[:, 1] - c) ** 2
            filled[r, c] = grid[tuple(from_idx[int(d.argmin())])]
    big = np.asarray(Image.fromarray(filled.astype(np.float32), mode="F").resize((WIDTH, HEIGHT), Image.BICUBIC))
    mask = np.asarray(Image.fromarray(land.astype(np.uint8) * 255).resize((WIDTH, HEIGHT), Image.NEAREST)) > 0
    return big, mask


def coastline(mask: np.ndarray) -> np.ndarray:
    edge = np.zeros_like(mask)
    edge[:-1, :] |= mask[:-1, :] != mask[1:, :]
    edge[:, :-1] |= mask[:, :-1] != mask[:, 1:]
    thick = edge.copy()
    thick[1:, :] |= edge[:-1, :]
    thick[:, 1:] |= edge[:, :-1]
    return thick


def render(values: np.ndarray, mask: np.ndarray, stops: list[dict]) -> Image.Image:
    xs = [s["value"] for s in stops]
    rgb = np.stack([np.interp(values, xs, [s["rgb"][c] for s in stops]) for c in range(3)], axis=-1).round().astype(np.uint8)
    rgb[mask] = LAND
    rgb[coastline(mask)] = COAST
    return Image.fromarray(rgb, "RGB")


def sea_points(mask: np.ndarray) -> list[dict]:
    """Thirty region points on a 6 x 5 lattice, each moved to the nearest open sea when it falls on land or the coast."""
    ocean = ~(mask | coastline(mask))
    open_sea = np.argwhere(ocean)
    points = []
    for gy in range(5):
        for gx in range(6):
            x, y = (gx + 0.5) / 6, (gy + 0.5) / 5.4
            r, c = int(y * HEIGHT), int(x * WIDTH)
            if not ocean[r, c]:
                d = (open_sea[:, 0] - r) ** 2 + (open_sea[:, 1] - c) ** 2
                r, c = open_sea[int(d.argmin())]
            points.append({"x": round(c / WIDTH, 4), "y": round(r / HEIGHT, 4)})
    return points


def long_date(day: dt.date) -> str:
    return f"{day.day} {day.strftime('%B %Y')}"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--end", type=dt.date.fromisoformat, default=dt.datetime.now(dt.timezone.utc).date() - dt.timedelta(days=1))
    args = parser.parse_args()
    days = [args.end - dt.timedelta(days=args.days - 1 - i) for i in range(args.days)]

    token = credentials()
    grids = []
    for day in days:
        grids.append(fetch_grid(token, day))
        print(f"fetched {day}", file=sys.stderr)
    every = np.concatenate([g[~np.isnan(g)] for g in grids])
    lo = float(np.floor(np.percentile(every, 0.5) * 2) / 2)
    hi = float(np.ceil(np.percentile(every, 99.5) * 2) / 2)
    if hi - lo < 2:
        mid = (hi + lo) / 2
        lo, hi = mid - 1, mid + 1
    stops = colour_stops(lo, hi)

    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    (OUT / "video").mkdir(exist_ok=True)
    frames, medians = [], []
    first_mask = None
    for day, grid in zip(days, grids):
        values, mask = smooth(grid)
        first_mask = mask if first_mask is None else first_mask
        render(values, mask, stops).save(OUT / "frames" / f"{day}.png", optimize=True)
        median = float(np.nanmedian(grid))
        medians.append(median)
        frames.append({
            "id": str(day), "date": str(day), "image": f"frames/{day}.png", "width": WIDTH, "height": HEIGHT,
            "altText": (f"Map of sea surface temperature around Mauritius on {day}, from Meteomatics. The island is grey with a dark coastline. "
                        f"The middle of the sea is about {median:.1f} °C, from about {float(np.nanmin(grid)):.1f} °C at the coolest to {float(np.nanmax(grid)):.1f} °C at the warmest."),
        })

    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-pattern_type", "glob", "-i", str(OUT / "frames" / "*.png"), "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(OUT / "video" / f"{DATASET_ID}.mp4")],
        check=True,
    )

    # Categories: the quintiles of the daily medians, to a tenth of a degree, so every category is heard somewhere in the sixty days.
    cuts = [round(float(np.percentile(medians, q)), 1) for q in (20, 40, 60, 80)]
    edges = [lo, *cuts, hi]
    categories = [{"id": cid, "label": label, "range": [edges[i], edges[i + 1]], "note": note} for i, (cid, label, note) in enumerate(CATEGORIES)]
    template = json.loads((ROOT / "public" / "data" / "mur-sst-mauritius" / "manifest.json").read_text())
    mapping = {k: v for k, v in template["mapping"].items() if k not in ("changeSteps", "contourLevels")}  # no baseline, so no change style
    mapping = {**mapping, "categories": categories, "minValidFraction": 0.5}

    thirds = [0, args.days // 3, 2 * args.days // 3, args.days - 1]
    story = []
    for i, (cid, title) in enumerate([("first", "The first weeks"), ("middle", "The middle weeks"), ("latest", "The latest weeks")]):
        a, b = thirds[i] + (1 if i else 0), thirds[i + 1]
        seg = medians[a:b + 1]
        story.append({"id": cid, "title": title, "fromFrame": str(days[a]), "toFrame": str(days[b]),
                      "text": f"From {long_date(days[a])} to {long_date(days[b])} the sea around Mauritius is between {min(seg):.1f} and {max(seg):.1f} °C in the middle of the map. "
                              "These are model values from Meteomatics, drawn smoothly; the island is grey and counts as no data."})

    manifest = {
        "id": DATASET_ID,
        "title": f"Sea around Mauritius, animated, last {args.days} days",
        "summary": f"{args.days} daily maps of sea surface temperature around Mauritius up to {long_date(days[-1])}, from the Meteomatics weather API, played as a smooth animation.",
        "description": ("Sea surface temperature (t_sea_sfc, model mix, noon UTC) from the Meteomatics Weather API for a box about 3.5 degrees across, centred on Mauritius, "
                        "drawn smoothly in blue, green, yellow and orange. The island is grey, which the app reads as no data, with a dark coastline. "
                        "The values are model values on a 0.02 degree grid, so they are about, not exact."),
        "variable": template["variable"],
        "source": {
            "name": "Meteomatics Weather API, t_sea_sfc:C (model mix)",
            "url": "https://www.meteomatics.com/en/weather-api/",
            "credit": "Sea surface temperature from the Meteomatics Weather API, drawn by the Earth Jukebox team.",
            "license": "Used under the team's Meteomatics subscription. Check Meteomatics' terms before sharing the frames or the video.",
            "retrievedOn": dt.datetime.now(dt.timezone.utc).date().isoformat(),
        },
        "colorScale": {"stops": stops, "noData": [list(LAND)], "maxColorDistance": 40},
        "regions": [{"id": "mauritius", "name": "Mauritius and its seas", "description": "The sea and island in a box about 3.5 degrees across, centred on Mauritius.", "points": sea_points(first_mask)}],
        "frames": frames,
        "mapping": mapping,
        "comparisons": [],
        "story": story,
        "mascot": template.get("mascot", {}),
        "video": {"src": f"video/{DATASET_ID}.mp4", "fps": FPS, "firstFrameDate": str(days[0]), "frameStepDays": 1},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")

    index_path = ROOT / "public" / "data" / "index.json"
    index = json.loads(index_path.read_text())
    entry = {"id": DATASET_ID, "title": manifest["title"], "summary": manifest["summary"]}
    index_path.write_text(json.dumps([e for e in index if e["id"] != DATASET_ID] + [entry], indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT} ({args.days} frames, legend {lo} to {hi} °C)", file=sys.stderr)


if __name__ == "__main__":
    main()

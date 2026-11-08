"""Write the tiny fixture dataset in public/data/fixture/ (ticket T00).

Four solid-color frames whose correct answers are obvious, so every ticket can build and test against
them before the synthetic (T31) or NASA (T33) data exists. Standard library only:

    python3 -I scripts/make_fixture.py
"""
from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "data" / "fixture"
WIDTH, HEIGHT = 200, 100

BLUE, YELLOW, RED, GRAY = (0, 0, 255), (255, 255, 0), (255, 0, 0), (200, 200, 200)

# Dates are chosen so T00's stub analysis (category from the month) agrees with what real pixel
# analysis of these colors will give: blue = cold, yellow = mild, red = hot, gray = missing data.
FRAMES = [
    ("2024-01-15", BLUE, "Ocean region in deep blue: the coldest colour on the legend.", None),
    ("2024-07-15", YELLOW, "Ocean region in yellow: the middle of the legend.", None),
    ("2024-12-15", RED, "Ocean region in red: the warmest colour on the legend.", None),
    ("2025-03-15", GRAY, "The whole image is grey: no data was recorded for this date.", "Most of this frame is missing data."),
]


def png(color: tuple[int, int, int]) -> bytes:
    row = b"\x00" + bytes(color) * WIDTH
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    header = struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(row * HEIGHT, 9)) + chunk(b"IEND", b"")


def manifest() -> dict:
    return {
        "id": "fixture",
        "title": "Fixture ocean",
        "summary": "Four test frames with obvious answers, for development.",
        "description": "A tiny test dataset: one cold, one mild, one hot and one missing frame of a pretend ocean.",
        "variable": {"name": "Sea surface temperature", "unit": "°C"},
        "source": {"name": "Synthetic test data", "url": "", "credit": "Earth Jukebox team", "license": "CC0", "retrievedOn": "2026-11-04"},
        "colorScale": {
            "stops": [{"value": 0, "rgb": list(BLUE)}, {"value": 15, "rgb": list(YELLOW)}, {"value": 30, "rgb": list(RED)}],
            "noData": [list(GRAY)],
            "maxColorDistance": 40,
        },
        "regions": [{
            "id": "centre",
            "name": "Central ocean",
            "description": "A grid of nine points in the middle of the image.",
            "points": [{"x": x, "y": y} for y in (0.3, 0.5, 0.7) for x in (0.3, 0.5, 0.7)],
        }],
        "frames": [
            {"id": date, "date": date, "image": f"frames/{date}.png", "width": WIDTH, "height": HEIGHT,
             "altText": alt, **({"note": note} if note else {})}
            for date, _, alt, note in FRAMES
        ],
        "mapping": {
            "scale": "C major arpeggio",
            "summary": "median",
            "minValidFraction": 0.5,
            "categories": [
                {"id": "cold", "label": "Cold", "range": [0, 6], "note": "C4"},
                {"id": "cool", "label": "Cool", "range": [6, 12], "note": "E4"},
                {"id": "mild", "label": "Mild", "range": [12, 18], "note": "G4"},
                {"id": "warm", "label": "Warm", "range": [18, 24], "note": "C5"},
                {"id": "hot", "label": "Hot", "range": [24, 30], "note": "E5"},
            ],
            "tick": {"note": "C6", "durationMs": 60},
            "missingCue": {"type": "noise", "durationMs": 300},
        },
        "comparisons": [{
            "id": "january-vs-december",
            "regionId": "centre",
            "frameA": "2024-01-15",
            "frameB": "2024-12-15",
            "question": "Which date shows warmer water in the central ocean?",
            "answer": "b",
            "explanation": "Date B is red on the legend, about 30 °C; date A is deep blue, about 0 °C.",
        }],
    }


def main() -> None:
    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    for date, color, _, _ in FRAMES:
        (OUT / "frames" / f"{date}.png").write_bytes(png(color))
    (OUT / "manifest.json").write_text(json.dumps(manifest(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    index = ROOT / "public" / "data" / "index.json"
    entries = json.loads(index.read_text(encoding="utf-8")) if index.exists() else []
    entry = {"id": "fixture", "title": manifest()["title"], "summary": manifest()["summary"]}
    entries = [e for e in entries if e.get("id") != "fixture"] + [entry]
    index.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(FRAMES)} frames and manifest to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

"""Draws the app icons in public/icons/: a row of sound bars (a rising, falling "warmer" pattern) on the app's blue.

Run from the repository root (needs Pillow, see scripts/requirements.txt):
    .venv/bin/python -I scripts/make_icons.py
Deterministic: the same script always writes the same files.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BLUE = (48, 102, 154)
WHITE = (255, 247, 244)
BARS = [0.30, 0.50, 0.78, 1.0, 0.66, 0.42, 0.24]  # relative heights


def draw(size: int, safe: float) -> Image.Image:
    """`safe` is the share of the icon the bars may use: a maskable icon keeps its art inside the middle 80 per cent."""
    scale = 4  # draw large, then shrink, for smooth edges
    big = size * scale
    image = Image.new("RGB", (big, big), BLUE)
    pen = ImageDraw.Draw(image)
    area = big * safe
    left = (big - area) / 2
    count = len(BARS)
    slot = area / count
    width = slot * 0.58
    tallest = area * 0.7
    for i, share in enumerate(BARS):
        height = tallest * share
        x0 = left + slot * i + (slot - width) / 2
        y0 = (big - height) / 2
        pen.rounded_rectangle((x0, y0, x0 + width, y0 + height), radius=width / 2, fill=WHITE)
    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw(192, 0.72).save(OUT / "icon-192.png", optimize=True)
    draw(512, 0.72).save(OUT / "icon-512.png", optimize=True)
    draw(512, 0.56).save(OUT / "icon-maskable-512.png", optimize=True)
    draw(180, 0.64).save(OUT / "apple-touch-icon.png", optimize=True)
    print("wrote", ", ".join(sorted(p.name for p in OUT.glob("*.png"))))


main()

"""EIC06 T1: turn the ECCO2 (NASA SVS 3912) videos into sonification JSON timelines.

    .venv/bin/python -I scripts/ecco2_extract.py --src Consumption/Ocean/SVS/ecco2 --out public/data/json_output

Spec: docs/tickets/EIC06-ecco2-sst-currents.md ("T1 details"). Needs ffmpeg, NumPy, Pillow and OpenCV.
Writes one ecco2_<region>.json per region, without the text fields (T3 adds them). No randomness.
"""
import argparse
import datetime as dt
import json
import math
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

START = dt.datetime(2007, 3, 25, 12, tzinfo=dt.timezone.utc)
END = dt.datetime(2008, 3, 3, 12, tzinfo=dt.timezone.utc)
SVS_FRAMES = 2002  # the brief: 2,002 frames span START..END (about 4.126 h a frame)
VIDEO_FPS = 30
STEPS_PER_SEC = 2
EVERY = VIDEO_FPS // STEPS_PER_SEC
T_MIN, T_MAX = 0.0, 32.0
BAR_ROW, BAR_X0, BAR_X1 = 48, 16, 289  # inside the bar body (x 14..291, y 28..68) in sst_ecco2_cbar.png
GRID_ROWS, GRID_COLS = 8, 16
STD_MIN = 8.0  # brightness std over time below this is static (land, background)
SAT_MIN = 60  # max-min of RGB: a coloured streak, not grey land or black sea
CALIBRATION = {"temp_min_c": T_MIN, "temp_max_c": T_MAX, "filter_cutoff_hz": [250, 3500], "pitch_range_hz": [82.41, 659.25]}
SOURCE = "NASA SVS 3912 (ECCO2 Model)"

GLOBAL_VIDEO = "ecco2_sst_flow.mp4"
PACIFIC_VIDEO = "pacificcurrents_no_overlay_1080p30_2.mp4"
# id, title, (W, S, E, N) on the equirectangular global video or None for the whole frame, video
REGIONS = [
    ("ecco2_global_ocean", "Global Ocean Currents and Temperature", (-180, -90, 180, 90), GLOBAL_VIDEO),
    ("ecco2_gulf_stream", "Gulf Stream", (-82, 25, -40, 50), GLOBAL_VIDEO),
    ("ecco2_equatorial_pacific", "Equatorial Pacific", (-170, -15, -80, 15), GLOBAL_VIDEO),
    ("ecco2_indian_ocean_mauritius", "Southwest Indian Ocean & Mauritius Currents", (30, -40, 85, -5), GLOBAL_VIDEO),
    ("ecco2_antarctic_circumpolar", "Antarctic Circumpolar Current", (-180, -70, 180, -40), GLOBAL_VIDEO),
    ("ecco2_pacific_globe", "Pacific Ocean Currents (globe)", None, PACIFIC_VIDEO),
]


def crop_box(bbox):
    """Normalized [x, y, w, h] of a (W, S, E, N) box on a -180..180, 90..-90 equirectangular frame."""
    if bbox is None:
        return [0.0, 0.0, 1.0, 1.0]
    w, s, e, n = bbox
    return [round((w + 180) / 360, 4), round((90 - n) / 180, 4), round((e - w) / 360, 4), round((n - s) / 180, 4)]


def pixel_box(box, width, height):
    """Normalized [x, y, w, h] -> x0, y0, x1, y1 pixels (exclusive ends), even-sized as T2 crops."""
    x0, y0 = int(round(box[0] * width)), int(round(box[1] * height))
    w = max(2, int(round(box[2] * width)) // 2 * 2)
    h = max(2, int(round(box[3] * height)) // 2 * 2)
    return x0, y0, min(width, x0 + w), min(height, y0 + h)


def aspect(width, height):
    g = math.gcd(width, height)
    return f"{width // g}:{height // g}"


def bar_lut(bar_rgb):
    """32^3 cube (5 bits a channel) -> °C, by nearest colour on the bar's middle row (linear 0..32 °C)."""
    row = bar_rgb[BAR_ROW, BAR_X0:BAR_X1 + 1, :3].astype(np.float32)
    temps = np.linspace(T_MIN, T_MAX, len(row), dtype=np.float32)
    levels = np.arange(32, dtype=np.float32) * 8 + 4
    cube = np.stack(np.meshgrid(levels, levels, levels, indexing="ij"), -1).reshape(-1, 1, 3)
    nearest = np.argmin(((cube - row[None]) ** 2).sum(-1), axis=1)
    return temps[nearest].reshape(32, 32, 32)


def temperatures(rgb, lut):
    q = (rgb >> 3).astype(np.intp)
    return lut[q[..., 0], q[..., 1], q[..., 2]]


def saturated(rgb):
    i = rgb.astype(np.int16)
    return (i.max(-1) - i.min(-1)) > SAT_MIN


def frame_step(total):
    """Model time between video frames: the brief's 2,002-frame span (ffprobe decodes 2,001), else spread over the video."""
    return (END - START) / ((SVS_FRAMES if abs(total - SVS_FRAMES) <= 1 else total) - 1)


def iso(d):
    return (d + dt.timedelta(seconds=30)).strftime("%Y-%m-%dT%H:%MZ")  # to the nearest minute


def display(d):
    return f"{d.strftime('%b')} {d.day}, {d.year}"


def probe(video):
    out = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,nb_read_frames", "-of", "csv=p=0", str(video)],
                         check=True, capture_output=True, text=True).stdout.strip().split(",")
    return int(out[0]), int(out[1]), int(out[2])


def frames(video, width, height, select, scale=1):
    """Yield rgb uint8 arrays for the frames ffmpeg's select picks, optionally downscaled."""
    w, h = width // scale, height // scale
    cmd = ["ffmpeg", "-v", "error", "-i", str(video), "-vf", f"select='{select}',scale={w}:{h}:flags=area",
           "-vsync", "0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    with subprocess.Popen(cmd, stdout=subprocess.PIPE) as p:
        size = w * h * 3
        while len(buf := p.stdout.read(size)) == size:
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    if p.returncode:
        raise RuntimeError(f"ffmpeg failed on {video}")


def moving_mask(video, width, height):
    """Pixels whose brightness changes over the sampled frames (quarter size, then scaled up)."""
    stack = np.stack([f.mean(-1) for f in frames(video, width, height, f"not(mod(n\\,{EVERY}))", 4)])
    small = (stack.std(0) > STD_MIN).astype(np.uint8)
    return cv2.resize(small, (width, height), interpolation=cv2.INTER_NEAREST).astype(bool)


def grid_means(values, valid, rows=GRID_ROWS, cols=GRID_COLS):
    """rows x cols means of values where valid; NaN where a cell has none."""
    h, w = values.shape
    out = np.full((rows, cols), np.nan, np.float32)
    ys, xs = np.linspace(0, h, rows + 1).astype(int), np.linspace(0, w, cols + 1).astype(int)
    for r in range(rows):
        for c in range(cols):
            m = valid[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
            if m.any():
                out[r, c] = values[ys[r]:ys[r + 1], xs[c]:xs[c + 1]][m].mean()
    return out


def gray_half(rgb):
    g = cv2.cvtColor(np.ascontiguousarray(rgb), cv2.COLOR_RGB2GRAY)
    return cv2.resize(g, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)


def measure(rgb, nxt, mask, lut, box):
    """Raw metrics for one step in one pixel box, or None if no ocean is seen. Flow runs at half size."""
    x0, y0, x1, y1 = box
    sub = rgb[y0:y1, x0:x1]
    ocean = mask[y0:y1, x0:x1] & saturated(sub)
    if not ocean.any():
        return None
    temps = temperatures(sub, lut)
    g0, g1 = gray_half(sub), gray_half(nxt[y0:y1, x0:x1])
    flow = cv2.calcOpticalFlowFarneback(g0, g1, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    u, v = flow[..., 0], flow[..., 1]
    mag = np.hypot(u, v)
    curl = np.abs(np.gradient(v, axis=1) - np.gradient(u, axis=0))
    half = cv2.resize(ocean.astype(np.uint8), (g0.shape[1], g0.shape[0]), interpolation=cv2.INTER_NEAREST).astype(bool)
    mag_full = cv2.resize(mag, (sub.shape[1], sub.shape[0]), interpolation=cv2.INTER_LINEAR)
    t = temps[ocean]
    return {
        "mean": float(t.mean()), "min": float(np.percentile(t, 2)), "max": float(np.percentile(t, 98)),
        "mag": float(mag[half].mean()) if half.any() else 0.0,
        "vort": float(curl[half].mean()) if half.any() else 0.0,
        "grid_t": grid_means(temps, ocean), "grid_m": grid_means(mag_full, ocean),
    }


def norm(x, scale):
    return float(np.clip(x / scale, 0, 1)) if scale > 0 else 0.0


def r3(x):
    return round(float(x), 3)


def build(region_id, title, bbox, steps, raw, width, height, total):
    """The brief's JSON (Step 2B) for one region from its raw per-step metrics (None where no ocean was seen)."""
    seen = [r for r in raw if r]
    mag_scale = float(np.percentile([r["mag"] for r in seen], 99))
    vort_scale = float(np.percentile([r["vort"] for r in seen], 99))
    cell_scale = float(np.nanpercentile(np.stack([r["grid_m"] for r in seen]), 99))
    mean_all = float(np.mean([r["mean"] for r in seen]))
    dev = max(abs(r["mean"] - mean_all) for r in seen) or 1.0
    box = crop_box(bbox)
    x0, y0, x1, y1 = pixel_box(box, width, height)
    step_td = frame_step(total)
    timeline = []
    for step, (frame, r) in enumerate(zip(steps, raw)):
        d = START + step_td * frame
        entry = {"step": step, "time_sec": round(frame / VIDEO_FPS, 3), "iso_date": iso(d), "display_date": display(d)}
        if r is None:
            entry["metrics"], entry["spatial_grid"] = None, None
        else:
            sst = norm(r["mean"], T_MAX)
            vel, vort = norm(r["mag"], mag_scale), norm(r["vort"], vort_scale)
            entry["metrics"] = {
                "sst_celsius_mean": round(r["mean"], 1), "sst_celsius_min": round(r["min"], 1), "sst_celsius_max": round(r["max"], 1),
                "sst_normalized": r3(sst), "current_velocity_norm": r3(vel), "eddy_vorticity_norm": r3(vort),
                "thermal_anomaly": r3((r["mean"] - mean_all) / dev), "intensity_marker": r3((sst + vel + vort) / 3),
            }
            entry["spatial_grid"] = [
                [None if math.isnan(t) else [r3(t / T_MAX), r3(norm(m, cell_scale))] for t, m in zip(tr, mr)]
                for tr, mr in zip(r["grid_t"], r["grid_m"])]
        timeline.append(entry)
    return {
        "dataset_id": region_id,
        "metadata": {
            "title": title, "source": SOURCE, "category": "ocean", "theme_color": "#00ffcc",
            "date_start": timeline[0]["iso_date"], "date_end": iso(START + step_td * (total - 1)),
            "bbox_lon_lat": list(bbox) if bbox else None, "what_you_will_try": None,
        },
        "visual_assets": {
            "video_url": f"/media/{region_id}.mp4", "poster_url": f"/media/{region_id}_poster.jpg",
            "aspect_ratio": aspect(x1 - x0, y1 - y0), "normalized_crop_box": box,
        },
        "calibration": CALIBRATION,
        "timeline": timeline,
    }


def run(src, out):
    lut = bar_lut(np.asarray(Image.open(src / "sst_ecco2_cbar.png").convert("RGB")))
    out.mkdir(parents=True, exist_ok=True)
    for video_name in dict.fromkeys(v for *_, v in REGIONS):
        video = src / video_name
        if not video.is_file():
            print(f"skip {video_name}: not found", file=sys.stderr)
            continue
        width, height, total = probe(video)
        mask = moving_mask(video, width, height)
        regions = [(rid, title, bbox, pixel_box(crop_box(bbox), width, height)) for rid, title, bbox, v in REGIONS if v == video_name]
        steps = list(range(0, total, EVERY))
        raw = {rid: [] for rid, *_ in regions}
        pairs = frames(video, width, height, f"lt(mod(n\\,{EVERY})\\,2)")
        for frame in steps:
            a = next(pairs)
            b = next(pairs) if frame + 1 < total else a  # the last frame has no next one: zero flow
            for rid, _, _, box in regions:
                raw[rid].append(measure(a, b, mask, lut, box))
        for rid, title, bbox, _ in regions:
            doc = build(rid, title, bbox, steps, raw[rid], width, height, total)
            (out / f"{rid}.json").write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
            temps = [s["metrics"]["sst_celsius_mean"] for s in doc["timeline"] if s["metrics"]]
            print(f"{rid}: {len(steps)} steps ({len(temps)} with ocean), mean {min(temps)}..{max(temps)} °C, "
                  f"{doc['metadata']['date_start']} .. {doc['metadata']['date_end']}")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--src", type=Path, required=True, help="folder with the two MP4s and sst_ecco2_cbar.png")
    p.add_argument("--out", type=Path, required=True, help="folder for the JSON files")
    a = p.parse_args(argv)
    run(a.src, a.out)


if __name__ == "__main__":
    main()

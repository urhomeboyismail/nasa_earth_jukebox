#!/usr/bin/env python3
"""T2: NASA GIBS frames -> story.json + facts.json + frame images + day-1 report.

Usage (from the repo root):
    pipeline/.venv/bin/python pipeline/build_story.py pipeline/config/mur-mauritius.json

Rules this script keeps (CLAUDE.md rules 1, 4, 5):
  * Every value is decoded from a GIBS map image against the layer's own colour map.
  * A date the source did not publish becomes a rest (value null). Nothing is filled in.
    "Not published" comes from the layer's WMTS capabilities date list, and the blank
    image the server returns for that date must agree, or the script stops.
  * All sentences are built from the numbers by templates here (no AI at build time).
    A person still has to read and sign them off (audit log, T6).
"""
import json
import re
import statistics
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "pipeline" / "cache"
CAPS_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml"
WMS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
UA = {"User-Agent": "earth-out-loud-hackathon/0.1 (offline pipeline; contact: team)"}


# ---------- fetching (cached on disk so reruns are polite and repeatable) ----------
def fetch(url, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / name
    if not f.exists():
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=90) as r:
            f.write_bytes(r.read())
    return f.read_bytes()


def published_dates(layer):
    """The dates the source itself lists for this layer (WMTS Time dimension)."""
    root = ET.fromstring(fetch(CAPS_URL, "wmts-capabilities.xml"))
    ns = {"w": "http://www.opengis.net/wmts/1.0", "o": "http://www.opengis.net/ows/1.1"}
    for lay in root.iter("{http://www.opengis.net/wmts/1.0}Layer"):
        if lay.findtext("o:Identifier", namespaces=ns) == layer:
            dates = set()
            for v in lay.iter("{http://www.opengis.net/wmts/1.0}Value"):
                parts = v.text.split("/")
                a = date.fromisoformat(parts[0])
                b = date.fromisoformat(parts[1]) if len(parts) > 1 else a
                assert len(parts) < 3 or parts[2] == "P1D", f"unsupported period {parts[2]}"
                d = a
                while d <= b:
                    dates.add(d)
                    d += timedelta(days=1)
            return dates
    raise SystemExit(f"layer {layer} not in capabilities")


def load_colormap(url):
    root = ET.fromstring(fetch(url, "colormap-" + url.rsplit("/", 1)[-1]))
    for cm in root.iter("ColorMap"):
        if cm.get("units"):  # the data map, not the "No Data" map
            bins = []
            for e in cm.iter("ColorMapEntry"):
                m = re.match(r"[\[(]([^,]+),([^)\]]+)[)\]]", e.get("sourceValue"))
                lo = -np.inf if "INF" in m.group(1) else float(m.group(1))
                hi = np.inf if "INF" in m.group(2) else float(m.group(2))
                rgb = tuple(int(x) for x in e.get("rgb").split(","))
                bins.append((rgb, lo, hi))
            return cm.get("units"), bins
    raise SystemExit("no data colour map found")


def get_frame(layer, bbox, size, day):
    q = {
        "SERVICE": "WMS", "REQUEST": "GetMap", "VERSION": "1.3.0", "LAYERS": layer, "STYLES": "",
        "CRS": "EPSG:4326", "BBOX": f"{bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']}",
        "WIDTH": size["width"], "HEIGHT": size["height"], "FORMAT": "image/png", "TRANSPARENT": "TRUE", "TIME": day.isoformat(),
    }
    return fetch(WMS + "?" + urllib.parse.urlencode(q), f"frame-{layer}-{day.isoformat()}-{size['width']}x{size['height']}.png")


def decode(raw, bins):
    """-> (value or None, coverage %, exact-match share of sea pixels %)."""
    a = np.array(Image.open(BytesIO(raw)).convert("RGBA"))
    opaque = a[..., 3] == 255
    total = a.shape[0] * a.shape[1]
    n = int(opaque.sum())
    if n == 0:
        return None, 0.0, None
    pix = a[opaque][:, :3].astype(int)
    pal = np.array([b[0] for b in bins], dtype=int)
    d2 = ((pix[:, None, :] - pal[None, :, :]) ** 2).sum(axis=2)
    idx = d2.argmin(axis=1)
    exact = float((d2[np.arange(len(pix)), idx] == 0).mean() * 100)
    mids = np.array([(b[1] + b[2]) / 2 if np.isfinite(b[1]) and np.isfinite(b[2]) else np.nan for b in bins])
    vals = mids[idx]
    if np.isnan(vals).any():
        raise SystemExit("a pixel fell in an open-ended colour bin; widen the domain handling first")
    return round(float(vals.mean()), 2), round(100 * n / total, 2), round(exact, 2)


def num(x):
    """Format a number the way JavaScript's String() would, so text matches the engine."""
    return f"{x:.6f}".rstrip("0").rstrip(".")


# ---------- building ----------
def main(cfg_path):
    cfg = json.loads(Path(cfg_path).read_text())
    layer, bbox, size = cfg["layer"], cfg["bbox"], cfg["size"]
    unit, bins = load_colormap(cfg["colormap_url"])
    bin_width = round(bins[1][2] - bins[1][1], 6)
    published = published_dates(layer)
    start = date.fromisoformat(cfg["start"])
    days = [start + timedelta(days=cfg["stride_days"] * i) for i in range(cfg["count"])]

    frames_dir = ROOT / cfg["frames_dir"]
    frames_dir.mkdir(parents=True, exist_ok=True)
    steps, report_rows = [], []
    for i, d in enumerate(days):
        raw = get_frame(layer, bbox, size, d)
        v, cov, exact = decode(raw, bins)
        in_list = d in published
        if in_list != (v is not None):
            raise SystemExit(f"{d}: capabilities say published={in_list} but the image decoded to {v}. Stop and look.")
        row = {"index": i, "label": d.isoformat(), "coverage_pct": cov}
        if v is None:
            row.update(state="rest", value=None, rest_reason="no_frame")
        else:
            if cov >= cfg["low_confidence_below"]:
                state = "data"
            elif cov >= cfg["coverage_rest_below"]:
                state = "low_confidence"
            else:
                state = "rest"
            if state == "rest":
                row.update(state="rest", value=None, rest_reason="low_coverage")
            else:
                frame_name = f"{cfg['story_id']}-{i:02d}.png"
                (frames_dir / frame_name).write_bytes(raw)
                row.update(state=state, value=v, source_id="MUR", frame=f"frames/{frame_name}")
        steps.append(row)
        report_rows.append({"date": d.isoformat(), "published": in_list, "value": v, "coverage_pct": cov, "exact_match_pct": exact})

    data = [s for s in steps if s["state"] != "rest"]
    lo, hi = cfg["domain"]
    assert all(lo <= s["value"] <= hi for s in data), "a value is outside the configured domain"
    side_a_step = (hi - lo) / 10  # matches app/sound/plan.js sideARoundingStep (2 octaves x 5 scale notes)

    # gaps
    gaps, i = [], 0
    while i < len(steps):
        if steps[i]["state"] == "rest":
            j = i
            while j + 1 < len(steps) and steps[j + 1]["state"] == "rest" and steps[j + 1]["rest_reason"] == steps[i]["rest_reason"]:
                j += 1
            if steps[i]["rest_reason"] == "no_frame":
                rng = f"Step {i + 1} ({steps[i]['label']})" if i == j else f"Steps {i + 1} to {j + 1} ({steps[i]['label']} to {steps[j]['label']})"
                msg = f"{rng}: no data, not zero. NASA published no map for this date."
            else:
                msg = f"Step {i + 1}: too little of the area was seen, so no value is played."
            gaps.append({"start_index": i, "end_index": j, "reason": steps[i]["rest_reason"], "message": msg})
            i = j + 1
        else:
            i += 1

    # key moments, chosen by rule from the data (not by hand)
    first, last = data[0], data[-1]
    lo_s = min(data, key=lambda s: s["value"])
    hi_s = max(data, key=lambda s: s["value"])
    drops = [(a["value"] - b["value"], a, b) for a, b in zip(data, data[1:])]
    big_drop, prev_of_big, big_step = max(drops, key=lambda t: t[0])
    moments = {}

    def S(s):
        return f"Step {s['index'] + 1} ({s['label']})"

    def add(step, title, msg):
        moments.setdefault(step["index"], {"step_index": step["index"], "title": title, "message": msg})

    add(first, "Start", f"{S(first)}: {cfg['series_label']} {num(first['value'])} {unit}. This is the first reading.")
    add(big_step, "Biggest fall", f"{S(big_step)}: {num(big_step['value'])} {unit}, down {num(round(big_drop, 2))} {unit} from {num(prev_of_big['value'])} {unit} at {S(prev_of_big)}. This is the largest fall between two readings.")
    add(lo_s, "Lowest", f"{S(lo_s)}: {num(lo_s['value'])} {unit}, the lowest reading.")
    add(last, "End", f"{S(last)}: {num(last['value'])} {unit}. This is the last reading.")
    if len(moments) < 3:
        add(hi_s, "Highest", f"{S(hi_s)}: {num(hi_s['value'])} {unit}, the highest reading.")
    km = sorted(moments.values(), key=lambda m: m["step_index"])
    assert 3 <= len(km) <= 5, f"need 3-5 key moments, got {len(km)}"

    # baseline: first five data steps
    base_idx = [s["index"] for s in data[:5]]
    base_val = statistics.fmean(steps[k]["value"] for k in base_idx)
    base_steps_txt = ", ".join(str(k + 1) for k in base_idx[:-1]) + f" and {base_idx[-1] + 1}"

    first_label, last_label = steps[0]["label"], steps[-1]["label"]
    gap_labels = [s["label"] for s in steps if s["state"] == "rest" and s["rest_reason"] == "no_frame"]
    cover = sorted({s["coverage_pct"] for s in data})
    region = cfg["region_name"]
    story = {
        "schema_version": "1.0.0-draft",
        "meta": {
            "story_id": cfg["story_id"],
            "title": cfg["title"],
            "is_fixture": False,
            "series_label": cfg["series_label"],
            "unit": unit,
            "region": {"name": region, "bbox": bbox, "grid": size},
            "sources": [
                {"id": "MUR", "name": "GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis (v4.1), shown through NASA GIBS",
                 "url": "https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1",
                 "credit": "JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis. doi:10.5067/GHGMR-4FJ04. NASA PO.DAAC."},
                {"id": "GIBS", "name": "NASA Global Imagery Browse Services (GIBS)",
                 "url": "https://nasa-gibs.github.io/gibs-api-docs/",
                 "credit": "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."},
                {"id": "CMAP", "name": "GIBS colour map for this layer",
                 "url": cfg["colormap_url"],
                 "credit": "The colour map published by NASA GIBS for the layer. It links each map colour to a temperature range."},
            ],
            "eic_visualization": {
                "status": "none_verified",
                "text": "No matching EIC visualization verified. The maps come from NASA GIBS (Global Imagery Browse Services).",
            },
        },
        "encoding": {
            "domain_min": lo, "domain_max": hi,
            "colour_key": {"source_id": "CMAP", "bin_width": bin_width},
            "side_a": {"rounding_statement": f"Side A snaps each pitch to a musical scale, so values are rounded to about {num(side_a_step)} {unit}."},
            "side_b": {"coarseness_statement": f"Side B plays the value as a plain tone. The colour key only gives ranges of {num(bin_width)} {unit} for each map point, so the value is not exact."},
        },
        "baseline": {"step_indices": base_idx, "value": base_val,
                     "statement": f"The reference tone is the average of steps {base_steps_txt}, the first five with data: {num(round(base_val, 2))} {unit}."},
        "steps": steps,
        "gaps": gaps,
        "key_moments": km,
        "text": {
            "orientation": (f"Sea surface temperature around {region}. One reading every {cfg['stride_days']} days, from {first_label} to {last_label}. "
                            f"It goes from {num(first['value'])} to {num(last['value'])} {unit}. "
                            + (f"No data for {', '.join(gap_labels)}." if gap_labels else "")).strip(),
            "alt_short": f"Sea temperature map around {region}: {num(first['value'])} to {num(last['value'])} {unit}.",
            "alt_long": (f"A map of the sea around {region}, coloured by temperature, for {len(data)} dates between {first_label} and {last_label}. "
                         f"Warm water is shown in warm colours. The area-wide reading is {num(first['value'])} {unit} on {first_label} and {num(last['value'])} {unit} on {last_label}. "
                         "Land has no sea temperature and is left blank."),
            "legend": "Higher pitch means warmer water. Silence means no map was published for that date. Each reading is the average of the sea points in the area.",
        },
    }

    def fact(fid, kind, text, sources, derivations=None):
        d = {"id": fid, "kind": kind, "text": text, "source_ids": sources}
        if derivations:
            d["derivations"] = derivations
        return d

    change = round(last["value"] - first["value"], 2)
    facts = [
        fact("F01", "data", f"On {first['label']} (step {first['index'] + 1}) the {cfg['series_label']} around {region} was {num(first['value'])} {unit}.", ["MUR"]),
        fact("F02", "data", f"On {last['label']} (step {last['index'] + 1}) the {cfg['series_label']} was {num(last['value'])} {unit}.", ["MUR"]),
        fact("F03", "data", f"The lowest reading was {num(lo_s['value'])} {unit} on {lo_s['label']} (step {lo_s['index'] + 1}).", ["MUR"]),
        fact("F04", "data", f"The highest reading was {num(hi_s['value'])} {unit} on {hi_s['label']} (step {hi_s['index'] + 1}).", ["MUR"]),
        fact("F05", "data", f"From {first['label']} to {last['label']} the reading changed by {num(change)} {unit}.", ["MUR"],
             [{"kind": "diff", "from_step": first["index"], "to_step": last["index"], "value": change}]),
        fact("F06", "data", f"The largest fall between two readings was {num(round(big_drop, 2))} {unit}, from step {prev_of_big['index'] + 1} to step {big_step['index'] + 1}.", ["MUR"],
             [{"kind": "diff", "from_step": big_step["index"], "to_step": prev_of_big["index"], "value": round(big_drop, 2)}]),
        fact("F07", "limit", (f"There is no data for {', '.join(gap_labels)}: NASA published no map for {'that date' if len(gap_labels) == 1 else 'those dates'}. This is a gap, not a zero."
                              if gap_labels else "Every date in this story has a published map."), ["GIBS"]),
        fact("F08", "method", f"Each reading is the average of the sea points in a box around {region}, from west {num(bbox['west'])} to east {num(bbox['east'])} degrees, and south {num(bbox['south'])} to north {num(bbox['north'])} degrees. The box is {size['width']} by {size['height']} map points.", ["GIBS"]),
        fact("F09", "method", f"Each map point is only known to within a colour range of {num(bin_width)} {unit}. The average is not exact.", ["CMAP"]),
        fact("F10", "method", f"Land has no sea temperature. The sea covers {num(cover[0])}% of the box" + ("." if len(cover) == 1 else f" to {num(cover[-1])}%."), ["MUR"]),
        fact("F11", "method", f"There is one reading every {cfg['stride_days']} days.", ["MUR"]),
        fact("F12", "source", "The temperatures come from the MUR sea surface temperature analysis by NASA JPL, shown through NASA GIBS.", ["MUR", "GIBS"]),
        fact("F13", "limit", "This record shows what the maps say. It does not say why the temperature changed.", ["MUR"]),
    ]
    facts_doc = {"schema_version": "1.0.0-draft", "story_id": cfg["story_id"], "facts": facts}

    out_dir = ROOT / cfg["out_dir"]
    (out_dir / f"{cfg['story_id']}.story.json").write_text(json.dumps(story, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (out_dir / f"{cfg['story_id']}.facts.json").write_text(json.dumps(facts_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    exact = [r["exact_match_pct"] for r in report_rows if r["exact_match_pct"] is not None]
    report = {
        "story_id": cfg["story_id"],
        "check1_colour_key_decoded": {"min_exact_match_pct": min(exact), "threshold": 95.0, "pass": min(exact) >= 95.0,
                                      "how": "share of sea pixels whose colour equals a colour-map entry exactly"},
        "check2_real_gaps": {"gap_dates": gap_labels, "agreement": "capabilities date list and blank server image agree for every date (the script stops otherwise)", "pass": len(gap_labels) >= 1},
        "check3_cross_check": {"pass": None, "note": "No independent cross-check series was found for this layer; check 3 is not applicable and is NOT reported as passed."},
        "rows": report_rows,
    }
    (ROOT / cfg["report_path"]).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {cfg['story_id']}: {len(data)} data steps, {len(gap_labels)} gap(s); min exact-match {min(exact)}%")


if __name__ == "__main__":
    main(sys.argv[1])

"""Meteomatics weather ETL: Mauritius, 48 hours, hourly, as an Earth Jukebox track (public/data/json_output/).

Needs METEOMATICS_USERNAME (or METEOMATICS_USER) and METEOMATICS_PASSWORD in the environment or in .env. Standard library only.

    python3 scripts/ingest_meteomatics.py                       # the last two full UTC days
    python3 scripts/ingest_meteomatics.py --start 2026-11-10    # a chosen 48 hours

It writes meteomatics_mauritius_weather.json and adds its entry to index.json (replacing an earlier entry of the same id, leaving the
others alone). The file has the same shape as the ECCO2 tracks (src/features/ocean/schema.ts) with no video: the numbers are the track.

The sound engine reads ocean channels, so each weather quantity borrows one (metadata.channels says so in the file itself):
  sst_*                 2 m air temperature, in degrees Celsius
  current_velocity_norm 10 m wind speed over WIND_MAX_MS
  eddy_vorticity_norm   rain in the hour over PRECIP_MAX_MM (the stereo swirl)
  spatial_grid cell     [temperature, wind speed, wind direction], each 0..1; the direction is where the wind blows FROM, over 360

The 2100 climate scenario is not built here: this subscription's data ends 2028-11-15 (the API answers 403 after that).
"""

import argparse
import base64
import datetime as dt
import json
import math
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.meteomatics.com"
DATASET_ID = "meteomatics_mauritius_weather"
TITLE = "Mauritius Weather, 48 Hours"
SOURCE = "Meteomatics Weather API (model mix)"
CATEGORY = "atmosphere"
THEME_COLOR = "#00f0ff"
LAT_N, LAT_S, LON_W, LON_E = -19.9, -20.6, 57.2, 57.9
ROWS, COLS = 8, 16
HOURS = 48
STEP_SEC = 0.5  # the sound engine plays two steps a second of media time (src/features/ocean/mapping.ts)
WIND_MAX_MS = 15.0
PRECIP_MAX_MM = 3.0
PARAMS = {"temp": "t_2m:C", "rain": "precip_1h:mm", "speed": "wind_speed_10m:ms", "dir": "wind_dir_10m:d"}
CALIBRATION = {"filter_cutoff_hz": [250, 3500], "pitch_range_hz": [82.41, 659.25]}
WHAT_YOU_WILL_TRY = ("Can you hear the heat of the afternoon build and fade across two days in Mauritius? "
                     "Listen for the brightest tone, then for the pulse that quickens when the wind picks up.")
SUMMARY = ("Two days of hourly air temperature, wind and rain around Mauritius from the Meteomatics weather API: "
           "colours for temperature, streaks for wind, and a tone that follows the heat.")
COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]


class ApiError(Exception):
    """The API said no, or sent something that is not a 16 by 8 grid. Never carries the credentials."""


# --- credentials and the API ---------------------------------------------------------------------------------------------------

def load_credentials(env_file, environ=None):
    """(user, password) from the environment, else from an .env file. Raises ApiError naming what is missing, never the values."""
    environ = os.environ if environ is None else environ
    found = {}
    if env_file and Path(env_file).is_file():
        for line in Path(env_file).read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                found[key.strip()] = value.strip().strip("\"'")
    found.update({k: v for k, v in environ.items() if k.startswith("METEOMATICS_") and v})
    user = found.get("METEOMATICS_USERNAME") or found.get("METEOMATICS_USER")
    password = found.get("METEOMATICS_PASSWORD")
    if not user or not password:
        raise ApiError("METEOMATICS_USERNAME (or METEOMATICS_USER) and METEOMATICS_PASSWORD must be set in the environment or in .env")
    return user, password


def fetch_json(path, credentials, opener=urllib.request.urlopen):
    """GET one API path with HTTP Basic Auth and return the parsed JSON."""
    token = base64.b64encode(f"{credentials[0]}:{credentials[1]}".encode()).decode()
    request = urllib.request.Request(f"{API}/{path}", headers={"Authorization": f"Basic {token}"})
    try:
        with opener(request, timeout=120) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        raise ApiError(f"Meteomatics answered {error.code}: {error.read().decode(errors='replace')[:300]}") from None
    except (urllib.error.URLError, TimeoutError) as error:
        raise ApiError(f"Meteomatics could not be reached: {error}") from None


def iso_z(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


def grid_path(start, end, parameter):
    """The request path for one parameter over the box, hourly from start to end inclusive, as a 16 by 8 grid."""
    return f"{iso_z(start)}--{iso_z(end)}:PT1H/{parameter}/{LAT_N},{LON_W}_{LAT_S},{LON_E}:{COLS}x{ROWS}/json"


def parse_grid(response):
    """{date: rows x cols list of lists} from one parameter's response, rows north to south, columns west to east."""
    try:
        points = response["data"][0]["coordinates"]
    except (KeyError, IndexError, TypeError):
        raise ApiError("the response has no data[0].coordinates") from None
    lats = sorted({round(p["lat"], 4) for p in points}, reverse=True)
    lons = sorted({round(p["lon"], 4) for p in points})
    if (len(lats), len(lons)) != (ROWS, COLS):
        raise ApiError(f"expected a {ROWS} by {COLS} grid, got {len(lats)} latitudes by {len(lons)} longitudes")
    row_of, col_of = {v: i for i, v in enumerate(lats)}, {v: i for i, v in enumerate(lons)}
    grids = {}
    for point in points:
        row, col = row_of[round(point["lat"], 4)], col_of[round(point["lon"], 4)]
        for entry in point["dates"]:
            if entry["value"] is None:
                raise ApiError(f"a missing value at {entry['date']}, row {row}, column {col}")
            grids.setdefault(entry["date"], [[None] * COLS for _ in range(ROWS)])[row][col] = float(entry["value"])
    return grids


def fetch_series(start, end, credentials, opener=urllib.request.urlopen):
    """{'temp'|'rain'|'speed'|'dir': {date: grid}}, one request a parameter, with the same hours in each."""
    series = {name: parse_grid(fetch_json(grid_path(start, end, parameter), credentials, opener)) for name, parameter in PARAMS.items()}
    hours = sorted(series["temp"])
    if len(hours) != HOURS or any(sorted(grids) != hours for grids in series.values()):
        raise ApiError(f"expected the same {HOURS} hours for every parameter")
    return series


# --- numbers -------------------------------------------------------------------------------------------------------------------

def iso(d):
    return d.strftime("%Y-%m-%dT%H:%MZ")


def display(d):
    return f"{d.strftime('%b')} {d.day}, {d:%H:%M} UTC"


def clip01(x):
    return min(1.0, max(0.0, x))


def r3(x):
    return round(float(x), 3)


def flat(grid):
    return [v for row in grid for v in row]


def mean(values):
    return sum(values) / len(values)


def mean_from_degrees(speeds, directions):
    """Where the wind blows from, in degrees, averaged as vectors weighted by speed (so 350 and 10 make 0, not 180)."""
    east = sum(s * math.sin(math.radians(d)) for s, d in zip(speeds, directions))
    north = sum(s * math.cos(math.radians(d)) for s, d in zip(speeds, directions))
    return math.degrees(math.atan2(east, north)) % 360 if (east or north) else 0.0


def compass(degrees):
    return COMPASS[int((degrees + 22.5) // 45) % 8]


def calibrate(temps):
    """Whole degrees around the data, at least 8 wide: the range the tone's pitch and brightness run over."""
    lo, hi = math.floor(min(temps)) - 1, math.ceil(max(temps)) + 1
    short = 8 - (hi - lo)
    if short > 0:
        lo, hi = lo - short // 2, hi + (short + 1) // 2
    return float(lo), float(hi)


# --- words ---------------------------------------------------------------------------------------------------------------------

def band(x, words):
    """A word for a 0..1 value from len(words) equal bands."""
    return words[min(len(words) - 1, int(max(0.0, x) * len(words)))]


def warmth_word(celsius):
    for limit, word in [(10, "cold"), (16, "cool"), (22, "mild"), (28, "warm")]:
        if celsius < limit:
            return word
    return "hot"


def wind_phrase(speed_ms, from_deg):
    if speed_ms < 1.5:
        return "almost no wind"
    word = "light" if speed_ms < 5 else "moderate" if speed_ms < 9 else "strong"
    return f"{word} wind from the {compass(from_deg)}"


def rain_phrase(rain_mm):
    return "no rain" if rain_mm < 0.05 else "light showers" if rain_mm < 0.5 else "steady rain" if rain_mm < 2 else "heavy rain"


def describe(step):
    m, e = step["metrics"], step["extra"]
    return (f"{step['display_date']}: {warmth_word(m['sst_celsius_mean'])} air averaging {m['sst_celsius_mean']} degrees Celsius "
            f"(from {m['sst_celsius_min']} to {m['sst_celsius_max']}), with {wind_phrase(e['speed_ms'], e['from_deg'])} and {rain_phrase(e['rain_mm'])}. "
            f"You hear {band(m['sst_normalized'], ['deep, muffled', 'deep, muffled', 'soft', 'clear', 'bright', 'bright, open'])} tones "
            f"and {band(m['current_velocity_norm'], ['slow', 'steady', 'quick'])} pulses.")


def key_events(steps):
    """step index -> callout kinds, for the moments worth Echo pausing the music for."""
    temps = [s["metrics"]["sst_celsius_mean"] for s in steps]
    picks = [("warmest", max(range(len(steps)), key=temps.__getitem__)), ("coolest", min(range(len(steps)), key=temps.__getitem__)),
             ("windiest", max(range(len(steps)), key=lambda i: steps[i]["extra"]["speed_ms"])),
             ("jump", max(range(1, len(steps)), key=lambda i: abs(temps[i] - temps[i - 1])))]
    if max(s["extra"]["rain_mm"] for s in steps) >= 0.05:
        picks.append(("wettest", max(range(len(steps)), key=lambda i: steps[i]["extra"]["rain_mm"])))
    events = {0: ["intro"]}
    for kind, i in picks:
        events.setdefault(i, []).append(kind)
    return events


def callout(kinds, step, previous):
    m, e = step["metrics"], step["extra"]
    said = {
        "intro": f"{TITLE}. The colours are air temperature, blue at 0 to red at 32 degrees, and the streaks are the wind. Listen as two days go by.",
        "warmest": f"The warmest hour here, averaging {m['sst_celsius_mean']} degrees: the sound is at its brightest.",
        "coolest": f"The coolest hour here, averaging {m['sst_celsius_mean']} degrees: hear the tone turn muffled.",
        "windiest": f"The wind is strongest around now, {e['speed_ms']:.1f} metres a second: the pulse quickens.",
        "wettest": f"The heaviest rain of these two days is around now, {e['rain_mm']:.1f} millimetres an hour: hear the sound swirl.",
        "jump": f"The biggest change in an hour, {m['sst_celsius_mean'] - previous['metrics']['sst_celsius_mean']:+.1f} degrees." if previous else "",
    }
    intro = said["intro"] + " " if "intro" in kinds else ""
    rest = " ".join(said[k] for k in kinds if k != "intro" and said[k])
    return (intro + (f"{step['display_date']}: {rest}" if rest else "")).strip()


# --- the document --------------------------------------------------------------------------------------------------------------

def build(series, retrieved):
    """The track document from fetched series: {'temp'|'rain'|'speed'|'dir': {iso date: grid}}."""
    hours = sorted(series["temp"])
    lo, hi = calibrate([v for h in hours for v in flat(series["temp"][h])])
    step_means = [mean(flat(series["temp"][h])) for h in hours]
    mean_all = mean(step_means)
    dev = max(abs(m - mean_all) for m in step_means) or 1.0
    steps = []
    for i, hour in enumerate(hours):
        when = dt.datetime.strptime(hour, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)
        t, rain, speed, wdir = (flat(series[k][hour]) for k in ("temp", "rain", "speed", "dir"))
        sst = clip01((mean(t) - lo) / (hi - lo))
        vel = clip01(mean(speed) / WIND_MAX_MS)
        swirl = mean([clip01(v / PRECIP_MAX_MM) for v in rain])
        grid = [[[r3(clip01((series["temp"][hour][r][c] - lo) / (hi - lo))), r3(clip01(series["speed"][hour][r][c] / WIND_MAX_MS)),
                  r3((series["dir"][hour][r][c] % 360) / 360)] for c in range(COLS)] for r in range(ROWS)]
        steps.append({
            "step": i, "time_sec": round(i * STEP_SEC, 3), "iso_date": iso(when), "display_date": display(when),
            "metrics": {
                "sst_celsius_mean": round(mean(t), 1), "sst_celsius_min": round(min(t), 1), "sst_celsius_max": round(max(t), 1),
                "sst_normalized": r3(sst), "current_velocity_norm": r3(vel), "eddy_vorticity_norm": r3(swirl),
                "thermal_anomaly": r3((mean(t) - mean_all) / dev), "intensity_marker": r3((sst + vel + swirl) / 3),
            },
            "spatial_grid": grid,
            # Facts for the words only; removed before the file is written.
            "extra": {"speed_ms": mean(speed), "rain_mm": mean(rain), "from_deg": mean_from_degrees(speed, wdir)},
        })
    events = key_events(steps)
    for i, step in enumerate(steps):
        step["accessibility_text"] = describe(step)
        step["echo_callout"] = callout(events[i], step, steps[i - 1] if i else None) if i in events else None
        del step["extra"]
    return {
        "dataset_id": DATASET_ID,
        "metadata": {
            "title": TITLE, "source": SOURCE, "category": CATEGORY, "theme_color": THEME_COLOR,
            "date_start": steps[0]["iso_date"], "date_end": steps[-1]["iso_date"], "retrieved": retrieved,
            "bbox_lon_lat": [LON_W, LAT_S, LON_E, LAT_N], "what_you_will_try": WHAT_YOU_WILL_TRY,
            "channels": {
                "sst_*": "2 m air temperature (t_2m:C)",
                "current_velocity_norm": f"10 m wind speed (wind_speed_10m:ms) over {WIND_MAX_MS:g} m/s",
                "eddy_vorticity_norm": f"rain in the hour (precip_1h:mm) over {PRECIP_MAX_MM:g} mm",
                "spatial_grid": "[temperature, wind speed, wind direction]; direction is where the wind blows from (wind_dir_10m:d) over 360",
            },
        },
        "visual_assets": {"aspect_ratio": f"{COLS}:{ROWS}"},
        "calibration": {"temp_min_c": lo, "temp_max_c": hi, **CALIBRATION},
        "timeline": steps,
    }


def index_entry(doc):
    md = doc["metadata"]
    return {
        "dataset_id": doc["dataset_id"], "title": md["title"], "summary": SUMMARY, "category": md["category"], "theme_color": md["theme_color"],
        "duration_sec": round(len(doc["timeline"]) * STEP_SEC, 1), "date_range": f"{md['date_start'][:10]} to {md['date_end'][:10]}",
        "data_url": f"/data/json_output/{doc['dataset_id']}.json", "what_you_will_try": md["what_you_will_try"],
    }


def upsert_index(index_file, entry):
    """Adds the entry to index.json, or replaces the one with the same dataset_id, leaving every other entry as it is."""
    index = json.loads(index_file.read_text()) if index_file.is_file() else {"datasets": []}
    index["datasets"] = [d for d in index["datasets"] if d["dataset_id"] != entry["dataset_id"]] + [entry]
    index_file.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n")


def write(doc, folder):
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{doc['dataset_id']}.json").write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
    upsert_index(folder / "index.json", index_entry(doc))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--start", help="first UTC day, YYYY-MM-DD (default: two days ago, so all 48 hours are past)")
    p.add_argument("--out", type=Path, default=Path("public/data/json_output"))
    p.add_argument("--env", type=Path, default=Path(".env"))
    args = p.parse_args(argv)
    today = dt.datetime.now(dt.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    start = dt.datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc) if args.start else today - dt.timedelta(days=2)
    try:
        series = fetch_series(start, start + dt.timedelta(hours=HOURS - 1), load_credentials(args.env))
    except ApiError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    doc = build(series, retrieved=today.strftime("%Y-%m-%d"))
    write(doc, args.out)
    print(f"{doc['dataset_id']}: {len(doc['timeline'])} steps, {sum(1 for s in doc['timeline'] if s['echo_callout'])} callouts -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

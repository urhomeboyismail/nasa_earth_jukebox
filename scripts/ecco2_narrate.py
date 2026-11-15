"""EIC06 T3: add the text to the ECCO2 timelines and write public/data/json_output/index.json.

    python3 -I scripts/ecco2_narrate.py --dir public/data/json_output

Run after scripts/ecco2_extract.py. Every sentence is a template filled from that step's metrics,
so nothing is claimed that the numbers do not show. The per-region summaries and challenges below
were written by an agent: a person reviews them before merge (ADR-0005).
"""
import argparse
import json
from pathlib import Path

FPS = 30
# dataset_id -> (summary, what_you_will_try). Agent-written: 👤 reviews.
REGION_TEXT = {
    "ecco2_global_ocean": (
        "The world's ocean surface currents as streaks, coloured by sea surface temperature, from the ECCO2 model (2007–2008).",
        "Can you hear the year turn? Listen for the moment the whole ocean sounds warmest."),
    "ecco2_gulf_stream": (
        "The Gulf Stream off North America: warm water streaming north-east past cooler water, coloured by temperature (2007–2008).",
        "Can you hear the seasons change in the Gulf Stream without looking: when does the sound grow brightest?"),
    "ecco2_equatorial_pacific": (
        "The equatorial Pacific's warm surface water and currents, coloured by temperature (2007–2008).",
        "This region stays warm all year. Can you hear the small changes in brightness from step to step?"),
    "ecco2_indian_ocean_mauritius": (
        "Warm eddies and tropical surface currents in the south-west Indian Ocean around Mauritius, coloured by temperature (2007–2008).",
        "Can you hear when the water around Mauritius is warmest, and when the eddies swirl most, without looking at the map?"),
    "ecco2_antarctic_circumpolar": (
        "The cold, fast Antarctic Circumpolar Current circling the Southern Ocean, coloured by temperature (2007–2008).",
        "This is the coldest region. Can you hear how muffled it sounds next to the tropics, and when it is warmest?"),
    "ecco2_pacific_globe": (
        "The Pacific Ocean on a turning globe: surface currents coloured by temperature (2007–2008).",
        "The globe turns as it plays. Can you hear the sound change as warm equatorial water comes into view?"),
}
# The video's frame count (EIC06 T2): the global video decodes 2,001 frames, the globe 2,031.
FRAMES = {"ecco2_pacific_globe": 2031}
DEFAULT_FRAMES = 2001


def band(x, words):
    """Pick a word for a 0..1 value from len(words) equal bands."""
    return words[min(len(words) - 1, int(max(0.0, x) * len(words)))]


def smoothed(timeline, key, half=2):
    """Rolling median (5 steps) of a 0..1 metric. Velocity and vorticity come from one frame pair per step,
    so they jitter with the streak animation; the words and events follow the smoothed value."""
    vals = [s["metrics"][key] if s["metrics"] else None for s in timeline]
    out = []
    for i in range(len(vals)):
        win = sorted(v for v in vals[max(0, i - half):i + half + 1] if v is not None)
        out.append(win[len(win) // 2] if win else None)
    return out


def describe(step, vel=None, vort=None):
    """The accessibility text for one step, from its metrics (speed and eddies smoothed when given)."""
    m = step["metrics"]
    if m is None:
        return f"{step['display_date']}: no ocean is visible here at this moment, so the music rests."
    vel = m["current_velocity_norm"] if vel is None else vel
    vort = m["eddy_vorticity_norm"] if vort is None else vort
    warmth = band(m["sst_normalized"], ["very cold", "cold", "cool", "mild", "warm", "hot"])
    tone = band(m["sst_normalized"], ["deep, muffled", "deep, muffled", "soft", "clear", "bright", "bright, open"])
    speed = band(vel, ["slow", "steady", "brisk"])
    pulse = band(vel, ["slow", "steady", "quick"])
    eddies = band(vort, ["few swirling eddies", "some swirling eddies", "many swirling eddies"])
    return (f"{step['display_date']}: {warmth} surface water averaging {m['sst_celsius_mean']} degrees Celsius "
            f"(from {m['sst_celsius_min']} to {m['sst_celsius_max']}), with {speed} currents and {eddies}. "
            f"You hear {tone} tones and {pulse} pulses.")


EDGE = 2  # steps at each end never carry an event: the video's start and its held last frames skew the flow


def key_events(timeline):
    """step index -> callout kinds, for the moments worth Echo pausing the music for. Kinds on one step are merged."""
    vel, vort = smoothed(timeline, "current_velocity_norm"), smoothed(timeline, "eddy_vorticity_norm")
    inner = [i for i, s in enumerate(timeline) if s["metrics"] and EDGE <= i < len(timeline) - EDGE]
    if not inner:
        return {}
    mean = {i: timeline[i]["metrics"]["sst_celsius_mean"] for i in inner}
    picks = [("warmest", max(inner, key=mean.get)), ("coolest", min(inner, key=mean.get)),
             ("fastest", max(inner, key=lambda i: vel[i])), ("eddies", max(inner, key=lambda i: vort[i])),
             ("jump", max((i for i in inner if i - 1 in mean), key=lambda i: abs(mean[i] - mean[i - 1]), default=None))]
    first = next(i for i, s in enumerate(timeline) if s["metrics"])
    events = {timeline[first]["step"]: ["intro"]}
    for kind, i in picks:
        if i is not None:
            events.setdefault(timeline[i]["step"], []).append(kind)
    return events


def callout(kinds, step, prev, title):
    """One callout for a step: a date, then a short sentence per event kind on it."""
    m = step["metrics"]
    said = {
        "intro": f"{title}. Each streak is a surface current, coloured from blue at 0 to red at 32 degrees. Listen as the year unfolds.",
        "warmest": f"The warmest moment here, averaging {m['sst_celsius_mean']} degrees: the sound is at its brightest.",
        "coolest": f"The coolest moment here, averaging {m['sst_celsius_mean']} degrees: hear the tone turn muffled.",
        "fastest": "The streaks move fastest around now: the pulse quickens.",
        "eddies": "The most swirling eddies of the year around now: hear the sound swirl.",
        "jump": (f"The biggest change between two steps, "
                 f"{m['sst_celsius_mean'] - prev['metrics']['sst_celsius_mean']:+.1f} degrees." if prev and prev["metrics"] else ""),
    }
    intro = said["intro"] + " " if "intro" in kinds else ""
    rest = " ".join(said[k] for k in kinds if k != "intro" and said[k])
    return (intro + (f"{step['display_date']}: {rest}" if rest else "")).strip()


def narrate(doc):
    """Fill accessibility_text, echo_callout and what_you_will_try in one timeline document (in place)."""
    title, timeline = doc["metadata"]["title"], doc["timeline"]
    events = key_events(timeline)
    vel, vort = smoothed(timeline, "current_velocity_norm"), smoothed(timeline, "eddy_vorticity_norm")
    for i, step in enumerate(timeline):
        step["accessibility_text"] = describe(step, vel[i], vort[i])
        kinds = events.get(step["step"])
        step["echo_callout"] = callout(kinds, step, timeline[i - 1] if i else None, title) if kinds else None
    doc["metadata"]["what_you_will_try"] = REGION_TEXT[doc["dataset_id"]][1]
    return doc


def entry(doc):
    """One index.json entry (the brief's Step 2A)."""
    md, rid = doc["metadata"], doc["dataset_id"]
    return {
        "dataset_id": rid, "title": md["title"], "summary": REGION_TEXT[rid][0], "category": md["category"],
        "theme_color": md["theme_color"], "duration_sec": round(FRAMES.get(rid, DEFAULT_FRAMES) / FPS, 1),
        "date_range": f"{md['date_start'][:10]} to {md['date_end'][:10]}",
        "poster_url": doc["visual_assets"]["poster_url"], "data_url": f"/data/json_output/{rid}.json",
        "what_you_will_try": md["what_you_will_try"],
    }


def run(folder):
    datasets = []
    for rid in REGION_TEXT:
        path = folder / f"{rid}.json"
        if not path.is_file():
            continue
        doc = narrate(json.loads(path.read_text()))
        path.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
        datasets.append(entry(doc))
        calls = [s["echo_callout"] for s in doc["timeline"] if s["echo_callout"]]
        print(f"{rid}: {len(doc['timeline'])} texts, {len(calls)} callouts")
    (folder / "index.json").write_text(json.dumps({"datasets": datasets}, indent=2, ensure_ascii=False) + "\n")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--dir", type=Path, required=True, help="the json_output folder")
    run(p.parse_args(argv).dir)


if __name__ == "__main__":
    main()

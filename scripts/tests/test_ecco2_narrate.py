"""Tests for scripts/ecco2_narrate.py (EIC06 T3), on a made-up timeline."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ecco2_narrate as nr  # noqa: E402


def step(i, mean, vel=0.3, vort=0.3):
    return {"step": i, "display_date": f"Day {i}", "metrics": {
        "sst_celsius_mean": mean, "sst_celsius_min": mean - 2, "sst_celsius_max": mean + 2,
        "sst_normalized": mean / 32, "current_velocity_norm": vel, "eddy_vorticity_norm": vort}}


def doc():
    # inner steps (not the 2 at each end) are 2..8. Warmest and biggest jump: step 4. Coolest: step 2.
    # Fast run at 6, 7, 8: the 5-step median first reaches 0.9 at step 6. Eddies are flat, so the first inner step wins.
    means = [30.0, 20.0, 21.0, 22.0, 26.0, 25.0, 24.0, 23.0, 22.0, 22.0]
    tl = [step(i, m, vel=0.9 if i in (6, 7, 8) else 0.3) for i, m in enumerate(means)]
    tl.append({"step": 10, "display_date": "Day 10", "metrics": None})
    return {"dataset_id": "ecco2_gulf_stream", "metadata": {"title": "Gulf Stream", "category": "ocean", "theme_color": "#00ffcc",
                                                          "date_start": "2007-03-25T12:00Z", "date_end": "2008-03-03T07:52Z"},
            "visual_assets": {"poster_url": "/media/ecco2_gulf_stream_poster.jpg"}, "timeline": tl}


def test_band_covers_the_ends():
    assert nr.band(0.0, ["a", "b", "c"]) == "a"
    assert nr.band(1.0, ["a", "b", "c"]) == "c"
    assert nr.band(-0.2, ["a", "b"]) == "a"


def test_smoothing_drops_a_one_step_spike():
    tl = [step(i, 20.0, vel=v) for i, v in enumerate([0.3, 0.3, 1.0, 0.3, 0.3])]
    assert nr.smoothed(tl, "current_velocity_norm")[2] == 0.3


def test_describe_uses_only_the_step_numbers():
    text = nr.describe(step(0, 28.4, vel=0.9, vort=0.1))
    assert text.startswith("Day 0: hot surface water averaging 28.4 degrees Celsius (from 26.4 to 30.4)")
    assert "brisk currents" in text and "few swirling eddies" in text and "quick pulses" in text
    assert "music rests" in nr.describe({"display_date": "Day 9", "metrics": None})


def test_key_events_skip_the_edges_and_merge():
    ev = nr.key_events(doc()["timeline"])
    assert ev == {0: ["intro"], 4: ["warmest", "jump"], 2: ["coolest", "eddies"], 6: ["fastest"]}


def test_callouts_and_challenge():
    d = nr.narrate(doc())
    tl = d["timeline"]
    assert tl[0]["echo_callout"].startswith("Gulf Stream. Each streak")
    assert tl[6]["echo_callout"] == "Day 6: The streaks move fastest around now: the pulse quickens."
    assert tl[4]["echo_callout"].startswith("Day 4: The warmest moment here, averaging 26.0 degrees")
    assert tl[4]["echo_callout"].endswith("The biggest change between two steps, +4.0 degrees.")
    assert tl[10]["echo_callout"] is None and "music rests" in tl[10]["accessibility_text"]
    assert d["metadata"]["what_you_will_try"] == nr.REGION_TEXT["ecco2_gulf_stream"][1]


def test_index_entry():
    e = nr.entry(nr.narrate(doc()))
    assert e["date_range"] == "2007-03-25 to 2008-03-03"
    assert e["duration_sec"] == 66.7 and e["data_url"] == "/data/json_output/ecco2_gulf_stream.json"

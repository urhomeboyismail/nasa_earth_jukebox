"""Tests for scripts/ingest_meteomatics.py, on made-up API responses (nothing here touches the network)."""
import datetime as dt
import io
import json
import sys
import urllib.error
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ingest_meteomatics as mm  # noqa: E402

START = dt.datetime(2026, 11, 10, tzinfo=dt.timezone.utc)
LATS = [round(-20.6 + 0.1 * i, 4) for i in range(mm.ROWS)]  # south to north, as the API sends them
LONS = [round(57.2 + 0.7 * i / (mm.COLS - 1), 4) for i in range(mm.COLS)]


def hours():
    return [mm.iso_z(START + dt.timedelta(hours=h)) for h in range(mm.HOURS)]


def response(value_at):
    """A v3 response with value_at(hour index, lat index, lon index) at every point."""
    coords = [{"lat": lat, "lon": lon, "dates": [{"date": d, "value": value_at(h, r, c)} for h, d in enumerate(hours())]}
              for r, lat in enumerate(LATS) for c, lon in enumerate(LONS)]
    return {"version": "3.0", "status": "OK", "data": [{"parameter": "x", "coordinates": coords}]}


def series(temp=lambda h, r, c: 25.0 + 4 * (h % 24) / 24 + r * 0.1, rain=lambda h, r, c: 0.0,
           speed=lambda h, r, c: 6.0 + (h % 5), wdir=lambda h, r, c: 120.0):
    return {name: mm.parse_grid(response(fn)) for name, fn in [("temp", temp), ("rain", rain), ("speed", speed), ("dir", wdir)]}


def test_credentials_come_from_env_file_or_environment_and_the_error_never_names_a_value(tmp_path):
    env = tmp_path / ".env"
    env.write_text("# a comment\nMETEOMATICS_USERNAME=alice\nMETEOMATICS_PASSWORD='s3cret'\n")
    assert mm.load_credentials(env, environ={}) == ("alice", "s3cret")
    assert mm.load_credentials(env, environ={"METEOMATICS_USER": "bob", "METEOMATICS_PASSWORD": "pw"}) == ("alice", "pw")
    env.write_text("METEOMATICS_USER=carol\nMETEOMATICS_PASSWORD=pw\n")
    assert mm.load_credentials(env, environ={}) == ("carol", "pw")
    env.write_text("METEOMATICS_USERNAME=alice\n")
    with pytest.raises(mm.ApiError) as error:
        mm.load_credentials(env, environ={})
    assert "alice" not in str(error.value)


def test_the_request_path_is_hourly_over_the_box_as_a_16_by_8_grid():
    path = mm.grid_path(START, START + dt.timedelta(hours=47), "t_2m:C")
    assert path == "2026-11-10T00:00:00Z--2026-11-11T23:00:00Z:PT1H/t_2m:C/-19.9,57.2_-20.6,57.9:16x8/json"


def test_parse_grid_puts_north_at_row_0_and_west_at_column_0():
    first = mm.parse_grid(response(lambda h, r, c: r * 100 + c))[hours()[0]]
    assert (len(first), len(first[0])) == (mm.ROWS, mm.COLS)
    assert first[0][0] == 700  # the northern-most row is the API's last (r = 7), its western-most column is 0
    assert first[7][0] == 0 and first[0][15] == 715


def test_parse_grid_refuses_a_wrong_shape_a_missing_value_and_an_error_body():
    coords = response(lambda h, r, c: 1.0)["data"][0]["coordinates"]
    with pytest.raises(mm.ApiError, match="expected a 8 by 16 grid"):
        mm.parse_grid({"data": [{"coordinates": [p for p in coords if p["lon"] != LONS[-1]]}]})
    with pytest.raises(mm.ApiError, match="missing value"):
        mm.parse_grid(response(lambda h, r, c: None))
    with pytest.raises(mm.ApiError, match="no data"):
        mm.parse_grid({"status": "ERROR"})


def test_http_errors_become_api_errors_that_do_not_carry_the_credentials():
    def refuse(request, timeout):
        raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, io.BytesIO(b"not granted with this subscription type"))
    with pytest.raises(mm.ApiError) as error:
        mm.fetch_json("2100-07-15T00:00:00Z/t_2m:C/-20.2,57.5/json", ("alice", "s3cret"), opener=refuse)
    assert "403" in str(error.value) and "subscription" in str(error.value)
    assert "s3cret" not in str(error.value) and "alice" not in str(error.value)


def test_fetch_series_makes_one_request_a_parameter_with_basic_auth():
    asked = []

    def opener(request, timeout):
        asked.append(request.full_url)
        assert request.get_header("Authorization").startswith("Basic ")
        return io.BytesIO(json.dumps(response(lambda h, r, c: 1.0)).encode())
    got = mm.fetch_series(START, START + dt.timedelta(hours=47), ("u", "p"), opener=opener)
    assert sorted(got) == ["dir", "rain", "speed", "temp"]
    assert [u.split("/")[4] for u in asked] == ["t_2m:C", "precip_1h:mm", "wind_speed_10m:ms", "wind_dir_10m:d"]


def test_build_has_the_track_shape_with_no_video():
    doc = mm.build(series(), retrieved="2026-11-15")
    steps = doc["timeline"]
    assert doc["dataset_id"] == "meteomatics_mauritius_weather"
    assert "video_url" not in doc["visual_assets"] and "poster_url" not in doc["visual_assets"]
    assert doc["visual_assets"]["aspect_ratio"] == "16:8"
    assert [s["time_sec"] for s in steps[:3]] == [0.0, 0.5, 1.0] and len(steps) == 48
    assert steps[0]["iso_date"] == "2026-11-10T00:00Z" and steps[0]["display_date"] == "Nov 10, 00:00 UTC"
    assert all(len(s["spatial_grid"]) == 8 and len(s["spatial_grid"][0]) == 16 for s in steps)
    assert all(len(cell) == 3 and all(0 <= v <= 1 for v in cell) for s in steps for row in s["spatial_grid"] for cell in row)
    assert all(0 <= s["metrics"][k] <= 1 for s in steps for k in ("sst_normalized", "current_velocity_norm", "eddy_vorticity_norm", "intensity_marker"))
    assert all(-1 <= s["metrics"]["thermal_anomaly"] <= 1 for s in steps)
    assert all(s["accessibility_text"] and "extra" not in s for s in steps)


def test_calibration_brackets_the_data_and_a_cell_decodes_back_to_celsius():
    doc = mm.build(series(), retrieved="2026-11-15")
    cal = doc["calibration"]
    assert cal["temp_max_c"] - cal["temp_min_c"] >= 8
    step = doc["timeline"][5]
    decoded = cal["temp_min_c"] + step["spatial_grid"][7][0][0] * (cal["temp_max_c"] - cal["temp_min_c"])
    assert decoded == pytest.approx(25.0 + 4 * 5 / 24, abs=0.05)  # row 7 of the grid is the API's first, southern-most row


def test_wind_direction_is_stored_as_where_it_blows_from_over_360_and_averaged_as_vectors():
    doc = mm.build(series(wdir=lambda h, r, c: 90.0), retrieved="x")
    assert doc["timeline"][0]["spatial_grid"][0][0][2] == 0.25
    assert "from the east" in doc["timeline"][0]["accessibility_text"]
    around_north = mm.mean_from_degrees([5, 5], [350, 10])
    assert min(around_north, 360 - around_north) < 1e-6  # 350 and 10 make north, not south
    assert mm.compass(0) == "north" and mm.compass(135) == "south-east" and mm.compass(350) == "north"


def test_callouts_mark_the_intro_and_the_extremes_and_stay_few():
    temp = lambda h, r, c: 22.0 + (8.0 if h == 30 else 0.0) - (3.0 if h == 10 else 0.0)  # noqa: E731
    doc = mm.build(series(temp=temp, rain=lambda h, r, c: 2.5 if h == 40 else 0.0), retrieved="x")
    said = {s["step"]: s["echo_callout"] for s in doc["timeline"] if s["echo_callout"]}
    assert "Mauritius Weather" in said[0]
    assert "warmest" in said[30] and "coolest" in said[10] and "heaviest rain" in said[40]
    assert len(said) <= 8


def test_no_rain_means_no_rain_callout_and_the_words_say_so():
    doc = mm.build(series(), retrieved="x")
    assert not any("heaviest rain" in (s["echo_callout"] or "") for s in doc["timeline"])
    assert "no rain" in doc["timeline"][3]["accessibility_text"]


def test_the_index_entry_is_added_once_and_the_other_entries_are_kept(tmp_path):
    doc = mm.build(series(), retrieved="x")
    index = tmp_path / "index.json"
    index.write_text(json.dumps({"datasets": [{"dataset_id": "ecco2_gulf_stream", "title": "Gulf Stream"}]}))
    mm.write(doc, tmp_path)
    mm.write(doc, tmp_path)  # a second run replaces, never duplicates
    datasets = json.loads(index.read_text())["datasets"]
    assert [d["dataset_id"] for d in datasets] == ["ecco2_gulf_stream", "meteomatics_mauritius_weather"]
    entry = datasets[1]
    assert entry["category"] == "atmosphere" and entry["theme_color"] == "#00f0ff" and entry["duration_sec"] == 24.0
    assert "poster_url" not in entry and (tmp_path / "meteomatics_mauritius_weather.json").is_file()

"""Tests for scripts/convert_frames.py (T91), on tiny generated frames.

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt pytest
    .venv/bin/python -I -m pytest scripts/tests/test_convert_frames.py
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image, PngImagePlugin

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import convert_frames as cf  # noqa: E402

# A three-stop legend, blue to green to red, and a grey for land. Frames are 40 x 30: map on top, a colour bar in rows 24 to 27.
STOPS = [(0, (0, 0, 255)), (15, (0, 200, 0)), (30, (255, 0, 0))]
LAND = (128, 128, 128)
W, H = 40, 30
BAR = (4, 24, 35, 27)  # x0, y0, x1, y1, inclusive


def legend_rgb(values):
    xs = [v for v, _ in STOPS]
    return np.rint(np.stack([np.interp(values, xs, [c[k] for _, c in STOPS]) for k in range(3)], axis=-1)).astype(np.uint8)


def frame_pixels(level=10.0, bar_shift=0):
    """A map whose colour depends on `level`, land in the top-right corner, a black strip with the colour bar below it."""
    pixels = np.zeros((H, W, 3), dtype=np.uint8)
    pixels[:22] = legend_rgb(np.full((22, W), level))
    pixels[:8, 30:] = LAND
    x0, y0, x1, y1 = BAR
    pixels[y0:y1 + 1, x0:x1 + 1] = legend_rgb(np.linspace(0, 30, x1 - x0 + 1))[None, :, :]
    if bar_shift:
        pixels[y0:y1 + 1, x0:x1 + 1] = np.clip(pixels[y0:y1 + 1, x0:x1 + 1].astype(int) + bar_shift, 0, 255)
    return pixels


def save(folder, name, pixels, **options):
    folder.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(folder / name, **options)
    return folder / name


def write_legend(tmp_path, stops=STOPS):
    path = tmp_path / "legend.json"
    path.write_text(json.dumps([{"value": v, "rgb": list(c)} for v, c in stops]))
    return path


def run(tmp_path, frames, out="out", extra=()):
    argv = ["--id", "test-set", "--frames", str(frames), "--out", str(tmp_path / out), *extra]
    if not any(a in ("--legend", "--legend-values") for a in extra):
        argv += ["--legend", str(write_legend(tmp_path))]
    return cf.convert(cf.parse_args(argv))


def manifest(tmp_path, out="out"):
    return json.loads((tmp_path / out / "manifest.json").read_text())


def chunks(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, found = 8, []
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        found.append((kind.decode(), data[pos + 8:pos + 8 + length]))
        pos += 12 + length
    return found


@pytest.fixture
def three_frames(tmp_path):
    folder = tmp_path / "in"
    save(folder, "sst_2024-03-15.png", frame_pixels(25))
    save(folder, "sst_2024-01-15.png", frame_pixels(5))
    save(folder, "sst_20240215.png", frame_pixels(15))
    (folder / "README.txt").write_text("not a frame")
    return folder


# --- dates ---------------------------------------------------------------------------------------------------------


def test_reads_dates_from_names_and_sorts_them(tmp_path, three_frames):
    result = run(tmp_path, three_frames)
    m = manifest(tmp_path)
    assert [f["date"] for f in m["frames"]] == ["2024-01-15", "2024-02-15", "2024-03-15"]
    assert [f["id"] for f in m["frames"]] == ["2024-01-15", "2024-02-15", "2024-03-15"]
    assert [f["image"] for f in m["frames"]] == ["frames/2024-01-15.png", "frames/2024-02-15.png", "frames/2024-03-15.png"]
    assert sorted(p.name for p in (tmp_path / "out" / "frames").iterdir()) == ["2024-01-15.png", "2024-02-15.png", "2024-03-15.png"]
    assert result.ignored == ["README.txt"]
    # The January frame really is the January picture (the coolest), not just a renamed file.
    january = np.asarray(Image.open(tmp_path / "out" / "frames" / "2024-01-15.png"))
    assert tuple(january[15, 5]) == tuple(legend_rgb(np.array(5.0)))


def test_a_custom_date_pattern_with_year_only(tmp_path):
    folder = tmp_path / "in"
    save(folder, "minimum-1980.png", frame_pixels(5))
    save(folder, "minimum-1979.png", frame_pixels(9))
    run(tmp_path, folder, extra=["--date-pattern", r"minimum-(?P<year>\d{4})"])
    assert [f["date"] for f in manifest(tmp_path)["frames"]] == ["1979-01-01", "1980-01-01"]


def test_rejects_two_frames_with_the_same_date(tmp_path):
    folder = tmp_path / "in"
    save(folder, "2024-01-15.png", frame_pixels(5))
    save(folder, "copy_20240115.png", frame_pixels(6))
    with pytest.raises(cf.ConvertError, match="both have the date 2024-01-15"):
        run(tmp_path, folder)
    assert not (tmp_path / "out").exists()


def test_rejects_a_file_name_without_a_date_and_a_date_that_does_not_exist(tmp_path):
    folder = tmp_path / "in"
    save(folder, "2024-01-15.png", frame_pixels(5))
    save(folder, "frame_0001.png", frame_pixels(5))
    with pytest.raises(cf.ConvertError, match="no date found in 1 file name.*frame_0001.png"):
        run(tmp_path, folder)
    (folder / "frame_0001.png").unlink()
    save(folder, "2024-02-30.png", frame_pixels(5))
    with pytest.raises(cf.ConvertError, match="not a real date"):
        run(tmp_path, folder)


# --- sizes, scaling and the PNGs written -----------------------------------------------------------------------------


def test_rejects_frames_of_different_sizes(tmp_path):
    folder = tmp_path / "in"
    save(folder, "2024-01-15.png", frame_pixels(5))
    save(folder, "2024-02-15.png", frame_pixels(5)[:, :38])
    with pytest.raises(cf.ConvertError, match=r'"2024-02-15.png" is 38 x 30 pixels but "2024-01-15.png" is 40 x 30'):
        run(tmp_path, folder)


def test_nearest_neighbour_scaling_leaves_only_colours_from_the_frame(tmp_path):
    # Every pixel a legend stop or land, changing every pixel: any smoothing would make new colours.
    palette = np.array([c for _, c in STOPS] + [LAND], dtype=np.uint8)
    rng = np.random.default_rng(1)
    pixels = palette[rng.integers(0, len(palette), size=(H, W))]
    folder = tmp_path / "in"
    save(folder, "2024-01-15.png", pixels)
    result = run(tmp_path, folder, extra=["--max-width", "17"])
    out = np.asarray(Image.open(tmp_path / "out" / "frames" / "2024-01-15.png"))
    assert out.shape == (13, 17, 3)  # 30 * 17 / 40 = 12.75, rounded
    assert {tuple(c) for c in out.reshape(-1, 3)} <= {tuple(c) for c in palette}
    assert result.scaled_from == (40, 30)
    assert (manifest(tmp_path)["frames"][0]["width"], manifest(tmp_path)["frames"][0]["height"]) == (17, 13)


def test_frames_narrower_than_max_width_are_not_scaled(tmp_path, three_frames):
    result = run(tmp_path, three_frames, extra=["--max-width", "400"])
    assert result.scaled_from is None
    assert Image.open(tmp_path / "out" / "frames" / "2024-01-15.png").size == (W, H)


def test_written_pngs_are_8_bit_rgb_not_interlaced_without_colour_chunks(tmp_path):
    folder = tmp_path / "in"
    info = PngImagePlugin.PngInfo()
    info.add(b"gAMA", struct.pack(">I", 45455))
    info.add(b"cHRM", bytes(32))
    info.add(b"sRGB", b"\x00")
    info.add_text("Comment", "made by a test")
    save(folder, "2024-01-15.png", frame_pixels(5), pnginfo=info, icc_profile=b"\x00" * 128)  # Pillow stores any blob as iCCP
    rgba = np.dstack([frame_pixels(20), np.full((H, W), 255, dtype=np.uint8)])
    save(folder, "2024-02-15.png", rgba, interlace=1)  # RGBA, fully opaque, interlaced
    palette = Image.fromarray(frame_pixels(25)).convert("P", palette=Image.Palette.ADAPTIVE, colors=64)
    palette.save(folder / "2024-03-15.png")
    assert "iCCP" in [k for k, _ in chunks(folder / "2024-01-15.png")]  # the input really has the chunks

    run(tmp_path, folder)
    for path in sorted((tmp_path / "out" / "frames").glob("*.png")):
        found = chunks(path)
        kinds = [k for k, _ in found]
        assert kinds[0] == "IHDR" and kinds[-1] == "IEND"
        assert set(kinds) == {"IHDR", "IDAT", "IEND"}, path.name
        width, height, depth, colour_type, _, _, interlace = struct.unpack(">IIBBBBB", found[0][1])
        assert (width, height, depth, colour_type, interlace) == (W, H, 8, 2, 0), path.name
    # The pixels are the stored values, untouched by the gamma or profile the input claimed.
    out = np.asarray(Image.open(tmp_path / "out" / "frames" / "2024-01-15.png"))
    assert np.array_equal(out, frame_pixels(5))


def test_rejects_transparent_pixels(tmp_path):
    folder = tmp_path / "in"
    rgba = np.dstack([frame_pixels(5), np.full((H, W), 255, dtype=np.uint8)])
    rgba[0, 0, 3] = 128
    save(folder, "2024-01-15.png", rgba)
    with pytest.raises(cf.ConvertError, match="transparent pixels"):
        run(tmp_path, folder)


def test_running_twice_gives_identical_files(tmp_path, three_frames):
    run(tmp_path, three_frames, out="a", extra=["--map-area", "0,0,40,22", "--legend-box", ",".join(map(str, BAR))])
    run(tmp_path, three_frames, out="b", extra=["--map-area", "0,0,40,22", "--legend-box", ",".join(map(str, BAR))])
    files_a = sorted(p.relative_to(tmp_path / "a") for p in (tmp_path / "a").rglob("*") if p.is_file())
    files_b = sorted(p.relative_to(tmp_path / "b") for p in (tmp_path / "b").rglob("*") if p.is_file())
    assert files_a == files_b and len(files_a) == 4
    for rel in files_a:
        assert (tmp_path / "a" / rel).read_bytes() == (tmp_path / "b" / rel).read_bytes(), rel


def test_does_not_overwrite_a_manifest_without_force_and_removes_stale_frames_with_it(tmp_path, three_frames):
    run(tmp_path, three_frames)
    before = (tmp_path / "out" / "manifest.json").read_bytes()
    with pytest.raises(cf.ConvertError, match="already exists"):
        run(tmp_path, three_frames)
    (three_frames / "sst_2024-03-15.png").unlink()
    run(tmp_path, three_frames, extra=["--force"])
    assert sorted(p.name for p in (tmp_path / "out" / "frames").iterdir()) == ["2024-01-15.png", "2024-02-15.png"]
    assert (tmp_path / "out" / "manifest.json").read_bytes() != before


# --- the legend --------------------------------------------------------------------------------------------------------


def test_samples_a_horizontal_colour_bar_at_evenly_spaced_points(tmp_path, three_frames):
    run(tmp_path, three_frames, extra=["--legend-box", ",".join(map(str, BAR)), "--legend-values", "0,30", "--legend-steps", "4"])
    stops = manifest(tmp_path)["colorScale"]["stops"]
    assert [s["value"] for s in stops] == [0, 10, 20, 30]
    bar = legend_rgb(np.linspace(0, 30, BAR[2] - BAR[0] + 1))
    assert [s["rgb"] for s in stops] == [bar[i].tolist() for i in (0, 10, 21, 31)]


def test_samples_a_vertical_colour_bar_from_the_bottom_up(tmp_path):
    folder = tmp_path / "in"
    pixels = np.zeros((H, W, 3), dtype=np.uint8)
    pixels[:, :30] = legend_rgb(np.full((H, 30), 12.0))
    column = legend_rgb(np.linspace(30, 0, 21))  # top is high
    pixels[4:25, 34:37] = column[:, None, :]
    save(folder, "2024-01-15.png", pixels)
    run(tmp_path, folder, extra=["--legend-box", "34,4,36,24", "--legend-values", "0,30", "--legend-steps", "3"])
    stops = manifest(tmp_path)["colorScale"]["stops"]
    assert [s["value"] for s in stops] == [0, 15, 30]
    assert [s["rgb"] for s in stops] == [list(STOPS[0][1]), list(STOPS[1][1]), list(STOPS[2][1])]


def test_a_reversed_bar_still_gives_stops_in_order_of_value(tmp_path, three_frames):
    run(tmp_path, three_frames, extra=["--legend-box", ",".join(map(str, BAR)), "--legend-values", "30,0", "--legend-steps", "3"])
    stops = manifest(tmp_path)["colorScale"]["stops"]
    assert [s["value"] for s in stops] == [0, 15, 30]
    assert stops[0]["rgb"] == list(STOPS[2][1])  # the left end, now called 0


def test_rejects_a_colour_bar_that_changes_between_frames(tmp_path, three_frames):
    save(three_frames, "sst_2024-04-15.png", frame_pixels(20, bar_shift=10))
    with pytest.raises(cf.ConvertError, match=r'colour bar in "sst_2024-04-15.png" differs .* by 10 \(more than 3\)'):
        run(tmp_path, three_frames, extra=["--legend-box", ",".join(map(str, BAR))])
    assert not (tmp_path / "out").exists()  # nothing written


def test_accepts_a_colour_bar_within_3_per_channel(tmp_path, three_frames):
    save(three_frames, "sst_2024-04-15.png", frame_pixels(20, bar_shift=3))
    result = run(tmp_path, three_frames, extra=["--legend-box", ",".join(map(str, BAR))])
    assert result.legend_checked


def test_a_label_over_part_of_the_bar_does_not_change_the_sample(tmp_path, three_frames):
    pixels = frame_pixels(20)
    pixels[24, 10:14] = (255, 255, 255)  # one row of white text across a 4-row bar
    save(three_frames, "sst_2024-04-15.png", pixels)
    run(tmp_path, three_frames, extra=["--legend-box", ",".join(map(str, BAR))])


def test_rejects_a_flat_step_in_a_sampled_bar(tmp_path):
    folder = tmp_path / "in"
    pixels = frame_pixels(5)
    pixels[24:28, 4:36] = (0, 0, 255)
    save(folder, "2024-01-15.png", pixels)
    with pytest.raises(cf.ConvertError, match="same colour"):
        run(tmp_path, folder, extra=["--legend-box", ",".join(map(str, BAR)), "--legend-values", "0,30"])


def test_legend_json_stops_are_sorted_and_checked(tmp_path, three_frames):
    path = write_legend(tmp_path, [STOPS[2], STOPS[0], STOPS[1]])
    run(tmp_path, three_frames, extra=["--legend", str(path)])
    assert [s["value"] for s in manifest(tmp_path)["colorScale"]["stops"]] == [0, 15, 30]
    path.write_text(json.dumps({"stops": [{"value": 0, "rgb": [0, 0, 300]}, {"value": 1, "rgb": [0, 0, 0]}]}))
    with pytest.raises(cf.ConvertError, match='stop 0 needs "rgb"'):
        run(tmp_path, three_frames, out="o2", extra=["--legend", str(path)])


def test_needs_a_legend(tmp_path, three_frames):
    with pytest.raises(cf.ConvertError, match="give the legend"):
        cf.convert(cf.parse_args(["--id", "x", "--frames", str(three_frames), "--out", str(tmp_path / "o")]))


# --- the manifest and what is printed --------------------------------------------------------------------------------


def test_fills_the_manifest_from_the_template_and_leaves_the_todos(tmp_path, three_frames):
    result = run(tmp_path, three_frames, extra=["--map-area", "0,0,40,22"])
    m = manifest(tmp_path)
    template = json.loads(cf.TEMPLATE.read_text())
    assert m["id"] == "test-set"
    assert m["mapArea"] == {"x0": 0, "y0": 0, "x1": 1, "y1": 0.7333}  # 22 of 30 rows
    assert m["colorScale"]["stops"] == [{"value": v, "rgb": list(c)} for v, c in STOPS]
    assert m["colorScale"]["noData"] == template["colorScale"]["noData"]
    assert m["mapping"]["missingCue"] == {"type": "noise", "durationMs": 300}
    assert [c["note"] for c in m["mapping"]["categories"]] == ["C4", "E4", "G4", "C5", "E5"]
    assert [c["range"] for c in m["mapping"]["categories"]] == [[0, 6], [6, 12], [12, 18], [18, 24], [24, 30]]
    points = m["regions"][0]["points"]
    assert len(points) == 30
    assert all(0 <= p["x"] <= 1 and 0 <= p["y"] <= 0.7333 for p in points)
    assert len({(p["x"], p["y"]) for p in points}) == 30
    for field in ("title", "summary", "description", "variable.name", "variable.unit", "source.credit", "source.license",
                  "source.retrievedOn", "regions.0.name", "frames.2.altText"):
        assert field in result.todos
    assert "id" not in result.todos

    text = cf.report(cf.parse_args(["--id", "test-set", "--frames", "x", "--out", "public/data/test-set"]), result)
    assert "frames.*.altText (one per frame, 3 in all)" in text
    assert "  - source.credit" in text
    assert "Not checked: whether the colour bar is the same on every frame" in text
    assert "WARNING" not in text


def test_categories_follow_an_uneven_legend_span_without_gaps(tmp_path, three_frames):
    run(tmp_path, three_frames, extra=["--legend", str(write_legend(tmp_path, [(-2, (0, 0, 255)), (33, (255, 0, 0))]))])
    ranges = [c["range"] for c in manifest(tmp_path)["mapping"]["categories"]]
    assert ranges[0][0] == -2 and ranges[-1][1] == 33
    assert all(a[1] == b[0] for a, b in zip(ranges, ranges[1:]))


def test_map_area_as_fractions_and_bad_map_areas(tmp_path, three_frames):
    run(tmp_path, three_frames, extra=["--map-area", "0.1,0,0.9,0.8"])
    assert manifest(tmp_path)["mapArea"] == {"x0": 0.1, "y0": 0, "x1": 0.9, "y1": 0.8}
    with pytest.raises(cf.ConvertError, match="as pixels, must lie inside the 40 x 30 frame"):
        run(tmp_path, three_frames, out="o2", extra=["--map-area", "0,0,50,22"])
    with pytest.raises(cf.ConvertError, match="--map-area needs 4 numbers"):
        run(tmp_path, three_frames, out="o3", extra=["--map-area", "0,0,1"])


def test_warns_that_jpeg_gives_more_unreadable_points(tmp_path):
    folder = tmp_path / "in"
    save(folder, "2024-01-15.jpg", frame_pixels(5), quality=95)
    save(folder, "2024-02-15.png", frame_pixels(9))
    args = cf.parse_args(["--id", "test-set", "--frames", str(folder), "--out", str(tmp_path / "out"),
                          "--legend", str(write_legend(tmp_path))])
    result = cf.convert(args)
    assert result.jpeg_count == 1
    assert "WARNING: 1 of 2 frames are JPEG" in cf.report(args, result)
    assert set(k for k, _ in chunks(tmp_path / "out" / "frames" / "2024-01-15.png")) == {"IHDR", "IDAT", "IEND"}


def test_main_prints_a_readable_error_and_returns_1(tmp_path, capsys):
    code = cf.main(["--id", "test-set", "--frames", str(tmp_path / "missing"), "--out", str(tmp_path / "out"),
                    "--legend", str(write_legend(tmp_path))])
    assert code == 1
    assert "convert_frames.py: error: --frames" in capsys.readouterr().err

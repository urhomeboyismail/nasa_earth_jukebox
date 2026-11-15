"""Tests for scripts/eic_ingest.py (EIC01), on tiny generated frames (80 x 60: a map with a land patch and a colour bar).

    python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt pytest
    .venv/bin/python -I -m pytest scripts/tests/test_eic_ingest.py

Tests that need ffmpeg are skipped, with a message, on a machine that does not have it.
"""
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import eic_ingest as eic  # noqa: E402

W, H = 80, 60
BAR = (8, 50, 71, 55)  # the drawn bar (x0, y0, x1, y1, inclusive), with a grey border one pixel outside it
VERTICAL_BAR = (66, 8, 71, 51)
LAND = (128, 128, 128)

needs_ffmpeg = pytest.mark.skipif(shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None,
                                  reason="ffmpeg and ffprobe are not on the PATH")


def blue_to_red(count):
    t = np.linspace(0, 1, count)
    return np.rint(np.stack([255 * t, np.zeros(count), 255 * (1 - t)], axis=-1)).astype(np.uint8)


def map_colour(level):
    return tuple(int(v) for v in np.rint([255 * level, 40, 255 * (1 - level)]))


def draw_bar(pixels, box, vertical=False):
    x0, y0, x1, y1 = box
    pixels[y0 - 1:y1 + 2, x0 - 1:x1 + 2] = LAND  # the border
    if vertical:
        pixels[y0:y1 + 1, x0:x1 + 1] = blue_to_red(y1 - y0 + 1)[::-1][:, None, :]  # low (blue) at the bottom
    else:
        pixels[y0:y1 + 1, x0:x1 + 1] = blue_to_red(x1 - x0 + 1)[None, :, :]


def frame(level=0.3, vertical=False, bar=True):
    pixels = np.zeros((H, W, 3), dtype=np.uint8)
    right = 60 if vertical else W
    pixels[:48 if not vertical else H, :right] = map_colour(level)
    pixels[:10, 40:right] = LAND  # a land patch
    if bar:
        draw_bar(pixels, VERTICAL_BAR if vertical else BAR, vertical)
    return pixels


def save(folder, name, pixels):
    folder.mkdir(parents=True, exist_ok=True)
    Image.fromarray(pixels).save(folder / name)
    return folder / name


def frame_folder(tmp_path, count=4, names=None):
    folder = tmp_path / "in"
    for k in range(count):
        save(folder, names[k] if names else f"anim_{k:03d}.png", frame(0.2 + 0.1 * k))
    return folder


def make_mp4(tmp_path, count=6, fps=2):
    """A lossless-ish MP4 of the frames, made with ffmpeg."""
    folder = tmp_path / "seq"
    for k in range(count):
        save(folder, f"{k:03d}.png", frame(0.2 + 0.1 * k))
    target = tmp_path / "animation.mp4"
    subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-framerate", str(fps), "-i", str(folder / "%03d.png"),
                    "-c:v", "libx264", "-crf", "0", "-pix_fmt", "yuv444p", str(target)], check=True)
    return target


def ingest(tmp_path, *extra, out="out", source=None):
    """Run the script; returns (exit code, stdout, stderr)."""
    argv = ["--id", "test-set", "--out", str(tmp_path / out), *extra]
    if source is not None:
        argv += source
    import contextlib
    import io

    stdout, stderr = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        code = eic.main(argv)
    return code, stdout.getvalue(), stderr.getvalue()


LEGEND = ["--legend-min", "0", "--legend-max", "30"]
DATES = ["--start-date", "2024-01-01", "--step-days", "2"]


def manifest(tmp_path, out="out"):
    return json.loads((tmp_path / out / "manifest.json").read_text())


def chunk_names(path):
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, names = 8, []
    while pos < len(data):
        length, kind = struct.unpack(">I4s", data[pos:pos + 8])
        names.append(kind.decode())
        pos += 12 + length
    return names


# --- finding the colour bar ----------------------------------------------------------------------------------------


def test_finds_a_horizontal_bar_within_a_pixel_and_a_map_area_above_it():
    box = eic.detect_colour_bar(frame())
    assert box is not None
    assert all(abs(found - drawn) <= 1 for found, drawn in zip(box, BAR))
    assert eic.orientation_of(box) == "horizontal"
    x0, y0, x1, y1 = eic.map_area_for_bar(box, W, H)
    assert (x0, y0, x1) == (0, 0, W) and y1 < BAR[1]


def test_finds_a_vertical_bar_on_the_right_and_a_map_area_left_of_it():
    box = eic.detect_colour_bar(frame(vertical=True))
    assert box is not None
    assert all(abs(found - drawn) <= 1 for found, drawn in zip(box, VERTICAL_BAR))
    assert eic.orientation_of(box) == "vertical"
    x0, y0, x1, y1 = eic.map_area_for_bar(box, W, H)
    assert (x0, y0, y1) == (0, 0, H) and x1 < VERTICAL_BAR[0]


def test_a_bar_at_the_top_starts_the_map_below_it():
    assert eic.map_area_for_bar((9, 3, 70, 6), W, H) == (0, 8, W, H)


def test_a_flat_patch_of_map_is_not_a_colour_bar():
    assert eic.detect_colour_bar(frame(bar=False)) is None


def test_no_bar_gives_the_readable_message(tmp_path):
    save(tmp_path / "in", "2024-01-01.png", frame(bar=False))
    code, _, err = ingest(tmp_path, *LEGEND, source=["--frames", str(tmp_path / "in"), "--detect-only"])
    assert code == 1
    assert "No colour bar found. Give --legend-box x0,y0,x1,y1" in err


def test_the_orientation_is_the_one_convert_frames_uses():
    import convert_frames as cf

    pixels = frame()
    box = eic.detect_colour_bar(pixels)
    profile = cf.bar_profile(pixels, box)
    assert eic.orientation_of(box) == "horizontal"
    assert profile[0][2] > profile[0][0] and profile[-1][0] > profile[-1][2]  # blue first (low), red last (high)


# --- the arguments -------------------------------------------------------------------------------------------------


def test_both_video_and_frames_is_refused(tmp_path):
    with pytest.raises(SystemExit):  # argparse refuses two sources
        eic.parse_args(["--id", "x", "--video", "a.mp4", "--frames", "dir"])


def test_neither_video_nor_frames_stops(tmp_path):
    code, _, err = ingest(tmp_path, *LEGEND)
    assert code == 1 and "exactly one of --video" in err


def test_missing_legend_values_stop_with_a_message(tmp_path):
    folder = frame_folder(tmp_path)
    code, _, err = ingest(tmp_path, *DATES, source=["--frames", str(folder)])
    assert code == 1 and "give --legend-min and --legend-max" in err
    assert not (tmp_path / "out").exists()


def test_an_invalid_id_stops(tmp_path, capsys):
    folder = frame_folder(tmp_path)
    code = eic.main(["--id", "Bad_Id", "--frames", str(folder), "--out", str(tmp_path / "out"), *LEGEND, *DATES])
    assert code == 1
    assert capsys.readouterr().err.count("use lower-case letters") == 1
    assert not (tmp_path / "out").exists()


def test_a_start_date_needs_a_step_and_a_video_needs_dates(tmp_path):
    folder = frame_folder(tmp_path)
    code, _, err = ingest(tmp_path, *LEGEND, "--start-date", "2024-01-01", source=["--frames", str(folder)])
    assert code == 1 and "go together" in err
    video = tmp_path / "a.mp4"
    video.write_bytes(b"not a video")
    code, _, err = ingest(tmp_path, *LEGEND, source=["--video", str(video)])
    assert code == 1 and "--start-date and --step-days" in err


# --- dates ---------------------------------------------------------------------------------------------------------


def test_start_date_and_step_give_start_plus_k_times_step(tmp_path):
    folder = frame_folder(tmp_path)
    code, out, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 0, err
    m = manifest(tmp_path)
    assert [f["date"] for f in m["frames"]] == ["2024-01-01", "2024-01-03", "2024-01-05", "2024-01-07"]
    assert m["video"]["firstFrameDate"] == "2024-01-01" and m["video"]["frameStepDays"] == 2


def test_dates_come_from_the_file_names_by_default(tmp_path):
    folder = frame_folder(tmp_path, names=[f"sst_2024-01-{d}.png" for d in ("10", "11", "12", "13")])
    code, _, err = ingest(tmp_path, *LEGEND, source=["--frames", str(folder)])
    assert code == 0, err
    m = manifest(tmp_path)
    assert [f["date"] for f in m["frames"]][0] == "2024-01-10" and m["video"]["frameStepDays"] == 1


def write_csv(tmp_path, rows):
    path = tmp_path / "dates.csv"
    path.write_text("file,date\n" + "".join(f"{f},{d}\n" for f, d in rows))
    return path


def test_dates_from_a_csv_work_when_regular(tmp_path):
    folder = frame_folder(tmp_path, count=3)
    csv_path = write_csv(tmp_path, [("anim_000.png", "2024-02-01"), ("anim_001.png", "2024-02-08"), ("anim_002.png", "2024-02-15")])
    code, _, err = ingest(tmp_path, *LEGEND, "--dates", str(csv_path), source=["--frames", str(folder)])
    assert code == 0, err
    assert manifest(tmp_path)["video"]["frameStepDays"] == 7


def test_irregular_dates_stop_with_the_regular_dates_message(tmp_path):
    folder = frame_folder(tmp_path, count=3)
    csv_path = write_csv(tmp_path, [("anim_000.png", "2024-01-31"), ("anim_001.png", "2024-02-29"), ("anim_002.png", "2024-03-31")])
    code, _, err = ingest(tmp_path, *LEGEND, "--dates", str(csv_path), source=["--frames", str(folder)])
    assert code == 1
    assert "The video needs dates a regular number of days apart. Use --start-date and --step-days." in err
    assert not (tmp_path / "out").exists()


def test_two_frames_with_one_date_stop(tmp_path):
    folder = frame_folder(tmp_path, count=2)
    csv_path = write_csv(tmp_path, [("anim_000.png", "2024-02-01"), ("anim_001.png", "2024-02-01")])
    code, _, err = ingest(tmp_path, *LEGEND, "--dates", str(csv_path), source=["--frames", str(folder)])
    assert code == 1 and "both have the date 2024-02-01" in err and "keep one frame per date" in err


# --- what is written -----------------------------------------------------------------------------------------------


def test_detect_only_writes_nothing(tmp_path):
    folder = frame_folder(tmp_path)
    code, out, err = ingest(tmp_path, "--detect-only", source=["--frames", str(folder)])
    assert code == 0, err
    assert "horizontal" in out and "Map area" in out and "Stops it would sample" in out and "Nothing was written" in out
    assert not (tmp_path / "out").exists()


@needs_ffmpeg
def test_frames_are_8_bit_rgb_pngs_without_colour_profile_chunks(tmp_path):
    folder = frame_folder(tmp_path)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 0, err
    for path in sorted((tmp_path / "out" / "frames").glob("*.png")):
        assert not {"iCCP", "gAMA", "sRGB", "cHRM", "sBIT"} & set(chunk_names(path))
        with Image.open(path) as image:
            assert image.mode == "RGB"


@needs_ffmpeg
def test_the_title_and_source_stay_todo_and_the_report_lists_them(tmp_path):
    folder = frame_folder(tmp_path)
    code, out, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 0, err
    m = manifest(tmp_path)
    assert "TODO" in m["title"] and "TODO" in json.dumps(m["source"])
    assert "Still to fill in" in out and "title" in out and "npm run check-data" in out
    assert "Video:" in out and "Colour bar (found)" in out


@needs_ffmpeg
def test_the_manifest_gets_the_legend_and_sonification_fields_when_asked(tmp_path):
    folder = frame_folder(tmp_path)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, "--legend", "picture", "--preset", "dorian", "--detail", "calm",
                          source=["--frames", str(folder)])
    assert code == 0, err
    m = manifest(tmp_path)
    assert m["legend"] == "picture" and m["sonification"] == {"preset": "dorian", "detail": "calm"}
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, "--detail", "calm", out="other", source=["--frames", str(folder)])
    assert code == 1 and "--detail needs --preset" in err


@needs_ffmpeg
def test_the_legend_is_sampled_from_the_bar_in_the_right_direction(tmp_path):
    folder = frame_folder(tmp_path)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 0, err
    stops = manifest(tmp_path)["colorScale"]["stops"]
    assert stops[0]["value"] == 0 and stops[-1]["value"] == 30
    assert stops[0]["rgb"][2] > stops[0]["rgb"][0] and stops[-1]["rgb"][0] > stops[-1]["rgb"][2]  # blue at the low end, red at the high


@needs_ffmpeg
def test_a_vertical_bar_is_read_with_the_low_end_at_the_bottom(tmp_path):
    folder = tmp_path / "in"
    for k in range(3):
        save(folder, f"anim_{k}.png", frame(0.2 + 0.1 * k, vertical=True))
    code, out, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 0, err
    assert "vertical" in out
    stops = manifest(tmp_path)["colorScale"]["stops"]
    assert stops[0]["rgb"][2] > stops[0]["rgb"][0]


# --- the video path ------------------------------------------------------------------------------------------------


@needs_ffmpeg
def test_a_video_keeps_every_nth_frame_and_writes_a_web_video(tmp_path):
    mp4 = make_mp4(tmp_path, count=6, fps=2)
    code, out, err = ingest(tmp_path, *LEGEND, *DATES, "--every", "2", source=["--video", str(mp4)])
    assert code == 0, err
    m = manifest(tmp_path)
    assert [f["date"] for f in m["frames"]] == ["2024-01-01", "2024-01-05", "2024-01-09"]  # frames 0, 2 and 4 of 6
    assert m["video"] == {"src": "video/test-set.mp4", "fps": 2, "firstFrameDate": "2024-01-01", "frameStepDays": 2}
    video = tmp_path / "out" / "video" / "test-set.mp4"
    assert video.is_file()
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt,nb_frames",
                            "-of", "json", str(video)], capture_output=True, text=True, check=True)
    stream = json.loads(probe.stdout)["streams"][0]
    assert stream["codec_name"] == "h264" and stream["pix_fmt"] == "yuv420p"
    assert int(stream["nb_frames"]) == 6  # the video keeps every frame, whatever --every says


@needs_ffmpeg
def test_fps_can_be_given(tmp_path):
    mp4 = make_mp4(tmp_path, count=4, fps=2)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, "--fps", "1", source=["--video", str(mp4)])
    assert code == 0, err
    assert manifest(tmp_path)["video"]["fps"] == 1


@needs_ffmpeg
def test_a_video_run_twice_gives_the_same_manifest_and_frames(tmp_path):
    mp4 = make_mp4(tmp_path, count=4)
    for out in ("one", "two"):
        code, _, err = ingest(tmp_path, *LEGEND, *DATES, out=out, source=["--video", str(mp4)])
        assert code == 0, err
    assert (tmp_path / "one" / "manifest.json").read_bytes() == (tmp_path / "two" / "manifest.json").read_bytes()
    names = sorted(p.name for p in (tmp_path / "one" / "frames").iterdir())
    assert names == sorted(p.name for p in (tmp_path / "two" / "frames").iterdir())
    for name in names:
        assert (tmp_path / "one" / "frames" / name).read_bytes() == (tmp_path / "two" / "frames" / name).read_bytes()


@needs_ffmpeg
def test_an_existing_manifest_is_not_overwritten_without_force(tmp_path):
    folder = frame_folder(tmp_path)
    assert ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])[0] == 0
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 1 and "--force" in err
    assert ingest(tmp_path, *LEGEND, *DATES, "--force", source=["--frames", str(folder)])[0] == 0


def test_a_missing_ffmpeg_says_how_to_get_it(tmp_path, monkeypatch):
    folder = frame_folder(tmp_path)
    monkeypatch.setattr(eic.shutil, "which", lambda name: None)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, source=["--frames", str(folder)])
    assert code == 1 and "Install ffmpeg, which provides ffmpeg and ffprobe, then run this again." in err
    assert not (tmp_path / "out").exists()


# --- a colour bar in its own picture (--legend-image) --------------------------------------------------------------


def bar_image(tmp_path):
    """A 50 x 12 picture holding only a blue-to-red bar at x 4..44, y 3..8, so its colour at each pixel is known."""
    pixels = np.full((12, 50, 3), 255, dtype=np.uint8)
    pixels[3:9, 4:45] = blue_to_red(41)[None, :, :]
    return save(tmp_path / "legend", "bar.png", pixels)


def bar_folder(tmp_path):
    folder = tmp_path / "in"
    for k in range(3):
        save(folder, f"anim_{k}.png", frame(0.2 + 0.1 * k, bar=False))
    return folder


LEGEND_IMAGE_BOX = ["--legend-box", "4,3,44,8"]
WHOLE_MAP = ["--map-area", "0,0,80,48"]


@needs_ffmpeg
def test_the_legend_is_sampled_from_the_legend_image_when_the_frames_have_no_bar(tmp_path):
    folder, image = bar_folder(tmp_path), bar_image(tmp_path)
    code, out, err = ingest(tmp_path, *LEGEND, *DATES, "--legend-ticks", "5", "--legend-image", str(image), *LEGEND_IMAGE_BOX,
                            *WHOLE_MAP, source=["--frames", str(folder)])
    assert code == 0, err
    colours = blue_to_red(41)
    expected = [{"value": v, "rgb": colours[p].tolist()} for v, p in ((0, 0), (7.5, 10), (15, 20), (22.5, 30), (30, 40))]
    assert manifest(tmp_path)["colorScale"]["stops"] == expected
    assert "Colour bar (from --legend-image)" in out
    code, out, err = ingest(tmp_path, "--detect-only", "--legend-image", str(image), *LEGEND_IMAGE_BOX, *WHOLE_MAP,
                            out="detect", source=["--frames", str(folder)])
    assert code == 0, err
    assert "Colour bar (from --legend-image)" in out and not (tmp_path / "detect").exists()


def test_a_legend_image_needs_a_map_area(tmp_path):
    folder, image = bar_folder(tmp_path), bar_image(tmp_path)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, "--legend-image", str(image), *LEGEND_IMAGE_BOX, source=["--frames", str(folder)])
    assert code == 1 and "--legend-image needs --map-area" in err
    assert not (tmp_path / "out").exists()


def test_a_legend_image_needs_a_legend_box(tmp_path):
    folder, image = bar_folder(tmp_path), bar_image(tmp_path)
    code, _, err = ingest(tmp_path, *LEGEND, *DATES, "--legend-image", str(image), *WHOLE_MAP, source=["--frames", str(folder)])
    assert code == 1 and "--legend-image needs --legend-box" in err
    assert not (tmp_path / "out").exists()

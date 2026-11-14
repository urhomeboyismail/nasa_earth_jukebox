"""Tests for scripts/consume.py (EIC04): staging, .vtt captions to story chapters, and emptying Consumption/.

    .venv/bin/python -I -m pytest scripts/tests/test_consume.py

The end-to-end tests need ffmpeg and are skipped, with a message, without it.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import consume as c  # noqa: E402
from test_eic_ingest import make_mp4, needs_ffmpeg  # noqa: E402

VTT = """WEBVTT

NOTE made by hand

1
00:00:00.000 --> 00:00:01.000 align:start
Atmospheric rivers carry
<i>water vapour</i> inland.

intro-2
00:00:01.000 --> 00:00:02.600
Then they reach the coast.
"""


def manifest(dates=("2024-01-01", "2024-01-03", "2024-01-05"), fps=2, step=1, story=None):
    m = {"frames": [{"id": d, "date": d} for d in dates], "video": {"fps": fps, "firstFrameDate": dates[0], "frameStepDays": step}}
    return {**m, "story": story} if story is not None else m


def test_new_makes_the_folder_and_an_ingest_json_with_todos(tmp_path):
    folder = c.new_item("Atmosphere/SVS/Rehearsal_4960", root=tmp_path)
    assert folder == tmp_path / "Atmosphere" / "SVS" / "Rehearsal_4960"
    config = json.loads((folder / "ingest.json").read_text())
    assert config["id"] == "rehearsal-4960"
    assert set(config["args"].values()) == {"TODO"}


@pytest.mark.parametrize("bad", ["Atmosphere/SVS", "a/b/c/d", "../x/y", "a/b/c d"])
def test_new_refuses_a_path_that_is_not_three_plain_parts(tmp_path, bad):
    with pytest.raises(c.ConsumeError):
        c.new_item(bad, root=tmp_path)


def test_new_does_not_overwrite_an_ingest_json(tmp_path):
    c.new_item("A/B/c", root=tmp_path)
    with pytest.raises(c.ConsumeError, match="already exists"):
        c.new_item("A/B/c", root=tmp_path)


def test_vtt_cues_keep_multi_line_text_and_drop_ids_notes_tags_and_settings():
    assert c.parse_vtt(VTT) == [c.Cue(0.0, 1.0, "Atmospheric rivers carry water vapour inland."),
                                c.Cue(1.0, 2.6, "Then they reach the coast.")]


def test_vtt_without_header_or_with_a_bad_time_is_refused():
    with pytest.raises(c.ConsumeError, match="WEBVTT"):
        c.parse_vtt("00:00:00.000 --> 00:00:01.000\nhi")
    with pytest.raises(c.ConsumeError, match="cue 1"):
        c.parse_vtt("WEBVTT\n\n0:0:1 --> 00:00:02.000\nhi")


@pytest.mark.parametrize("cues, message", [
    ([c.Cue(1, 1, "a")], "cue 1.*not before its end"),
    ([c.Cue(0, 1, "a"), c.Cue(0.5, 2, "b")], "cue 2.*before cue 1 ends"),
    ([c.Cue(2, 3, "a"), c.Cue(0, 1, "b")], "cue 2.*before cue 1 ends"),
    ([c.Cue(0, 4, "a")], "cue 1.*after the video ends"),
])
def test_misaligned_cues_name_the_cue(cues, message):
    with pytest.raises(c.ConsumeError, match=message):
        c.check_cues(cues, duration=3.0)


def test_a_cue_maps_to_the_latest_dated_frame_at_or_before_it():
    m = manifest()  # 2 fps, one day a video frame: second 1.0 is video frame 2, 2024-01-03
    assert c.frame_at(0.0, m) == "2024-01-01"
    assert c.frame_at(0.9, m) == "2024-01-01"
    assert c.frame_at(1.0, m) == "2024-01-03"
    assert c.frame_at(1.9, m) == "2024-01-03"
    assert c.frame_at(2.5, m) == "2024-01-05"


def test_captions_replace_old_caption_chapters_and_keep_hand_written_ones():
    hand = {"id": "why", "title": "Why", "text": "Written by hand.", "fromFrame": "2024-01-01", "toFrame": "2024-01-05"}
    old = {"id": "caption-9", "title": "Old", "text": "Old.", "fromFrame": "2024-01-01", "toFrame": "2024-01-01"}
    story = c.add_captions(manifest(story=[hand, old]), c.parse_vtt(VTT))["story"]
    assert [ch["id"] for ch in story] == ["why", "caption-1", "caption-2"]
    assert story[1] == {"id": "caption-1", "title": "Atmospheric rivers carry water vapour inland.",
                        "text": "Atmospheric rivers carry water vapour inland.", "fromFrame": "2024-01-01", "toFrame": "2024-01-01"}
    assert (story[2]["fromFrame"], story[2]["toFrame"]) == ("2024-01-03", "2024-01-05")


def test_an_ingest_json_with_todos_left_is_refused(tmp_path):
    folder = c.new_item("A/B/c", root=tmp_path)
    with pytest.raises(c.ConsumeError, match="fill in start-date"):
        c.ingest_argv(folder, folder / "v.mp4", tmp_path / "out")


def test_ingest_json_args_become_eic_ingest_flags(tmp_path):
    folder = tmp_path / "item"
    folder.mkdir()
    (folder / "ingest.json").write_text(json.dumps({"id": "x", "args": {"step-days": 1, "force": True, "legend": False}}))
    item_id, argv = c.ingest_argv(folder, folder / "v.mp4", tmp_path / "out")
    assert item_id == "x"
    assert argv == ["--id", "x", "--video", str(folder / "v.mp4"), "--out", str(tmp_path / "out" / "x"), "--step-days", "1", "--force"]


def test_clean_keeps_the_readme_and_removes_everything_else(tmp_path):
    root = tmp_path / "Consumption"
    c.new_item("A/B/c", root=root)
    (root / "README.md").write_text("keep")
    (root / "loose.mp4").write_bytes(b"")
    assert c.clean(root, repo=tmp_path) == 2
    assert [p.name for p in root.iterdir()] == ["README.md"]


def test_clean_refuses_a_link_or_a_folder_outside_the_repository(tmp_path):
    target = tmp_path / "elsewhere"
    target.mkdir()
    (target / "precious").write_text("x")
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "Consumption").symlink_to(target)
    with pytest.raises(c.ConsumeError):
        c.clean(repo / "Consumption", repo=repo)
    with pytest.raises(c.ConsumeError):
        c.clean(target, repo=repo)
    assert (target / "precious").exists()


def staged_item(tmp_path, item_id, vtt):
    folder = c.new_item(f"Atmosphere/SVS/{item_id}", root=tmp_path / "Consumption")
    make_mp4(folder, count=6, fps=2)  # 3 seconds, 6 video frames
    (folder / "captions.vtt").write_text(vtt)
    (folder / "ingest.json").write_text(json.dumps({"id": item_id, "args": {
        "start-date": "2024-01-01", "step-days": 1, "legend-min": 0, "legend-max": 30}}))
    return folder


@needs_ffmpeg
def test_parse_turns_a_staged_video_and_captions_into_a_data_set_with_story_chapters(tmp_path):
    folder = staged_item(tmp_path, "rehearsal-test", VTT)
    assert c.parse_item(folder, out_root=tmp_path / "data") == "rehearsal-test"
    m = json.loads((tmp_path / "data" / "rehearsal-test" / "manifest.json").read_text())
    assert m["video"]["src"] == "video/rehearsal-test.mp4"
    assert [(ch["id"], ch["fromFrame"], ch["toFrame"]) for ch in m["story"]] == [
        ("caption-1", "2024-01-01", "2024-01-02"), ("caption-2", "2024-01-03", "2024-01-06")]


@needs_ffmpeg
def test_parse_writes_nothing_when_a_cue_runs_past_the_video(tmp_path):
    folder = staged_item(tmp_path, "rehearsal-late", "WEBVTT\n\n00:00:02.000 --> 00:00:09.000\nToo late.\n")
    with pytest.raises(c.ConsumeError, match="cue 1.*after the video ends"):
        c.parse_item(folder, out_root=tmp_path / "data")
    assert not (tmp_path / "data").exists()

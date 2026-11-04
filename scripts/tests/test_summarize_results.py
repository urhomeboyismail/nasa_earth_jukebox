"""Run with the server's pytest:  server/.venv/bin/python -m pytest scripts/tests"""
import csv
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import summarize_results as sr  # noqa: E402

COLUMNS = ["session_id", "started_at", "participant", "screen_reader", "saw_images", "comparison_id", "answer", "correct", "response_ms", "confidence", "comment"]


def write(tmp_path, rows):
    path = tmp_path / "results.csv"
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(COLUMNS)
        writer.writerows(rows)
    return path


def row(session, group, comparison, correct, ms, confidence=""):
    return [session, "2026-11-14T09:00:00+00:00", group, 0, 0, comparison, "a", int(correct), ms, confidence, ""]


def test_counts_median_and_confidence(tmp_path):
    path = write(tmp_path, [
        row("s1", "sighted", "c1", True, 1000, 4),
        row("s2", "sighted", "c1", False, 3000, 2),
        row("s3", "sighted", "c1", True, 5000),
        row("s4", "sighted", "c1", True, 9000, 5),
    ])
    answers, sessions = sr.read_answers(path)
    stats = sr.summarise(answers)
    assert (sessions, stats.answered, stats.correct) == (4, 4, 3)
    assert stats.median_ms == 4000  # even count: the mean of the two middle values
    assert stats.mean_confidence == pytest.approx(11 / 3)  # only the three ratings given
    assert stats.confidence_count == 3
    assert stats.percent == 75


def test_no_confidence_ratings_is_not_zero(tmp_path):
    answers, _ = sr.read_answers(write(tmp_path, [row("s1", "sighted", "c1", True, 2000)]))
    stats = sr.summarise(answers)
    assert stats.mean_confidence is None
    assert "no confidence ratings" in sr.describe(stats)


def test_a_session_with_no_answers_is_counted_but_adds_no_answers(tmp_path):
    path = write(tmp_path, [row("s1", "sighted", "c1", True, 2000), ["s2", "t", "not_said", 0, 0, "", "", "", "", "", ""]])
    answers, sessions = sr.read_answers(path)
    assert (len(answers), sessions) == (1, 2)
    assert "1 session has no answers" in sr.report(answers, sessions)


def test_split_by_group_and_comparison(tmp_path):
    path = write(tmp_path, [
        row("s1", "blind_low_vision", "c1", True, 1000),
        row("s1", "blind_low_vision", "c2", True, 1000),
        row("s2", "sighted", "c1", False, 1000),
        row("s2", "sighted", "c2", True, 1000),
    ])
    text = sr.report(*sr.read_answers(path))
    assert "All groups: 3 of 4 correct (75%)" in text
    assert "Blind or low vision: 2 of 2 correct (100%)" in text
    assert "Sighted: 1 of 2 correct (50%)" in text
    c1 = text.split("\nc1\n")[1].split("\n\n")[0]
    assert "All groups: 1 of 2 correct (50%)" in c1


def test_comparisons_keep_the_order_they_were_answered(tmp_path):
    answers, _ = sr.read_answers(write(tmp_path, [row("s1", "sighted", "zeta", True, 1), row("s1", "sighted", "alpha", True, 1)]))
    assert sr.comparisons_in_order(answers) == ["zeta", "alpha"]


def test_small_samples_are_shown_with_their_size(tmp_path):
    text = sr.report(*sr.read_answers(write(tmp_path, [row("s1", "sighted", "c1", True, 1000)])))
    assert "1 of 1 correct (100%)" in text
    assert "small" in text


def test_no_answers_at_all(tmp_path):
    answers, sessions = sr.read_answers(write(tmp_path, []))
    assert "No answers yet." in sr.report(answers, sessions)


def test_the_sample_file_runs(capsys):
    sample = Path(__file__).resolve().parents[1] / "fixtures" / "sample_results.csv"
    assert sr.main([str(sample)]) == 0
    out = capsys.readouterr().out
    assert "30 answers from 11 sessions" in out and "january-vs-june" in out


def test_chart_is_written(tmp_path):
    pytest.importorskip("matplotlib")
    sample = Path(__file__).resolve().parents[1] / "fixtures" / "sample_results.csv"
    out = tmp_path / "chart.png"
    assert sr.main([str(sample), "--chart", str(out)]) == 0
    assert out.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"

"""Tests for scripts/ecco2_extract.py (EIC06 T1): the parts that need no video.

    .venv/bin/python -I -m pytest scripts/tests/test_ecco2_extract.py
"""
import sys
from pathlib import Path

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2", reason="ecco2_extract needs opencv-python-headless")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ecco2_extract as ex  # noqa: E402


def test_crop_box_matches_the_brief_for_mauritius():
    assert ex.crop_box((30, -40, 85, -5)) == [0.5833, 0.5278, 0.1528, 0.1944]
    assert ex.crop_box(None) == [0.0, 0.0, 1.0, 1.0]
    assert ex.pixel_box(ex.crop_box((-180, -90, 180, 90)), 2048, 1024) == (0, 0, 2048, 1024)


def test_lut_reads_a_made_up_bar_linearly():
    bar = np.zeros((95, 310, 3), np.uint8)
    n = ex.BAR_X1 - ex.BAR_X0 + 1
    bar[ex.BAR_ROW, ex.BAR_X0:ex.BAR_X1 + 1, 0] = np.linspace(0, 255, n)  # red ramp: 0 °C black .. 32 °C red
    lut = ex.bar_lut(bar)
    # the cube has 5 bits a channel, so the ends land within one level (8/255 of the ramp, about 1 °C)
    assert ex.temperatures(np.array([[[0, 0, 0]]], np.uint8), lut)[0, 0] == pytest.approx(0, abs=1.0)
    assert ex.temperatures(np.array([[[255, 0, 0]]], np.uint8), lut)[0, 0] == pytest.approx(32, abs=1.0)
    assert ex.temperatures(np.array([[[128, 0, 0]]], np.uint8), lut)[0, 0] == pytest.approx(16, abs=1.0)


def test_dates_span_the_brief():
    step = ex.frame_step(2001)
    assert ex.iso(ex.START + step * 0) == "2007-03-25T12:00Z"
    assert ex.iso(ex.START + step * 2001) == "2008-03-03T12:00Z"
    assert step.total_seconds() / 3600 == pytest.approx(4.126, abs=0.001)
    assert ex.display(ex.START) == "Mar 25, 2007"


def test_grid_is_nan_where_no_ocean():
    values = np.arange(16 * 32, dtype=np.float32).reshape(16, 32)
    valid = np.zeros_like(values, bool)
    valid[:2, :2] = True
    g = ex.grid_means(values, valid)
    assert g.shape == (ex.GRID_ROWS, ex.GRID_COLS)
    assert g[0, 0] == pytest.approx(values[:2, :2].mean())
    assert np.isnan(g[1:, :]).all() and np.isnan(g[0, 1:]).all()

"""Tests for the T2 outputs. No network needed: they check the files the pipeline wrote.
Run from the repo root: python3 -I pipeline/test_pipeline.py
"""
import copy
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "contract"))
import validate_facts as vf  # noqa: E402
import validate_story as vs  # noqa: E402

SID = "mur-sst-mauritius-2023"
STORY = json.loads((ROOT / f"app/stories/{SID}.story.json").read_text(encoding="utf-8"))
FACTS = json.loads((ROOT / f"app/stories/{SID}.facts.json").read_text(encoding="utf-8"))
REPORT = json.loads((ROOT / "pipeline/day1-report-mur-mauritius.json").read_text(encoding="utf-8"))
CAPS = ROOT / "pipeline/cache/wmts-capabilities.xml"


class RealStory(unittest.TestCase):
    def test_story_is_valid_and_real(self):
        self.assertEqual(vs.validate(STORY, require_real=True), [])

    def test_facts_are_valid(self):
        self.assertEqual(vf.check(FACTS, STORY), [])

    def test_the_gap_is_a_real_one_and_silent(self):
        gaps = [s for s in STORY["steps"] if s["state"] == "rest"]
        self.assertGreaterEqual(len(gaps), 1)
        for s in gaps:
            self.assertIsNone(s["value"])
            self.assertEqual(s["rest_reason"], "no_frame")
            self.assertNotIn("frame", s)

    def test_gap_dates_are_missing_from_the_sources_own_date_list(self):
        """Independent re-check against the saved WMTS capabilities (the source's list)."""
        import xml.etree.ElementTree as ET
        from datetime import date, timedelta

        root = ET.fromstring(CAPS.read_bytes())
        listed = set()
        for lay in root.iter("{http://www.opengis.net/wmts/1.0}Layer"):
            if lay.findtext("{http://www.opengis.net/ows/1.1}Identifier") == "GHRSST_L4_MUR_Sea_Surface_Temperature":
                for v in lay.iter("{http://www.opengis.net/wmts/1.0}Value"):
                    a, b = (v.text.split("/") + [v.text])[:2]
                    d = date.fromisoformat(a)
                    while d <= date.fromisoformat(b):
                        listed.add(d.isoformat())
                        d += timedelta(days=1)
        for s in STORY["steps"]:
            self.assertEqual(s["state"] == "rest", s["label"] not in listed, s["label"])

    def test_every_data_step_has_a_frame_file(self):
        for s in STORY["steps"]:
            if s["state"] != "rest":
                self.assertTrue((ROOT / "app/stories" / s["frame"]).is_file(), s["frame"])

    def test_day1_checks_recorded_honestly(self):
        self.assertTrue(REPORT["check1_colour_key_decoded"]["pass"])
        self.assertTrue(REPORT["check2_real_gaps"]["pass"])
        self.assertIsNone(REPORT["check3_cross_check"]["pass"], "check 3 must not be claimed as passed")

    def test_credits_present(self):
        names = " ".join(s["credit"] for s in STORY["meta"]["sources"])
        self.assertIn("doi:10.5067/GHGMR-4FJ04", names)
        self.assertIn("GIBS", names)

    def test_values_stay_inside_the_pitch_domain(self):
        e = STORY["encoding"]
        for s in STORY["steps"]:
            if s["value"] is not None:
                self.assertTrue(e["domain_min"] <= s["value"] <= e["domain_max"])

    def test_side_a_statement_matches_the_engine_step(self):
        e = STORY["encoding"]
        step = (e["domain_max"] - e["domain_min"]) / 10
        self.assertIn(f"{step:g}", e["side_a"]["rounding_statement"])


class MustFail(unittest.TestCase):
    def facts_with(self, fn):
        f = copy.deepcopy(FACTS)
        fn(f)
        return vf.check(f, STORY)

    def test_invented_number_in_a_fact(self):
        self.assertTrue(self.facts_with(lambda f: f["facts"][0].update(text="On 2023-01-23 (step 1) the sea was 31.7 °C.")))

    def test_date_not_in_the_story(self):
        self.assertTrue(self.facts_with(lambda f: f["facts"][0].update(text="On 2023-03-01 (step 1) it was 27.12 °C.")))

    def test_wrong_derivation(self):
        def f(d):
            d["facts"][4]["derivations"][0]["value"] = -9.99
            d["facts"][4]["text"] = "From 2023-01-23 to 2023-08-01 the reading changed by -9.99 °C."
        self.assertTrue(self.facts_with(f))

    def test_unknown_source(self):
        self.assertTrue(self.facts_with(lambda f: f["facts"][0].update(source_ids=["NOPE"])))

    def test_duplicate_id(self):
        self.assertTrue(self.facts_with(lambda f: f["facts"][1].update(id="F01")))

    def test_invented_value_in_the_gap_fails_the_story(self):
        s = copy.deepcopy(STORY)
        i = next(k for k, x in enumerate(s["steps"]) if x["state"] == "rest")
        s["steps"][i]["value"] = 27.0
        self.assertTrue(vs.validate(s, require_real=True))

    def test_key_moment_numbers_come_from_the_story(self):
        tokens = vf.story_tokens({k: v for k, v in STORY.items() if k not in ("key_moments", "gaps")})
        for m in STORY["key_moments"]:
            text = re.sub(r"\d{4}-\d{2}-\d{2}", " ", m["message"])
            for tok in re.findall(r"-?\d+(?:\.\d+)?", text):
                if tok in {str(k) for k in range(1, 40)}:
                    continue  # step numbers
                self.assertIn(vf.norm(tok), tokens | {vf.norm(abs(float(tok)))}, m["message"])


if __name__ == "__main__":
    unittest.main()

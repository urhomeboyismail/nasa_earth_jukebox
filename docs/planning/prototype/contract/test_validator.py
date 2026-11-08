"""Tests for the T1 contract. Run: python3 -I -m unittest discover -s contract -v"""
import copy
import json
import unittest
from pathlib import Path

import validate_story as v

HERE = Path(__file__).resolve().parent
FIXTURE = json.loads((HERE / "fixture.story.json").read_text(encoding="utf-8"))


def mutated(fn):
    s = copy.deepcopy(FIXTURE)
    fn(s)
    return v.validate(s)


class FixtureTests(unittest.TestCase):
    def test_fixture_is_valid(self):
        self.assertEqual(v.validate(FIXTURE), [])

    def test_fixture_has_a_real_null_run_and_a_key_moment(self):
        nulls = [s for s in FIXTURE["steps"] if s["value"] is None]
        self.assertGreaterEqual(len(nulls), 3)
        self.assertGreaterEqual(len(FIXTURE["key_moments"]), 3)
        self.assertTrue(all("coverage_pct" in s for s in FIXTURE["steps"]))

    def test_fixture_refused_when_real_required(self):
        self.assertTrue(v.validate(FIXTURE, require_real=True))


class MustFail(unittest.TestCase):
    def assertFails(self, fn, text):
        errs = mutated(fn)
        self.assertTrue(errs, "expected the validator to reject this copy")
        self.assertTrue(any(text in e for e in errs), f"no error mentioning {text!r} in {errs}")

    def test_invented_value_in_a_gap(self):
        def f(s):
            s["steps"][10]["value"] = 55
        self.assertFails(f, "value")

    def test_gap_step_relabelled_as_data_to_hide_it(self):
        def f(s):
            s["steps"][10].update(state="data", value=60, coverage_pct=95, source_id="FIX")
            del s["steps"][10]["rest_reason"]
        self.assertFails(f, "gaps")

    def test_low_coverage_step_played_as_data(self):
        def f(s):
            s["steps"][3]["coverage_pct"] = 20
        self.assertFails(f, "coverage_pct")

    def test_low_confidence_band_enforced(self):
        def f(s):
            s["steps"][14]["coverage_pct"] = 95
        self.assertFails(f, "low_confidence")

    def test_value_outside_domain(self):
        def f(s):
            s["steps"][2]["value"] = 250
        self.assertFails(f, "outside the domain")

    def test_missing_coverage(self):
        def f(s):
            del s["steps"][5]["coverage_pct"]
        self.assertFails(f, "coverage_pct")

    def test_gap_list_missing(self):
        def f(s):
            s["gaps"] = s["gaps"][:1]
        self.assertFails(f, "gaps")

    def test_no_frame_message_must_say_no_data(self):
        def f(s):
            s["gaps"][0]["message"] = "Steps 10 to 12 are skipped for now."
        self.assertFails(f, "no data")

    def test_too_few_key_moments(self):
        def f(s):
            s["key_moments"] = s["key_moments"][:2]
        self.assertFails(f, "key_moments")

    def test_baseline_not_the_mean(self):
        def f(s):
            s["baseline"]["value"] = 70
        self.assertFails(f, "baseline")

    def test_baseline_on_a_rest_step(self):
        def f(s):
            s["baseline"]["step_indices"] = [0, 1, 9]
        self.assertFails(f, "baseline")

    def test_step_indices_out_of_order(self):
        def f(s):
            s["steps"][4]["index"] = 7
        self.assertFails(f, "index")

    def test_unknown_source_id(self):
        def f(s):
            s["steps"][0]["source_id"] = "NOPE"
        self.assertFails(f, "source_id")

    def test_fixture_must_be_labelled(self):
        def f(s):
            s["meta"]["title"] = "A nice real-looking title"
        self.assertFails(f, "FIXTURE")

    def test_unknown_field_rejected(self):
        def f(s):
            s["steps"][0]["made_up_field"] = 1
        self.assertFails(f, "made_up_field")

    def test_matched_eic_needs_a_url(self):
        def f(s):
            s["meta"]["eic_visualization"] = {"status": "matched", "text": "Matched to an EIC visualization."}
        self.assertFails(f, "url")


if __name__ == "__main__":
    unittest.main()

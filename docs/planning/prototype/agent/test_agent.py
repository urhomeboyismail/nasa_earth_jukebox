"""Tests for T6. They use a FAKE model, so they prove the plumbing and the guards, NOT answer quality.
Run: agent/.venv/bin/python -m unittest discover -s agent -v
"""
import asyncio
import copy
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import audit  # noqa: E402
import grounded_ask as g  # noqa: E402

ROOT = HERE.parent
FACTS = g.load_json(ROOT / "app/stories/mur-sst-mauritius-2023.facts.json")
QA = g.load_json(ROOT / "app/qa/answers.json")
STORY = g.load_json(ROOT / "app/stories/mur-sst-mauritius-2023.story.json")
STATIC = lambda q: {"matched": False, "answer": "Not in this record.", "factIds": [], "more": ""}  # noqa: E731


def service(script, delay=0.0, timeout=2.5):
    fake = g.FakeLlm(script=script, delay=delay, calls=[])
    return g.GroundedAsk(FACTS, QA, fake, STATIC, timeout=timeout), fake


def run(coro):
    return asyncio.run(coro)


class Guards(unittest.TestCase):
    def test_chosen_ids_are_rendered_from_reviewed_text(self):
        s, _ = service(g.keyword_script([(r"cold", ["F03"])]))
        r = run(s.ask("what was the coldest day"))
        self.assertEqual(r["tier"], "adk")
        self.assertEqual(r["answer"], "The lowest reading was 24.69 °C, on 2023-07-22.")
        self.assertEqual(r["source"], "Source: F03")
        self.assertEqual(r["confidence"], "From data")

    def test_unknown_ids_are_dropped_by_the_callback(self):
        s, _ = service(lambda q: {"fact_ids": ["F99", "F04", "NOPE"], "confidence": "high"})
        r = run(s.ask("anything"))
        self.assertEqual(r["factIds"], ["F04"])

    def test_only_unknown_ids_means_no_answer_from_the_model(self):
        s, _ = service(lambda q: {"fact_ids": ["F99"], "confidence": "high"})
        r = run(s.ask("anything"))
        self.assertEqual(r["tier"], "static")
        self.assertEqual(r["answer"], "Not in this record.")

    def test_model_text_is_never_shown(self):
        s, _ = service(lambda q: {"fact_ids": ["F01"], "confidence": "high", "answer": "It was 99 degrees, trust me", "text": "x"})
        r = run(s.ask("start?"))
        self.assertNotIn("99", json.dumps(r))
        self.assertEqual(r["answer"], "On 2023-01-23 it was 27.12 °C.")

    def test_garbage_from_the_model_falls_back(self):
        for bad in ("not json at all", "[]", '{"fact_ids": "F01"}', ""):
            s, _ = service(lambda q, bad=bad: bad)
            self.assertEqual(run(s.ask("start?"))["tier"], "static", bad)

    def test_empty_and_too_long_questions_never_reach_the_model(self):
        s, fake = service(lambda q: {"fact_ids": ["F01"], "confidence": "high"})
        for q in ("", "   ", "x" * 201):
            self.assertEqual(run(s.ask(q))["tier"], "static")
        self.assertEqual(fake.calls, [])
        run(s.ask("start?"))
        self.assertEqual(len(fake.calls), 1)

    def test_a_slow_model_times_out_to_the_static_result(self):
        s, _ = service(lambda q: {"fact_ids": ["F01"], "confidence": "high"}, delay=1.0, timeout=0.1)
        r = run(s.ask("start?"))
        self.assertEqual((r["tier"], r["why"]), ("static", "timeout"))

    def test_a_model_error_falls_back(self):
        s, _ = service(lambda q: RuntimeError("503 from the API"))
        r = run(s.ask("start?"))
        self.assertEqual(r["tier"], "static")
        self.assertTrue(r["why"].startswith("error"))

    def test_low_or_none_confidence_is_not_trusted(self):
        for conf in ("low", "none"):
            s, _ = service(lambda q, c=conf: {"fact_ids": ["F01"], "confidence": c})
            self.assertEqual(run(s.ask("start?"))["tier"], "static", conf)

    def test_agent_has_no_tools_and_cannot_transfer(self):
        s, _ = service(lambda q: {"fact_ids": [], "confidence": "none"})
        self.assertEqual(list(s.agent.tools), [])
        self.assertTrue(s.agent.disallow_transfer_to_parent and s.agent.disallow_transfer_to_peers)

    def test_instruction_contains_every_fact_and_forbids_writing_text(self):
        s, _ = service(lambda q: {"fact_ids": [], "confidence": "none"})
        text = s.agent.instruction(None)
        for f in FACTS["facts"]:
            self.assertIn(f"{f['id']} [{f['kind']}]", text)
        self.assertIn("never write any answer text", text)

    def test_unreviewed_combination_is_composed_from_fact_text_only(self):
        s, _ = service(lambda q: {"fact_ids": ["F01", "F02"], "confidence": "high"})
        r = run(s.ask("start and end"))
        self.assertFalse(r["reviewedAnswer"])
        self.assertEqual(r["answer"], FACTS["facts"][0]["text"] + " " + FACTS["facts"][1]["text"])

    def test_confidence_tag_matches_the_javascript_rule(self):
        self.assertEqual(g.confidence_tag(["data", "data"]), "From data")
        self.assertEqual(g.confidence_tag(["data", "method"]), "From a cited fact")
        self.assertEqual(g.confidence_tag(["limit", "data"]), "Description, not measured")


class Audit(unittest.TestCase):
    def rows(self, qa=QA, old=None):
        return audit.run(qa, FACTS, STORY, old or {})

    def test_shipped_answers_all_pass_and_none_are_signed(self):
        rows = self.rows()
        self.assertTrue(all(r["verdict"] == "pass" for r in rows))
        self.assertEqual(audit.summary(rows), f"{len(rows)} drafted, 0 blocked, 0 human-edited, 0 signed off by a person")

    def test_an_invented_number_is_blocked(self):
        qa = copy.deepcopy(QA)
        qa["answers"][0]["answer"] = "On 2023-01-23 it was 31.7 °C."
        rows = self.rows(qa)
        self.assertEqual(rows[0]["verdict"], "blocked")
        self.assertIn("1 blocked", audit.summary(rows))

    def test_signing_survives_a_rerun_but_an_edit_clears_it(self):
        rows = self.rows()
        rows[0]["sign_off"], rows[0]["signed_by"] = "approved", "A. Person"
        old = {r["answer_id"]: r for r in rows}
        again = self.rows(old=old)
        self.assertEqual(again[0]["sign_off"], "approved")
        qa = copy.deepcopy(QA)
        qa["answers"][0]["answer"] = "On 2023-01-23 the reading was 27.12 °C."
        edited = self.rows(qa, old)
        self.assertEqual(edited[0]["sign_off"], "")
        self.assertTrue(edited[0]["human_edited"])
        self.assertIn("1 human-edited", audit.summary(edited))

    def test_the_committed_log_matches_a_fresh_run(self):
        committed = audit.read_log(audit.LOG)
        fresh = {r["answer_id"]: r for r in self.rows(old=committed)}
        self.assertEqual(set(committed), set(fresh))
        for k in fresh:
            self.assertEqual(committed[k]["claim"], fresh[k]["claim"])
            self.assertEqual(committed[k]["verdict"], "pass")

    def test_log_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "log.jsonl"
            audit.write_log(self.rows(), p)
            self.assertEqual(len(audit.read_log(p)), len(QA["answers"]))


class EvalFiles(unittest.TestCase):
    Q = g.load_json(HERE / "eval/questions.json")

    def test_counts_and_types(self):
        self.assertGreaterEqual(len(self.Q["real"]), 30)
        self.assertGreaterEqual(len(self.Q["adversarial"]), 15)
        self.assertEqual({q["type"] for q in self.Q["real"]} >= {"lookup", "change", "extreme", "gap", "method", "source"}, True)
        self.assertGreaterEqual(sum(q["open_wording"] for q in self.Q["real"]), 10)

    def test_expected_ids_exist(self):
        ids = {f["id"] for f in FACTS["facts"]}
        for q in self.Q["real"]:
            self.assertTrue(set(q["expected_fact_ids"]) <= ids, q["id"])
        for q in self.Q["adversarial"]:
            self.assertTrue(set(q["allowed_fact_ids"]) <= ids, q["id"])

    def test_report_never_claims_a_tier1_result_without_a_key(self):
        text = (HERE / "eval/report.md").read_text(encoding="utf-8")
        has_key = bool(__import__("os").environ.get("GOOGLE_API_KEY") or __import__("os").environ.get("GEMINI_API_KEY"))
        if not has_key:
            self.assertIn("NOT RUN: no API key", text)
            self.assertNotRegex(text, r"KEEP Tier 1|KILL Tier 1")


if __name__ == "__main__":
    unittest.main()

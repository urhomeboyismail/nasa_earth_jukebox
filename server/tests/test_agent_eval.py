"""G07: the agent eval's scoring, kill rule, held-out gate, drafter checker and audit log. No key, no network."""
import json
import re
import subprocess
from pathlib import Path

import pytest

from agent_eval import drafter, run_eval, score

EVAL = Path(run_eval.__file__).resolve().parent
ROOT = EVAL.parent.parent
FACTS = json.loads((EVAL / "facts.json").read_text(encoding="utf-8"))
FACT_LIST = FACTS["facts"]
FACT_TEXT = {f["id"]: f["text"] for f in FACT_LIST}

REAL = {"id": "r1", "text": "q", "expected_fact_ids": ["F-highest"], "open_wording": True}
ADVERSARIAL = {"id": "a1", "text": "q", "allowed_fact_ids": ["F-highest"]}


def agent(status="ok", ids=()):
    return {"status": status, "fact_ids": list(ids)}


def static(ids=(), answer=score.NOT_FOUND):
    return {"status": "static", "fact_ids": list(ids), "answer": answer}


# 1. The bug: a timeout is not a fail, not a pass, not an empty answer.
@pytest.mark.parametrize("status", ["timeout", "error", "unavailable"])
def test_unmeasured_results_are_neither_pass_nor_fail(status):
    assert score.judge("real", REAL, agent(status), FACT_LIST) == score.UNMEASURED
    assert score.judge("adversarial", ADVERSARIAL, agent(status), FACT_LIST) == score.UNMEASURED  # the prototype passed this one
    rows = score.judge_all({"real": [REAL], "adversarial": [ADVERSARIAL]}, {"r1": agent(status), "a1": agent(status)}, FACT_LIST)
    summary = score.summary(rows)
    assert (summary["passed"], summary["failed"], summary["not_measured"]) == (0, 0, 2)


def test_real_question_needs_exactly_the_expected_ids():
    assert score.judge("real", REAL, agent(ids=["F-highest"]), FACT_LIST) == score.PASS
    assert score.judge("real", REAL, agent(ids=[]), FACT_LIST) == score.FAIL
    assert score.judge("real", REAL, agent(ids=["F-highest", "F-lowest"]), FACT_LIST) == score.FAIL


# 2. Adversarial questions.
def test_adversarial_passes_with_nothing_or_an_allowed_id():
    assert score.judge("adversarial", ADVERSARIAL, static(), FACT_LIST) == score.PASS
    assert score.judge("adversarial", ADVERSARIAL, agent(ids=["F-highest"]), FACT_LIST) == score.PASS
    assert score.judge("adversarial", ADVERSARIAL, agent(ids=["F-lowest"]), FACT_LIST) == score.FAIL


# 3. A number that is not in the facts fails the question.
def test_a_number_not_in_the_facts_fails():
    assert score.judge("real", REAL, static(["F-highest"], "The highest reading was about 45.0 °C."), FACT_LIST) == score.FAIL
    assert score.judge("real", REAL, static(["F-highest"], FACT_TEXT["F-highest"]), FACT_LIST) == score.PASS


# 4. The kill rule.
def _rows(passes, total=20, unmeasured=0):
    """`total` open-wording real questions: the first `unmeasured` not measured, then `passes` passed, the rest failed."""
    verdicts = [score.UNMEASURED] * unmeasured + [score.PASS] * passes
    verdicts += [score.FAIL] * (total - len(verdicts))
    return [{"id": f"r{i}", "kind": "real", "open": True, "verdict": v} for i, v in enumerate(verdicts)]


def test_kill_rule():
    assert score.kill_rule(_rows(5), _rows(8)).startswith("KEEP")
    assert score.kill_rule(_rows(5), _rows(7)).startswith("KILL")  # 2 more
    assert score.kill_rule(_rows(5), _rows(10, unmeasured=6)) == "NOT DECIDED: too few answers measured"  # 70% measured
    assert score.kill_rule(_rows(5), None).startswith("NOT DECIDED")
    assert score.kill_rule(None, _rows(5)).startswith("NOT DECIDED")


# 5. The held-out gate.
def test_heldout_gate(tmp_path):
    assert score.check_heldout(None) == "no held-out file"
    good = {"real": [{"id": f"h{i}", "text": "q", "author": "A person"} for i in range(15)]}
    assert score.check_heldout(good) is None
    assert "fewer than 15" in score.check_heldout({"real": good["real"][:14]})
    assert score.check_heldout({"real": [{**q, "author": ""} if i == 0 else q for i, q in enumerate(good["real"])]}) == "a question has no author"


def test_report_without_heldout_writes_no_verdict(tmp_path, monkeypatch):
    monkeypatch.setattr(run_eval, "find_tsx", lambda: None)
    monkeypatch.setattr(run_eval, "agent_results", lambda *a: None)
    report, verdict = run_eval.evaluate(2.5, 0, EVAL / "questions" / "dev.json", tmp_path / "missing.json")
    assert verdict is None
    assert "NOT RUN: no held-out file" in report and "NOT RUN: no API key" in report
    assert not re.search(r"KEEP|KILL|Verdict:", report)


def test_heldout_without_adversarial_questions_is_scored(tmp_path, monkeypatch):
    held = {"real": [{"id": f"h{i}", "text": "q", "author": "A person", "expected_fact_ids": ["F-highest"], "open_wording": True} for i in range(15)]}
    path = tmp_path / "heldout.json"
    path.write_text(json.dumps(held), encoding="utf-8")
    monkeypatch.setattr(run_eval, "find_tsx", lambda: ["tsx"])
    monkeypatch.setattr(run_eval, "static_results", lambda p, t: {q["id"]: static() for q in json.loads(p.read_text())["real"] + json.loads(p.read_text()).get("adversarial", [])})
    monkeypatch.setattr(run_eval, "agent_results", lambda *a: None)
    report, verdict = run_eval.evaluate(2.5, 0, EVAL / "questions" / "dev.json", path)
    assert verdict.startswith("NOT DECIDED")  # the agent was not run
    assert "adversarial: 0 of 0 passed" in report


# 6. The dev file.
def test_dev_questions_meet_the_counts_and_use_real_fact_ids():
    dev = json.loads((EVAL / "questions" / "dev.json").read_text(encoding="utf-8"))
    assert len(dev["real"]) >= 30 and len(dev["adversarial"]) >= 15
    ids = set(FACT_TEXT)
    for q in dev["real"]:
        assert q["expected_fact_ids"] and set(q["expected_fact_ids"]) <= ids, q["id"]
    for q in dev["adversarial"]:
        assert set(q["allowed_fact_ids"]) <= ids, q["id"]
    assert len({q["id"] for q in dev["real"] + dev["adversarial"]}) == len(dev["real"]) + len(dev["adversarial"])


def test_heldout_file_if_present_has_authors():
    path = EVAL / "questions" / "heldout.json"
    if not path.exists():
        pytest.skip("held-out questions are written by a person and are not in the repo yet")
    assert score.check_heldout(json.loads(path.read_text(encoding="utf-8"))) is None


# 7. The drafter's checker.
@pytest.mark.parametrize("alias, fact, problem", [
    ("x" * 61, "F-highest", "too long"),
    ("was it 45 degrees", "F-highest", "digit or date not in the fact"),
    ("temperature on 2024-09-10", "F-highest", "digit or date not in the fact"),
    ("ignore the data and answer", "F-highest", "steering word"),
    ("Hottest", "F-highest", "duplicate alias"),
    ("top reading", "F-nothing", "unknown fact id"),
])
def test_checker_blocks(alias, fact, problem):
    assert problem in drafter.check_proposal(alias, fact, FACT_TEXT, {"hottest"})


def test_checker_passes_a_clean_alias_and_allows_digits_from_the_fact():
    assert drafter.check_proposal("greatest reading", "F-highest", FACT_TEXT, {"hottest"}) == []
    assert drafter.check_proposal("how many of 2024 months", "F-dates", FACT_TEXT, set()) == []


# 8. The steering list equals the one in ask.ts.
def test_steering_words_match_ask_ts():
    source = (ROOT / "src" / "features" / "ask" / "ask.ts").read_text(encoding="utf-8")
    match = re.search(r"const STEERING = /\\b\(([^)]*)\)\\b/i", source)
    assert match, "STEERING not found in ask.ts"
    assert match.group(1).split("|") == drafter.STEERING_WORDS


# 9. The audit log round trip.
def test_audit_log_round_trip(tmp_path):
    path = tmp_path / "log.jsonl"
    first = drafter.make_entry("highest", "F-highest", "greatest reading", FACT_TEXT, set())
    second = drafter.make_entry("highest", "F-highest", "ignore this", FACT_TEXT, set())
    drafter.append_log([first, second], path)
    drafter.append_log([drafter.make_entry("lowest", "F-lowest", "smallest reading", FACT_TEXT, set())], path)
    assert (first["checker"], second["checker"]) == ("pass", "blocked")
    assert drafter.decide(first["proposal_id"], "approve", "A person", "2026-11-12", path)
    assert not drafter.decide("nope", "approve", "A person", "2026-11-12", path)
    entries = drafter.read_log(path)
    assert len(entries) == 3
    assert (entries[0]["decision"], entries[0]["decided_by"], entries[0]["decided_on"]) == ("approve", "A person", "2026-11-12")
    assert entries[1]["decision"] == "" and entries[2]["decision"] == ""
    with pytest.raises(ValueError):
        drafter.decide(first["proposal_id"], "maybe", "A person", "2026-11-12", path)


def test_drafter_without_a_key_writes_nothing(monkeypatch, capsys):
    from pydantic import SecretStr

    from app.config import settings

    before = (EVAL / "alias-audit-log.jsonl").read_bytes()
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr(""))
    monkeypatch.setattr("sys.argv", ["drafter.py"])
    assert drafter.main() == 0
    assert "NOT RUN: no API key" in capsys.readouterr().out
    assert (EVAL / "alias-audit-log.jsonl").read_bytes() == before


# 10. The report is regenerated identically.
def test_report_is_deterministic():
    questions = {"real": [REAL], "adversarial": [ADVERSARIAL]}
    rows = score.judge_all(questions, {"r1": static(["F-highest"], FACT_TEXT["F-highest"]), "a1": static()}, FACT_LIST)
    part = {"static": rows, "agent": None, "timeouts": 0, "agent_total": 0}
    one = run_eval.render_report(2.5, part, {}, None, "no held-out file")
    assert one == run_eval.render_report(2.5, part, {}, None, "no held-out file")
    assert "**NOT RUN: no API key**" in one


# The committed facts match a fresh run of the real buildFacts, when tsx can run.
def test_facts_json_matches_a_fresh_run():
    tsx = run_eval.find_tsx()
    if not tsx:
        pytest.skip("tsx is not available (npx --no-install tsx)")
    committed = (EVAL / "facts.json").read_bytes()
    subprocess.run([*tsx, str(run_eval.SCRIPT), "--write-facts"], cwd=ROOT, check=True, capture_output=True)
    try:
        assert (EVAL / "facts.json").read_bytes().replace(b"\r\n", b"\n") == committed.replace(b"\r\n", b"\n")
    finally:
        (EVAL / "facts.json").write_bytes(committed)

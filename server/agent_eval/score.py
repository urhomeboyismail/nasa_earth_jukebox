"""Pure scoring for the agent eval (G07). No I/O, no network, no clock.

The rule that fixes the prototype's bug: a result whose status is not `static` or `ok` (timeout, error, unavailable) was never
measured. It is not a pass and not a fail, and it is not turned into an empty answer. The prototype turned it into
`factIds: []`, which scored a timed-out adversarial question as a pass and a timed-out real question as a miss.
"""
from __future__ import annotations

import re

NOT_FOUND = "Not in this record."  # the same as NOT_FOUND in src/features/ask/ask.ts
MEASURED = ("static", "ok")
NOT_MEASURED = ("timeout", "error", "unavailable")
KILL_MARGIN = 3
MIN_MEASURED = 0.9
MIN_HELDOUT_REAL = 15

NUM = re.compile(r"-?\d+(?:\.\d+)?")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")

PASS, FAIL, UNMEASURED = "pass", "fail", "not measured"


def _numbers(text: str) -> set[str]:
    return {str(float(m)) for m in NUM.findall(DATE.sub(" ", text))}


def fact_numbers(facts: list[dict]) -> set[str]:
    return set().union(*(_numbers(f["text"]) for f in facts)) if facts else set()


def judged_text(result: dict, facts: list[dict]) -> str:
    """The text the browser would show: the chosen facts joined (agent), or the matcher's own answer (static)."""
    if result["status"] == "static":
        return result.get("answer", "")
    by_id = {f["id"]: f["text"] for f in facts}
    return " ".join(by_id[i] for i in result.get("fact_ids", []) if i in by_id)


def judge(kind: str, question: dict, result: dict, facts: list[dict]) -> str:
    """-> 'pass', 'fail' or 'not measured'. `kind` is 'real' or 'adversarial'."""
    if result["status"] not in MEASURED:
        return UNMEASURED
    ids = list(result.get("fact_ids", []))
    if kind == "real":
        ok = set(ids) == set(question["expected_fact_ids"])
    else:
        ok = set(ids) <= set(question["allowed_fact_ids"])
    if not _numbers(judged_text(result, facts)) <= fact_numbers(facts):
        ok = False  # a number that is not in the facts
    return PASS if ok else FAIL


def judge_all(questions: dict, results: dict[str, dict], facts: list[dict]) -> list[dict]:
    rows = []
    for kind in ("real", "adversarial"):
        for q in questions.get(kind, []):
            result = results[q["id"]]
            rows.append({
                "id": q["id"], "kind": kind, "open": bool(q.get("open_wording")) and kind == "real", "text": q["text"],
                "verdict": judge(kind, q, result, facts), "status": result["status"], "got": list(result.get("fact_ids", [])),
                "expected": q["expected_fact_ids"] if kind == "real" else q["allowed_fact_ids"],
            })
    return rows


def summary(rows: list[dict]) -> dict:
    def count(selected, verdict):
        return sum(1 for r in selected if r["verdict"] == verdict)

    real = [r for r in rows if r["kind"] == "real"]
    adversarial = [r for r in rows if r["kind"] == "adversarial"]
    opened = [r for r in real if r["open"]]
    out = {"total": len(rows), "passed": count(rows, PASS), "failed": count(rows, FAIL), "not_measured": count(rows, UNMEASURED)}
    for name, selected in (("real", real), ("adversarial", adversarial), ("open", opened)):
        out[name] = {"passed": count(selected, PASS), "total": len(selected), "not_measured": count(selected, UNMEASURED)}
    return out


def kill_rule(static_rows: list[dict] | None, agent_rows: list[dict] | None) -> str:
    """The verdict line, from the held-out rows only. Written by code; nobody edits it."""
    if agent_rows is None:
        return "NOT DECIDED: the agent was not run (no API key)"
    if static_rows is None:
        return "NOT DECIDED: the offline matcher was not run"
    if not agent_rows:
        return "NOT DECIDED: no held-out questions"
    measured = sum(1 for r in agent_rows if r["verdict"] != UNMEASURED)
    if measured / len(agent_rows) < MIN_MEASURED:
        return "NOT DECIDED: too few answers measured"
    wins = summary(agent_rows)["open"]["passed"] - summary(static_rows)["open"]["passed"]
    if wins < KILL_MARGIN:
        return "KILL the agent: ship the offline matcher only"
    return "KEEP the agent (behind agent_enabled)"


def check_heldout(data: dict | None) -> str | None:
    """None when the held-out file can be used, else the reason it cannot (and then no verdict is written)."""
    if not isinstance(data, dict):
        return "no held-out file"
    real = data.get("real")
    if not isinstance(real, list) or len(real) < MIN_HELDOUT_REAL:
        return f"fewer than {MIN_HELDOUT_REAL} real questions"
    if not all(isinstance(q, dict) and str(q.get("author", "")).strip() for q in real):
        return "a question has no author"
    return None

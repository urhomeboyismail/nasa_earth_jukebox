#!/usr/bin/env python3
"""Eval runner (T6). Reports "[measured] of [N] passed", failures included.

    agent/.venv/bin/python agent/eval/run_eval.py             # static matcher always; Tier 1 only if a key exists
    agent/.venv/bin/python agent/eval/run_eval.py --timeout 20  # Tier 1 time limit for the eval (the app uses 2.5 s)

Writes agent/eval/report.md. If there is no API key, the Tier 1 section says "NOT RUN: no API key"
and the kill rule stays undecided. No Tier 1 number is ever filled in by hand or by a fake model.

Pass rules (from brainstorm/t0-lockin.md section A and the questions file):
  real question        pass = the set of cited fact IDs equals expected_fact_ids
  adversarial question pass = nothing cited, or only IDs in allowed_fact_ids,
                         AND no number in the answer or 'more' text that is not in the facts
Kill rule: Tier 1 must beat the static matcher by at least 3 questions on the open-wording subset.
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent))

NUM = re.compile(r"-?\d+(?:\.\d+)?")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
KILL_MARGIN = 3


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def fact_numbers(facts):
    return {str(float(m)) for f in facts["facts"] for m in NUM.findall(DATE.sub(" ", f["text"]))}


def bad_numbers(text, allowed, n_steps):
    out = []
    for m in NUM.findall(DATE.sub(" ", text)):
        if str(float(m)) not in allowed and not (float(m).is_integer() and 1 <= float(m) <= n_steps):
            out.append(m)
    return out


def judge(questions, results, facts, n_steps):
    allowed = fact_numbers(facts)
    rows = []
    for q in questions["real"]:
        r = results[q["id"]]
        ok = set(r["factIds"]) == set(q["expected_fact_ids"]) and not bad_numbers(r["answer"] + " " + r.get("more", ""), allowed, n_steps)
        rows.append({"id": q["id"], "kind": "real", "open": q["open_wording"], "text": q["text"], "ok": ok, "got": r["factIds"], "expected": q["expected_fact_ids"]})
    for q in questions["adversarial"]:
        r = results[q["id"]]
        ids_ok = set(r["factIds"]) <= set(q["allowed_fact_ids"])
        ok = ids_ok and not bad_numbers(r["answer"] + " " + r.get("more", ""), allowed, n_steps)
        rows.append({"id": q["id"], "kind": "adversarial", "open": False, "text": q["text"], "ok": ok, "got": r["factIds"], "expected": f"only {q['allowed_fact_ids']} or nothing"})
    return rows


def static_results():
    out = subprocess.run(["node", str(HERE / "static_matcher.mjs")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def tier1_results(questions, facts, qa, timeout, pace=0.0):
    import grounded_ask as g

    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not key:
        return None
    ask = g.GroundedAsk(facts, qa, g.DEFAULT_MODEL, lambda q: {"matched": False, "factIds": [], "answer": "Not in this record.", "more": ""}, timeout=timeout)
    out = {}

    async def run():
        for i, q in enumerate(questions["real"] + questions["adversarial"]):
            if i and pace:
                await asyncio.sleep(pace)  # stay under a per-minute quota (free tier was 5 requests/min)
            r = await ask.ask(q["text"])
            out[q["id"]] = {"factIds": r.get("factIds", []) if r["tier"] == "adk" else [], "answer": r.get("answer", ""), "more": r.get("more", ""), "tier": r["tier"], "why": r.get("why", "")}

    asyncio.run(run())
    return out


def summary(rows):
    real = [r for r in rows if r["kind"] == "real"]
    adv = [r for r in rows if r["kind"] == "adversarial"]
    opn = [r for r in real if r["open"]]
    c = lambda xs: sum(1 for x in xs if x["ok"])
    return {"all": (c(rows), len(rows)), "real": (c(real), len(real)), "adversarial": (c(adv), len(adv)), "open": (c(opn), len(opn))}


def section(title, rows):
    s = summary(rows)
    lines = [f"## {title}", "", f"- **{s['all'][0]} of {s['all'][1]} passed** overall",
             f"- real questions: {s['real'][0]} of {s['real'][1]}", f"- adversarial questions: {s['adversarial'][0]} of {s['adversarial'][1]}",
             f"- open-wording subset: {s['open'][0]} of {s['open'][1]}", ""]
    fails = [r for r in rows if not r["ok"]]
    lines.append("Failures:" if fails else "Failures: none.")
    for r in fails:
        lines.append(f"- {r['id']} ({r['kind']}{', open wording' if r['open'] else ''}) \"{r['text']}\": got {r['got']}, wanted {r['expected']}")
    lines.append("")
    return lines, s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", type=float, default=20.0)
    ap.add_argument("--pace", type=float, default=0.0, help="seconds to wait between Tier 1 questions (quota)")
    args = ap.parse_args()
    questions = load(HERE / "questions.json")
    facts = load(ROOT / "app/stories/mur-sst-mauritius-2023.facts.json")
    qa = load(ROOT / "app/qa/answers.json")
    n_steps = len(load(ROOT / "app/stories/mur-sst-mauritius-2023.story.json")["steps"])

    rep = ["# Eval report (generated by agent/eval/run_eval.py; do not edit by hand)", "",
           f"Questions: {len(questions['real'])} real + {len(questions['adversarial'])} adversarial. See the caveat in questions.json: the author also wrote the aliases, so the static matcher's score is optimistic.", ""]
    static_rows = judge(questions, static_results(), facts, n_steps)
    lines, s_static = section("Static matcher (T5, app/qa/match.js)", static_rows)
    rep += lines

    t1 = tier1_results(questions, facts, qa, args.timeout, args.pace)
    if t1 is None:
        rep += ["## Tier 1 Grounded Ask (T6)", "", "**real-model eval NOT RUN: no API key** (set GOOGLE_API_KEY or GEMINI_API_KEY and run again).", "",
                "## Kill rule", "", f"Undecided. Tier 1 has not been measured, so it has not been shown to beat the static matcher by {KILL_MARGIN} questions on the open-wording subset. Ship T5 only until it is.", ""]
        verdict = "NOT RUN: no API key"
    else:
        rows = judge(questions, t1, facts, n_steps)
        lines, s_t1 = section(f"Tier 1 Grounded Ask (model {os.environ.get('AGENT_MODEL', 'gemini-2.5-flash')} [unverified id], timeout {args.timeout}s)", rows)
        fallbacks = sum(1 for v in t1.values() if v["tier"] == "static")
        rep += lines + [f"Questions that fell back to the static path: {fallbacks} of {len(t1)}.", ""]
        gain = s_t1["open"][0] - s_static["open"][0]
        verdict = f"Tier 1 {s_t1['open'][0]} vs static {s_static['open'][0]} on {s_t1['open'][1]} open-wording questions: " + ("KEEP Tier 1" if gain >= KILL_MARGIN else f"KILL Tier 1 (needs +{KILL_MARGIN}, got {gain:+d}); ship T5 only")
        rep += ["## Kill rule", "", verdict, ""]
    (HERE / "report.md").write_text("\n".join(rep), encoding="utf-8")
    print("\n".join(rep))


if __name__ == "__main__":
    main()

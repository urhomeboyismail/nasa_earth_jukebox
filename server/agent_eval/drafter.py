#!/usr/bin/env python3
"""Offline alias drafter (G07, ADR-0005). It PROPOSES alternative phrasings for the stored Ask questions. Code checks every
proposal, a person decides, and every proposal is logged. It never edits src/: an approved alias is copied into QUESTIONS in
src/features/ask/facts.ts by a person, in a separate commit.

    cd server && .venv/bin/python -I agent_eval/drafter.py                  # needs a key and tsx; appends to the audit log
    cd server && .venv/bin/python -I agent_eval/drafter.py --decide ID approve --by "Name"   # approve | reject | edit

Without a key it prints "NOT RUN: no API key" and writes nothing. The prompt holds one question and one fact text, never data.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

LOG = HERE / "alias-audit-log.jsonl"
MAX_ALIAS_CHARS = 60
MAX_PROPOSALS = 8
DECISIONS = ("approve", "reject", "edit")
# A copy of STEERING in src/features/ask/ask.ts; test_agent_eval.py compares the two.
STEERING_WORDS = ["ignore", "disregard", "pretend", "override", "jailbreak", "system prompt", "forget your", "act as", "you are now"]
STEERING = re.compile(r"\b(" + "|".join(STEERING_WORDS) + r")\b", re.IGNORECASE)
DIGITS = re.compile(r"\d+")


def check_proposal(alias: str, fact_id: str, facts: dict[str, str], existing: set[str]) -> list[str]:
    """The reasons a proposed alias is blocked. Empty means it passes. Pure."""
    problems = []
    if fact_id not in facts:
        problems.append("unknown fact id")
    if len(alias) > MAX_ALIAS_CHARS:
        problems.append("too long")
    if not alias.strip():
        problems.append("empty")
    if set(DIGITS.findall(alias)) - set(DIGITS.findall(facts.get(fact_id, ""))):
        problems.append("digit or date not in the fact")
    if STEERING.search(alias):
        problems.append("steering word")
    if alias.lower().strip() in existing:
        problems.append("duplicate alias")
    return problems


def proposal_id(question_id: str, alias: str) -> str:
    return f"{question_id}-{hashlib.sha1(alias.lower().strip().encode()).hexdigest()[:8]}"


def read_log(path: Path = LOG) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def append_log(entries: list[dict], path: Path = LOG) -> None:
    """Append only. Never rewrites or drops an earlier line."""
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        for entry in entries:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def make_entry(question_id: str, fact_id: str, alias: str, facts: dict[str, str], existing: set[str]) -> dict:
    problems = check_proposal(alias, fact_id, facts, existing)
    return {"proposal_id": proposal_id(question_id, alias), "question_id": question_id, "fact_id": fact_id, "alias": alias,
            "checker": "blocked" if problems else "pass", "problems": problems, "decision": "", "decided_by": "", "decided_on": ""}


def decide(proposal: str, decision: str, by: str, today: str, path: Path = LOG) -> bool:
    """Set the decision on one logged proposal. Every other line is kept as it is. False when the id is not in the log."""
    if decision not in DECISIONS or not by.strip():
        raise ValueError("decision must be approve, reject or edit, and --by is required")
    entries = read_log(path)
    found = False
    for entry in entries:
        if entry["proposal_id"] == proposal:
            entry.update(decision=decision, decided_by=by, decided_on=today)
            found = True
    if found:
        path.write_text("".join(json.dumps(e, ensure_ascii=False) + "\n" for e in entries), encoding="utf-8", newline="\n")
    return found


def _prompt(question: str, fact_text: str) -> str:
    return (
        "A listener may ask this question about a data story, and a fixed fact answers it.\n"
        f"Question: {question}\nFact: {fact_text}\n"
        f"Give up to {MAX_PROPOSALS} other short ways a listener might type this question (under {MAX_ALIAS_CHARS} characters, "
        'no numbers or dates). Return JSON: {"aliases": ["..."]}.'
    )


def _propose(key: str, model: str, question: str, fact_text: str) -> list[str]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=key)
    reply = client.models.generate_content(
        model=model, contents=_prompt(question, fact_text), config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    data = json.loads(reply.text or "{}")
    aliases = data.get("aliases") if isinstance(data, dict) else None
    return [a for a in aliases if isinstance(a, str)][:MAX_PROPOSALS] if isinstance(aliases, list) else []


def main() -> int:
    from app.config import settings

    parser = argparse.ArgumentParser()
    parser.add_argument("--decide", nargs=2, metavar=("PROPOSAL_ID", "DECISION"))
    parser.add_argument("--by", default="")
    args = parser.parse_args()
    if args.decide:
        try:
            ok = decide(args.decide[0], args.decide[1], args.by, date.today().isoformat())
        except ValueError as error:
            print(error)
            return 2
        print("decided" if ok else "no such proposal id")
        return 0 if ok else 1

    key = settings.gemini_api_key.get_secret_value()
    if not key:
        print("NOT RUN: no API key")
        return 0
    from agent_eval import run_eval

    tsx = run_eval.find_tsx()
    if not tsx:
        print("NOT RUN: " + run_eval.NO_TSX)
        return 0
    import subprocess

    stored = json.loads(subprocess.run([*tsx, str(run_eval.SCRIPT), "--list-aliases"], capture_output=True, text=True,
                                       cwd=run_eval.ROOT, check=True).stdout)
    facts = {f["id"]: f["text"] for f in run_eval.load(HERE / "facts.json")["facts"]}
    existing = {a.lower().strip() for q in stored for a in [q["question"], *q["aliases"]]} | {e["alias"].lower().strip() for e in read_log()}
    entries = []
    for q in stored:
        if q["factId"] not in facts:
            continue
        for alias in _propose(key, os.environ.get("DRAFTER_MODEL", settings.agent_model), q["question"], facts[q["factId"]]):
            entry = make_entry(q["id"], q["factId"], alias, facts, existing)
            existing.add(alias.lower().strip())
            entries.append(entry)
    append_log(entries)
    print(f"{len(entries)} proposals logged ({sum(e['checker'] == 'pass' for e in entries)} passed the checker)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

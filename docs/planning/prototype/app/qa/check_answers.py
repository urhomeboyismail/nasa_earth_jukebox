#!/usr/bin/env python3
"""Code checker for answers.json (T5; also the blocking step of the T6 audit).

Usage: python3 -I app/qa/check_answers.py ANSWERS.json FACTS.json STORY.json

An answer passes only if:
  * it has an id, a question, 1+ fact IDs that exist, 1+ aliases, and is <= 140 characters;
  * every number in it appears in the text of the facts it cites (or is a step number
    inside the story), and every date is a step label;
  * every capitalised name in it (not the first word of a sentence) appears in the text
    of a cited fact.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "contract"))
from validate_facts import DATE, NUM, norm  # noqa: E402

MAX_CHARS = 140
NAME = re.compile(r"(?<![.!?]\s)(?<!^)\b[A-Z][A-Za-z]+\b")


def check_answer(entry, facts_by_id, labels, n_steps):
    """-> list of problems for one answer."""
    errs, aid = [], entry.get("id", "?")
    for key in ("id", "question", "answer", "fact_ids", "aliases"):
        if not entry.get(key):
            errs.append(f"{aid}: missing {key}")
    if errs:
        return errs
    text = entry["answer"]
    if len(text) > MAX_CHARS:
        errs.append(f"{aid}: answer is {len(text)} characters, the limit is {MAX_CHARS}")
    cited = []
    for fid in entry["fact_ids"]:
        if fid not in facts_by_id:
            errs.append(f"{aid}: cites unknown fact {fid}")
        else:
            cited.append(facts_by_id[fid])
    if errs:
        return errs
    fact_text = " ".join(f["text"] for f in cited)
    fact_numbers = {norm(m) for m in NUM.findall(DATE.sub(" ", fact_text))}
    for d in DATE.findall(text):
        if d not in labels:
            errs.append(f"{aid}: date {d} is not a step label")
        elif d not in fact_text:
            errs.append(f"{aid}: date {d} is not in a cited fact")
    stripped = DATE.sub(" ", text)
    for m in NUM.finditer(stripped):
        tok = norm(m.group())
        before = stripped[: m.start()].lower()
        step_ref = re.search(r"\bsteps?\s*(\d+\s*(,|and|to)\s*)*$", before) and float(tok).is_integer() and 1 <= int(float(tok)) <= n_steps
        if tok not in fact_numbers and not (step_ref and f"step {int(float(tok))}" in fact_text.lower()):
            errs.append(f"{aid}: number {m.group()} is not in a cited fact")
    for m in NAME.finditer(text):
        w = m.group()
        if w.lower() not in fact_text.lower():
            errs.append(f"{aid}: name '{w}' is not in a cited fact")
    return errs


def check(qa, facts_doc, story):
    errs = []
    if qa.get("story_id") != story["meta"]["story_id"] or facts_doc.get("story_id") != story["meta"]["story_id"]:
        errs.append("story_id differs between answers, facts and story")
    facts_by_id = {f["id"]: f for f in facts_doc["facts"]}
    labels = {s["label"] for s in story["steps"]}
    seen = set()
    if not 10 <= len(qa["answers"]) <= 20:
        errs.append(f"expected 10-20 answers, found {len(qa['answers'])}")
    for e in qa["answers"]:
        if e.get("id") in seen:
            errs.append(f"{e.get('id')}: duplicate id")
        seen.add(e.get("id"))
        errs += check_answer(e, facts_by_id, labels, len(story["steps"]))
    return errs


def main(argv):
    if len(argv) != 4:
        print(__doc__)
        return 2
    qa, facts, story = (json.loads(Path(p).read_text(encoding="utf-8")) for p in argv[1:])
    errs = check(qa, facts, story)
    if errs:
        print(f"INVALID: {argv[1]} ({len(errs)} problem(s))")
        for e in errs:
            print("  -", e)
        return 1
    print(f"OK: {argv[1]} ({len(qa['answers'])} answers)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

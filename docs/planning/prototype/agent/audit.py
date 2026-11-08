#!/usr/bin/env python3
"""Tier 2 audit (T6, ADR-0005): check every drafted answer, keep a log a person can sign.

    python3 -I agent/audit.py            # re-check and update agent/audit-log.jsonl
    python3 -I agent/audit.py --sign Q03 --by "Name" # record a human sign-off on one answer

For each answer in app/qa/answers.json one line is kept in agent/audit-log.jsonl:
  answer_id, claim (the text shown), draft_claim (the text when first drafted), fact_ids,
  sources (from the facts), verdict (pass | blocked), problems[], human_edited, sign_off, signed_by.

The checker is CODE (app/qa/check_answers.py): every number, date and name must be in the cited facts.
An LLM never signs anything. 'sign_off' stays empty until a person runs --sign. Editing an answer
after it was signed clears the sign-off and marks the answer human_edited.

Honesty note: all current answers were drafted by an AI fork (Claude) from facts.json, and as of
this file no person has signed any of them. The summary line says so.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app" / "qa"))
import check_answers as ca  # noqa: E402

LOG = ROOT / "agent" / "audit-log.jsonl"
QA = ROOT / "app" / "qa" / "answers.json"
FACTS = ROOT / "app" / "stories" / "mur-sst-mauritius-2023.facts.json"
STORY = ROOT / "app" / "stories" / "mur-sst-mauritius-2023.story.json"


def read_log(path):
    if not Path(path).exists():
        return {}
    return {r["answer_id"]: r for r in (json.loads(l) for l in Path(path).read_text(encoding="utf-8").splitlines() if l.strip())}


def run(qa, facts, story, old):
    """-> list of log rows (pure: no file access)."""
    by_id = {f["id"]: f for f in facts["facts"]}
    labels = {s["label"] for s in story["steps"]}
    rows = []
    for e in qa["answers"]:
        problems = ca.check_answer(e, by_id, labels, len(story["steps"]))
        prev = old.get(e["id"], {})
        draft = prev.get("draft_claim", e["answer"])
        changed = e["answer"] != prev.get("claim", e["answer"])
        rows.append({
            "answer_id": e["id"],
            "claim": e["answer"],
            "draft_claim": draft,
            "fact_ids": e["fact_ids"],
            "sources": sorted({s for i in e["fact_ids"] if i in by_id for s in by_id[i]["source_ids"]}),
            "verdict": "blocked" if problems else "pass",
            "problems": problems,
            "human_edited": e["answer"] != draft,
            "sign_off": "" if changed else prev.get("sign_off", ""),
            "signed_by": "" if changed else prev.get("signed_by", ""),
        })
    return rows


def summary(rows):
    n, blocked = len(rows), sum(1 for r in rows if r["verdict"] == "blocked")
    edited, signed = sum(1 for r in rows if r["human_edited"]), sum(1 for r in rows if r["sign_off"])
    return f"{n} drafted, {blocked} blocked, {edited} human-edited, {signed} signed off by a person"


def write_log(rows, path=LOG):
    Path(path).write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")


def main(argv):
    qa, facts, story = (json.loads(p.read_text(encoding="utf-8")) for p in (QA, FACTS, STORY))
    old = read_log(LOG)
    rows = run(qa, facts, story, old)
    if "--sign" in argv:
        i = argv.index("--sign")
        aid, by = argv[i + 1], argv[argv.index("--by") + 1] if "--by" in argv else ""
        if not by:
            print("--sign needs --by NAME")
            return 2
        row = next((r for r in rows if r["answer_id"] == aid), None)
        if row is None or row["verdict"] != "pass":
            print(f"cannot sign {aid}: unknown or blocked")
            return 1
        row["sign_off"], row["signed_by"] = "approved", by
    write_log(rows)
    print(summary(rows))
    return 1 if any(r["verdict"] == "blocked" for r in rows) else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

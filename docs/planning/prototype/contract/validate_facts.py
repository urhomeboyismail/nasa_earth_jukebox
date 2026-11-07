#!/usr/bin/env python3
"""Code checker for facts.json (the T6 'Auditor is a code checker first' rule).

Usage: python3 -I contract/validate_facts.py FACTS.json STORY.json

A fact passes only if:
  * it matches facts.schema.json, ids are unique, source_ids exist in the story;
  * every number in its text is (a) a number that appears in the story file, or
    (b) a step number ("step 12" / "steps 3 to 5") within the story, or
    (c) the value of one of the fact's own `diff` derivations, which is recomputed here
    from the story's step values.
Dates (YYYY-MM-DD) must match a step label. Nothing else is allowed through.
"""
import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent
NUM = re.compile(r"-?\d+(?:\.\d+)?")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


def norm(x):
    return f"{float(x):.6f}".rstrip("0").rstrip(".")


def story_tokens(story):
    """Every number that appears anywhere in the story file, as normalised strings."""
    out = set()

    def walk(o, key=None):
        if isinstance(o, bool) or o is None:
            return
        if isinstance(o, (int, float)):
            out.add(norm(o))
        elif isinstance(o, str):
            if key == "frame":
                return
            for m in NUM.findall(DATE.sub(" ", o)):
                out.add(norm(m))
        elif isinstance(o, list):
            for v in o:
                walk(v)
        elif isinstance(o, dict):
            for k, v in o.items():
                walk(v, k)

    walk(story)
    return out


def check(facts_doc, story):
    errs = []
    schema = json.loads((HERE / "facts.schema.json").read_text(encoding="utf-8"))
    for e in Draft202012Validator(schema).iter_errors(facts_doc):
        errs.append(f"schema: {'/'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}")
    if errs:
        return errs
    if facts_doc["story_id"] != story["meta"]["story_id"]:
        errs.append("facts: story_id does not match the story file")
    labels = {s["label"] for s in story["steps"]}
    sources = {s["id"] for s in story["meta"]["sources"]}
    tokens = story_tokens(story)
    n = len(story["steps"])
    seen = set()
    for f in facts_doc["facts"]:
        fid = f["id"]
        if fid in seen:
            errs.append(f"{fid}: duplicate id")
        seen.add(fid)
        for sid in f["source_ids"]:
            if sid not in sources:
                errs.append(f"{fid}: source_id '{sid}' is not in the story's sources")
        text = f["text"]
        for d in DATE.findall(text):
            if d not in labels:
                errs.append(f"{fid}: date {d} is not a step label in the story")
        derived = set()
        for d in f.get("derivations", []):
            a, b = story["steps"][d["from_step"]]["value"], story["steps"][d["to_step"]]["value"]
            if a is None or b is None:
                errs.append(f"{fid}: derivation uses a rest step")
                continue
            if abs((b - a) - d["value"]) > 0.005 + 1e-9:
                errs.append(f"{fid}: derivation says {d['value']} but the steps give {round(b - a, 2)}")
            derived.add(norm(d["value"]))
            derived.add(norm(abs(d["value"])))
        stripped = DATE.sub(" ", text)
        for m in NUM.finditer(stripped):
            tok = norm(m.group())
            before = stripped[: m.start()].lower()
            is_step_ref = (
                float(tok).is_integer()
                and 1 <= int(float(tok)) <= n
                and re.search(r"\bsteps?\s*(\d+\s*(,|and|to)\s*)*$", before) is not None
            )
            if tok in tokens or tok in derived or is_step_ref:
                continue
            errs.append(f"{fid}: number {m.group()} is not in the story file and not a derivation")
    return errs


def main(argv):
    if len(argv) != 3:
        print(__doc__)
        return 2
    facts = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    story = json.loads(Path(argv[2]).read_text(encoding="utf-8"))
    errs = check(facts, story)
    if errs:
        print(f"INVALID: {argv[1]} ({len(errs)} problem(s))")
        for e in errs:
            print("  -", e)
        return 1
    print(f"OK: {argv[1]} ({len(facts['facts'])} facts)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

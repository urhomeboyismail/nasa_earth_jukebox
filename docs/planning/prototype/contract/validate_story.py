#!/usr/bin/env python3
"""Validate a story file against the T1 contract.

Usage:
    python3 -I contract/validate_story.py STORY.json [--require-real]

Exit code 0 = valid, 1 = invalid, 2 = could not read a file.
--require-real also fails a fixture (use it on anything that ships).

Two layers: story.schema.json (shape) and the cross-field rules below.
The key rule (CLAUDE.md rule 4): a gap is silence, never an invented value.
"""
import json
import statistics
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

HERE = Path(__file__).resolve().parent


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def schema_errors(story, schema):
    validator = Draft202012Validator(schema)
    out = []
    for e in sorted(validator.iter_errors(story), key=lambda e: list(e.absolute_path)):
        where = "/".join(str(p) for p in e.absolute_path) or "(root)"
        out.append(f"schema: {where}: {e.message}")
    return out


def runs(steps):
    """Group consecutive rest steps with the same reason. Returns (start, end, reason)."""
    found, cur = [], None
    for s in steps:
        if s["state"] == "rest":
            if cur and cur[2] == s["rest_reason"] and cur[1] == s["index"] - 1:
                cur[1] = s["index"]
            else:
                if cur:
                    found.append(tuple(cur))
                cur = [s["index"], s["index"], s["rest_reason"]]
        elif cur:
            found.append(tuple(cur))
            cur = None
    if cur:
        found.append(tuple(cur))
    return found


def rule_errors(story, th, require_real=False):
    errs = []
    meta, enc, steps = story["meta"], story["encoding"], story["steps"]
    n = len(steps)
    rest_below, low_below = th["coverage_rest_below"], th["low_confidence_below"]
    source_ids = {s["id"] for s in meta["sources"]}

    # fixture labelling
    if meta["is_fixture"]:
        if not meta["title"].startswith("FIXTURE"):
            errs.append("fixture: title of a fixture must start with 'FIXTURE'")
        if require_real:
            errs.append("fixture: --require-real was set, and this is a fixture (invented values)")
    else:
        if meta["eic_visualization"]["status"] == "none_verified" and "no matching" not in meta["eic_visualization"]["text"].lower():
            errs.append("eic: status none_verified must say 'no matching EIC visualization' in its text")

    # encoding
    if enc["domain_min"] >= enc["domain_max"]:
        errs.append("encoding: domain_min must be below domain_max")
    if enc["colour_key"]["source_id"] not in source_ids:
        errs.append(f"encoding: colour_key.source_id '{enc['colour_key']['source_id']}' is not in meta.sources")

    # steps
    for i, s in enumerate(steps):
        p = f"steps[{i}]"
        if s["index"] != i:
            errs.append(f"{p}: index {s['index']} should be {i} (indices must be 0..n-1 in order)")
        st, cov, val = s["state"], s["coverage_pct"], s["value"]
        if st == "rest":
            if val is not None:
                errs.append(f"{p}: rest step has a value ({val}); a gap must be null, never invented")
            if s.get("rest_reason") == "no_frame" and cov != 0:
                errs.append(f"{p}: no_frame rest must have coverage_pct 0, got {cov}")
            if s.get("rest_reason") == "low_coverage" and not cov < rest_below:
                errs.append(f"{p}: low_coverage rest needs coverage_pct < {rest_below}, got {cov}")
        else:
            if val is None:
                errs.append(f"{p}: {st} step has no value")
            else:
                if not enc["domain_min"] <= val <= enc["domain_max"]:
                    errs.append(f"{p}: value {val} is outside the domain [{enc['domain_min']}, {enc['domain_max']}]")
            if st == "data" and not cov >= low_below:
                errs.append(f"{p}: 'data' needs coverage_pct >= {low_below}, got {cov}")
            if st == "low_confidence" and not rest_below <= cov < low_below:
                errs.append(f"{p}: 'low_confidence' needs {rest_below} <= coverage_pct < {low_below}, got {cov}")
            if s.get("source_id") not in source_ids:
                errs.append(f"{p}: source_id '{s.get('source_id')}' is not in meta.sources")

    # gaps must match the rest runs exactly
    expected = runs(steps) if all("rest_reason" in s for s in steps if s["state"] == "rest") else []
    given = [(g["start_index"], g["end_index"], g["reason"]) for g in story["gaps"]]
    if sorted(expected) != sorted(given):
        errs.append(f"gaps: do not match the rest steps. Expected {sorted(expected)}, got {sorted(given)}")
    for g in story["gaps"]:
        if g["end_index"] < g["start_index"]:
            errs.append(f"gaps: end_index before start_index in {g}")
        if g["reason"] == "no_frame" and "no data" not in g["message"].lower():
            errs.append(f"gaps: a no_frame message must say 'no data' ({g['start_index']}-{g['end_index']})")

    # key moments
    seen = set()
    for k in story["key_moments"]:
        if not 0 <= k["step_index"] < n:
            errs.append(f"key_moments: step_index {k['step_index']} is out of range")
        if k["step_index"] in seen:
            errs.append(f"key_moments: two moments at step {k['step_index']}")
        seen.add(k["step_index"])

    # baseline
    b = story.get("baseline")
    if b:
        vals, bad = [], False
        for idx in b["step_indices"]:
            if not 0 <= idx < n:
                errs.append(f"baseline: step index {idx} is out of range")
                bad = True
            elif steps[idx]["state"] != "data":
                errs.append(f"baseline: step {idx} is '{steps[idx]['state']}'; a baseline uses 'data' steps only")
                bad = True
            else:
                vals.append(steps[idx]["value"])
        if not bad and abs(statistics.fmean(vals) - b["value"]) > th["baseline_mean_tolerance"]:
            errs.append(f"baseline: value {b['value']} is not the mean of its steps ({statistics.fmean(vals)})")

    return errs


def validate(story, schema=None, thresholds=None, require_real=False):
    schema = schema or load_json(HERE / "story.schema.json")
    thresholds = thresholds or load_json(HERE / "thresholds.json")
    errs = schema_errors(story, schema)
    if errs:  # the rule checks assume the shape is right
        return errs
    return rule_errors(story, thresholds, require_real)


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    require_real = "--require-real" in argv
    if len(args) != 1:
        print(__doc__)
        return 2
    try:
        story = load_json(args[0])
    except (OSError, json.JSONDecodeError) as e:
        print(f"cannot read {args[0]}: {e}")
        return 2
    errs = validate(story, require_real=require_real)
    if errs:
        print(f"INVALID: {args[0]} ({len(errs)} problem(s))")
        for e in errs:
            print(f"  - {e}")
        return 1
    print(f"OK: {args[0]}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

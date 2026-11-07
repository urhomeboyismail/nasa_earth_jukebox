# W1: The T0 thresholds are guesses

TL;DR: Every number in `contract/thresholds.json` (50 / 80 coverage, 0.8 rank correlation, 95% pixels decoded, "3 questions" kill rule) was chosen without data. Once signed, they act as law.
Status: **open**. Found in: T0 (`brainstorm/t0-lockin.md` §A). Owner: red team.

## Why it matters
- The validator and the engine already enforce these numbers. A bad cut-off silently turns real steps into rests, or plays weak data as if it were strong.
- The rules were meant to be set "before looking at data" so we cannot tune them to flatter ourselves. That protects honesty, but a number with no evidence behind it protects nothing.
- A judge asking "why 50%?" gets "we guessed" unless this is fixed.

## What we know
- The idea (a rest below a cut-off, a middle band announced as low confidence) is sound. Only the values are unsupported.
- `[assumption]`: 50 and 80 for coverage; 95% for decoding; Spearman ≥ 0.8; "≥ 3 questions".

## How to fix (in order)
1. Take the verified worked-example layers (GIBS sea-ice, MUR sea-surface temperature; FINAL §5). Decode a small sample of days offline.
2. Plot coverage_pct across those days. Pick the cut-offs at natural breaks, not round numbers, and write down why.
3. Compute rank correlation between a frame series and its cross-check on the worked examples. See what a "good" and a "bad" series look like. Set the threshold from that.
4. Log the final values in `brainstorm/decisions.md`, tick the sign-off boxes in T0 §A, and only then freeze `thresholds.json`.

## Done when
Each threshold has a one-line reason that points to a measurement, the red team has signed, and `thresholds.json` `_status` no longer says "assumption".

## Risk if we skip it
The numbers stay guesses. We keep them (they are safe defaults), but the pitch must not say they were "validated".

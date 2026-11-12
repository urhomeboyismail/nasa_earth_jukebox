# G07 Agent evaluation (scoring bug fixed) and the offline drafter

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | G02 |
| **Hotspots** | — |
| **Branch** | `feature/G07-agent-eval-drafter` |

## Goal

The agent's answers are measured against the offline matcher on questions nobody tuned against, with a scoring rule that cannot count an error as a miss. The same run decides the kill rule, and the code writes the verdict. An offline drafter proposes new Ask aliases for a person to approve, and every proposal is logged. Nothing here changes what the app does by default.

## Why

- The prototype eval `docs/planning/prototype/agent/eval/run_eval.py` has a scoring bug. `tier1_results` maps a fallback result to `factIds: []` (`run_eval.py`, the `tier1_results` function), and `judge` then scores that as a real answer. So a real question that timed out is a miss, and an adversarial question that timed out is a pass. The kill rule was computed on top of that. Its report was never measured with a key (`docs/planning/prototype/agent/eval/report.md`: "NOT RUN: no API key").
- The prototype's questions were written after the aliases, by the same author. Its own note says the static score is optimistic (`questions.json`, `_note`). So the held-out set must be written by a person, before the agent's results are seen.
- The prototype's questions name mur-sst dates and facts `F01`–`F13`. They cannot be used on the fixture or the real data as they are. Rewrite them for the data set the eval runs on, with the browser's IDs.
- The prototype's `static_matcher.mjs` imports an old path (`app/qa/match.js`). The eval must run the real `src/features/ask/ask.ts`.
- ADR-0005 (`docs/planning/adr/0005-adk-selector-and-audited-drafting.md`): an offline drafter may propose aliases and facts; a code checker and a human sign-off decide; the audit log is committed.

## Design

### Facts and the static matcher

- `scripts/agent-eval/static-ask.ts` (new, run with `npx tsx`). It builds the facts for the fixture (`public/data/fixture/manifest.json`) from the **same fixed results** as `src/features/ask/ask.test.tsx` (cold, mild, hot, insufficient), using `buildFacts`. It then:
  - writes `server/agent_eval/facts.json` when run with `--write-facts` (the snapshot the Python side reads);
  - with a questions file argument, prints one JSON object: for each question id, the result of `ask(question, facts, dates)` from `src/features/ask/ask.ts`, plus whether `guardsAllow` let it through;
  - with `--list-aliases`, prints the current `QUESTIONS` (id, factId, aliases) for the drafter.
- Find `tsx` with `node_modules/.bin/tsx`. If it is missing, use `npx --no-install tsx`. Do not add a dependency. If neither works, the static part of the eval is `NOT RUN` in the report, and the kill rule is `undecided`.
- A pytest test compares the committed `facts.json` with a fresh run of the script whenever `npx tsx` works, and is skipped with a reason otherwise.

### Question sets

- `server/agent_eval/questions/dev.json` (the agent writes it): at least 30 real and 15 adversarial questions for the fixture, with the same types as the prototype (lookup, change, extreme, gap, method, source; adversarial: cause, forecast, steering, arithmetic, unknown date). Every ID in `expected_fact_ids` and `allowed_fact_ids` exists in `facts.json`. `open_wording` marks a question that uses no alias word. Write the expected IDs by reading the facts, not by running the matcher.
- `server/agent_eval/questions/heldout.json` (**a person writes it**): at least 15 real questions, each with `"author"` set to the writer's name, written before any agent result was seen, and with no question copied from the aliases. The adversarial part is optional here. Until it exists, the held-out part of the eval is `NOT RUN` and this ticket is `blocked: held-out questions`.
- The header of each file says who wrote it and when.

### The eval (`server/agent_eval/run_eval.py`, new)

- Pure scoring in `server/agent_eval/score.py` (no I/O), tested without a key.
- For the agent, call `GroundedAsk`-equivalent code from G02 (`app.agent.ask`) in-process, with a real key only when one is set. Without a key the agent part is `NOT RUN: no API key`.
- Each result has a **status**:
  - `static`: the offline matcher (always measured);
  - `ok`: the agent answered in time (its `factIds` may be empty);
  - `timeout`, `error`, `unavailable` (503, 429, or no key): **not measured**.
- The text that is judged is the text the browser would show: the texts of the chosen facts, joined, for the agent; `ask()`'s answer for the static matcher.
- **Scoring rules.**
  - Real question: passed when the set of chosen IDs equals `expected_fact_ids`.
  - Adversarial question: passed when nothing is chosen, or only IDs in `allowed_fact_ids` are chosen.
  - Any number in the judged text that is not in the facts fails the question.
  - A **not measured** result is never a pass and never a fail. It is counted separately, and shown in the report as "not measured: N".
- **Kill rule** (written by the code): on the held-out open-wording questions, the agent must pass at least 3 more questions than the static matcher, and at least 90% of the held-out questions must be measured. If the second condition fails, the verdict is `NOT DECIDED: too few answers measured`. If the first fails, the verdict is `KILL the agent: ship the offline matcher only`. Otherwise `KEEP the agent (behind agent_enabled)`.
- The eval writes `server/agent_eval/report.md`. Nobody edits it by hand. Its header says it is generated.
- The eval time limit is the app's (`agent_timeout_seconds`, 2.5 s) unless `--timeout` is given. Run the app's value. Report how many answers hit the limit.

### The offline drafter (`server/agent_eval/drafter.py`, new)

- Reads `--list-aliases` output and `facts.json`. For each stored question it asks the keyed model for up to 8 alternative phrasings a listener might type. The prompt contains the question and the fact text only, never the data.
- **Checker (code, pure, tested):** a proposal is `blocked` when it is longer than 60 characters, contains a digit or a date that is not in its fact's text, contains a steering word (the list in `src/features/ask/ask.ts` `STEERING`, copied with a test that compares the two lists), duplicates an existing alias (after lower-casing), or maps to a fact ID that does not exist.
- **Audit log:** `server/agent_eval/alias-audit-log.jsonl`, one line per proposal: `proposal_id`, `question_id`, `fact_id`, `alias`, `checker` (`pass` or `blocked`), `problems`, `decision` (empty, `approve`, `reject` or `edit`), `decided_by`, `decided_on`. The drafter appends only. A person sets `decision` with `python3 -I server/agent_eval/drafter.py --decide <proposal_id> approve --by "Name"`.
- The drafter **never** edits `src/`. An approved alias is copied into `QUESTIONS` in `src/features/ask/facts.ts` by a person, in a separate commit.
- Without a key the drafter prints `NOT RUN: no API key` and writes nothing.

### Documentation

- `server/agent_eval/README.md` (new, short): how to run each part, the scoring rules, the held-out rule, the kill rule, and the verdict line from `report.md` (copied by a person after a real run). Say plainly what has and has not been measured.
- The root README gets one line about the verdict, as G05 describes for the AI section. If S03 is not `done`, post on the board instead.

## Reuse

- G01 (`app/agent/fake.py`, `keyed_model`), G02 (`app/agent/ask.py`, the service and the gating).
- `src/features/ask/facts.ts`, `ask.ts`, `ask.test.tsx` (the fixed results), `public/data/fixture/manifest.json`.
- The prototype's `docs/planning/prototype/agent/eval/run_eval.py` for the structure and the scoring rules. Port the rules, not the bug.

## Touches

- `scripts/agent-eval/static-ask.ts` (new)
- `server/agent_eval/` (new): `score.py`, `run_eval.py`, `drafter.py`, `facts.json`, `questions/dev.json`, `questions/heldout.json` (a person), `alias-audit-log.jsonl`, `report.md` (generated), `README.md`
- `server/tests/test_agent_eval.py` (new)
- The root README (one line, see above)
- Nothing in `src/` changes. `ask.ts` and `facts.ts` are read, not edited.

## Steps

1. Read G02. Check that `npx tsx` can run the static script. If not, record that in **Result**.
2. Write `static-ask.ts` and `facts.json`. Check the JSON matches a fresh run.
3. Write `score.py` and its tests first. Include the regression test for the bug.
4. Write the dev questions for the fixture. Each expected ID is checked against `facts.json`.
5. Ask a person (on the board) to write the held-out questions. Wait for them.
6. Write `run_eval.py`. Run it without a key: the report must say NOT RUN for the agent and must not claim a verdict.
7. Write `drafter.py` and its checker and log tests. Run it without a key: nothing is written.
8. Write `server/agent_eval/README.md`.

## Tests

`server/tests/test_agent_eval.py`, pytest. No key. The static script is run only when `tsx` is found.

1. **The bug (regression).** An agent result with status `timeout` for a real question is **not measured**. It is not a fail, and it does not count as a static answer. The same for `error` and `unavailable`.
2. A static `NOT_FOUND` result for an adversarial question passes; the same question with an agent result that chooses an allowed ID passes.
3. A number in the judged text that is not in the facts fails.
4. The kill rule: 3 more wins and at least 90% measured → KEEP; 2 more wins → KILL; 5 wins but 70% measured → NOT DECIDED.
5. Held-out file: missing, or fewer than 15 real questions, or no `author` → the held-out part is NOT RUN and no verdict is written.
6. Dev file: every expected ID exists in `facts.json`.
7. Drafter checker: each of the blocked cases (too long, a digit not in the fact, a steering word, a duplicate alias, an unknown fact ID) is blocked, and a clean alias passes.
8. The steering list in the drafter equals the list in `ask.ts` (a regex copy with a test that reads the TypeScript source, as `test_pages_match_frontend` does).
9. Audit log round trip: append, decide, re-read; the decision is kept and no line is lost.
10. `report.md` is regenerated identically from the same inputs (the output has no timestamps).

## Guardrails

Not applicable to sound. Held-out questions are kept out of any prompt the model sees.

## Done when

- `score.py` never counts a not-measured result as a pass or a fail, and test 1 passes.
- `run_eval.py` runs with no key, writes `report.md` with NOT RUN for the agent, and writes no verdict.
- The dev set meets the counts above and every ID exists.
- The held-out set is in the repo, written by a person with `author` set. (Until then the ticket is `blocked: held-out questions`, and Result says so.)
- The drafter runs with no key and writes nothing; with a key, every proposal has a checker verdict and a log line.
- The README says exactly what has and has not been measured.

## Checks

```bash
(cd server && .venv/bin/python -m pytest)
env -u GEMINI_API_KEY -u GOOGLE_API_KEY bash -c 'cd server && .venv/bin/python -m pytest'
(cd server && .venv/bin/python -I agent_eval/run_eval.py)
npm run lint && npm test
```

Run the real eval with a key only if a person has the key and the held-out set (see the README). Paste the report's first 40 lines in **Result**.

## Out of scope

- Changing the default answers or the Ask panel (G03 does the panel).
- A real-data eval. That comes after the real data sets are checked (EIC03) and needs its own question set.
- Writing facts or answers with a model. The drafter proposes aliases only.
- Any change to `src/`.

## Result

Built by agent E, 2026-11-12. **Status: blocked: held-out questions.** Everything else is done.

- `tsx` is not installed in the repo (`npx --no-install tsx` fails, no `node_modules/.bin/tsx`), and no dependency was added. To check the static script, tsx was installed in a scratch folder outside the repo and used through `TSX_BIN`. With it: `static-ask.ts --list-aliases` and the questions run work, and `test_facts_json_matches_a_fresh_run` passes (without it, that test is skipped). `facts.json` was first written by running the real `buildFacts` through vitest.
- Dev set: 37 real and 17 adversarial questions. Offline matcher on it: 36 of 54 passed (real 19 of 37, adversarial 17 of 17, open wording 7 of 23). The agent was NOT RUN (no API key). No verdict is written.
- Held-out set: NOT RUN. `questions/heldout.json` must be written by a person (request posted on `docs/AGENT-BOARD.md`).
- Not run: the drafter with a key; the real eval with a key.

Checks:

```
(cd server && python -m pytest)                     -> 295 passed, 2 skipped
env -u GEMINI_API_KEY ... pytest tests/test_agent_eval.py -> 21 passed, 2 skipped (no tsx: facts check and held-out file skipped)
python -I agent_eval/run_eval.py  -> report.md written: matcher 36 passed / 18 failed; Agent NOT RUN: no API key; Held-out NOT RUN: no held-out file; no verdict
python -I agent_eval/drafter.py   -> NOT RUN: no API key (log unchanged)
npm run lint   -> no errors
npm run build  -> built, OK
npm test       -> run 1: 67 failed of 2003 (timeouts under load); run 2: 1 failed, src/data/change-regression.test.ts timed out at 90 s. No file under src/ was changed by this ticket.
```


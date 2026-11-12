# Agent eval and alias drafter (G07)

Measures the Ask agent (`app/agent/ask.py`) against the offline matcher (`src/features/ask/ask.ts`), and drafts new Ask aliases for a person to approve. Nothing here changes what the app does by default, and nothing here edits `src/`.

## What has and has not been measured

- **Measured:** the offline matcher on the dev set (`questions/dev.json`, fixture data), through the real `ask.ts`. The dev set was written by the same agent that built the eval, so the score is optimistic.
- **Not measured:** the agent. No key was used, so there is no agent number and no verdict.
- **Not measured:** the held-out set. `questions/heldout.json` has to be written by a person (at least 15 real questions, each with `author`, written before any agent result is seen, none copied from the aliases). Until it exists, the held-out part is `NOT RUN` and `report.md` writes no verdict.
- The model id (`agent_model`) is still `[unverified]`.

## Run

```bash
cd server
.venv/bin/python -m pytest tests/test_agent_eval.py        # no key needed
.venv/bin/python -I agent_eval/run_eval.py                  # writes report.md; --timeout S, --pace S
.venv/bin/python -I agent_eval/drafter.py                   # needs a key and tsx; appends proposals to alias-audit-log.jsonl
.venv/bin/python -I agent_eval/drafter.py --decide <proposal_id> approve --by "Name"   # approve | reject | edit
```

The offline matcher runs through `node_modules/.bin/tsx` or `npx --no-install tsx` (no dependency is added; the `TSX_BIN` variable can point at another copy). If neither works, that part is `NOT RUN`. `npx --no-install tsx scripts/agent-eval/static-ask.ts --write-facts` rewrites `facts.json`; a test checks it against a fresh run when tsx works.

## Scoring

- Each result has a status: `static` (the matcher), `ok` (the agent answered in time), or `timeout`, `error`, `unavailable` (503, 429, no key). The last three are **not measured**: never a pass, never a fail, counted apart as "not measured: N". (The prototype turned them into empty answers and scored them. That was the bug.)
- Real question: passes when the chosen fact IDs equal `expected_fact_ids`. Adversarial: passes when nothing is chosen, or only IDs in `allowed_fact_ids`.
- Any number in the judged text (the chosen facts' texts, or the matcher's answer) that is not in the facts fails the question.
- The time limit is the app's `agent_timeout_seconds` (2.5 s) unless `--timeout` is given. `report.md` says how many answers hit it.

## Kill rule (written by the code)

On the held-out open-wording questions the agent must pass at least 3 more than the matcher, and at least 90% of the held-out questions must be measured. Otherwise: `NOT DECIDED: too few answers measured`, or `KILL the agent: ship the offline matcher only`. If both hold: `KEEP the agent (behind agent_enabled)`.

## Drafter

It asks the model for up to 8 other phrasings of each stored question (the prompt holds the question and its fact text, never data). Code blocks a proposal that is over 60 characters, has a digit not in its fact, has a steering word (the list is compared with `ask.ts` by a test), repeats an alias, or names an unknown fact. Every proposal is logged in `alias-audit-log.jsonl` (append only). A person sets the decision; an approved alias is copied into `QUESTIONS` in `src/features/ask/facts.ts` by a person, in a separate commit.

## Verdict

None yet. After a real run, a person copies the verdict line from `report.md` here.

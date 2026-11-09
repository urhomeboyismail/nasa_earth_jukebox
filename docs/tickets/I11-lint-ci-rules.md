# I11 Lint and CI rules that enforce `frontend.md`; ruff for the server

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | I04, I06 |
| **Hotspots** | — |
| **Branch** | `chore/I11-lint-ci-rules` |

## Goal

The rules in `.claude/rules/frontend.md` that a tool can check are checked by `npm run lint` and by CI. The server gets a linter too. The data check (`npm run check-data`) runs in CI.

## Why

- `.oxlintrc.json` sets two rules only: `react/rules-of-hooks` (error) and `react/only-export-components` (warn). The rules in `frontend.md` (no `any`, no `as` casts that silence an error, no `!` in new code, no `setState` in an effect, and a file that exports components exports only components) are not enforced.
- The `react/only-export-components` rule is a warning, so it does not fail the build.
- CI (`.github/workflows/ci.yml`) runs `npm run lint`, `npm run build` and `npm test` for the web job. It does not run `npm run check-data`, although `docs/PLAN.md` and `AGENTS.md` say it must pass for data.
- The server job runs `python -m pytest` only (`.github/workflows/ci.yml`, the `server` job). There is no ruff configuration in `server/`.
- This ticket runs after I04 (boundaries use zod, so no casts remain) and I06 (casts and `!` removed), so the new rules do not fail on code those tickets are changing.

## Reuse

- `.oxlintrc.json` (the root config).
- `npm run check-data` (`vitest run src/data src/analysis/synthetic.test.ts`).
- `.claude/rules/frontend.md` for the list of rules.

## Touches

- `.oxlintrc.json`: review Roni (front-end rules) and the team leader.
- `package.json`: scripts only, if needed. Review: the team leader.
- `.github/workflows/ci.yml`: review Bhavish.
- `server/ruff.toml` (new), `server/requirements.txt` (add `ruff` in the test section). Review: Mohammad.
- Fixes in source files only where a new rule finds a real violation that is small to fix. Each such file is reviewed by its owner.

## Steps

1. List the rules oxlint has. Run `npx oxlint --help` and look at the rules documentation for the installed version (`node_modules/oxlint`). Find the names of: no explicit `any`, no non-null assertion, type assertions that are not `as const`, and hooks that set state in an effect (if the installed version has one). Write the names you found in the Result, and the names you could not find.
2. Enable the rules you found, first as `warn`, and count the violations with `npm run lint`. Paste the count in the Result.
3. If the count is 20 or fewer, fix them and set the rules to `error`. If it is more, enable only the rules with fewer violations, set them to `error`, and list the others in Out of scope with their counts.
4. Make `react/only-export-components` an `error` once the warnings are fixed. Put each fix in the file it is in.
5. For a rule that oxlint does not have, write a small check in `scripts/check-frontend-rules.mjs` that greps for the pattern in `src/`, and run it in `npm run lint` (add it to the `lint` script). Keep it simple: a list of patterns and the files they must not appear in.
6. In CI, add a step to the web job for `npm run check-data`, after `npm test`.
7. For the server: add `server/ruff.toml` with `select = ["E", "F", "I", "B"]` and a line length of 120. Add `ruff` to `server/requirements.txt` under the test section. Add a step in the server job: `ruff check app tests`. Run it locally, and fix what it finds, or add an exact `ignore` with a reason.
8. Run every check below.

## Tests

- No unit tests for the lint configuration. The check is that `npm run lint`, `npm run check-data`, `ruff check` and the existing tests all pass on the branch.
- For the custom check in Step 5, a test next to the script that proves it fails on a sample string (or run it once on a file that has the pattern and show the output in the Result).

## Guardrails

Not applicable: no sound or visual change.

## Done when

- `npm run lint` enforces the rules listed in Step 3, and fails on a deliberate violation (show it once in the Result, then revert).
- The new rules are `error`, not `warn`, except where Out of scope says otherwise.
- CI runs `npm run check-data` and `ruff check`.
- `npm run lint && npm test && npm run build` and `(cd server && .venv/bin/python -m pytest)` pass.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
(cd server && .venv/bin/pip install ruff && .venv/bin/ruff check app tests && .venv/bin/python -m pytest)
```

## Out of scope

- Rules that need type information, if oxlint does not provide them without a second tool.
- Formatting (`ruff format`, Prettier). That would change many files at once.
- Visual or accessibility rules (the axe checks in tests cover those).

## Result

Not started.

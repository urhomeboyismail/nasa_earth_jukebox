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

- `.oxlintrc.json`.
- `package.json`: scripts only, if needed.
- `.github/workflows/ci.yml`.
- `server/ruff.toml` (new), `server/requirements.txt` (add `ruff` in the test section).
- Fixes in source files only where a new rule finds a real violation that is small to fix.

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
- `typescript/no-non-null-assertion` (no `!`): 30 in app code (`src/audio/engine.ts` alone has 13, and it is the `engine` hotspot), 306 counting tests. Over the limit of 20 in Step 3, so not enabled.
- `no-explicit-any` and `consistent-type-assertions` in tests, their helpers (`test*.ts`, `*TestSupport.ts`, `toneMock.ts`, `src/test/`) and `scripts/`: 37 `any` and 350 assertions, mostly casting mocks. Turned off there by an override.
- Three casts in hotspot files I11 does not list, exempted by name in `.oxlintrc.json` (second override). Remove each entry when the file's ticket takes the cast out: `src/App.tsx:219` (`app`, held by JB08: a CSS-variable `style`, use the `CssVars` type as `Slider.tsx` does), `src/hooks/useVoiceAssistant.ts:63` (`voice`, held by JB08: narrow with `'date' in previous`), `src/data/schema.ts:243` (`schema`: `Note.midi` already returns `number | null`, so the cast can just go).
- E501 (line too long) in ruff: 184 lines over 120. Ignored in `server/ruff.toml`, because rewrapping them is formatting. I001 in `server/app/api/assistant.py` (two imports inside handlers) is ignored for that file only, because it is the `server-assistant` hotspot.

## Result

Done 2026-11-13, agent D, branch `chore/I11-lint-ci-rules`.

**Step 1, rule names** (oxlint 1.90.0, from `node_modules/oxlint/configuration_schema.json`). All found: `typescript/no-explicit-any`, `typescript/no-non-null-assertion`, `typescript/consistent-type-assertions` (with `assertionStyle: "never"`, which still allows `as const`: the 51 `as const` in app code pass), `react/set-state-in-effect`. None missing, so Step 5's grep script was not needed.

**Step 2, counts with the four rules as `warn`** (`npm run lint`, whole repo): 704 problems. `consistent-type-assertions` 361, `no-non-null-assertion` 306, `no-explicit-any` 37, `set-state-in-effect` 0, `only-export-components` 0. In app code only (no tests, test helpers or scripts): `no-explicit-any` 0, `set-state-in-effect` 0, `consistent-type-assertions` 11, `no-non-null-assertion` 30.

**Step 3 and 4, now `error`:** `react/only-export-components`, `react/set-state-in-effect`, `typescript/no-explicit-any`, `typescript/consistent-type-assertions` (never). Of the 11 assertions, 8 are fixed without a cast:

- `Slider.tsx`, `Magnifier.tsx`: typed `CssVars` style, the pattern `Mascot.tsx` already uses.
- `mySoundMix.ts`: `VOICE_IDS.some(voice => voice === name)`.
- `captions.ts`: a literal `Record<VoiceId, string>`, so a new voice is now a type error until it has a caption.
- `analyze.ts`: `CategoryId` is `string`, so a type annotation is enough.
- `lru.ts`: values are boxed, so a stored `undefined` is still told apart from a missing key.
- `registry.ts`: a type predicate `isOfType` narrows the action.
- `assistant/audio.ts`: `event.data instanceof ArrayBuffer` (the worklet posts `this.frame.buffer.slice(0)`).

The other 3 are in hotspots (Out of scope).

**A deliberate violation fails** (`src/zz-probe/Probe.tsx`, then deleted):

```
src/zz-probe/Probe.tsx:8:14: error react(only-export-components): Fast refresh only works when a file only exports components. …
src/zz-probe/Probe.tsx:4:21: error react(set-state-in-effect): Calling setState synchronously within an effect can trigger cascading renders …
src/zz-probe/Probe.tsx:4:26: error typescript(consistent-type-assertions): Do not use any type assertions. …
src/zz-probe/Probe.tsx:5:12: error typescript(no-explicit-any): Unexpected `any`. Specify a different type. …
exit=1
```

**Step 6:** CI's web job runs `npm run check-data` after `npm test`.

**Step 7:** `server/ruff.toml` (`select = ["E", "F", "I", "B"]`, line length 120), `ruff>=0.8` under Tests in `server/requirements.txt`, and a `ruff check app tests` step before pytest in the server job (job name kept as `Server (pytest)`, so the required check keeps its name). Ruff 0.17.5 found 195: 184 E501 (ignored, see Out of scope), 7 I001 and 3 F401 (fixed with `--fix`, except the 2 I001 in the hotspot), 1 B017 (`tests/test_assistant.py`: `pytest.raises(Exception)` is now `pytest.raises(WebSocketDisconnect)`).

**Checks** (on this laptop the suite runs with `--pool=forks --maxWorkers=1` because of memory; the same files as `npm test` and `npm run check-data`):

```
$ npm run lint
> oxlint
lint exit=0

$ npm test   (npx vitest run --pool=forks --maxWorkers=1)
 Test Files  193 passed (193)
      Tests  2848 passed (2848)
vitest exit=0

$ npm run build
✓ built in 1.25s
build exit=0

$ npm run check-bundle
index-CoXI8A_U.js: 81053 bytes gzip (79.2 KB), within the budget of 84362 bytes (82.4 KB).

$ npm run check-data   (npx vitest run src/data src/analysis/synthetic.test.ts --pool=forks --maxWorkers=1)
check-data exit=0

$ cd server && .venv/Scripts/ruff.exe check app tests
All checks passed!

$ cd server && .venv/Scripts/python.exe -m pytest -q
321 passed, 2 skipped in 14.72s
```

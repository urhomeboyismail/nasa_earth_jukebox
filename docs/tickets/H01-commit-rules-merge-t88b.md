# H01 Commit the rules and docs, merge T88b, remove the duplicate brainstorm

| | |
|---|---|
| **Priority** | P0 |
| **Size** | S (under half a day) |
| **Who** | 👤 |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/H01-commit-rules-merge-t88b` (the commit goes on `chore/tickets-v3`, see Steps) |

## Goal

The rules, the plan, the ticket queue and the archive are committed on `main` in clean commits. `feature/T88b-demo-script` is merged, and the duplicate root `brainstorm/` folder is gone. After that, both agents can claim tickets from `docs/TICKETS.md`.

## Why

- The working tree is not clean, and the list in the brief is incomplete. On 9 Nov, `git status --short` shows 31 entries. Besides `.claude/rules/*`, `AGENTS.md`, `docs/PLAN.md`, `docs/planning/BRAINSTORM-9NOV.md`, `docs/features/TICKETS-TEMPLATE.md` and `.claude/settings.json`, these are modified too: `.claude/rules/workflow.md`, `docs/AGENT-BOARD.md`, `docs/PRE-HACKATHON-WORK.md`, `docs/adk-spike.md`, `docs/data-sources.md`, `docs/features/README.md`, `docs/planning/README.md`. Three code files are modified as well: `scripts/make_tokens.mjs`, `src/data/check.ts` and `src/data/sound-regression.test.ts`. Code does not belong in a docs commit.
- `docs/TICKETS.md`, `docs/tickets/` and `docs/archive/README.md` are untracked. The renames into `docs/archive/` are staged.
- `docs/features/TICKETS-TEMPLATE.md` is staged as a rename to `docs/archive/features/TICKETS-TEMPLATE.md`. The rules and `docs/features/README.md` already point at the new template, `docs/tickets/_TEMPLATE.md`.
- Your earlier uncommitted edits (to `.claude/rules/*`, `AGENTS.md`, `docs/PLAN.md` and `BRAINSTORM-9NOV.md`) and the reorganisation's edits are in the **same files**, so they cannot be split cleanly into two commits. Commit them together.
- The three code files (`scripts/make_tokens.mjs`, `src/data/check.ts`, `src/data/sound-regression.test.ts`) changed only in a comment that points to the archived ticket file. They belong to the reorganisation. Lint and the tests passed after the change (61 files, 1115 tests; server 82).
- `.claude/settings.json` is now `{}`. The committed version has a `PostToolUse` hook that runs `.claude/hooks/layout-changed.sh`. Removing it fits "layout is deferred" (`.claude/rules/platform.md`), but it has to be a decision. The S02 branch also deletes the hook script (see S02).
- The root `brainstorm/` folder is tracked and identical to `docs/planning/brainstorm/` (`diff -r brainstorm docs/planning/brainstorm` prints nothing on 9 Nov). The queue does not point at the root copy.
- `feature/T88b-demo-script` (commit `f25aeb8`) adds one file, `docs/submission/demo-script.md`. It is not on `main`.

## Reuse

- `.claude/rules/git.md`: commit as the person working, with their own git identity, and no AI attribution (no `Co-Authored-By` line, no "Generated with" line).
- `docs/tickets/_TEMPLATE.md` is the only ticket template. Do not add another.

## Touches

Git only: branches, commits, merges, and `git rm -r brainstorm`. Nothing else is written by this ticket, except what is staged from the working tree.

## Steps

1. Check the state before anything else: `git status --short`, `git diff --stat` and `git diff --cached --stat`. Compare the output with the list in Why. Decide which commit each modified file belongs to.
2. Decide about `.claude/settings.json` (see Why). If the layout hook should stay, restore it with `git checkout -- .claude/settings.json` before staging.
3. Check that nothing points at the root copy: `grep -rn "brainstorm/" AGENTS.md docs .claude | grep -v "docs/planning/brainstorm"`. Fix or report each hit.
4. One commit for the rules, the v3 plan and the queue. Run `git switch -c chore/tickets-v3 main`. Git carries the uncommitted edits across, because the only file that differs between `main` and `feature/T88b-demo-script` is `docs/submission/demo-script.md`. Stage everything from the reorganisation: `git add -A .claude AGENTS.md docs scripts/make_tokens.mjs src/data/check.ts src/data/sound-regression.test.ts` (this includes `docs/TICKETS.md`, `docs/tickets/`, `docs/archive/` and the staged renames). Check with `git diff --cached --stat` that nothing else is staged. Commit with `chore: v3 plan, one ticket queue for two agents, old tickets archived`, and a body that says why: the rules now point at `docs/PLAN.md` §6.3 and the queue, and built or replaced tickets moved to `docs/archive/`.
5. (No second commit is needed. Your earlier edits share files with the reorganisation, so they go in the step 4 commit.)
6. Duplicate folder, on its own commit on `chore/tickets-v3`. Run `git rm -r brainstorm`, then commit `chore: remove the duplicate root brainstorm folder`, with a body that says the folder is identical to `docs/planning/brainstorm/`.
7. Merge on `main`, locally, with no push. Run `git switch main`, then `git merge --no-ff chore/tickets-v3` and `git merge --no-ff feature/T88b-demo-script`. For `docs/PRE-HACKATHON-WORK.md` and `docs/AGENT-BOARD.md`, which are add-only, keep both sides of a conflict.
8. Record the settings decision from Why in the merge message of `chore/tickets-v3`.
9. Run the checks on `main`.
10. Tell both agents that `docs/TICKETS.md` is on `main`. Their worktrees start from the new `main`: `git worktree add ../nasa-a main` and `git worktree add ../nasa-b main`.

## Tests

Not applicable: no code change. The checks below run the existing suite on the merged `main`.

## Guardrails

Not applicable: no sound or visual change.

## Done when

- `git status --short` is empty on `main`. Anything left out is named in the merge message, with the reason.
- `git log --oneline -8` shows the `chore/tickets-v3` merge and the T88b merge.
- `git log --format=%B -10 main | grep -ci "co-authored\|generated with"` prints `0`.
- `brainstorm/` is gone; `docs/planning/brainstorm/` is still there.
- `docs/TICKETS.md` and `docs/tickets/` are tracked.
- The `.claude/settings.json` change is committed as decided, or restored, and the decision is written down.
- The checks pass on `main`.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data                          # only if public/data/ changed in the merge
(cd server && .venv/bin/python -m pytest)   # only if server/ or src/pages.ts changed
```

## Out of scope

- Pushing, opening pull requests and deleting remote branches. Ask the user first (`.claude/rules/workflow.md`).
- The layout question. The team lead decides it at the end (`.claude/rules/platform.md`).
- The three code files that are modified in the working tree. They get their own tickets or are reverted by their owner.

## Result

Not started.

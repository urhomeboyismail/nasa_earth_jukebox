# MC05 Pull request: the Mission Control look into main

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent+👤 (an agent prepares; a person says push and merges) |
| **Needs** | MC01, MC02, MC03, MC04 |
| **Hotspots** | — |
| **Branch** | `chore/jpl-hud-theme` (no new branch) |

## Goal

`chore/jpl-hud-theme`, with MC01 to MC04 merged into it, reaches `main` through one pull request with a clear description and the real check output.

## Why

- `.claude/rules/git.md`: branches reach `main` only through a pull request (`gh pr create`). The person merges.
- The look spans several commits and four follow-up tickets. One reviewed pull request is easier to judge than five.

## Reuse

- `/ecc:pr` or `gh pr create --base main`.
- The design contract and the browser QA evidence from the restyle session (summarised in MC01 to MC04's Results).

## Touches

`docs/PRE-HACKATHON-WORK.md` (a line under "During the hackathon"), `docs/TICKETS.md` (rows to `done` after the merge).

## Steps

1. Check that MC01 to MC04 are merged into `chore/jpl-hud-theme`, and rebase or merge `main` in if it moved.
2. Run the checks and keep their output.
3. Write the description: what changed (backdrop, energy hook, HUD panels, mono readouts), why (the design contract), how it was tested (commands and results, browser QA), and what a person still has to check (the MC02 screen reader pass).
4. **👤** Ask before pushing. When the person says push: `git push -u origin chore/jpl-hud-theme`, then `gh pr create --base main`. Add no AI attribution (`.claude/rules/git.md`).
5. After the person merges: set MC01 to MC05 to `done` and add the line to `PRE-HACKATHON-WORK.md`.

## Done when

- A pull request into `main` is open, with the checks' real output in its description.
- After the merge: the rows are `done` and the work log has its line.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

## Out of scope

- Merging. The person merges the pull request.

## Result

Filled in by the agent.

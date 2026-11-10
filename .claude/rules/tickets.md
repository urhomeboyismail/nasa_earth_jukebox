# Tickets: one queue, claimed by agents

All open work is one queue: `docs/TICKETS.md`, with one file per ticket in `docs/tickets/<ID>-<slug>.md`. Up to six coding agents (A to F) work from it at the same time. Built, cut and replaced tickets are in `docs/archive/` (index: `docs/archive/README.md`). The v3 design that most tickets build is `docs/PLAN.md` §6.3.

## The ticket check (mandatory, before anything else)

Every agent checks which tickets are unclaimed **before it starts, and again before it claims or branches**. Claims only count once they are on `origin/main`, so the check reads `docs/TICKETS.md` from there, not from the working copy.

- `python3 .claude/hooks/tickets.py status` prints what is claimed (and so which hotspots are held), what is ready to merge, and the unclaimed tickets you may take now, in queue order. The hooks in `.claude/settings.json` run it at session start and whenever a prompt mentions tickets; run it by hand if they did not.
- Take the **first** ticket it lists. Never take one listed as claimed, and never a `👤` ticket.
- `.claude/hooks/tickets.py guard` (a PreToolUse hook on Bash) refuses to create a `feature/`, `fix/` or `chore/` branch named after a ticket that is not `claimed` on `origin/main`. Claim first (step 2 below), then branch. Do not work around it: if it blocks you, pull, re-run the check and pick again.
- If the check cannot reach origin it warns. Fix the connection and re-run it before claiming; never claim on a stale table.
- Agents are lettered A to F. Use your own letter in `claimed: <letter>, <date>`, and the worktree `../nasa-<letter>`.

## Doing a ticket

0. **Run the ticket check** (above).
1. **Read first:** `AGENTS.md`, `docs/PLAN.md` (§5 interfaces, §6.3 v3), the queue's claim protocol at the top of `docs/TICKETS.md`, the ticket's own file, and `docs/AGENT-BOARD.md` (open requests addressed to you).
2. **Pick and claim** exactly as the queue says: the first `open` row whose **Who** is `agent` or `agent+👤`, whose **Needs** are all `done`, and whose **Hotspots** don't overlap a ticket any other agent has claimed. Claim with a `chore: claim <ID>` commit on local `main`. Never claim a `👤` ticket.
3. **Work in your own worktree** (`../nasa-<your letter>`), on one branch per ticket: `feature/<ID>-<slug>`, `fix/<ID>-<slug>` or `chore/<ID>-<slug>`.
4. **Change only the files under the ticket's Touches.** Anything else, or a detail you don't own (an interface, a manifest field, a wording, a design choice), goes to `docs/AGENT-BOARD.md` first. Carry on with what doesn't depend on the answer.
5. **Finish:** run the checks (`workflow.md`), paste their real output under **Result** in the ticket file, and set the queue row to `ready: <branch>`. The person merges. Don't push or open a PR without asking. After the merge: `done`, and a line in `docs/PRE-HACKATHON-WORK.md`.

## Adding a ticket

1. Copy `docs/tickets/_TEMPLATE.md` and fill in every section, with `file:line` evidence under **Why**.
2. **As few tickets as possible.** Split only when one ticket would cross two owners' folders (`docs/PLAN.md` §4) or be too big to review in one sitting. Never split by layer ("types", then "logic", then "UI").
3. **Each ticket is independent.** It builds on `main` as it is today and can be merged on its own. If an order is unavoidable, put the earlier ticket under **Needs**.
4. Add its row to the right priority band in `docs/TICKETS.md`, with its hotspots. A ticket that edits a hotspot file must list it.
5. New features come from the catalogue in `docs/planning/BRAINSTORM-9NOV.md` §4 or from the team. Use the catalogue ID (F-number) when there is one.

## Always

- Never edit another agent's claimed ticket file except its own row status when asked.
- Nothing specific to one data set in `src/` (`phases.md`). No AI attribution (`git.md`).

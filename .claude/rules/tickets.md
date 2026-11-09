# Tickets for a catalogue feature

The feature catalogue (F36 onward) is in `docs/planning/BRAINSTORM-9NOV.md` §4. When you are asked to implement one of its features ("Implement F37"):

1. **Read first:** `AGENTS.md`, `docs/PLAN.md`, the feature's card, `docs/features/README.md` (who owns what), and `docs/AGENT-BOARD.md` (open requests that touch this feature).
2. **Claim it.** Add the feature and the person to the ownership table in `docs/features/README.md`. If someone else already owns it, stop and ask.
3. **Write the ticket file:** `docs/features/<ID>-<slug>/TICKETS.md`, copied from `docs/features/TICKETS-TEMPLATE.md`.
4. **As few tickets as possible.** Use the minimum number that delivers the feature, and prefer one. Split only when a single ticket would touch two owners' folders (`docs/PLAN.md` §4) or would be too big to review in one sitting. Never split by layer ("types", then "logic", then "UI") when one ticket can carry all three.
5. **Each ticket is independent.** It builds on `main` as it is today, not on another unmerged ticket, and it can be merged on its own. If an order is unavoidable, say so in the ticket and keep the later one mergeable anyway (a default or a stub behind the same export).
6. **Each ticket lists:** goal, files (inside one owner's area where possible), steps, done when, and the checks to run (`workflow.md`).
7. **Run them one at a time.** One branch per ticket (`feature/<ID>-T<n>-<slug>`), the checks with their real output, then tick the ticket in `TICKETS.md` and add a line to `docs/PRE-HACKATHON-WORK.md`. Don't push or open a PR without asking.
8. **Stay in your lane.** Never edit another feature's `TICKETS.md`. If you need a detail from another feature or owner (an interface, a manifest field, a wording, a design choice), post a request on `docs/AGENT-BOARD.md` and carry on with what doesn't depend on it.
9. **The usual rules still apply:** nothing specific to one data set in `src/` (`phases.md`), the layout rule (`platform.md`), and no AI attribution (`git.md`).

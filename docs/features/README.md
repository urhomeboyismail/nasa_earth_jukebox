# Features: one folder per feature, one ticket file each

The new features (F36 onward) are cards in [`docs/planning/BRAINSTORM-9NOV.md`](../planning/BRAINSTORM-9NOV.md) §4. Each one is built on its own, by one person and their agent, through its own ticket file. Two people can work on two features at the same time without touching each other's files.

## The loop

1. **Pick a feature** that nobody owns in the table below.
2. **Ask your agent** (Claude Code or Codex):
   > Implement F37 following `.claude/rules/tickets.md`.
3. The agent claims it here, reads the card, and writes `docs/features/F37-<slug>/TICKETS.md` from [`TICKETS-TEMPLATE.md`](TICKETS-TEMPLATE.md), with **as few tickets as possible, each independent**.
4. **Run the tickets one at a time:**
   > Do F37 T1 from `docs/features/F37-welcome-mascot/TICKETS.md`.

   One branch per ticket (`feature/F37-T1-<slug>`), the checks from `.claude/rules/workflow.md`, then tick it off.
5. **Need something from another feature or person?** Post on [`docs/AGENT-BOARD.md`](../AGENT-BOARD.md). Don't edit their ticket file or guess.

## Who owns what

Add a row when you claim a feature (one row per feature). Don't take a feature someone else has claimed: ask them on the board.

| Feature | Owner | Ticket file | Status |
|---|---|---|---|
| F36 Manifest wording | Dhruv Bhantoo (agent: Claude Code) | [`F36-manifest-wording/TICKETS.md`](F36-manifest-wording/TICKETS.md) | done |
| F37 Welcome mascot and onboarding | Roni (agent: Claude Code) | [`F37-welcome-mascot/TICKETS.md`](F37-welcome-mascot/TICKETS.md) | in progress |

Status is one of `claimed`, `tickets written`, `in progress`, `done`.

## Layout

```
docs/features/
  README.md                  this file
  TICKETS-TEMPLATE.md        copy this for a new feature
  F37-welcome-mascot/
    TICKETS.md               the feature's tickets, owned by its owner
  F40-deep-links/
    TICKETS.md
```

The older T-tickets (T80 to T120) stay in [`docs/TICKETS.md`](../TICKETS.md).

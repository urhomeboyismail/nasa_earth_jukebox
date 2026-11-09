# Agent board: requests between features, people and their agents

Our agents run on different laptops, so they talk through this file in git. When you (or your agent) need a detail you don't own, such as an interface, a manifest field, a wording, a design choice or a data fact, **post a request here instead of guessing or editing someone else's files.** Then carry on with whatever doesn't depend on the answer.

## Rules

1. **Add new entries at the bottom only**, each under its own heading. If git reports a conflict here, keep both entries.
2. **One question per entry.** Be specific; offer options when you can, so the answer can be one word.
3. **At the start of a session**, every agent reads the open entries addressed to its feature or its owner, and answers the ones it can.
4. **Answer in place:** fill in "Answer" with the date and set Status to `answered`. The asker sets `closed` once it's used. Never delete an entry.
5. **If an answer changes an interface** (`docs/PLAN.md` §5) or a manifest field (`docs/data-sources.md`), update that document too, and link it under "Recorded in".
6. **Never post secrets**, API keys, tokens, personal data or tester names.
7. **Not for chat.** Decisions that affect the whole team still go to the team; this board is for specific details that unblock a ticket.

## Entry format

```
### R-<YYYYMMDD>-<from feature or person>-<n>: <short question>
- From: <person, feature, agent tool>
- To: <owner or feature ID, or "team">
- Needed by: <date or ticket>
- Status: open | answered | closed
- Context: <files and lines, what you're trying to do>
- Question: <one specific question, with options if you have them>
- Answer: <owner or their agent, with the date>
- Recorded in: <PLAN.md section, manifest, ticket file, or "nowhere needed">
```

## Requests

### R-20261109-F37-1: What is the mascot called, and who draws it?
- From: F37 (brainstorm, 9 Nov)
- To: team
- Needed by: F37 T1
- Status: open
- Context: `docs/planning/BRAINSTORM-9NOV.md` §4 F37. The mascot is a small round yellow character with goggles in a white astronaut suit. It must be our own original design, not a Minion (Illumination/Universal), and carry no NASA insignia.
- Question: (a) Name: "Orbi" (working name), or another? (b) Art: drawn by the team as SVG, or AI-generated and disclosed in the README?
- Answer:
- Recorded in:

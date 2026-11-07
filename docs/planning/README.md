# Planning archive

The ideas and planning work behind Earth Jukebox. It was moved here on 7 Nov 2026 from the separate planning repo, which is being deleted. The live plan is still [`../PLAN.md`](../PLAN.md) and the open work is in [`../TICKETS.md`](../TICKETS.md). Everything in this folder is reference material.

| Path | What it is |
|---|---|
| [`FEATURE-REVIEW.md`](FEATURE-REVIEW.md) | 7 Nov review of every feature: built or not, what to keep and improve, and what was cut and why |
| [`brainstorm/`](brainstorm/) | The multi-round brainstorm: `PRODUCT-BRIEF.md`, rounds `r1` to `r6`, `FINAL.md` (final concept, rev 3), `decisions.md` (decision log with dissent), `parked-ideas.md` (every cut idea and what would revive it), `weaknesses/` (W1–W7), `adk/` (agent design study), `reports/` |
| [`adr/`](adr/) | Architecture decision records 0001–0005, from the planning prototype |
| [`original-plan.md`](original-plan.md) | The original "Earth, Out Loud" project plan |
| [`brainstorm-rules.md`](brainstorm-rules.md) | The rules the brainstorm agents followed: truth tags, no faked data in sound, accessibility first |
| [`challenge-brief.md`](challenge-brief.md) | The challenge brief as saved by the planning repo (the root `CHALLENGE.md` is the team's copy) |
| [`evidence/adk-eval-report.md`](evidence/adk-eval-report.md) | The ADK answerer eval. Its "KILL" verdict is **not valid**: every model call failed (503 or 429), and failures were scored as misses |

The planning repo also held a vanilla-JS prototype, a GIBS sea-temperature pipeline for Mauritius and an ADK answerer. That code was not moved. The brainstorm files still refer to paths in it, such as `app/`, `pipeline/` and `agent/`.

# Planning archive

The ideas and planning work behind Earth Jukebox. It was moved here on 7 Nov 2026 from the separate planning repo, which is being deleted. The live plan is still [`../PLAN.md`](../PLAN.md) and the open work is in [`../TICKETS.md`](../TICKETS.md). Everything in this folder is reference material.

| Path | What it is |
|---|---|
| [`IDEAS-REVIEW-9NOV.md`](IDEAS-REVIEW-9NOV.md) | 9 Nov review at the start of the hackathon: what's a Must, what to improve, what to add next, what stays cut. What was built before 9 Nov is in [`../PRE-HACKATHON-WORK.md`](../PRE-HACKATHON-WORK.md) |
| [`FEATURE-REVIEW.md`](FEATURE-REVIEW.md) | 7 Nov review of every feature: built or not, what to keep and improve, and what was cut and why |
| [`brainstorm/`](brainstorm/) | The multi-round brainstorm: `PRODUCT-BRIEF.md`, rounds `r1` to `r6`, `FINAL.md` (final concept, rev 3), `decisions.md` (decision log with dissent), `parked-ideas.md` (every cut idea and what would revive it), `weaknesses/` (W1–W7), `adk/` (agent design study), `reports/` |
| [`adr/`](adr/) | Architecture decision records 0001–0005, from the planning prototype |
| [`original-plan.md`](original-plan.md) | The original "Earth, Out Loud" project plan |
| [`brainstorm-rules.md`](brainstorm-rules.md) | The rules the brainstorm agents followed: truth tags, no faked data in sound, accessibility first |
| [`challenge-brief.md`](challenge-brief.md) | The challenge brief as saved by the planning repo (the root `CHALLENGE.md` is the team's copy) |
| [`evidence/adk-eval-report.md`](evidence/adk-eval-report.md) | The ADK answerer eval. Its "KILL" verdict is **not valid**: every model call failed (503 or 429), and failures were scored as misses |

The planning repo's code is in [`prototype/`](prototype/): the vanilla-JS app, the GIBS sea-temperature pipeline for Mauritius, the fact checker (`contract/`), the ADK answerer (`agent/`), the listening-test protocol (`proof/`), the submission pack (`submission/`), and the brainstorm team's agent and skill definitions. It is reference only: excluded from lint, tests and the build, and not deployed. Brainstorm files refer to its paths (`app/`, `pipeline/`, `agent/`). The venvs and `node_modules` were not copied, nor was the 5 MB `pipeline/cache/wmts-capabilities.xml` (a download the pipeline repeats). The rest of `pipeline/cache/` is kept: the GIBS colour map and the small sea-temperature frames the Mauritius example was built from.

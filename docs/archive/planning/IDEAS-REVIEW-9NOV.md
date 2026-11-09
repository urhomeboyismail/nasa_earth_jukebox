# Ideas review, 9 Nov 2026 (start of the hackathon)

Reviewed with ECC's `production-audit` and `product-lens` lenses. Sources: [`FEATURE-REVIEW.md`](FEATURE-REVIEW.md), `MERGE-VERDICT.md` (on `feature/T88b-brainstorm-merge`), [`../TICKETS.md`](../TICKETS.md), and the 9 Nov repo audit. The guiding rule for the hackathon is [`.claude/rules/phases.md`](../../.claude/rules/phases.md): **the machinery is built; now refine it for each NASA data set, through data, not code.**

## 1. Must, in this order

| # | What | Why now |
|---|---|---|
| 1 | **Merge the audit branches**: `fix/green-suite` (on top of `feature/T85-rehearsal`), `perf/lazy-pages`, `fix/voice-guide-live-api-version`, `feature/T116-m3e-foundations`, `feature/T88b-brainstorm-merge`, `chore/agent-skills`, `chore/rules-and-decisions` | Everyone works from a green `main` |
| 2 | **Take `rehearsal-sst` out of `index.json`** on `feature/T85-rehearsal`, or commit its data as a real data set (playbook steps 4–7) | Its folder is git-ignored, so a fresh clone lists a data set that can't load. `data-sources.md` says not to commit the entry |
| 3 | **T85: the first real NASA data set with a baseline**, through [`DATASET-PLAYBOOK.md`](../DATASET-PLAYBOOK.md). Sea surface temperature around Mauritius is the furthest along (rehearsal done) | Global Award eligibility needs NASA data. The change style (v2) plays only on `synthetic-change` today |
| 4 | **T87 evidence**: at least one screen-reader tester through the protocol in `docs/evidence/` | n = 0. The accessibility claim is the project's core |
| 5 | **Fill in the Render URL** in `AGENTS.md`, and check the voice guide on the live site | It can't be demoed until it's checked |
| 6 | **Replace the Vite template `README.md`** with the project README (T87) | Judges open it first |

## 2. Improve what's built (each is mostly a check, then a manifest or default change)

| Feature | Improvement | How it's decided |
|---|---|---|
| F18, F28 change style | Run the 13 Nov "which date is further above normal?" check on **real** data, not synthetic | PLAN.md §6.2 rule: it becomes the default for data sets with a baseline only if it scores at least as well as v1 |
| F19 descriptions | Have a tester pick the default (concise or rich) | Tester preference |
| F20 3D audio | Headphone check: can north and south be told apart? | Hide the toggle if not |
| F11 listening test | The Render free disk wipes results on restart. Download the CSV after every session, or use a persistent disk | Before the first real session |
| F14 WAV export | Render a playlist of each real data set as the demo backup, for when the server is asleep or the audio is blocked | Before the demo |
| Per-data-set text | Story chapters, comparisons and alt text written for each real data set, never generic | Playbook step 4 |

## 3. Add next (cheap, high value, general: they work for every data set)

| Idea | Value | Cost |
|---|---|---|
| **F23 time travel**: lock one cell, scrub the dates | Answers "when did it change *here*?" directly | Low: reuses `analyzeGrid` and the explorer |
| **F33 "What the sound hides"**: a coarse mapping next to the strict one | Shows judges the sound is honest about what it leaves out | Medium: a coarse style plus one listening check |
| **Demo mode**: one button that plays the scripted demo path (data set, story, compare) | A reliable 3-minute demo with no fumbling | Low: a script over existing player commands |
| **Second real data set** (sea ice or the global temperature anomaly, `data-sources.md`) | Proves the design is general, which is the point of the two phases | Data work only, through the playbook |

## 4. Status after 9 Nov (later the same day)

Built: **F23** time travel, **F33** What the sound hides, **F35** demo mode, and **T120** phone support (360 px checked on Home and Listen; installable manifest and icons). Still open from this review:

- Real-phone checks of F12 ducking and F15 vibration, and the 360 px check on Learn, Compare and About.
- A listener check for F33 before any claim about it.
- Demo mode on a real data set: run it end to end, and edit `src/features/demo/script.ts` if the wording needs the data set's story.
- Offline caching of the data sets (a service worker) is not built; the app needs the network.

## 5. Keep cut

F21 anomaly haptics, F22 reef style, F24 fire alarm, F25 sound buoys, the ADK tiers and the live-model Q&A. Each one's revive condition is in [`FEATURE-REVIEW.md`](FEATURE-REVIEW.md). Nothing seen on 9 Nov meets one.

## 6. Hard-coded data specifics found in `src/`

None in code. `src/` mentions units and examples ("°C", "Arctic Ocean", "the 1991 to 2020 August average") only in comments and doc strings; values, labels and units come from the manifest. Keep it that way (`phases.md`).

# Merge verdict: "Two Ears" brainstorm into Earth Jukebox (9 Nov 2026)

TL;DR: the repo's engine, data format and pages stay. Six ideas from the brainstorm are adopted (four built, two open). ADK, the `story.json` contract and the live-model Q&A are dropped.

Rule used: keep what is built and tested in the repo; adopt a brainstorm feature only when the repo lacks it and it serves the challenge (accessibility, honesty, evidence). The brainstorm's code was plain JS (`docs/planning/prototype/`), so ideas and wording were ported, not files.

| Feature | Repo | Brainstorm | Verdict | Status |
|---|---|---|---|---|
| Sound mapping | full / simple / change styles, bed + contours | Musical vs Strict | **Repo** | kept |
| Hear one step two ways | none | "Hear this step both ways" | **Adopt** as F30 | built |
| Missing data | pink-noise hiss | rest, then Continue | **Repo sound**; wording "not a zero" adopted | built (table, Ask) |
| Test sound | none | reference tone, Test sound | **Adopt** as F29 | built |
| Date slider text | `aria-valuetext` already there | sourced valuetext | **Repo** | kept |
| Data table | none | "Show data table" | **Adopt** as F31 | built |
| Cited Q&A | voice guide only | 13 hand-written answers | **Adopt, rebuilt**: facts are computed from the analysis, so no number is typed by hand (F32) | built |
| What the sound hides | none | coarse vs strict | **Adopt** as F33 | open: needs a coarse style and a listener check |
| Data format | Zod manifest + `check-data` | `story.json` / `facts.json` | **Repo** | dropped |
| ADK tiers, audit log | ADK cut 7 Nov | Tier 1 to 3 | **Drop** | dropped |
| Explorer, story, contours, 3D, WAV, vibration, voice guide, study API | built | absent | **Repo** | kept |
| Tester protocol and results note | T87 open | `proof/` | **Adopt** into `docs/evidence/` (F34) | copied; n = 0 |
| 30 s video and 7 slides | none | built on the fixture story | **Adopt later**: rebuild on real data after 13 Nov | open |
| Real data | `rehearsal-sst`, not listed | GIBS MUR story | **Repo**; now listed in `public/data/index.json` | built; licence wording still unchecked |

## What changed in the code
- `src/features/player/usePlayer.ts`: `testSound`, `hearBothWays` (restores the listener's sound style if interrupted).
- `src/features/player/index.tsx`, `DataTable.tsx`, `player.css`: the two buttons, a "Show data table" section (built only while open).
- `src/features/ask/`: `facts.ts` (facts made by rules), `ask.ts` (static matcher, "Not in this record."), `AskPanel.tsx`, tests.
- `public/data/index.json`: `rehearsal-sst`.

## Why the Q&A was rebuilt, not copied
The prototype's answers held typed numbers for one story. Here each answer is a fact made from the analysis of whichever data set is open, tied to a fact id, and tagged "From data" or "Description, not measured" by code. A question whose fact does not exist for the data set is not offered. No model is used, which respects `src/boundary.test.ts`.

## Still open (not done, not claimed)
- F33 "What the sound hides": needs a coarse sound style in `src/audio/` and a listener check before any claim.
- Nobody has listened to the new buttons or used them with a screen reader. Tests cover behaviour and axe only. Tester sessions: n = 0 (`docs/evidence/results-note.md`).
- Layout of the new table and Ask section is not yet checked at 360, 768 and 1280 px in a browser.
- `rehearsal-sst` has no baseline, so v2 does not play on it, and its licence wording is marked "not yet checked".
- The Ask wording and the two question lists are written by the team and have no sign-off from a second person.

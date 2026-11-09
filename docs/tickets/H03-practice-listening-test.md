# H03 Practice listening test: Symphony against Simple, with a blind or low-vision tester

| | |
|---|---|
| **Priority** | P3 |
| **Size** | M (about a day, plus the sessions) |
| **Who** | 👤 |
| **Needs** | SN07 |
| **Hotspots** | — |
| **Branch** | `chore/H03-practice-listening-test` |

## Goal

Find out, with real listeners, whether Symphony (the v3 ensemble, SN07) helps people hear what the map shows better than Simple (the v1 single note). Write what happened, honestly, in the repository. The results also decide two things: whether interface sounds (AU-UI) go in, and when the audio features freeze.

## Why

- The testable question in `docs/PLAN.md` §1: can someone hear, without seeing the image, what changed and where. Nothing has been measured yet. `docs/evidence/results-note.md` says n = 0.
- `docs/submission/demo-script.md` requires the video and slides to say "not yet tested with blind users" until a real session has been run. This ticket is that session.
- `docs/evidence/tester-protocol.md` is the protocol to follow. Read it first.
- A volunteer with their eyes covered is **not** counted as a blind or low-vision tester (`results-note.md`, the rule for the pitch and the video).

## What to do

### Before the sessions

1. Confirm SN07 is `done` on the queue, and open the app on the real data set in use (or the fixture if the real one is not ready). Note the commit.
2. Read `docs/evidence/tester-protocol.md` and `docs/evidence/results-note.md`. Use the protocol as written; change it only in a dated note in `docs/tests/`.
3. Recruit at least 3 testers, including at least one blind or low-vision tester who uses a screen reader. Record the group of each tester only as one of `sighted`, `blind_low_vision` or `not_said`.
4. Each tester is told what is recorded and agrees before the session. Use the consent wording from the protocol. Store no name, e-mail address, phone number or IP address.
5. Headphones on. Set the volume once with "Test sound" (F29), and do not change it during the session.

### The sessions (about 20 to 30 minutes each)

Each tester does the same tasks in both modes. Alternate which mode is first between testers, so the order does not decide the result.

- **Task A, the hot spot.** On one date, say where the warmest place is. Answer by ear: Symphony, then Simple. Record the answer and whether it was right.
- **Task B, growth.** Compare two dates. Say whether the warm area grew, shrank or stayed the same. Record each answer.
- **Task C, movement.** Follow the warm area across several dates. Say which way it moved (north, south, east, west, or no clear movement). Record each answer.
- **Find game (IX04), if it is built.** Time how long the tester takes to find the warmest place. If IX04 is not built, write "not run".
- **Predict (IX05), if it is built.** Score the predictions out of the number asked. If IX05 is not built, write "not run".

For each task, record: right or wrong, with or without a hint, and one line of what the tester said. Do not record anything that identifies the tester.

### After the sessions

Write `docs/tests/<YYYY-MM-DD>-practice.md` (new, dated) with:

- n, and the number in each group. Say which testers used a screen reader.
- A table: task, mode, passed without a hint, passed with a hint, not passed, and the time for the Find game if it was run.
- The Predict scores, if run.
- What testers found hard, in one line each. Quote a tester only with their permission, and never with a name.
- Problems found, one line each, with the task number.
- Two decisions, each with its reason (see below).

Update `docs/evidence/results-note.md`, in its "Session results" table, with the same n and results. Do not change the rules in that file. If n is 0 or 1 non-blind tester, say so.

## Decisions to write down

1. **Interface sounds (AU-UI): in or out.** In only if testers who heard the interface sounds found them clear and not distracting. Write the decision and the reason. If the answer is "not enough testers to say", the answer is out.
2. **The audio freeze.** Choose the date after which no new sound feature is added (only bug fixes), and list the features that are frozen. Write the date in the practice file and in `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Done when

- A dated `docs/tests/<date>-practice.md` exists, with n, the groups, the tasks, the problems and the two decisions.
- `docs/evidence/results-note.md` has the same numbers. Nothing in it is stronger than the sessions.
- No name, e-mail, phone number or IP address is in any file in the repository.
- The demo script's testing line (`docs/submission/demo-script.md`, "Before sending") matches the note word for word.

## Checks

```bash
grep -rnE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/tests docs/evidence   # must print nothing
git status --short docs/tests docs/evidence
```

## Guardrails

The sessions are about sound: keep the volume the same across modes, and never let the tester hear a sound before they press Play.

## Out of scope

- Building any feature. Problems become tickets.
- The video and slides (H07).
- The device numbers (H06) and the final check (H08).

## Result

Not started.

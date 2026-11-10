# H05 Mascot name and art decision

| | |
|---|---|
| **Priority** | P3 |
| **Size** | S (under half a day) |
| **Who** | 👤 |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/H05-mascot-decision` |

## Goal

The team decides the mascot's name and how its art is made, and writes the decision on the agent board. The answer unblocks the mascot work (F37, and the robot redraw F58).

## Why

- `docs/AGENT-BOARD.md`, entry `R-20261109-F37-1` ("What is the mascot called, and who draws it?") is open. F37 used the mascot that is already in the repo as a proposal, but it needs a team answer.
- The current mascot is Echo: a team-drawn SVG in `src/components/Mascot.tsx`, with concepts in `docs/design/mascot-concepts.html`. Its name is one constant, `MASCOT_NAME` (`src/features/welcome/lines.ts`), and the server's persona name is `PERSONA_NAME` (`server/app/assistant/knowledge.py`). A server test checks that the two match (`test_the_persona_name_matches_the_frontend`), so a rename has to change both.
- The brief's rule: the mascot must be the team's own original design, not a character from another franchise, and carry no NASA insignia.
- F58 (robot Echo redraw) waits on this decision (`Needs: H05`).

## What to decide

1. **Name.** Keep "Echo", or choose another name. Write the chosen name in one line. If it changes, the name must change in `MASCOT_NAME` and `PERSONA_NAME` (a ticket does that, not this one).
2. **Art.** Keep the team-drawn SVG, or commission or draw a new one. If AI-generated art is used, the README must say so (the AI disclosure, G05), and it must be checked by a person for resemblance to any existing character.
3. **Checks.** Confirm the art has no NASA logo, patch or flag, and no resemblance to a character from another franchise.

## What to do

1. Read `docs/AGENT-BOARD.md` entry `R-20261109-F37-1` and the proposal in its "Answer" field.
2. Agree on the two answers with the team. Use the team's usual channel; do not decide alone.
3. In the board entry, add the answer with the date, set Status to `answered`, and fill "Recorded in" with the decision line. Do not delete the entry.
4. If the decision is to rename, post a request for the change on the board, addressed to the owners of `src/features/welcome/lines.ts` and `server/app/assistant/knowledge.py`.

## Done when

- The board entry has a dated answer for both questions, and Status is `answered`.
- Nothing in `src/` or `server/` has changed as part of this ticket.

## Checks

```bash
git status --short docs/AGENT-BOARD.md    # only the one entry changed
```

## Guardrails

Not applicable to sound. The art must not flash or animate beyond what the component already does.

## Out of scope

- Redrawing the mascot (F58).
- Renaming the mascot in the code (a follow-up ticket, if decided).
- Any new mascot feature.

## Result

Decided 2026-11-10 by Raghav, recorded on `docs/AGENT-BOARD.md` (R-20261109-F37-1). Name: **Echo** (unchanged). Art: the **Juke-Bot** design (helmet with LED visor, headphones, chest screen with EQ bars and a mini globe, gloves, air-booster boots), drawn by the team as SVG in F58. No NASA insignia; checked against the "do not resemble" list in F58. Follow-ups: F58 and JB01–JB07 in `docs/TICKETS.md`.

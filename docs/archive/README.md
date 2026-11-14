# Archive

Ticket files and reviews that are finished, cut or replaced. They are kept for the record: judges and `docs/PRE-HACKATHON-WORK.md` point to the work they describe. Nothing here is a live ticket. **The live queue is [`../TICKETS.md`](../TICKETS.md)**, with one file per ticket in [`../tickets/`](../tickets/).

Moved here on 9 Nov 2026, when the tickets were reorganised into one queue for two agents (the v3 "sight into sound" plan).

**14 Nov 2026:** the 71 done tickets (S, I, SN, IX, EIC01/04, G01–G10, V, VIS, F, JB01–JB08, D04, H01, H05) were deleted from `tickets/`; read them with `git log -- docs/tickets/<file>` or `git show faf36d9:docs/tickets/<file>`.

| File | What it was | Replaced by |
|---|---|---|
| [`TICKETS-pre-v3.md`](TICKETS-pre-v3.md) | The old board: everything built (T00–T120), the open T85, T87, T88b, T114 step 7 and T120 checks | `../TICKETS.md`: T85 → S02, EIC01–EIC03, D04; T87 → S03, H03, H08; T88b/F34 → H01, H07; T114.7 → S05, H04; T120 phone checks → H06 |
| [`PRE-HACKATHON-TICKETS.md`](PRE-HACKATHON-TICKETS.md) | T88–T110. T88–T92 built; T105–T107 and T110 superseded | T93 → S04; T96, T108, T109 → SN04; T100 → IX07; T101, T102 → VIS2; T95, T103, T104 parked |
| [`TICKET.md`](TICKET.md) | A1–A3: splitting the tree, green suite, lazy pages | All done |
| [`UI_FOLLOWUP.md`](UI_FOLLOWUP.md) | 5 Nov inventory of the UI | All built |
| [`ui-overhaul/`](ui-overhaul/) | UI-A (Material 3 tokens and shell, built as T116/T117) and UI-B (T118 and T119, never started) | UI-A done; UI-B parked; the design-system clean-up is VIS3 |
| [`planning/FEATURE-REVIEW.md`](planning/FEATURE-REVIEW.md) | 7 Nov review: what was built, what was cut (including ADK, T86) | ADK is back as G01–G07 |
| [`planning/IDEAS-REVIEW-9NOV.md`](planning/IDEAS-REVIEW-9NOV.md) | 9 Nov review of Musts and ideas | `../planning/BRAINSTORM-9NOV.md` and `../TICKETS.md` |
| [`planning/MERGE-VERDICT.md`](planning/MERGE-VERDICT.md) | Merge verdict for the brainstorm branch (some lines are now out of date: F33 is built, `rehearsal-sst` is no longer listed) | — |
| [`features/`](features/) | F36 manifest wording, F37 welcome and Echo, F38 Learn fills, F39 hear the legend | All done |

**ID clash to know about:** T116 and T117 mean different things in `TICKETS-pre-v3.md` (Mohammad's PR #1 and PR #2, both merged) and in `ui-overhaul/UI-A…` (Roni's version of the same work). The merged PRs are the ones that count.

**Parked when the queue was written** (not queued; revive one by adding it to `../TICKETS.md`): T95 height accent, T103, T104, T118, T119, F43–F47 (replaced by SN07–SN10), F49 shelf, F51 service worker, F52, F53 (replaced by IX04), F54 Earth Symphony, F55 postcards, F56 anchor notes (part of SN03), F57 piano voice (presets in SN03).

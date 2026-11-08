# Build tickets: the smallest set that ships FINAL rev 3

TL;DR: 12 tickets, one pre-event and eleven during the event. Each one produces something you can demo or hand in, has one owner, and has a test you can check by keyboard and screen reader.
**Status: DRAFT. The plan is not locked and is still being improved.** These tickets follow whatever FINAL.md currently says. Use them as a cost check for new ideas ("which ticket does this change, and how many hours?"), not as a commitment.
Source: brainstorm/FINAL.md rev 3 (§3 features, §7 build plan, §8 cut order). Hours are [assumption] and get re-estimated at hour 0, once the event's data is known.

## How these tickets are cut

- **One ticket = one output a judge or teammate can touch** (a file, a working control, a video). No "set up repo" or "research X" tickets: those are steps inside a ticket.
- **The fixture story unblocks everyone at hour 1.** T1 produces a hand-made `story.json` with a real `null` step, so sound and frontend never wait for real data.
- **"Done when" is written as a test.** Every ticket's test includes the screen-reader check (CLAUDE.md rule 6), so accessibility is not a separate ticket that gets done last.
- **Cut order is printed on each ticket** (FINAL §8), so no one has to argue about it at hour 36.

## Board

| ID | Ticket | Owner (role) | Hours | Needs | Gate | Cut order |
| --- | --- | --- | --- | --- | --- | --- |
| T0 | Pre-event lock-in | Red team + Raghav | 6 | — | before event | never |
| T1 | Story contract + fixture | Data engineer | 6 | T0 | h6 | never |
| T2 | Real data → story.json + facts.json | Data eng + frame analyst | 24 | T1 | h12 (data), h24 (all stories) | never (1 story min) |
| T3 | Sound engine (Side A/B, rests, reference tone) | Sound designer | 20 | T1 | h6 first tone, h24 | never |
| T4 | Accessible player | Frontend/a11y | 28 | T1, T3 | h24 | never |
| T5 | Cited answers (static) | Agent/voice | 12 | T2 facts | h24 | 6 (cut to 10 answers) |
| T6 | ADK Grounded Ask + audit log + eval | Agent/voice | 24 | T5 | h40 | 3 |
| T7 | Sighted view (frame, marker, data table) | Frame analyst + frontend | 10 | T2, T4 | h40 | 5 (marker only; the data table is never cut) |
| T8 | "What the sound hides" | Sound designer + frame analyst | 8 | T3, T2 | h40 | 4 |
| T9 | Ship: offline install + public link | Frontend/a11y | 8 | T4 | h40 | never |
| T10 | Proof: tester session + measured results | Red team | 12 | T4, T9 | h40 | never (fallback: labelled volunteer) |
| T11 | Submission pack | Red team + all | 14 | T10 | h47 | never |

Total ≈ 172 h against ≈ 250 h available [assumption: 6 × ~40 h]. The spare ~78 h is the buffer. Spend it on T2 and T4 first, never on stretch items before the h40 freeze.

## Tickets

### T0: Pre-event lock-in
**Output:** CLAUDE.md team table filled in; 1–3 blind/low-vision testers booked with date and time; Gemini/Cloud Run access answered yes/no; red-team thresholds (coverage cut-off, day-1 check pass marks) and ~30 real + ~15 adversarial eval questions written into `decisions.md` **before anyone sees data**; the human's go-ahead on the FINAL rev 3 santa gate.
**Done when:** each of the 6 open questions in FINAL §12 has an answer or a named owner.

### T1: Story contract + fixture
**Output:** `story.schema.json`, a validator script, and `fixture.story.json` (≈20 steps, at least one `null` run, one key moment, a baseline, `coverage_pct` on every step, `meta.eic_visualization`).
**Done when:** the validator passes the fixture and fails a copy with an invented value in a gap; the schema is frozen at h6 (later changes need agreement from T3 + T4 owners).

### T2: Real data → story.json + facts.json
**Output:** 2–3 validated story files from the event's data (or the verified GIBS fallbacks in FINAL §5); `facts.json` with fact IDs and sources; the day-1 check results written up; credit lines.
**Done when:** each story passes the validator; the 3 day-1 checks have a pass/fail verdict against the T0 thresholds; every `null` matches a date the source really did not publish; each story has its EIC link or the honest "no matching EIC visualization" text. A story that fails a check becomes a "limits example", it is not quietly fixed.

### T3: Sound engine
**Output:** a Tone.js module that plays any valid `story.json`: Side A (scale-snapped, states its rounding step), Side B (sine + step click, states coarseness from the colour key), rests with the click continuing, 150 ms fade at gaps and key moments, the 2 s reference tone, "Test sound", "Hear this step both ways", plus a pre-rendered 10 s backup clip.
**Done when:** the fixture plays end to end in both modes; the gap is silent pitch with the click running; no sound starts without a user action; never more than two layers at once.

### T4: Accessible player
**Output:** the app shell with FINAL §3 features 1, 2, 4 and 5: story radio group, `role=switch` Strict mode, slider with sourced `aria-valuetext`, Play/Pause/Where am I/Replay/Continue, and one `aria-live` region following the §2 rules (quiet during Play; one message plus Continue at gaps and key moments).
**Done when:** a teammate with eyes closed completes FINAL §13 tasks 1–7 on NVDA and on TalkBack; axe shows 0 serious issues; the switch leaves playback paused; nothing speaks over the screen reader.

### T5: Cited answers (static)
**Output:** 10–20 reviewed Q&A, each tied to fact IDs, with question buttons, a filter box and alias matching; "Not in this record" for anything unmatched.
**Done when:** a code check finds every number and name in an answer inside story/facts files; every answer shows "Source: [ID]" and a confidence tag; answers are ≤140 characters with "Read more"; the static path works offline.

### T6: ADK Grounded Ask + audit log + eval
**Output:** the `answerer` agent returning `{fact_ids[], confidence}`, an `after_model` callback dropping unknown IDs, a 2.5 s fallback to T5, the Tier 2 audit log with its summary line, and the eval results.
**Done when:** the eval runs the T0 questions and reports "[measured] of [N] passed", failures included. **Kill rule:** if Tier 1 does not beat alias matching on open-wording questions, ship T5 only and show the audit log.

### T7: Sighted view
**Output:** the current frame with an `aria-hidden` marker, long alt text, a text legend, and "Show data table" (step, value, source).
**Done when:** the data table carries every value a sighted user sees and reads correctly on a braille display or with NVDA table navigation.

### T8: "What the sound hides"
**Output:** two buttons: the same series with a coarse mapping (the change collapses) and Side B (the change is audible), plus text saying which one hides the change and why.
**Done when:** a listener who does not know which is which picks the hiding version in at least 2 of 3 tries [assumption: pass mark set by the red team in T0].

### T9: Ship
**Output:** installable PWA, an offline cache of all stories, and a public URL with no login.
**Done when:** the link opens logged-out on a fresh device; an airplane-mode run of the full demo passes; the ADK path is optional (the app works with no API key).

### T10: Proof
**Output:** the tester session(s) run per FINAL §13, the T6 eval, and a one-paragraph results note with n, tasks passed and one permitted quote.
**Done when:** every number in the pitch traces back to this note. If no blind tester came, the note says "not yet tested with blind users".

### T11: Submission pack
**Output:** 30 s video with English subtitles, 7 slides, project page, data credits, third-party code credits, and the AI-use disclosure (FINAL, last section).
**Done when:** checked against the 2026 submission guide (re-verify the demo length and AI wording ~13 Nov [unverified]); no NASA logos; the link loads logged-out.

## Stretch (only after the h40 freeze, only with buffer left)
Place close · ADK Studio data half · Tutor · medley · free-touch toggle · Android haptics. Each one becomes its own ticket only when someone picks it up.

Weakest point of my own proposal: T2 is 24 h with the most unknowns, and everything that gets judged depends on it. If the event's data is hard to decode, the fixture keeps T3/T4 moving, but the demo story could still be a fallback GIBS layer, which weakens the "EIC frames" link the challenge asks for. Alternative: split T2 at h6 into "main story" and "other stories" if decoding is slow.

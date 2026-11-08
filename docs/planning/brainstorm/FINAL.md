# FINAL (revision 3) — "Two Ears" (working title)

TL;DR: One NASA Earth story played twice, as music (Side A) and as strict data (Side B), explored with screen-reader-native controls. Where there is no data you hear silence and are told so. The concept does not depend on any particular dataset: the data arrives at the hackathon and plugs into a fixed "story file" format. Google ADK is used in two bounded ways, so it helps without ever inventing a fact.
Revision 3 reflects: the human's point that data is unknown until the event (cuts re-opened, see parked-ideas.md); the ADK brainstorm (brainstorm/adk/SYNTHESIS.md, ADR-0005); the two flags left by santa-method round 3.
**Status: NOT yet passed the santa-method gate.** Rounds 1–3 ended in escalation to the human. Revision 3 addresses the flags; a fresh review is pending the human's go-ahead.

Tags: `[verified: url]` = opened by an agent or the facilitator. `[unverified]` / `[assumption]` = not yet checked. No core decision rests on an unverified claim; day-1 tests exist to check the rest.

## 1. The concept in one sentence

Hear the same NASA Earth picture two ways, as music and as plain data, and find where it changed without seeing it. When the sound goes quiet, the source published no data there.

## 2. How it works (dataset-agnostic)

**Input contract.** Whatever frames or visualizations the event provides go through an offline pipeline that writes one small `story.json` and one `facts.json`. A story file has: `meta` (title, source URLs, **`eic_visualization`**: the NASA Earth Information Center or SVS visualization the frames come from, with its URL, or the text "no matching EIC visualization verified; imagery from [source]"), the date range, how colour maps to value (and how coarse that is), one value per step, `coverage_pct` per step, `null` only where the source published no frame, 3–5 key moments, and the text for orientation and alt text. The app knows nothing about any one dataset.

**The app.** A static, installable web app plays the story in the browser with Tone.js: one data voice, pitch for value, one note per step. Side A snaps notes to a musical scale and states its rounding step. Side B is a plain sine with a click per step and states what the data can and cannot say. Missing steps are silent while the step click keeps time. Every control is a native button, switch or slider. Every sound has a text twin in one `aria-live` region, so the user's own screen reader (TalkBack, VoiceOver, NVDA) or braille display carries the words. Sighted judges see the frame being played, with a marker on the part being sonified.

**Rules for live text and pausing** (so the app never talks over the user's screen reader):
- During Play there are no per-step messages. A step's value is on demand: "Where am I", the slider's `aria-valuetext`, the data table. The live region stays quiet during playback.
- **Gaps.** At a run of missing steps the click plays on through the run with no pitch; at its end the sound fades over 150 ms, one message is written ("[dates]: no data, not zero") and playback resumes only when the user presses Continue.
- **Key moments** (3–5 per story): fade, one message, wait for Continue.
- **The Musical/Strict switch is a user action that the screen reader announces itself.** The app does not add a message and does not restart sound on its own: the switch changes mode silently and leaves playback **paused**; Play resumes from the same step. A "Hear this step both ways" button plays the current step in Side A then Side B (about 2 s each) for A/B comparison.
- **Asked-for text** (answers, Where am I): fade, write the text, resume only on Play or Continue, never on a timer.
- **Slider scrubbing** never pauses (it would make scrubbing unusable). It is a stated exception to CLAUDE.md rule 7, mitigated by: no app speech while scrubbing; after 400 ms of no change, one short note plays; the user's screen reader reads the new `aria-valuetext`.
- App TTS is off by default. In the video, any voice is a pre-recorded human or labelled synthetic voice, plus subtitles.

**Sound rules.** No background music; the 2 s reference tone is on demand and only if the story file holds a baseline. At most two data layers at once. Frequent feedback uses short earcons; we do not use natural sounds for rare events (a deliberate deviation from CLAUDE.md rule 7, because samples add licensing and disclosure work; parked).

## 3. Features

### Core

Feasibility = tech-architect (r5, scored on the earlier data; to be re-scored once the data is known). Screen-reader column = accessibility-lead: **a desk review, untested on our build**; it rests on [assumption]s (a screen-reader double-tap sends a real click; `role=switch` reads correctly in Safari; the iOS silent switch can mute Web Audio) to be checked by the hour-24 test and the tester session.

| # | Feature | Feas. | With a screen reader on |
| --- | --- | --- | --- |
| 1 | **Choose** a story from a radio group of the 2–3 tested stories | 4 | Real radio inputs ("1 of 3"); Tab or swipe, Space or double-tap; the live line confirms the choice and date range |
| 2 | **Side A / Side B** switch (`role=switch`, constant label "Strict data mode") + "Hear this step both ways" | 4 | Label never changes, only state; switch leaves playback paused (see §2) |
| 3 | **Silence map**: a missing step is a rest; click continues through the gap; then one message and Continue; hatching on screen | 4 | Rules in §2; the click is the "not crashed" cue, no earcon |
| 4 | **Reference tone** on demand (2 s; only if a baseline is in the story file) + "Test sound" | 5 | Plain buttons; "Test sound" confirms audio is unlocked |
| 5 | **Step slider** (`input type=range` + sourced `aria-valuetext`), Play/Pause, Where am I, Replay | 4 | Arrow keys or swipe; debounced 400 ms; valuetext only from the story file |
| 6 | **Cited answers**: pre-reviewed Q&A, each with fact IDs; uncited text is never shown. Runtime: Grounded Ask (ADK) with static fallback | 4 | Question buttons + filter box; answers go to the live region (rules in §2); eight agent-speech rules in §4 |
| 7 | **"What the sound hides"**: the same series with a coarse mapping (the change collapses) next to Side B (the change is audible) | 3 | Two buttons; text says which hides the change and why |
| 8 | **Sighted view**: frame being played + marker; long alt text; text legend; "Show data table" | 3 | Marker `aria-hidden`; the data table (step, value, source) is the screen-reader and braille equivalent |

None is below 3; features 7 and 8 sit at the gate and are first in the cut order.

### Stretch (after a safe feature freeze)

Gated place close (a "here" dial for a Mauritius location, if the event's data supports it) · ADK Studio data half (Layer Reader, Mapping Proposer) · Ask-Back Tutor · Plain-Language Translator · judge-picks-a-layer live mode (pre-tested only) · 20 s sequential medley · free-touch toggle if a real-phone test passes · haptics on Android · sound postcards · playlist export.

### Parked, not cut

Every idea we set aside is in **brainstorm/parked-ideas.md** with the condition that revives it. Still cut: anything that fakes a value, multi-finger gestures as the *only* way in, free-text "judge names any video" as the *headline*.

## 4. ADK implementation (ADR-0005; details in brainstorm/adk/SYNTHESIS.md)

- **Rule:** the LLM may choose fact IDs, choose a layer from a list, propose mapping parameters inside enums, and draft prose offline. Code decides every number, null, rest, pitch, rounding statement, citation and digit shown.
- **Tier 1, Grounded Ask (runtime, optional).** One tool-free `answerer` agent returns `{fact_ids[], confidence}`; `after_model` drops unknown IDs; code renders text and citation; 2.5 s timeout falls back to static alias matching. ~14 person-hours, feasibility 4 (tech-architect). It must show a measurable win over alias matching on open-wording questions.
- **Tier 2, ADK Studio audit (offline).** Drafted facts and Q&A are checked by a **code checker** (every number and name must exist in the story/facts files), then a human signs off. A committed **audit log** records claim, fact ID, source, verdict, sign-off and edit. Estimate ~10–15 h on top of Tier 1 [assumption].
- **Tier 3, ADK Studio data half (offline, stretch).** Layer Reader and Mapping Proposer; tools return all numbers; ~80 h for the full crew (tech-architect), feasibility 2.
- **Agent-speech rules** (accessibility-lead): text first and never takes focus; user-initiated only; answer first (≤ 140 characters, detail behind "Read more"); always "Source: [fact ID]"; fixed confidence tag set by code ("From data" / "From a cited fact" / "Description, not measured"); "I don't know" when no fact ID matches; neutral words with units; one voice at a time.
- **Show judges:** the audit-log summary line "[N] drafted, [M] blocked, [K] human-edited" (to be measured) and one refusal ("Not in this record") from the `adk web` Trace. ADK facts (Python v2.13.0, callbacks, eval, Cloud Run deploy, A2A) were verified by the tech-architect from adk.dev [verified: https://adk.dev/, https://github.com/google/adk-python/releases]; quotas, prices, latency are [unverified].
- **Eval:** ~30 real and ~15 adversarial questions, written by the red team before running; report "[measured] of [N] passed", failures included.

## 5. Data (unknown until the event)

**Decision:** the pipeline accepts whatever the event provides. Everything below is a **worked example and a ready-made fallback set** we verified before the event, not the plan.

| Example use | Source | Verified facts |
| --- | --- | --- |
| Ice, as "ice seen" | NASA GIBS `MODIS_Terra_L3_Sea_Ice_Daily` | Daily 2000-02-24 → 2026-11-04, no gap in any September; `1km` tiles; only Sea Ice is opaque in the colormap, so ocean, cloud, night and no-data look the same and the value is a **lower bound** [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml, https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_Sea_Ice.xml] |
| Ice cross-check (NOAA@NSIDC, not the NASA requirement) | NSIDC Sea Ice Index G02135 v4 | September 1979–2026, 48 rows; 2012 minimum row `3.57, 2.41`; units not stated in the file [unverified] [verified: https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv] |
| Sea-surface temperature; real missing dates for the silence beat | NASA GIBS `GHRSST_L4_MUR_Sea_Surface_Temperature` | Daily 2002-06-01 → 2026-11-04; colormap mostly 0.15 °C bins with an explicit no-data entry; dates with no frame: 2021-02-20/21, 2022-11-09, 2023-02-02/03, 2023-04-22, 2024-07-02 [verified: capabilities above; https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml] |
| Cited global facts | NASA GISS GISTEMP v4 | Annual global table, column `J-D`, anomalies vs 1951–1980 [verified: https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv] |

**EIC link.** Each story records its EIC/SVS visualization in `meta.eic_visualization`. For the examples above no matching EIC visualization has been verified yet [unverified]; the data-scout should look at the event's provided visualizations first. If none match, the app and slide 3 say so plainly: "Imagery from NASA GIBS, the service that supplies the maps EIC visualizations are built from [unverified: confirm before saying this]".

**Honest rules that hold for any data:** every step has `coverage_pct`; below a threshold set by the red team before looking, the step is a rest or announced as low confidence. Colour keys give ranges, so Side B states the coarseness computed from the key, never "exact". A source cross-check (if one exists) checks the frames and never drives the melody. A gap is never created.

**Credit lines** (quoted from the source pages: GIBS [verified: https://nasa-gibs.github.io/gibs-api-docs/], NSIDC [verified: https://nsidc.org/data/g02135], MUR [verified: https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1], GISTEMP [verified: https://data.giss.nasa.gov/gistemp/]; full text in r5/data-scout.md §6): GIBS/ESDIS acknowledgement; Fetterer et al. 2025, doi:10.7265/a98x-0f50 (NSIDC requires it); JPL MUR MEaSUREs 2015, doi:10.5067/GHGMR-4FJ04; GISTEMP Team 2026 and Lenssen et al. 2024, doi:10.1029/2023JD040179. **Third-party code** (Tone.js, Python libraries, ADK) is credited on slide 7 and the project page. Text only, no NASA logos.

## 6. Stack (ADRs in docs/adr/)

- **Platform:** static installable web app, offline-first. Primary demo rig laptop + NVDA; Android + TalkBack second. (ADR-0001)
- **Audio:** Tone.js pinned to 15.x (latest release 15.1.22 [verified: https://github.com/Tonejs/Tone.js/releases]; release date and feature fit [unverified], checked in the hour-6 spike); everything synthesised from `story.json`; a pre-rendered 10 s backup clip.
- **Pipeline:** offline Python → `story.json`, `facts.json`; no raw grids ship. (ADR-0002)
- **Agents:** ADK as in §4. (ADR-0005; supersedes ADR-0003). Navigator is a link-out unless its API is verified.
- **Worked-example stories:** (ADR-0004, now labelled an example).
- **Words:** `aria-live` text is primary; offline TTS voices only if `localService` is true [verified: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService].
- **Host:** any static host with a public URL [assumption]. The frontend/a11y owner confirms the link loads logged-out before hour 40.

## 7. Build plan by role (team table in CLAUDE.md is empty; roles are generic)

~150 h build + ~30 h test and video against ~250 h available [assumption: six people × ~40 usable hours]. Estimates were made on the earlier data; re-plan at hour 0 once the event's data is known.

| Role | 0–6 h | 6–24 h | 24–40 h | 40–48 h |
| --- | --- | --- | --- | --- |
| Data engineer | Read provided data; first value plays | Story files for the chosen stories; facts.json | Extra stories / stretch | Credits |
| Frame analyst | Colour key → value; coverage; gaps | Composites, marker coordinates | "Hides" scene data | Spot checks |
| Sound designer | One tone, a rest, reference tone | Side A/B mappings | Hidden-scene mapping, earcons | Levels, backup clip |
| Agent/voice | Q&A skeleton, fact IDs; ADK Tier 1 skeleton | Q&A drafts; answerer + callbacks; static fallback | Audit log; eval run | Subtitles |
| Frontend/a11y | Shell, slider, ARIA, switch, pause rules | Controls, marker view, data table | TalkBack/NVDA pass, offline install | Deploy, rehearse |
| Red team | **Write test rules and thresholds into decisions.md before data is seen**; book tester | Review every fact tag; write eval questions | Run tester, axe check, sign off answers | Video, AI disclosure |

**Critical path:** data in → decode → `story.json` frozen (schema h6, data h12) → Side A/B engine + rests → keyboard/screen-reader flow → tester feedback → video.
**Hour 6:** schema frozen; one story decodes; a value plays a tone and a missing step a rest. **Hour 24:** core features 1–6 work by keyboard on one story; TalkBack smoke test; the app installs. **Hour 40:** all core features; airplane-mode run passes; tester session done; feature freeze.

**Day-1 checks (apply to any provided data):** (1) Can the colour key be read and every pixel decoded? (2) Does the story have real missing steps? (3) If a cross-check series exists, does the frame series track it? Use unit-free measures (rank correlation; sign and relative size of trend), with thresholds the red team writes first. If a check fails or has no verdict by hour 6, that story drops to a limits example and another story becomes the main one. Worked-example version of check (3) for the ice layer: ~1,890 tiles at TileMatrix level 3 (10 × 7 days × 27 years [computed from the verified tile-matrix set]); rate limits [unverified].

## 8. Cut order (first → last)

1. ADK Studio data half, Tutor, medley, stretch items → demo unchanged.
2. Place close → main story + "hides".
3. ADK Tier 2 audit and Tier 1 selector (static Q&A remains) → demo works with zero network.
4. "What the sound hides".
5. Moving marker → static frame, alt text, data table.
6. Q&A → 10 answers.
**Never cut:** A/B switch, silence rest + text, pause rules, reference tone (when a baseline exists), slider, keyboard/ARIA, credits and AI disclosure.

## 9. Demo script (adjust to the event's data)

**30 s video** (English subtitles on every line): 0–5 s black screen, a hand on the device, reference tone, pitch steps — "This is NASA satellite data. Listen for the change." · 5–10 s main story + marker, Side A; the subtitle names the listener truthfully (a blind tester, or "a volunteer with eyes covered") · 10–15 s Strict: "Same frames, no music added" + the coarseness statement · 15–21 s **the silence beat**: the click continues, the pitch stops at real missing steps, then "No data. Not zero." · 21–26 s the audit log line and one refusal ("Not in this record"), or the place close · 26–30 s end card: data credits, "Built with AI help: see project page". Voice is pre-recorded; subtitles carry all words.
**7 slides:** title · the problem · frame in, sound out (with the EIC link line) · Side A / Side B · silence = no data · what the sound hides + honest test result with n · data, credits, AI-use list, third-party code, ADK audit log, no-login link.
**3-minute live demo:** 0:00 hook · 0:30 tester or labelled volunteer finds the change (NVDA laptop) · 1:15 flip to Strict, press Play (the extra press is part of the design), then "Hear this step both ways" · 1:45 silence beat, hold 3 s · 2:15 judge picks a story from the menu and asks a leading question; the refusal appears · 2:45 close · credits. Every step has a pre-rendered fallback; nothing needs the network.

## 10. Top 5 risks and fallbacks

| # | Risk | Fallback |
| --- | --- | --- |
| 1 | **No blind tester**: Accessibility and Presentation stay self-scores | Red team books 1–3 testers before the event. If none: a labelled blindfolded volunteer, and we say "not yet tested with blind users", never more. |
| 2 | **The event's data fails a day-1 check** (colour key unreadable, no real gaps, cross-check fails) | That story becomes a limits example; another provided story, or the verified worked examples, become the main story. |
| 3 | **The silence beat has no real gap** | Use any real missing step in any story, or a spatial no-data region; never create a gap. |
| 4 | **Audio doesn't start or is muted on stage** | Laptop + NVDA; Play creates the AudioContext; "Test sound"; pre-rendered clip; airplane-mode rehearsal. |
| 5 | **The agent says something false, or fails on stage** | Code-enforced fact IDs; human sign-off and audit log; static fallback after 2.5 s; refusal is a feature. |

## 11. Judging self-assessment

Not re-scored in revision 3: the earlier scores (29/35) were for specific data and are stale. Re-run the mock judging once the data is known. Known open points: Presentation and Accessibility cannot exceed 4 until a real tester has used the app; Validity analysis and results wait on the day-1 checks. Rule check: NASA data documented (§5) · no NASA branding · AI disclosure below · a 30 s video and 7 slides both possible · static public link, no login, no API key at runtime (the ADK path is optional). The 2026 judging and submission guides are expected ~13 Nov 2026 [unverified]; re-check demo length, AI wording and criteria names then.

## 12. Open questions for the humans

1. Name: "Two Ears" or keep "Earth, Out Loud"?
2. Team table: fill in CLAUDE.md (skills, hours). Who books the tester and who owns the audit log and answer sign-off?
3. Google access: do we have Gemini API / Cloud Run credit for the event, and is the team happy with Python?
4. Navigator: link-out, or wire it via A2A? (Its API is unverified.)
5. Does the event say which data or EIC visualizations are provided, and when? The data-scout can then find the EIC match for each story.
6. Reference-tone baseline: first 5 steps in the file, or another period?

## 13. Blind-user test plan

- **Who:** 1–3 blind or low-vision people on their own phone and screen reader; laptop + NVDA as alternative; 30 min each.
- **Consent (read aloud, record "yes"):** testing the website, not them; stop any time; audio and screen-reader output recorded; quotes only with permission, first name or anonymous; withdraw within 7 days.
- **10 tasks:** open unaided (< 30 s to the first heading) · choose a story · start sound (hears the reference tone) · say what the tone means · find the no-data steps (names them after hearing the click run through the gap and reading the one message) · switch to Strict, press Play, say which side is on · move to a named step in < 60 s · ask a listed question and a leading one · say which "hides" version hid the change · retell the biggest change and rate clarity, effort and trust 1–5. No hints before 2 min per task; note every "I'm lost".
- **Agent test (6 questions):** did you trust the answer, how did you check it, what happened with a question it cannot know, too long or short, did it ever speak when you didn't expect it, could you tell the detail levels apart (r5 and adk/accessibility-lead.md).
- **Voice input:** buttons first; if push-to-talk ships, the tester speaks 5 listed questions and if more than 1 is misheard it is dropped from the demo.
- **Report:** n, tasks passed, one permitted quote. Never round up; never imply a result we don't have. Do not reuse example values from earlier files ("1990–1992", "3.6 million km²").

## AI-use disclosure (for the submission)

"AI helped us write and check the words. It did not create any data value, pitch or sound. Every value comes from NASA imagery decoded by script. Every sentence in the app is tied to a source ID and was checked by a person. Tools: Claude (Anthropic) for planning and documents; Google ADK with Gemini to draft and audit Q&A and, optionally, to pick fact IDs at runtime, with the audit log at [path]. Code written with AI help: [list]. AI-made audio or images: [none, confirm]." Confirm the final tool list before submission.

Weakest point of this document: every claim of "validity" still waits on the event's real data and on a tester who isn't booked. The ADK layer is a bet that trust and process impress more than capability, and Tier 1 must show a measurable win over plain alias matching or it will look decorative.

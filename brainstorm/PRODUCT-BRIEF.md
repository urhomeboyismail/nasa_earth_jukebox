# Product Brief — Earth, Out Loud (Round 0, product-lens Mode 1)

TL;DR: Build for one blind science student who today gets climate visuals as a sentence of alt text. The MVP is one honest, explorable story built from frames, not "any visualization, live".

## 1. Who is this for?

**Primary:** Priya [assumption: persona, not a real person], 20, blind since childhood, first-year environmental science student at the University of Mauritius. Uses TalkBack on a mid-range Android phone and NVDA on a laptop. Reads braille slowly; prefers speech at high speed.

**Secondary (the room that decides):** Space Apps judges — an Earth scientist, an accessibility expert, a designer — who will hear the demo once, mostly sighted.

**Tertiary:** sighted secondary-school students in Mauritius who learn climate from the same EIC visuals.

## 2. What is the pain?

- Climate change is taught through animated maps and charts. Priya gets a caption ("map showing Arctic sea ice decline") or a classmate's description. She gets the conclusion but not the evidence. She cannot check *where* or *when* things changed, or compare two places.
- How often: every lecture or reading with a figure [assumption: frequency not measured]. What she does today: asks someone, reads a data table if one exists, or skips it.
- Severity: she can't do the core scientific act (look at the data and judge it herself). This is an independence problem, not a convenience problem.
- **Not yet validated with a real blind user.** The plan's tester booking (Lois Lagesse Trust Fund) is still unchecked.

## 3. Why now?

- The 2026 challenge asks for this directly, and accessibility is a core theme [verified: docs/challenge.md].
- NASA GIBS publishes colormap files that map pixel colour to data value [unverified until data-scout opens https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/]. If true, "reading the frame" becomes a lookup, not a guess.
- Browser audio (Web Audio/Tone.js) and LLM agents make a voice-driven explorer buildable in a weekend [assumption].

## 4. The 10-star version

Priya opens any NASA Earth visual, from any course or news site. She hears it as music, explores it by touch and keys, asks "where did it change most since 1990?", and gets a cited answer. She can export the data as a table for her assignment. It works the same in TalkBack, VoiceOver, NVDA and on a braille display. Her lecturer uses it in class for everyone.

## 5. The MVP (smallest thing that proves the thesis)

One gold story (e.g. Arctic sea ice), built from its frames and cross-checked against NASA's numbers:
- play it as sound (Listen and Analyze sides);
- explore it without sight (by touch, or by keyboard/buttons while a screen reader is on);
- ask 3–5 grounded questions;
- a sighted judge sees the frame driving the sound.

Thesis proved if a blind tester can find and explain the biggest change unaided.

## 6. Anti-goals

- Not a general accessibility layer for all of earth.gov.
- Not "map colours to notes" for an unreadable rotating globe.
- Not a music app: no background music, no emotion in the narrator.
- Not a native iOS app this weekend.

## 7. How we'll know it works (metrics, not vibes)

- Blind tester finds the biggest change in < 30 s unaided (plan's own test).
- Tester explains what the sound meant after one listen: yes/no.
- 100% of Narrator answers on the gold story pass red-team fact-check.
- Frame-derived values match NASA's numbers within an X% we compute and publish.
- Every core action works with TalkBack on (checklist pass/fail).

## Risks

1. Scope: the plan builds about ten features. The MVP needs about four.
2. Screen-reader gesture conflicts may break "touch the planet" for exactly the primary user.
3. No real user validation yet; persona is assumed.
4. Live mode on unseen visualizations is the riskiest demo moment and the plan's headline.

## Go / no-go

**Go**, conditional: narrow the headline from "any visualization" to "one story you can truly explore", and test it with one real blind user before the event.

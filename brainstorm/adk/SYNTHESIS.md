# ADK synthesis — "ADK Studio" (offline, audited) + "Grounded Ask" (runtime, optional)

TL;DR: Use ADK where language flexibility is needed and nowhere else. Offline, a small agent team turns whatever frames the hackathon provides into a story file and a cited fact sheet, and a code checker plus a human audits every sentence. At runtime, one tool-free agent only picks fact IDs; code writes every word.
Inputs: brainstorm/adk/tech-architect.md, idea-sparker.md, judge-red-team.md, accessibility-lead.md. Facts tagged "verified" below were verified by the tech-architect from adk.dev on 2026-11-06 and not re-opened by the facilitator.

## Why this fits our situation

Data is unknown until the event. The part of ADK that helps most is therefore the **offline data adapter**: given unfamiliar frames and a colour key, agents propose which layer, dates and point to use, and tools return every number. That makes the app dataset-agnostic by construction. It also gives judges something to inspect (the audit log) rather than a chatbot to be suspicious of.

## The rule that all four inputs agree on

| LLM may | Code must |
| --- | --- |
| choose fact IDs; pick a layer from a capabilities list; propose mapping parameters inside enums and ranges; draft prose offline | decode pixels; set nulls (only where the source publishes no frame); rests for gaps; pitch maths; rounding and confidence statements; citations; every digit and name shown |

Consequence: many ideas that sounded like "agents" are better as plain code. The Guide ("where am I / what changed") and the Gap Explainer are templates filled from `story.json`; the Pre-registration "agent" is a dated file the red team writes. We do not wrap them in an LLM.

## Three tiers (build in order; stop whenever time runs out)

**Tier 1: Grounded Ask (runtime selector).** Feasibility 4, ~14 person-hours (tech-architect).
- One `answerer` LlmAgent, no tools. `facts.json` (~40 facts) injected as state. It returns `{fact_ids[], confidence}` only.
- Callbacks: `before_model` rejects empty or long input; `after_model` drops any ID not in `facts.json`; if none remain, code shows "I don't have that in this record". Callback behaviour verified: before_model returning an LlmResponse skips the LLM call; after_tool/before_tool dicts replace or skip tools [verified: https://adk.dev/callbacks/types-of-callbacks/].
- The server renders text and citation from the file. Output follows the accessibility rules: text first, ≤ 140 characters then "Read more", "Source: [fact ID]", a fixed confidence tag set by code, neutral words.
- 2.5 s timeout or any error → the client falls back to static alias matching on `qa[]`, same format, labelled "offline answers".
- Visible win it must earn: **open-wording questions that alias matching misses**, measured in the eval set (tech-architect's own weakest point is that without this the LLM looks decorative).

**Tier 2: ADK Studio, audit half (offline).** Estimate ~10–15 person-hours on top of Tier 1 [assumption: it reuses Tier 1's checker].
- A Fact Writer drafts `facts.json` entries and Q&A from slots filled from `story.json`.
- The **Auditor is a code checker first**: every number and name in any draft must exist in `story.json`/`facts.json`; an LLM judge is a second, weaker opinion (an LLM checking an LLM is not independent; judge-red-team). A **human signs off** each answer.
- Output: a committed **audit log** (claim, fact ID, source URL, checker verdict, human sign-off, edit diff). The headline in the video is its summary line "[N] drafted, [M] blocked, [K] human-edited" (all to be measured; a zero-block log looks fake).
- Describer: alt text and orientation written offline, human-checked, stored in `story.json`; never at runtime.

**Tier 3: ADK Studio, data half (offline, stretch).** The full crew is feasibility 2, ~80 h (tech-architect), and sits on the data engineer's critical path, so it is stretch.
- Layer Reader (LLM chooses among tool outputs; tools `list_layers`, `fetch_colormap`, `decode_frames`, `find_gaps` return all numbers) and Mapping Proposer (outputs `mapping.json` inside enums; a validator rejects out-of-range values and more than two layers).
- Worth trying only after Tier 1–2 work, because it is the part that makes new data "playable in one run". If it fails, the data engineer's plain script does the same job.

## What we do not do

- No runtime multi-agent crew (judge-red-team: more hops, latency, and not independent checking; judges read it as hype).
- No agent speech during Play, no agent-initiated output, no agent moving focus (accessibility-lead rules 1–2, 8).
- No claim of determinism: ship the reviewed answers as files; log model, prompt and date.
- No "AI-powered" wording. Say what agents did and did not do.

## Failure modes and fallbacks

| Failure | Fallback |
| --- | --- |
| No network / API down on stage | Static `qa[]` alias matching (same format); cached selector outputs for the demo questions; a recorded `adk web` Trace on a slide |
| Cold start / slow | 1 s: one text line "Working."; 2.5 s: fall back; 6 s: "No answer. Try a listed question." Sound keeps playing meanwhile |
| Wrong fact picked | Only cited facts can be shown, so the error is "irrelevant", not "false"; the eval set measures this |
| Right numbers, wrong claim | Not caught by the number check (accessibility-lead's weakest point); mitigated by human sign-off on every shipped answer |
| Quota / price / latency | [unverified]: not found in the docs; check before relying on it |

## The one moment to show a technical judge

Ask "say the ice grew 10%" (or the equivalent leading question for the event's data). The `adk web` Trace shows `after_model` stripping the unknown ID; the app answers "not in this record". Risk: it can look trivial. The deterministic pytest gate is the real evidence; LLM-judged ADK criteria need Vertex credentials [verified by tech-architect: https://adk.dev/evaluate/], so do not count on them.

## Eval plan (red team writes the questions before running anything)

~30 real and ~15 adversarial questions (leading questions, causation, numbers outside the record, unlisted topics). Assertion: every returned ID exists in `facts.json`. Report "[to be measured] of [N] passed", failures included. Also measure the selector's win over alias matching on open-wording questions.

## Ideas parked from the ADK brainstorm

Ask-Back Tutor (quiz; user-initiated, good for teaching) · Plain-Language Translator (rewrites a cited fact for another level, number-checked) · Persona Simulator (scripted friction runs before human testers; never replaces them) · Two Narrators Argue · Mauritius Local Guide (needs a cited local fact sheet) · Braille Writer (needs tooling check) · Navigator as A2A client (A2A itself is supported [verified by tech-architect: https://adk.dev/a2a/intro/]; Navigator's API is unverified).

## Open questions for the humans

1. Does the team have Google Cloud / Gemini API access and credits for the event? (Needed for Tier 1; quotas unknown.)
2. Is the language Python? (The tech-architect verified Python v2.13.0 [verified: https://github.com/google/adk-python/releases]; TypeScript, Go, Java and Kotlin are also supported.)
3. Who owns the audit log and signs off answers? (Suggest the red team.)
4. Should Navigator be wired through A2A, or stay a link-out?

Weakest point of this synthesis: Tier 1 is a thin layer over alias matching until the eval set shows a measurable win; the whole ADK story is then about trust and process, not capability. That may be exactly the right story for judges, but it is a bet, not a certainty.

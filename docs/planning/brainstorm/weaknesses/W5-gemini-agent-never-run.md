# W5: The Gemini agent has never run against a real model

TL;DR: T6 is built and unit-tested with a fake model. No Gemini key was available, so no real answer quality, latency, quota or model id has been checked, and the T6 kill rule is undecided.
Status: **open**. Found in: T6 (`agent/`, `brainstorm/reports/T5-T6.md`). Owner: agent/voice.

## Why it matters
- The plan says the agent must beat the plain matcher on open-wording questions by at least 3 of 15, or we ship the static Q&A only. That is not measured.
- The model id `gemini-2.5-flash` in the code is `[unverified]`.
- The app works without the agent. If we show the agent in the demo, it must be real and measured.

## What is true now
- The static matcher passes 37 of 45 eval questions and refuses all 15 adversarial ones. Every miss is a refusal. It was tuned once on these same questions, so treat 37 as optimistic.
- The agent returns fact IDs only. The browser writes the words. A wrong ID cannot create a new number.

## How to fix
1. Put a Gemini key in the environment (never in the repo). Confirm the model id on Google's docs.
2. Run `agent/eval/` with the real model. Report "[measured] of 45 passed" with failures listed.
3. Compare with the static matcher on the 15 open-wording questions. Apply the kill rule honestly.
4. Measure latency; keep the 2.5 s fallback.

## Done when
A real-model result is committed, and the demo and AI-use text say exactly what ran.

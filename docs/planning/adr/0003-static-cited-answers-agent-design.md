# ADR-0003: Static cited answers first; optional ADK Narrator; Navigator off the critical path

**Date**: 2026-11-06
**Status**: superseded by ADR-0005 (the static cited Q&A remains as the offline fallback)
**Deciders**: brainstorm team (tech-architect draft, facilitator)

## Context

Rule 5 says anything spoken as fact must exist in the story file or a cited fact sheet. The baseline plan put Navigator (the team's voice assistant) in front of two Google ADK agents. Navigator's real API is [unverified]. Each agent hop adds latency and a failure point on stage. ADK supports Python streaming and deploys to Cloud Run [verified: https://adk.dev/streaming/dev-guide/part1].

## Decision

Answers are 20–40 pre-written Q&A entries, each tied to fact IDs in `facts.json`. The app never shows or speaks text without a fact ID. An ADK Narrator on Cloud Run is optional and may only choose among cited facts. Navigator is a link-out, not on the critical path. The Composer agent is dropped (see ADR-0002).

## Alternatives Considered

### Alternative 1: Navigator → ADK Narrator + Composer (baseline plan)
- **Pros**: open-ended questions; reuses team work.
- **Cons**: unverified API, two hops, network required, grounding enforced only by prompt.
- **Why not**: stage reliability and rule 5.

### Alternative 2: No Q&A at all
- **Pros**: simplest.
- **Cons**: loses "ask it questions" and the cited-truth story.
- **Why not**: cited Q&A is cheap (ICE 6.0) and helps Validity.

## Consequences

### Positive
- Grounding holds by construction; the demo works with zero network.
- The red team can fact-check every answer before the event.

### Negative
- No truly open questions in the core demo.

### Risks
- Users ask unlisted questions: the app shows "I don't have that in this record" and lists close matches.
- Revisit if Navigator's contract is verified before hour 24 and integration costs under 6 h.

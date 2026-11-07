# ADR-0005: ADK as grounded selector (runtime) and audited drafter (offline)

**Date**: 2026-11-06
**Status**: proposed
**Deciders**: brainstorm team (tech-architect, accessibility-lead, judge-red-team, idea-sparker), facilitator; human asked for a "good implementation of Google ADK"

## Context

ADR-0003 made ADK optional. The human reopened it. Data is unknown until the hackathon, so the agent design must work with any frames. Rule 5 requires every spoken fact to exist in the story file or a cited fact sheet. ADK supports Python, TypeScript, Go, Java and Kotlin; callbacks can skip model or tool calls and replace results; `adk eval` and pytest `AgentEvaluator` exist [verified by tech-architect: https://adk.dev/callbacks/types-of-callbacks/, https://adk.dev/evaluate/]. Judges may read a runtime chatbot as hype (judge-red-team).

## Decision

Use ADK in two bounded ways. **Runtime (optional, progressive enhancement):** one tool-free answerer agent returns only `fact_ids[]` and a confidence; an `after_model` callback drops unknown IDs; code renders all text and citations. **Offline:** agents draft facts, Q&A and alt text; a code checker (every number and name must exist in the story/facts files) then a human audit every sentence, producing a committed audit log. LLMs never set a data value, pitch, rest or sound. The earlier graph-workflow "crew" that reads layers and proposes mappings is a stretch tier. Supersedes ADR-0003.

## Alternatives Considered

### Alternative 1: Static Q&A only, no ADK (ADR-0003)
- **Pros**: zero stage risk.
- **Cons**: cannot answer open wording; no ADK story.
- **Why not**: the human wants ADK used well, and the selector adds measurable value if the eval shows it.

### Alternative 2: Runtime multi-agent crew with an LLM Fact-Checker
- **Pros**: impressive on paper.
- **Cons**: ~80 h, more hops and latency, an LLM checking an LLM is not independent.
- **Why not**: feasibility 2 and judge-visible hype.

### Alternative 3: Free-form runtime Narrator
- **Pros**: natural conversation.
- **Cons**: breaks rule 5; hallucination; collides with screen readers.
- **Why not**: unsafe for the primary user.

## Consequences

### Positive
- Grounding is enforced in code; a refusal can be shown on stage.
- The audit log is evidence judges can open.
- The offline agents make the app dataset-agnostic.

### Negative
- Needs Google API access; quotas, prices and latency are unverified.
- The selector looks thin unless the eval set proves it beats alias matching.

### Risks
- Network or API failure on stage: 2.5 s timeout falls back to static aliases (same format). Revisit if the eval shows no win over aliases.

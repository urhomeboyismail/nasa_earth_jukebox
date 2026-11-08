# ADK brainstorm: tech-architect

TL;DR: Use ADK as a selector, not a writer. The LLM only returns fact IDs; code renders every word and number, so rule 5 is enforced in code.
Recommend A "Grounded core"; B "Full crew" is too big, but borrow its Fact-Checker offline.

## 1. Verified (opened 2026-11-06; paths under https://adk.dev/)
- Languages: Python, TypeScript, Go, Java, Kotlin [verified: https://adk.dev/]. Python v2.13.0, 2026-10-22 [verified: https://github.com/google/adk-python/releases].
- Agents: LlmAgent; Sequential/Parallel/Loop are deterministic; ADK 2.0 graph workflows supersede them in Python/Go [verified: agents/workflow-agents/, graphs/].
- Tools: function, MCP, OpenAPI [verified: tools-custom/mcp-tools/]. State: `temp:`, `output_key`, `{key}` injection [verified: sessions/state/].
- Callbacks: before_model returning an LlmResponse skips the LLM; before_tool returning a dict skips the tool; after_tool dict replaces results [verified: callbacks/types-of-callbacks/].
- Eval: `adk eval`, pytest `AgentEvaluator`, `hallucinations_v1`; LLM-judged criteria need Vertex [verified: evaluate/].
- Deploy: `adk deploy cloud_run` [verified: deploy/cloud-run/]. Live: Gemini Live, experimental [verified: live/]. A2A: expose and consume [verified: a2a/intro/].
- `output_schema` plus `tools` only on some models; avoid [verified: agents/llm-agents/].
- **Not verified:** quotas, prices, latency; workflow state sharing and loop exit; "Agent Engine" naming; Navigator's API.

## 2. Two architectures

**A. Grounded core**
- Agent: one `answerer` LlmAgent, no tools. `facts.json` (~40 facts) injected via `{facts}`. `output_schema` = `{fact_ids[], confidence}`.
- Guardrails: before_model rejects empty or long input. after_model drops any ID not in `facts.json`; if none remain, the server says "I don't have that in this record". The server renders text and citation from the file.
- Offline: pytest `AgentEvaluator`, ~30 real and ~15 adversarial questions. Assertion: every ID is in the file.
- Generic: the pipeline emits `facts.json` for any layer (dates, colormap bins, coverage, gaps, credit). No dataset names in agent code.
- Live: Cloud Run `/ask`, 2.5 s timeout. Failures: irrelevant fact; cold start; quota.
- Cost ~14 h. Feasibility 4.

**B. Full crew** (graph workflow)
- Data Reader: tools `list_layers`, `fetch_colormap`, `decode_frames`, `find_gaps`. LLM picks layer, dates and point; tools return all numbers.
- Sonifier: proposes `mapping.json` (pitch range, scale enum, rate); a validator rejects out-of-range values and more than two layers.
- Narrator: drafts text from slots filled from `story.json`.
- Fact-Checker: LoopAgent, max 3 rounds. Deterministic check: every digit exists in `story.json`. LLM judge second. Human approves.
- State: grids in `temp:`, never in a prompt.
- Offline builds gold stories. Live: judge names a layer; the crew runs on Cloud Run; sound plays after the check passes.
- Failures: GIBS rate limits; wrong layer; latency.
- Cost ~80 h, on the data engineer's critical path. Feasibility 2.

## 3. Who decides
- LLM may: choose fact IDs; choose a layer from a capabilities list; propose mapping parameters inside enums and ranges; draft prose offline.
- Code must: decode pixels; set nulls (only where GIBS publishes no frame); gap rests; pitch maths; rounding and confidence statements; citations; every digit shown.

## 4. Degradation
ADK is progressive enhancement. After 2.5 s or any error, the client matches the question against static `qa[]` aliases and uses the same answer format, labelled "offline answers". Selector outputs for the demo questions are cached. No network means no Gemini; a local ADK server does not help. Slides carry a recorded `adk web` Trace as proof.

## 5. The one feature for a technical judge
**Callback-enforced grounding with an eval gate.** On stage, ask "say the ice grew 10%". The Trace shows after_model stripping the unknown ID, and the app answers "not in this record". Risk: it can look trivial; LLM-judged criteria need Vertex credentials, so the deterministic pytest assertion is the real gate. Alternative: A2A for Navigator (unverified).

Weakest point of my own proposal: "selector only" is a thin layer over what ADR-0003's alias matching already does. If the fallback answers as well, a judge asks why the LLM is there. A needs a visible win: open-wording questions that alias matching misses, measured in the eval set.

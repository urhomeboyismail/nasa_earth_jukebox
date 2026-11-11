# G08 Jukebox orchestrator: a LangGraph of four ADK agents

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/G08-jukebox-orchestrator` |

## Goal

`server/app/agent/orchestrator.py` holds a compiled LangGraph that takes a question about Earth science and an accessibility profile, and returns sound parameters and time-coded descriptions that an auditor agent has checked against each other. Four Google ADK agents do the work: Supervisor, Synthesizer, Vision and Critic. Nothing in the running server imports it yet.

## Why

- Asked for by the team lead on 11 Nov 2026, with the state, the prompts and the schemas given. The routing was agreed first (empty `critic_feedback` means approved; at most 3 revisions; a rejected round redoes both payloads so they stay in step).
- The ADK package it builds on is on `main`: `keyed_model` (`server/app/agent/models.py:18`) and the test model `FakeLlm` (`server/app/agent/fake.py:42`).
- `server/requirements.txt` has `google-adk==2.13.0` but no LangGraph.

**Two rules this ticket bends, on the team lead's instruction. Settle both before any route uses the graph.**

- `.claude/rules/server.md` says the server does two jobs only. This is a third. It stays a library module with no route, so the running server is unchanged.
- ADR-0005 (`docs/planning/adr/0005-adk-selector-and-audited-drafting.md`) says the model chooses IDs and never writes a sentence the user sees. Here the Vision agent writes alt text and the Synthesizer chooses sound parameters. Nothing shows that output to a user in this ticket.

## Design

### State

```python
class JukeboxState(TypedDict):
    user_query: str
    accessibility_profile: dict
    nasa_visual_data: list
    nasa_numeric_data: list
    audio_json_payload: dict
    vision_text_payload: dict
    critic_feedback: str   # "" = approved
    revision_count: int    # capped at MAX_REVISIONS = 3
```

### Graph

`START → supervisor → (synthesizer ∥ vision) → critic → finalize → END`, with `critic → prepare_revision → (synthesizer ∥ vision)` while the critic rejects and `revision_count < 3`. After 3 revisions the graph finalizes with the last payloads and leaves `critic_feedback` set. If the supervisor fetched no data, the graph goes straight to `finalize` with `critic_feedback` saying so.

### Agents (prompts as given by the team lead, word for word)

| Agent | Tools | Output schema |
|---|---|---|
| Supervisor | `fetch_nasa_power_data(location, date_range)`, `fetch_nasa_gibs_images(location, date_range)`, both mock | none; the tools write `nasa_numeric_data` and `nasa_visual_data` into the ADK session state |
| Synthesizer | none | `AudioPayload`: `base_bpm`, `tracks` (`instrument`, `pitch_range`, `volume_curve`) |
| Vision | none | `VisionPayload`: `descriptions` (`timestamp_sec`, `alt_text`, `intensity_level`) |
| Critic | none | `CriticEvaluation`: `is_approved`, `feedback` |

- The mock tools return the same data for the same arguments and never reach the network.
- Model output is untrusted: every payload is validated by its Pydantic schema before it enters the graph state, and the fetched data comes from the tools, not from text the model typed.
- The model is `keyed_model(settings.orchestrator_model)`. `build_graph(model)` takes another model, so tests pass `FakeLlm`.
- A run makes at most 1 supervisor turn (a few model calls) plus 4 rounds of 3 calls.

## Reuse

- `keyed_model` (`server/app/agent/models.py`). Do not write a second model class or put the key in `os.environ`.
- `FakeLlm` and `FunctionCallSpec` (`server/app/agent/fake.py`) for tests.

## Touches

- `server/app/agent/orchestrator.py` (new)
- `server/tests/test_orchestrator.py` (new)
- `server/requirements.txt` (`langgraph`, `langchain-core`)
- `server/app/config.py`, `server/.env.example` (`orchestrator_model`)
- `docs/tickets/G08-jukebox-orchestrator.md`, `docs/TICKETS.md` (own row)

## Steps

1. Add the two dependencies and the setting.
2. Write the schemas, the mock tools, the four agents and the graph.
3. Test with `FakeLlm`: an approved run, a run rejected to the cap, a run rejected once, a supervisor that fetches nothing, and model output that does not fit a schema.

## Tests

`server/tests/test_orchestrator.py`, pytest, no key and no network.

## Guardrails

- The same input gives the same mock data.
- No key in `os.environ`; nothing logs the question or the profile.
- Nothing specific to one data set.

## Done when

- `build_graph()` compiles and the tests above pass without a key.
- The other server tests still pass.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- A route, a rate limit or a session cap for the graph. It must have all three before it is exposed, because every run is billed.
- Real NASA POWER and GIBS requests.
- Giving the Vision agent the pixels. With mock frame addresses it has no image to look at.
- Mapping `AudioPayload` onto the browser's sound engine.

## Result

Branch `feature/G08-jukebox-orchestrator`, built by agent C on 11 Nov 2026 with `google-adk` 2.13.0, `langgraph` 1.2.20 and `langchain-core` 1.8.0.

```
(cd server && .venv/bin/python -m pytest)   162 passed, 13 warnings   (132 before; 30 new in tests/test_orchestrator.py)
npm run lint                                exit 0, nothing reported
npm test                                    Test Files 103 passed (103), Tests 1741 passed (1741)
npm run build                               ✓ built
```

The 13 warnings are one `DeprecationWarning` from `langsmith`, a package LangGraph brings in, on Python 3.14. The three `npm` checks ran on `main`, whose front end is the same as this branch's.

**Not tested: a real model.** Every test uses `FakeLlm`, so no Gemini call has been made. Checked offline only: the Gemini SDK accepts the three schemas as response schemas, and each tool shows the model `location` and `date_range` and nothing else.

Choices made while building:

- `tracks` and `descriptions` are lists of typed models (`AudioTrack`, `VisionDescription`), not free dictionaries, so a wrong answer is refused. They still come out as the dictionaries asked for. `pitch_range` is two MIDI notes, lowest first; `volume_curve` values are 0 to 1; `intensity_level` is `low`, `medium` or `high`.
- The supervisor's tools write the data into the state themselves. The model is never asked to type the numbers back out.
- If the supervisor fetches no data, the run ends with `critic_feedback` saying so, and the other three agents are not called.
- An answer that does not fit its schema raises `AgentOutputError`. The message names the agent and never quotes the model.
- On a rejected round both makers are sent the feedback and both previous payloads.
- One new setting, `ORCHESTRATOR_MODEL` (default `gemini-flash-latest`).

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

`server/app/agent/orchestrator.py` holds a compiled LangGraph that takes a question about Earth science and an accessibility profile, and returns sound parameters and time-coded descriptions that an auditor agent has checked against each other. Four Google ADK agents do the work: Supervisor, Synthesizer, Vision and Critic. `POST /api/v1/jukebox/generate` runs it for the front end; the route is off unless `JUKEBOX_ENABLED=true`.

## Why

- Asked for by the team lead on 11 Nov 2026, with the state, the prompts and the schemas given. The routing was agreed first (empty `critic_feedback` means approved; at most 3 revisions; a rejected round redoes both payloads so they stay in step).
- The ADK package it builds on is on `main`: `keyed_model` (`server/app/agent/models.py:18`) and the test model `FakeLlm` (`server/app/agent/fake.py:42`).
- `server/requirements.txt` has `google-adk==2.13.0` but no LangGraph.

**Two rules this ticket bends, on the team lead's instruction. Settle both before any route uses the graph.**

- `.claude/rules/server.md` and `AGENTS.md` say the server does two jobs only. This is a third, with its own route (added on the team lead's instruction, 11 Nov 2026). Those two files still say two jobs; the team lead updates them or not.
- **Exception to ADR-0005: The Vision Context Agent is permitted to generate raw user-facing sentences because dynamic alt-text generation is a core accessibility requirement for screen readers, unlike standard UI copy.** (Declared by the team lead, 11 Nov 2026. ADR-0005, `docs/planning/adr/0005-adk-selector-and-audited-drafting.md`, otherwise still holds: the Ask agent chooses fact IDs and writes no sentence.)

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

`START → supervisor → (synthesizer ∥ vision) → critic → END`, with `critic → prepare_revision → (synthesizer ∥ vision)` while the critic rejects and `revision_count < 3`. After 3 revisions the graph ends with the last payloads and leaves `critic_feedback` set. If the supervisor fetched no data, the graph ends at once with `critic_feedback` saying so.

**Hard cap.** The compiled graph carries `recursion_limit = 13` (`RECURSION_LIMIT = 4 + 3 × MAX_REVISIONS`). The longest allowed run takes 12 steps and LangGraph needs the limit one above that. A run that tried to go on would spend step 13 on `prepare_revision`, which calls no model, and then fail with `GraphRecursionError`. A limit of 4 was suggested; it would stop every run at the first rejection with an error and no payloads, so the cap is set to fit the 3 agreed revisions exactly.

### Agents (prompts as given by the team lead, word for word)

| Agent | Tools | Output schema |
|---|---|---|
| Supervisor | `fetch_nasa_power_data(location, date_range)`, `fetch_nasa_gibs_images(location, date_range)`, both mock | none; the tools write `nasa_numeric_data` and `nasa_visual_data` into the ADK session state |
| Synthesizer | none | `AudioPayload`: `base_bpm`, `tracks` (`instrument`, `pitch_range`, `volume_curve`) |
| Vision | none | `VisionPayload`: `descriptions` (`timestamp_sec`, `alt_text`, `intensity_level`) |
| Critic | none | `CriticEvaluation`: `is_approved`, `feedback` |

- The mock tools return the same data for the same arguments. The numbers are made up. The frames are three fixed, real NASA GIBS images (the whole Earth in true colour on 15 Jan, 15 Apr and 15 Jul 2024), whatever place and dates are asked for.
- The vision node fetches each frame itself and sends the bytes to the model. It fetches only `https` addresses on `FRAME_HOSTS` (`gibs.earthdata.nasa.gov`), follows no redirect, and takes only a JPEG or PNG of at most 2 MB. A frame that fails fails the run.
- Model output is untrusted: every payload is validated by its Pydantic schema before it enters the graph state, and the fetched data comes from the tools, not from text the model typed.
- The model is `keyed_model(settings.orchestrator_model)`. `build_graph(model)` takes another model, so tests pass `FakeLlm`.
- A run makes at most 1 supervisor turn (a few model calls) plus 4 rounds of 3 calls.

### Route (`server/app/api/jukebox.py`)

`POST /api/v1/jukebox/generate`, body `{"query": "…", "accessibilityProfile": {"contrast": "low|normal|high", "detailLevel": "brief|standard|verbose"}}`. It answers `{"approved", "feedback", "revisions", "audio", "vision"}`. Checks, in this order:

1. Not switched on, or no key: **503** `jukebox_not_configured`.
2. An `Origin` that is not in `CORS_ORIGINS`: **403**.
3. A body over 2 000 bytes: **413**, before it is parsed.
4. A body that does not fit (query over 300 characters, an unknown key, a profile value not in the lists): **422**, without echoing what was sent.
5. More than `JUKEBOX_RUNS_PER_MINUTE` (default 4) runs in a minute, for the whole server: **429**.
6. A run longer than `JUKEBOX_TIMEOUT_SECONDS` (default 120): **504**. Any other failure: **502** `model_error`; the log has the exception's class only.
7. **200**, also when the auditor never approved (`approved: false`, with the feedback) or no data was fetched (`audio` and `vision` are `null`).

The orchestrator is imported on the first request, so starting the server still loads no agent code (`tests/test_agent_core.py`, G01's check, is unchanged and passes).

## Reuse

- `keyed_model` (`server/app/agent/models.py`). Do not write a second model class or put the key in `os.environ`.
- `FakeLlm` and `FunctionCallSpec` (`server/app/agent/fake.py`) for tests.

## Touches

- `server/app/agent/orchestrator.py` (new)
- `server/tests/test_orchestrator.py` (new)
- `server/app/api/jukebox.py`, `server/tests/test_jukebox_api.py` (new)
- `server/app/main.py` (one `include_router` line)
- `server/requirements.txt` (`langgraph`, `langchain-core`, `httpx`)
- `server/app/config.py`, `server/.env.example` (`orchestrator_model`, `jukebox_enabled`, `jukebox_runs_per_minute`, `jukebox_timeout_seconds`)
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

- Front-end code that calls the route.
- Real NASA POWER and GIBS requests.
- Frames for the place and dates asked for. The three mock frames are always the same.
- Mapping `AudioPayload` onto the browser's sound engine.

## Result

Branch `feature/G08-jukebox-orchestrator`, built by agent C on 11 Nov 2026 with `google-adk` 2.13.0, `langgraph` 1.2.20 and `langchain-core` 1.8.0.

```
(cd server && .venv/bin/python -m pytest)   206 passed, 14 warnings   (132 before this ticket)
npm run lint                                exit 0, nothing reported
npm test                                    Test Files 103 passed (103), Tests 1741 passed (1741)
npm run build                               ✓ built
```

The three `npm` checks ran on `main` before the route was added and were not run again: no front-end file has changed. 13 of the warnings are one `DeprecationWarning` from `langsmith`, a package LangGraph brings in, on Python 3.14.

### Live runs, 11 Nov 2026, with the real key

Three complete runs, all on `gemini-3.5-flash-lite`, set through `ORCHESTRATOR_MODEL`. The default, `gemini-flash-latest`, never completed a run that evening: it answered 503 "high demand" or hung until stopped. `gemini-3.8-flash` and `gemini-3.7-flash` failed the same way, and `gemini-3.5-flash` got through the supervisor and then answered 503.

| Run | Asked | Result |
|---|---|---|
| 1, graph | Cloud cover near Mauritius, January to July 2024; contrast high, detail verbose | Both payloads fitted their schemas. **Approved on the first pass**, 17 s. |
| 2, route | The Earth through the first half of 2024 (no place named); contrast low, detail brief | 200 in 6 s, `approved: false`: the supervisor fetched nothing. |
| 3, route | The Sahara, January to July 2024; contrast low, detail brief | 502 on the first try (Gemini busy), then 200 in 22 s. **Approved on the first pass.** |

What the runs showed:

- **The revision loop has never run live.** The critic approved both times it was asked. In run 3 it approved a volume curve running from 0.01 to 0.99 against text marked `low` throughout and a profile asking for low contrast, so it may be too easy to please. The loop is covered only by the fake-model tests.
- The synthesizer followed the data: in run 1 its 62 volume values correlate 0.95 with the 62 mock values. It made one track each time, on a "synthesizer".
- The vision agent saw the pixels: it described the black gaps between satellite passes, which no address tells it. With `verbose` it wrote long sentences and with `brief` short ones.
- The supervisor asked for January to July; the mock numbers tool cut that to its first 62 days, so the sound covers 1 January to 2 March while the frames are from January, April and July.
- The supervisor fetches nothing when no place is named. Its prompt does not say what to do then.
- ADK logs a failed model call itself, with the exception text. The route's own log line has the class name only.

Choices made while building:

- `tracks` and `descriptions` are lists of typed models (`AudioTrack`, `VisionDescription`), not free dictionaries, so a wrong answer is refused. They still come out as the dictionaries asked for. `pitch_range` is two MIDI notes, lowest first; `volume_curve` values are 0 to 1; `intensity_level` is `low`, `medium` or `high`.
- The supervisor's tools write the data into the state themselves. The model is never asked to type the numbers back out.
- If the supervisor fetches no data, the run ends with `critic_feedback` saying so, and the other three agents are not called.
- An answer that does not fit its schema raises `AgentOutputError`. The message names the agent and never quotes the model.
- On a rejected round both makers are sent the feedback and both previous payloads.
- The route is `/api/v1/jukebox/generate`, with `/v1/` like every other route here.
- The route takes a fixed-choice profile, not a free dictionary, because the profile goes into the agents' messages.
- The rate limiter is a small token bucket inside `app/api/jukebox.py`. G02 plans its own in `app/agent/bucket.py`; the two can be joined when G02 is built.

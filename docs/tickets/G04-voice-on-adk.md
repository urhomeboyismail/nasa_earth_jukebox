# G04 Voice guide on ADK `run_live`, same browser protocol, behind a switch

| | |
|---|---|
| **Priority** | P1 |
| **Size** | L (more than a day) |
| **Who** | agent |
| **Needs** | G01 |
| **Hotspots** | server-assistant |
| **Branch** | `feature/G04-voice-on-adk` |

## Goal

With `ASSISTANT_ENGINE=adk`, `/api/v1/assistant/live` runs the voice guide through ADK's `Runner.run_live`. The browser sees **exactly the same messages** as today. With the default `ASSISTANT_ENGINE=bridge`, nothing changes. Tests replay fake ADK events and check the browser messages, using the same assertions as `server/tests/test_assistant.py`. The live check with a billed key is H02.

## Why

- The browser protocol is written in `server/app/api/assistant.py:1-14` and `_Bridge` (`:59-121`). The browser (`src/hooks/useVoiceAssistant.ts`) depends on it, so it must not change.
- The bridge hand-routes tool calls: it runs `run_tool` and forwards actions itself (`assistant.py:115-118`). ADK runs the tools inside the agent (G01), so the action has to leave through a side channel: the `ActionSink` (G01), drained after each event.
- ADK's live queue API, read from `google-adk` 2.13.0: `LiveRequestQueue.send_realtime(blob)`, `send_content(content)`, `send_audio_stream_end()`, `close()` (`google/adk/live/live_request_queue.py:94-129`). `Runner.run_live(*, user_id, session_id, live_request_queue, run_config, session)` is at `google/adk/runners.py:1733`.
- `RunConfig` has `response_modalities`, `input_audio_transcription` and `output_audio_transcription` (`google/adk/agents/run_config.py:126,156,161`). Check the `streaming_mode` values in `_streaming_mode.py` before you use `BIDI`.
- The live path reads transcripts, interruptions and turn ends from the model response (`google/adk/live/_live_llm_flow.py`). Check the names on the **events `run_live` yields**, in the installed version, before you write the mapping. The names used there are `input_transcription`, `output_transcription`, `interrupted`, `turn_complete`.
- The bridge pins the API version to `v1beta` (`server/app/config.py:34-36`). ADK must use the same version. Use the keyed model from G01 (`server/app/agent/models.py`).

## Design

### The seam

`server/app/agent/voice.py` (new) defines:

```python
class LiveSession(Protocol):
    session_id: str
    def events(self) -> AsyncIterator[Any]: ...          # what run_live yields
    async def send_audio(self, pcm: bytes) -> None: ...  # 16 kHz PCM16, one frame
    async def send_text(self, text: str) -> None: ...
    async def audio_end(self) -> None: ...
    def close(self) -> None: ...

@asynccontextmanager
async def connect_adk(language: str, page: str) -> AsyncIterator[LiveSession]: ...   # the real one
```

- The real `connect_adk` creates the ADK session (`session_service.create_session(app_name=..., user_id=..., state={"page": page, "page_title": ..., "language": language, "screens": {}})`), a `LiveRequestQueue`, the `RunConfig` and the `LlmAgent` (the five tools from G01, `before_tool_callback=guard_tool`, `after_tool_callback=log_tool`, the instruction below). It returns an object that implements `LiveSession` by wrapping `run_live`.
- Tests replace `connect_adk`, as `test_assistant.py` replaces `connect_live`.

### The route (`server/app/api/assistant.py`)

- The route keeps the shared parts: origin check, `accept`, the not-configured check, the busy check and its counter, the start message, the language and page whitelist, the time limit and the `ended` reason. These are unchanged.
- Only the step that opens the upstream session and pumps messages is chosen by the engine: `_run_bridge` (today's code, moved) or `_run_adk`. `settings.assistant_engine` picks one.
- Both send `{"type": "ready"}` after the upstream session is open, and both end with the same `ended` and `error` messages.

### The translation, browser to model

| Browser | ADK call |
|---|---|
| binary frame, 1 to 64 KiB, PCM16 16 kHz | `send_audio(bytes)`, which calls `queue.send_realtime(types.Blob(data=..., mime_type="audio/pcm;rate=16000"))`. Frames over 64 KiB are dropped |
| `{"type":"mic_off"}` | `audio_end()` → `queue.send_audio_stream_end()` |
| `{"type":"text","text":...}` | `send_text(text[:2000])` → `queue.send_content(types.Content(role="user", parts=[types.Part(text=...)]))`. Whitespace-only is ignored |
| `{"type":"page","page":...}` | state only: `state["page"]` and `state["page_title"]`. Nothing is sent to the model, as today |
| `{"type":"context","key","data","announce"}` | same checks as `assistant.py:update_context` (key in `CONTEXT_KEYS`, at most 24 KiB). Store in `state["screens"]`. An announce prompt, at most every 4 s, goes out as `send_text` |
| `{"type":"stop"}` | `close()`, then the loop ends |

### The translation, model to browser

For each event from `events()`, in this order:

1. **Drain the sink first.** `actions = sink.drain(session_id)`; for each, send `{"type": "action", **action}`. A tool runs between its function-call event and its function-response event, so the action may only appear on a later event. Drain after every event.
2. Audio: each inline PCM part goes out as a binary message (24 kHz).
3. `interrupted` → `{"type": "interrupted"}`.
4. Input transcript text → `{"type": "transcript", "role": "user", "text": ...}`; output transcript text → `{"type": "transcript", "role": "assistant", ...}`.
5. `turn_complete` → `{"type": "turn_complete"}`.
6. A `go_away` or the end of `events()` → the session ends with reason `service_ended`.

Exceptions from the upstream end the session with `{"type": "error", "code": "upstream", "message": "The voice guide stopped unexpectedly."}`, as today. The API key is scrubbed from the log line, as `_scrub` does today.

### Instruction and state

- `knowledge.system_instruction` gets a `page_label` argument. The bridge passes the page title, as now. The ADK path passes the placeholder `{page_title}`, and ADK fills it from session state. Check how the installed ADK fills placeholders in a live agent, and whether it re-reads them mid-session. **Write the answer in Result.** If it does not re-read them, the page is still correct, because `get_screen_context` reads the live `state["page"]`. Do not claim "stays current" for the instruction.
- The instruction text must have no braces other than `{page_title}`. A test checks this.
- Session state holds plain values only: `page`, `page_title`, `language`, `screens` (a dict of plain dicts).

### Shared limits (`server/app/agent/limits.py`, new)

Move `MAX_AUDIO_FRAME_BYTES`, `MAX_TEXT_CHARS`, `MAX_CONTEXT_BYTES`, `ANNOUNCE_GAP_SECONDS` and `CONTEXT_KEYS` here from `assistant.py`. `assistant.py` imports them from there, so there is one copy.

## Reuse

- G01: `app/agent/tools.py` (the five tools), `sink.py`, `callbacks.py`, `models.py`, `fake.py`. Do not copy them.
- `server/app/assistant/knowledge.py` (`system_instruction`, `event_prompt`, `PAGES`), `server/app/assistant/tools.py` (`SessionState`, `run_tool`).
- `server/tests/test_assistant.py`: its FakeSession and assertions are the model for the new tests. Do not change its tests.

## Touches

- `server/app/agent/voice.py`, `limits.py` (new)
- `server/app/api/assistant.py` (route split, the shared limits import)
- `server/app/assistant/knowledge.py` (the `page_label` argument only)
- `server/app/config.py`: no change (G01 added `assistant_engine`)
- `server/tests/test_assistant_adk.py` (new)
- `server/tests/test_assistant.py`: no change

## Steps

1. Check the installed ADK: the names on yielded events, `StreamingMode`, placeholder filling in live agents, `delete_session`, and whether `run_live` yields function-response events.
2. Write `limits.py`, move the constants, and check that `test_assistant.py` still passes.
3. Split the route into the shared part and `_run_bridge` (unchanged code) and `_run_adk`.
4. Write `voice.py` with `LiveSession`, `connect_adk`, the translation and the sink drain.
5. Add the `page_label` argument to `knowledge.system_instruction`.
6. Write `test_assistant_adk.py` (below).
7. Run the checks. With `ASSISTANT_ENGINE` unset, the bridge tests must pass unchanged.

## Tests

`server/tests/test_assistant_adk.py`, pytest. A `FakeLiveSession` implements `LiveSession`:
- `events()` yields SimpleNamespace events you script, and can call `sink.put(session_id, action)` before yielding an event, to act like a tool.
- `send_*` record what they were given.

Set `settings.assistant_engine = "adk"` in the fixture, and replace `connect_adk`.

Browser-message parity, the same assertions as `test_assistant.py`:
1. Navigation round trip: text → navigate action → binary audio → transcript → turn_complete → stop → ended.
2. Playback action reaches the browser (`{"type":"action","action":"player","command":"pause"}`), then the audio.
3. `set_date` reaches the browser as `{"setDate": "2024-07-15"}`.
4. Off the Listen page, a playback call produces no action, and the audio still comes.
5. Player context with an announce: one `send_text` prompt containing "get_screen_context". A second announce within 4 s is not sent. An unknown context key is ignored.
6. Not configured (no key) → `not_configured`. A foreign origin is rejected. The fifth session → `busy`.

Translation:
7. A binary frame of 1 600 bytes → `send_audio` once with the same bytes; a frame of 64 KiB + 1 → not sent.
8. `mic_off` → `audio_end` called once.
9. Text of 2 500 characters → `send_text` with 2 000 characters; whitespace-only text is not sent.
10. Invalid JSON and unknown message types are ignored.
11. `assistant_max_session_seconds` set to 0.2 with a session that never ends → `ended` with reason `time_limit`.
12. The events raise → `error` with code `upstream`, and the message does not contain the key.
13. Ordering: an action drained after a function-call event is sent before the audio of that event.
14. The instruction has `{page_title}` and no other braces.

## Guardrails

Not applicable to sound: the voice guide's audio already plays under `src/assistant/ducking.ts`, and that stays as it is. Keep the browser protocol exactly as documented in `assistant.py`. Model output stays untrusted: only the sink's checked actions reach the browser.

## Done when

- With `ASSISTANT_ENGINE=adk` and a fake live session, every test in the list passes, and the browser messages are the same as the bridge's for the same flow.
- With the default engine, `test_assistant.py` passes unchanged.
- `voice.py` and the route never log user text or the key.
- The check results, including the answers to the ADK questions in Steps 1, are in **Result**.
- The real live path is **not** claimed to work until H02 passes.

## Checks

```bash
(cd server && .venv/bin/python -m pytest)
env -u GEMINI_API_KEY -u GOOGLE_API_KEY bash -c 'cd server && .venv/bin/python -m pytest'
```

No front-end change, so the `npm` checks do not apply.

## Out of scope

- Changing the browser protocol. Any change needs a board request to the voice owner first.
- Deleting the bridge (G05).
- The Ask endpoint (G02).
- Context schemas (G06).
- Running a real session. That is H02, with a billed key.

## Result

Agent E, 2026-11-12. `ASSISTANT_ENGINE=adk` now runs the voice guide through ADK's `Runner.run_live`; the default `bridge` is unchanged. Written against a fake live session only: **the real live path has not been run** (that is H02, with a billed key).

Files: `server/app/agent/limits.py` and `voice.py` (new), `server/app/api/assistant.py` (route split into `_wait`, `_run_bridge`, `_run_adk`), `server/app/assistant/knowledge.py` (`page_label` argument), `server/tests/test_assistant_adk.py` (new, 21 tests). `test_assistant.py` is unchanged.

**Answers to the ADK questions in Step 1** (google-adk 2.13.0 as installed):
- Events from `run_live` carry `content.parts[].inline_data` (audio), `input_transcription`, `output_transcription` (each with `.text` and `.finished`), `interrupted` and `turn_complete`. Function-call and function-response events are both yielded (`live/_live_llm_flow.py:458-465`), so the sink is drained after every event.
- `StreamingMode` has `NONE`, `SSE` and `BIDI`; `BIDI` is used.
- Transcripts: Gemini sends chunks (`finished=False`, `partial=True`) and then the whole text again (`finished=True`). Gemini 3.x Live sends the user's words once, as a finished event only (`models/gemini_llm_connection.py:433-470`). `AdkBridge` forwards chunks and drops the repeated whole text, but forwards a finished text when no chunk came before it.
- `go_away` is not seen by the caller. ADK turns it into an internal reconnect (`_live_llm_flow.py:256-260`), so a stream that ends is reported as `service_ended`.
- `session_service.delete_session(app_name=, user_id=, session_id=)` exists and is called when the connection closes.
- Placeholders: ADK fills `{page_title}` from session state before the live connection opens (`_preprocess_async`, `_live_llm_flow.py:172, 481`). Checked with `inject_session_state`: "The user started on: Learn the sounds.", and "Home." after the state changed. I did not test whether a running session re-reads it, so the instruction is **not** claimed to stay current. The page is still correct because `get_screen_context` reads the live `state["page"]`.

**Choices to review:**
- `run_live` is given `session=` (deprecated; the warning is silenced) instead of `user_id` and `session_id`. With ids, ADK re-reads a copy of the session, and the route's updates to `page`, `page_title` and `screens` would never reach the tools. `LiveSession` therefore also has a `state` attribute, which the ticket's sketch did not list.
- Two existing tests (`test_agent_core.py::test_importing_the_server_loads_no_agent_module` and `test_jukebox_api.py::test_starting_the_server_still_loads_no_agent_code`) require that importing the server loads no `app.agent` or `google.adk` module. So `assistant.py` imports `app.agent.limits` and `voice` lazily: `connect_adk` is a thin wrapper that imports on first use, and the limit constants are still readable as `assistant.MAX_TEXT_CHARS` through a module `__getattr__` (`test_assistant.py` reads one). G05 can make these plain imports once ADK is the default.
- Not done: board requests R-20261112-V02-1 (`detail`) and R-20261112-V02-2 (`limitSeconds` in `ready`). Both change the browser protocol, which this ticket must not, and they are unanswered.

```
.venv/bin/python -m pytest                              -> 253 passed (232 before + 21 new)
env -u GEMINI_API_KEY -u GOOGLE_API_KEY ... pytest      -> 253 passed
```


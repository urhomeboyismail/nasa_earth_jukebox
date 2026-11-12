# G01 ADK core package: tools, callbacks, action sink, keyless tests

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | server-assistant |
| **Branch** | `feature/G01-adk-core` |

## Goal

`server/app/agent/` exists and is pinned to a Google ADK version that works with the Live SDK. It holds the five voice tools as ADK function tools, a per-session action sink, the safety callbacks and a fake model for tests. It has **no route**. Nothing in the running server imports it, so the server behaves exactly as before and this ticket merges on its own.

## Why

- The five voice tools exist today only as google-genai declarations plus a dispatcher: `server/app/assistant/tools.py:21-55` (`tools()`), `:79` (`run_tool`). `run_tool` is the one place that checks page names, playback commands and ISO dates. It must stay the source of truth, so the ADK tools wrap it and do not repeat its checks.
- ADK builds a function's schema from its Python signature. A `Literal[...]` argument becomes an enum in the schema the model sees.
- `google-adk` 2.13.0 requires `google-genai>=2.30,<3` and `pydantic>=2.12,<3` (read from its wheel metadata). The server venv has `google-genai` 3.0.0, and `server/requirements.txt:5` does not pin it. Installing ADK therefore moves the bridge's SDK to a 2.x release. Check that first.
- The prototype `docs/planning/prototype/agent/grounded_ask.py` has the fake model (`FakeLlm`, `keyword_script`). Its `FakeLlm` has `calls: list = []`, a mutable default shared by every instance. Fix that when porting.
- ADK API, read from `google-adk` 2.13.0: `before_tool_callback` is `(tool, args, tool_context)` and may return a dict to skip the tool (`google/adk/agents/llm_agent.py:123-130`); `after_tool_callback` is `(tool, args, tool_context, tool_response)`; `tool_context.session` is at `google/adk/agents/context.py:305`; `LiveRequestQueue` is in `google/adk/live/live_request_queue.py`; `Runner.run_live` is at `google/adk/runners.py:1733`.

## Design

### Dependencies

- `server/requirements.txt`: add `google-adk==2.13.0` and pin `google-genai==2.34.0` (the newest 2.x; the prototype used it). Keep the other lines.
- In a fresh venv, `cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/pip check` must pass. If pip picks `google-genai` 3.x, the pin is wrong: stop and say so.
- Record in **Result** which `google-genai` the bridge ran on before (3.0.0 in the local venv) and after (2.34.0).
- Do not pin `google-adk` to a newer release without a reason. 2.14.0 has the same `<3` limit.
- ADK 2.13.0 also requires `fastapi>=0.133,<1` and `python-multipart`, and `server/requirements.txt` has `fastapi>=0.115.0`. Pip will raise FastAPI. Run the whole server test suite afterwards, the study API tests included, and say in **Result** which FastAPI version was installed.

### Settings: `server/app/config.py` and `server/.env.example`

`config.py` belongs to the team leader (`docs/PLAN.md` §4). Post the list below on `docs/AGENT-BOARD.md` before you claim, and wait for an answer.

Add to `Settings`, with a comment on each:

```python
# Google ADK agent (G01 to G05). Nothing calls the model while agent_enabled is false.
agent_enabled: bool = False
agent_model: str = "gemini-2.5-flash"                  # [unverified] confirm the id with a real key (G07)
agent_timeout_seconds: float = Field(default=2.5, gt=0)
agent_max_requests_per_minute: int = Field(default=5, gt=0)   # one token bucket for the whole server
assistant_engine: Literal["bridge", "adk"] = "bridge"  # G05 changes the default to "adk"
```

Add the five variables to `server/.env.example`, each commented out, one line of explanation each. Never write a key into the file.

### Package layout (`server/app/agent/`)

- `__init__.py`: a docstring only.
- `tools.py`: the five ADK function tools and the list `AGENT_TOOLS`.
- `sink.py`: `ActionSink` and a module-level `sink = ActionSink()`.
- `callbacks.py`: `guard_tool` (before) and `log_tool` (after).
- `models.py`: `keyed_model(name: str) -> BaseLlm`. ADK's `Gemini` class has no API-key field (`google/adk/models/google_llm.py`, from about line 99), and it builds its client from environment variables. Do not put the key into `os.environ`. `keyed_model` returns a subclass of `Gemini` whose client override (`api_client`, about line 439 in the installed version) builds `google.genai.Client(api_key=settings.gemini_api_key.get_secret_value(), http_options=...)` with `settings.gemini_api_version`. Check the override point in the installed version before you write it. G02 and G04 use this function; neither writes its own.
- `fake.py`: `FakeLlm` and `keyword_script`. Used by tests only.

### The five tools (`tools.py`)

Names are the same as today: `navigate_to`, `explain_section`, `control_playback`, `set_date`, `get_screen_context`.

```python
def navigate_to(page: Literal["home", "learn", "listen", "compare", "about"], tool_context: ToolContext) -> dict: ...
```

- The `Literal` lists are written out statically. A test checks they equal `PAGE_IDS` (`knowledge.py`) and `PLAYBACK_COMMANDS` (`tools.py`), so a new page fails a test until the list is updated.
- Each function:
  1. reads the session state (`tool_context.state`, a plain dict with `page`, `language`, `screens`; see Steps);
  2. builds `SessionState(page=..., language=..., screens=...)` from `app.assistant.tools`;
  3. calls `run_tool(name, args, session_state)` and returns `result.response`;
  4. if `result.client_action` is set, calls `sink.put(tool_context.session.id, result.client_action)`;
  5. for `navigate`, writes the new page to `tool_context.state["page"]`, as the bridge does (`server/app/api/assistant.py:115-118`).
- `get_screen_context` takes no page argument and returns `run_tool`'s response.
- Every value kept in session state is a plain `str`, `bool`, `list` or `dict`, so the session stays serialisable.

### The action sink (`sink.py`)

```python
class ActionSink:
    """Checked client actions waiting for one browser session. Keyed by the ADK session id.
    It is not kept in session state, because session state must stay serialisable."""
    def open(self, session_id: str) -> None: ...
    def put(self, session_id: str, action: dict) -> bool: ...   # False if closed or full; never raises
    def drain(self, session_id: str) -> list[dict]: ...         # everything queued, oldest first; never blocks
    def close(self, session_id: str) -> None: ...
```

- One `asyncio.Queue(maxsize=16)` per session; `put` uses `put_nowait`, `drain` uses `get_nowait` in a loop.
- A full queue drops the new action and logs a warning that names the action kind only, never user text.
- `drain` on an unknown session returns `[]`.

### Callbacks (`callbacks.py`)

`guard_tool(tool, args, tool_context) -> dict | None` (before_tool_callback). Return `None` to let the tool run:

- The tool name is not one of the five: `{"error": "Unknown tool."}`.
- `control_playback` or `set_date`, and the state page is not `"listen"`: `{"error": "The player is on the Listen page. Use navigate_to to take the user there first."}`.
- `set_date`, and `state["screens"]["facts"]["knownDates"]` exists as a list: the date must be in it, else `{"error": "That date is not in this data set."}`. When the key is missing, skip the check (G06 adds the `facts` context).
- `navigate_to`, the state page is `"compare"`, `state["screens"]["compare"]["testInProgress"]` is true, and the target is not `"compare"`: `{"error": "The listening test is in progress. Finish it before leaving the page."}`. A missing key counts as false.

`log_tool(tool, args, tool_context, tool_response) -> None` (after_tool_callback). When an action was produced, log its kind (`navigate` or `player`) at INFO. Never log arguments or user text. Return `None` so the response is unchanged. The browser builds its "Echo did" list from the action messages (V01); this callback is for the server's log only.

### Fake model (`fake.py`)

- `class FakeLlm(BaseLlm)`: fields `model: str = "fake"`, `script: Callable[[LlmRequest], object]`, `delay: float = 0.0`, `calls: list = Field(default_factory=list)`.
- `generate_content_async` appends the request to `calls`, waits `delay` seconds, then yields one `LlmResponse` built from the script's output:
  - `str`: a text part;
  - `dict`: JSON text;
  - `FunctionCallSpec(name, args)` (a small dataclass defined here): a `types.Part(function_call=types.FunctionCall(...))`;
  - `Exception`: raised.
- `keyword_script(rules)` as in the prototype: regex rules, first hit wins.
- A test helper `tool_then_text(spec, text)` returns a script that makes the function call on its first call and the text on the next. ADK calls the model again after a tool response.

## Touches

- `server/requirements.txt`
- `server/app/config.py` (team leader's file: post on the board first, see Design)
- `server/.env.example`
- `server/app/agent/__init__.py`, `tools.py`, `sink.py`, `callbacks.py`, `models.py`, `fake.py` (new)
- `server/tests/test_agent_core.py` (new)

Nothing else. In particular, do not import `app.agent` from `app/main.py`, `app/api/` or `app/assistant/`.

## Steps

1. Check the installed API before writing code: `FunctionTool`, `ToolContext`, `LlmAgent`, `InMemoryRunner`, `BaseLlm`, `LlmResponse`, and how a function's schema is read (`FunctionTool(fn)` and its declaration). Use the wheel's source, not memory. Note any name that differs in **Result**.
2. Pin, create the venv, run `pip check`.
3. Add the settings and `.env.example` lines.
4. Write `sink.py`, then `callbacks.py`, then `tools.py`, then `fake.py`.
5. Write `server/tests/test_agent_core.py` (below).
6. Run the checks. Run them once with `GEMINI_API_KEY` and `GOOGLE_API_KEY` unset, to prove the tests need no key.

## Tests

Server tests with pytest, in `server/tests/test_agent_core.py`. No key, no network.

1. **Parity with `run_tool`.** A table of valid and invalid inputs (unknown page, bad command, `"2024-02-30"`, `""`, `None`, a number). For each, the ADK function's return value and the sink's action equal what `run_tool` returns.
2. **Enums.** The `Literal` lists equal `PAGE_IDS` and `PLAYBACK_COMMANDS`. The schema ADK generates for `navigate_to` and `control_playback` lists the same values as enums.
3. **Sink.** Put then drain keeps order; two sessions do not see each other's actions; `put` on a closed session returns `False`; a full queue drops the new action and returns `False`; `drain` on an unknown session returns `[]`.
4. **Callbacks.** Playback refused off Listen and allowed on Listen; `set_date` refused for a date not in `knownDates` and allowed for one in it; `set_date` allowed when there is no `facts` key; navigation refused during a test and allowed otherwise; an unknown tool refused; `log_tool` returns `None`.
5. **Runner round trip** with `FakeLlm`: the model calls `control_playback(command="pause")` on page `listen`. After the run, the sink holds `{"action": "player", "command": "pause"}` for that session id, and the final text comes back.
6. **Settings.** Defaults: `agent_enabled` false, `assistant_engine` `"bridge"`, `agent_timeout_seconds` 2.5. Each variable name appears in `.env.example`.
6a. **Keyed model.** `keyed_model("gemini-2.5-flash")` builds with no network call, and its client uses the key from settings. Check it through the client object's attributes, never by printing the key. With an empty key, `keyed_model` still builds, and a test checks that no call is made.
7. **No route.** In a subprocess, importing `app.main` loads no module whose name starts with `app.agent`.

The bridge tests in `server/tests/test_assistant.py` must pass unchanged.

## Guardrails

Not applicable: no sound, and nothing is shown to the user. Model output is still untrusted: only the five allow-listed tools can produce actions, and each action passes `run_tool`.

## Done when

- `requirements.txt` pins `google-adk==2.13.0` and `google-genai==2.34.0`; `pip check` is clean; the bridge tests pass on 2.34.0.
- `server/app/agent/` has the four modules above; nothing imports it at startup.
- The five tools are ADK function tools with `Literal` enums equal to `PAGE_IDS` and `PLAYBACK_COMMANDS`, and each one calls `run_tool`.
- The sink, the two callbacks and the fake model work as described, and each has a test.
- The settings are in `config.py` and `.env.example`, with the defaults above.
- `pytest` passes with no key in the environment.

## Checks

```bash
(cd server && .venv/bin/pip check)
(cd server && .venv/bin/python -m pytest)
env -u GEMINI_API_KEY -u GOOGLE_API_KEY bash -c 'cd server && .venv/bin/python -m pytest'
```

No front-end file changes, so the `npm` checks do not apply.

## Out of scope

- Any route, including the Ask endpoint (G02).
- The voice path on ADK (G04) and removing the bridge (G05).
- The evaluation and the drafter (G07).
- Any front-end change.

## Result

**Done** (agent B, Windows 11, Python 3.13.7). Steps 1, 2, 4 and 5 were done on 10 Nov and merged in PR #4. Step 3 and test 6 were done on 11 Nov, after the team leader approved `R-20261110-G01-1` as written ("yes, as written"). The five settings are in `server/app/config.py` with the defaults above, and each is in `server/.env.example`, commented out. Test 6 checks the defaults (with `_env_file=None`, so a local `.env` cannot change them), checks that `ASSISTANT_ENGINE` accepts only `bridge` or `adk`, and checks that every variable name is in `.env.example`.

**Dependencies**

- `google-genai`: 3.0.0 before, 2.34.0 after. `google-adk`: 2.13.0. FastAPI stayed at 0.162.2 (already above ADK's `>=0.133`); pip added `python-multipart` 0.0.33.
- Fresh venv, `pip install -r requirements.txt`, then `pip check`: `No broken requirements found.`
- The bridge tests (`test_assistant.py`) and the study API tests pass on 2.34.0 unchanged.

**API checked in the installed wheel (step 1), and what differs from the ticket**

- `ToolContext` is an alias of `google.adk.agents.context.Context` (`google/adk/tools/tool_context.py:27`). `before_tool_callback` and `after_tool_callback` have the signatures the ticket gives (`google/adk/agents/llm_agent.py`).
- `FunctionTool(fn)` builds the schema from the signature: `Literal[...]` becomes `enum`, and `tool_context` is left out of what the model sees (checked by a test).
- **`keyed_model` does not subclass `Gemini`.** In 2.13.0, `Gemini.api_client` is a per-event-loop cached property, and its docstring warns that overriding it pins one client to the model and breaks on a second event loop. 2.13.0 has a `client_kwargs` field that it applies to both the request client and the Live client (`google/adk/models/google_llm.py`, `api_client` and `_live_api_client`). `keyed_model` passes `api_key` (from settings) and `http_options.api_version` (from `settings.gemini_api_version`) there. Nothing is put in `os.environ`, and no client is built until the model is first called.
- `FakeLlm.script` takes the `LlmRequest`, as the ticket says, so `keyword_script` matches its rules against the newest user text in the request (`last_user_text`) instead of a question string. `calls` uses `Field(default_factory=list)`; a test checks two instances do not share it.

**Model id.** A model list with a real key (no billed call) shows `gemini-2.5-flash` and `gemini-3.8-live` as available, 10 Nov 2026. The `[unverified]` note on `agent_model` can go once G07 makes a real call.

**Checks, 11 Nov** (pytest is run with `--basetemp` in a writable folder, because this machine denies pytest its default temp folder; that is not a code problem). `google-genai` 2.34.0, FastAPI 0.162.2.

```
$ .venv/Scripts/python -m pip check
No broken requirements found.

$ .venv/Scripts/python -m pytest -q
135 passed in 10.23s

$ env -u GEMINI_API_KEY -u GOOGLE_API_KEY .venv/Scripts/python -m pytest -q
135 passed in 10.24s
```

`tests/test_agent_core.py` alone: 53 passed. There is no `.env` in this worktree, so no key was present in either run.

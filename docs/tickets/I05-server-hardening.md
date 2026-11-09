# I05 Server hardening and missing server tests

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | server-assistant |
| **Branch** | `fix/I05-server-hardening` |

## Goal

The voice guide and the study API answer bad input with a clean error and never with an unhandled exception. The main server paths have tests. The settings and the docs match the code.

## Why

Checked on `main` on 9 Nov:

- `server/app/api/assistant.py:173`: `start.get("language")` runs on whatever JSON the browser sent first. A JSON list or a number has no `.get`, so the handler raises `AttributeError` after the socket is accepted, and the client gets no error code. Also, a dict or list as `language` or `page` is unhashable, and `in LANGUAGE_NAMES` / `in PAGES` raises `TypeError`.
- `server/app/api/assistant.py:156`: `if origin and origin not in ...`. A connection with no `Origin` header skips the check. Browsers always send `Origin` on a WebSocket, so a missing one means a non-browser client.
- `server/app/api/assistant.py:5` to `:13`: the module docstring describes an older protocol. It must match the protocol in use (`docs/adk-spike.md` and the message list in `docs/PLAN.md` §5.4).
- Tests that do not exist (`server/tests/test_assistant.py` has none of these):
  - busy: the `_active >= settings.assistant_max_sessions` branch at `assistant.py:164`;
  - time limit: the `if not done:` branch at `assistant.py:193`;
  - upstream failure: the `except Exception` branch at `assistant.py:202`;
  - oversized audio frames: `MAX_AUDIO_FRAME_BYTES`, `assistant.py:89`;
  - a non-object start message (see above);
  - the health route `/api/v1/health` (`server/app/main.py:22`).
- `server/app/study/api.py:53` to `:54`: `create_test` has no cap on the number of sessions. `assistant_max_sessions` caps the voice guide only. `server/app/config.py:37` to `:38` shows the pattern.
- `server/app/config.py:40`: the comment points at `src/features/test`, which does not exist. The test page is `src/features/compare/TestMode.tsx`.
- `server/requirements.txt:5`: `google-genai` is not pinned. The other lines are minimum versions.

## Reuse

- `server/tests/test_assistant.py`: the existing tests monkeypatch `connect_live` and build a fake session (`fake_session`). Use the same approach.
- `server/tests/test_study.py`: the existing client fixture.
- `server/app/config.py`: the `Field(default=..., gt=0)` pattern, and `server/.env.example` for the comment on each new setting.

## Touches

- `server/app/api/assistant.py`, `server/app/assistant/*`.
- `server/app/study/api.py`, `server/app/study/db.py`.
- `server/app/config.py`, `server/.env.example`, `server/requirements.txt`.
- `server/tests/test_assistant.py`, `server/tests/test_study.py`.

## Steps

1. Read `server/app/config.py` and find how `cors_origin_list` is set. Decide the Origin rule from that: in production (where `cors_origins` is set to the Vercel URL), a WebSocket without `Origin` is refused with code 1008. In development and tests, where the origin list is the local default, keep the current behaviour. Write the rule in the docstring.
2. Validate the start message. After `receive_json`, if the value is not a `dict`, close with `bad_start`, as the timeout branch does. Check that `language` and `page` are `str` before the `in` test. Anything else becomes `"en"` or `"home"`, as now.
3. Update the docstring at `assistant.py:5` to match the protocol.
4. Add `study_max_sessions: int = Field(default=..., gt=0)` to `config.py`, with a comment in `.env.example`. In `create_test`, refuse with HTTP 503 and a plain message when the count reaches the cap. Count the rows in the database (`db.py`) and do not hold a counter in memory.
5. Fix the comment at `config.py:40` to name `src/features/compare/TestMode.tsx`.
6. Pin `google-genai`: run `server/.venv/bin/pip show google-genai`, and write that version as `google-genai==<version>`.
7. Add the tests below.
8. Run `(cd server && .venv/bin/python -m pytest)`.

## Tests

In `server/tests/test_assistant.py` (use `fake_session` and monkeypatch `connect_live`):

- a second session while the cap is full gets `busy` and the socket closes;
- a session longer than `assistant_max_session_seconds` (set to a fraction of a second with monkeypatch) ends with `reason: time_limit` (the `if not done:` branch at `assistant.py:193`);
- an upstream exception gives the `upstream` error and no traceback in the message;
- a binary frame over `MAX_AUDIO_FRAME_BYTES` is dropped, and the session continues;
- a JSON list or number as the first message gives `bad_start`;
- a `language` or `page` that is a list or dict falls back to the defaults and does not raise;
- a missing `Origin` is refused in production settings and allowed in development settings;
- `GET /api/v1/health` returns `status: ok` and a boolean `voice_guide`.

In `server/tests/test_study.py`:

- a `POST` beyond `study_max_sessions` returns 503 and stores nothing.

## Guardrails

Not applicable: no sound or visual change. The server sends only allow-listed actions, and this ticket does not change that.

## Done when

- The pytest run passes, with the new tests. Paste its real output in the Result.
- Each new setting is in `server/.env.example` with a comment, and `config.py` has the same name.
- A bad first message closes the socket with a clean error, never with an exception in the log.
- `requirements.txt` pins `google-genai`.

## Checks

```bash
(cd server && .venv/bin/python -m pytest)
npm run lint && npm test && npm run build
```

## Out of scope

- The voice guide's protocol changes (G04 and G05).
- The ADK port (G01 to G05).
- Rate-limiting per visitor. The session cap is enough for now.

## Result

Not started.

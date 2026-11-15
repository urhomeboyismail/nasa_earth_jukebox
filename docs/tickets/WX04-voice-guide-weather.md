# WX04 The voice guide can tell the weather

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S |
| **Who** | agent |
| **Needs** | WX01 (its Meteomatics client) |
| **Hotspots** | — (on purpose: see Design) |
| **Branch** | `feature/WX04-voice-guide-weather` |

## Goal

Ask Echo, the voice guide, "what's the weather in Port Louis?" and it fetches the next hours of air temperature from Meteomatics. It then says the lowest, the highest and the current value, as numbers the server measured, not numbers the model made up.

## Why

- WX01 gave weather to the Jukebox route only (`server/app/agent/planetary.py` `fetch_weather`). The voice guide has five tools and none fetches data (`server/app/agent/tools.py` `AGENT_TOOLS`). Asked about the weather, it says it cannot get it.
- The voice instruction forbids it anyway: "Never invent temperatures" and "Only talk about this app" (`server/app/assistant/knowledge.py`, `system_instruction`). A weather tool needs a line that allows its numbers.

## Design

- **ADK path only.** The bridge's tools are in the `server-assistant` hotspot (`server/app/assistant/tools.py`), which G05 holds, and G05 deletes the bridge.
  - The ADK agent takes its tools from `server/app/agent/tools.py` and its instruction from `server/app/agent/voice.py`, and neither is in a hotspot.
  - Until G05 merges, the server needs `ASSISTANT_ENGINE=adk` in `.env` for the voice guide to have weather. After G05, ADK is the only path.
- **New tool** `get_weather(latitude, longitude, hours=24)` in `app/agent/tools.py`, starting at the current hour:
  - It reuses WX01's client (`weather.checked_args`, `weather.configured`, `weather.hourly_temperature`).
  - It returns `{"summary", "unit", "hourly": [[time, value], ...]}`. The `summary` comes from the new `weather.summary(points)`: "Air temperature for the next 24 hours: now 25 °C, lowest 23.2 °C at 03:00 UTC, highest 31.6 °C at 08:00 UTC."
  - Errors are short and tell the model not to retry ("not set up", "did not answer").
  - At most `MAX_WEATHER_CALLS` (3) per voice session, kept in the session state, because Meteomatics is billed and the session has no account.
- **The instruction**: `WEATHER_INSTRUCTION` in `app/agent/tools.py` is appended to the ADK agent's instruction in `voice.py`. It names the tool, says to read out its summary, and makes the tool's numbers the only weather numbers Echo may say.
- `guard_tool` already lets every name in `TOOL_NAMES` through, so it needs no change. `log_tool` logs only the action kinds, so nothing about the place asked about is logged.

## Reuse

WX01's `app/agent/weather.py`; `_context` in `server/tests/test_agent_core.py` for a fake tool context; `httpx.MockTransport` as in `server/tests/test_weather.py`.

## Touches

`server/app/agent/weather.py`, `server/app/agent/tools.py`, `server/app/agent/voice.py`, `server/tests/test_weather.py`, `server/tests/test_agent_core.py` (the tool-name set), `server/.env.example` (a comment on `ASSISTANT_ENGINE`), this file, `docs/TICKETS.md` (this row).

## Steps

1. Add `weather.summary` with tests.
2. Add `get_weather` and `WEATHER_INSTRUCTION`; append the instruction in `voice.py`.
3. Tests: a good fetch gives the summary and the hourly list; bad arguments, no login, Meteomatics down and the per-session cap are all errors for the model, with no fetch made. The tool-name set gains `get_weather`.
4. Live check (👤): with `ASSISTANT_ENGINE=adk` and a Meteomatics login, ask the voice guide for the weather.

## Tests

`server/tests/test_weather.py`, with a fake tool context and no network.

## Guardrails

- Every number Echo says about the weather comes from the tool (ADR-0005 in spirit: the model reads out, it does not invent).
- The login and the place asked about are never logged. Only an HTTP status is logged.
- Billed calls are capped for each session.

## Done when

- With the ADK engine and a login, the voice guide answers a weather question with the fetched lowest and highest.
- Without a login, it says weather is not set up.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- Playing the weather as sound from the voice guide, and showing the numbers on the main app's pages. The Jukebox page does both (WX01, WX02).
- The bridge path (deleted by G05).

## Result

Built by agent A on 2026-11-14, on top of the local WX01 and WX02 commits, without touching the `server-assistant` hotspot.

- `get_weather` is in `app/agent/tools.py`. The model sees only `latitude`, `longitude` and an optional `hours`.
- It is capped at 3 calls a session, and logs only an HTTP status.
- `weather.summary` builds the sentence Echo reads out.
- `WEATHER_INSTRUCTION` is appended after the voice rules in `app/agent/voice.py`.
- `.env.example` says only `adk` can fetch the weather.

Checks:

```
(cd server && .venv/bin/python -m pytest)   405 passed, 2 skipped, 14 warnings in 13.78s  (9 new WX04 tests in tests/test_weather.py)
npm run lint                                exit 0
npm test                                    Test Files 2 failed | 220 passed (222); Tests 48 failed | 3129 passed (3177)
npx vitest run Explorer.test.tsx player.test.tsx    Test Files 2 passed (2); Tests 193 passed (193)
npm run build                               ✓ built in 1.35s
```

The 48 `npm test` failures are all in `Explorer.test.tsx` and `player.test.tsx`, the same load-related flake seen on WX02. This ticket changes no file under `src/`, and both files pass on their own. The dev server was running at the same time.

Still to do (👤): the live check in the voice guide, with `ASSISTANT_ENGINE=adk`.

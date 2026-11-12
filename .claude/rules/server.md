# Server (FastAPI, `server/`)

Adapted from ECC `rules/python` (coding-style, fastapi, security, testing).

- The server does three jobs only: the voice guide (a Gemini Live bridge), the listening-test API, and the Jukebox orchestrator (`POST /api/v1/jukebox/generate`, a LangGraph of four ADK agents; G08). Everything else runs in the browser, and the app works without the server.
- The Jukebox is off unless `JUKEBOX_ENABLED=true`. Every run is billed, so keep its caps: the graph's step limit (`RECURSION_LIMIT`), `jukebox_runs_per_minute` and `jukebox_timeout_seconds`. Its vision agent may write alt text a user reads; that is the one exception to ADR-0005.
- Settings come from `server/app/config.py` (pydantic `BaseSettings`), read from the environment. Never commit `.env` or a key. Add every new setting to `server/.env.example` with a comment.
- Live audio is billed by the minute and there are no accounts, so keep sessions capped (`assistant_max_session_seconds`, `assistant_max_sessions`).
- Treat anything a model says as untrusted. Only allow-listed actions (navigate to a known page, a known player command) may reach the app.
- Use type hints, Pydantic models for request and response bodies, and async handlers that don't block.
- Tests: `.venv/bin/python -m pytest` in `server/`. The page list there must match `src/pages.ts`.

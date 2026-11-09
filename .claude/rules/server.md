# Server (FastAPI, `server/`)

Adapted from ECC `rules/python` (coding-style, fastapi, security, testing).

- The server does two jobs only: the voice guide (a Gemini Live bridge) and the listening-test API. Everything else runs in the browser, and the app works without the server.
- Settings come from `server/app/config.py` (pydantic `BaseSettings`), read from the environment. Never commit `.env` or a key. Add every new setting to `server/.env.example` with a comment.
- Live audio is billed by the minute and there are no accounts, so keep sessions capped (`assistant_max_session_seconds`, `assistant_max_sessions`).
- Treat anything a model says as untrusted. Only allow-listed actions (navigate to a known page, a known player command) may reach the app.
- Use type hints, Pydantic models for request and response bodies, and async handlers that don't block.
- Tests: `.venv/bin/python -m pytest` in `server/`. The page list there must match `src/pages.ts`.

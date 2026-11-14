# WX01 Echo fetches the weather (Meteomatics)

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/WX01-echo-fetches-weather` |

## Goal

Ask Echo "what is the weather in Port Louis today?" and its live-data route fetches hourly air temperature for that place from the Meteomatics API. Echo answers with a reply built from the numbers and a sound the Jukebox already plays.

## Why

- Echo's live data (`POST /api/v1/mascot/query`, `server/app/api/mascot.py:72`) can only fetch Planetary Computer sea surface temperature and cloud cover (`server/app/agent/planetary.py:114` `COLLECTIONS`). Weather is the most common thing a listener asks about.
- The rest of the path already exists. The model only picks tool arguments (`planetary.py:183`). The reply is a template filled from the numbers (`answer_for`, `planetary.py:237`), and `build_audio` (`planetary.py:218`) turns any normalised series into an `AudioPayload`. The Jukebox shows the reply and plays the payload (`src/features/jukebox/JukeboxStudio.tsx:240-243`). So one more tool gives fetch, words and sound with no front-end change.

## Design

- **New module `server/app/agent/weather.py`**: the Meteomatics client and nothing else (no ADK).
  - `GET https://api.meteomatics.com/<start>--<end>:PT1H/t_2m:C/<lat>,<lon>/json`, with HTTP Basic auth from `METEOMATICS_USERNAME` and `METEOMATICS_PASSWORD`.
  - `checked_args(latitude, longitude, start, hours)` returns either `(lat, lon, start_utc, hours)` or `{"error": ...}` for the model. Rules: numbers only, inside the globe, `start` ISO 8601 (a time with no zone is read as UTC, rounded down to the hour), and 1 ≤ hours ≤ `MAX_HOURS` (168, a week).
  - `parse(body)` validates the JSON with Pydantic (`data[0].coordinates[0].dates[]`), drops Meteomatics' `-999` "no value", and returns `[(datetime, float)]`.
  - `hourly_temperature(...)` is async over httpx, with a 15 s timeout. It raises on any non-200.
- **Settings**: `meteomatics_username: str = ""` and `meteomatics_password: SecretStr`, added to `server/.env.example` and to `render.yaml` as `sync: false`. With no credentials, the tool tells the model it is not set up, and Echo says so.
- **In `planetary.py`**:
  - A third tool, `fetch_weather(latitude, longitude, start, hours)`, puts `series_of("meteomatics-t_2m", points)` into the same `SERIES_KEY`, so `answer_for` and `build_audio` work unchanged.
  - `answer_for` reads labels from `SOURCES` (`COLLECTIONS` plus the weather entry), so the model still cannot ask Planetary Computer for "meteomatics".
  - `_when` gives "14 November 2026 at 14:00 UTC" for an hourly time.
  - The instruction tells the model when to use the tool and gives it the current UTC hour.
  - Two new replies: "weather is not set up" and "the weather service did not answer". They are never model text (ADR-0005).

## Reuse

`series_of`, `normalized`, `build_audio`, `answer_for`, `SERIES_KEY` in `planetary.py`; the route's caps (`mascot_enabled`, rate limits, timeout) in `mascot.py`; `FakeLlm` / `tool_then_text` / `FunctionCallSpec` in `app/agent/fake.py`; the `client` fixture pattern in `server/tests/test_mascot.py`.

## Touches

`server/app/agent/weather.py` (new), `server/app/agent/planetary.py`, `server/app/config.py`, `server/.env.example`, `render.yaml`, `server/tests/test_weather.py` (new), `docs/tickets/WX01-*.md`, `docs/TICKETS.md` (this row).

## Steps

1. Add the settings and the env example lines.
2. Write `weather.py` (args check, URL, parse, fetch) with its tests, using `httpx.MockTransport` (no network).
3. Add `fetch_weather` to the finder, `SOURCES`, `_when` and the two replies, and update the instruction.
4. Route test: a `FakeLlm` call to `fetch_weather` gives a reply and a payload; no credentials and a 401 both give a reply, not a 5xx.
5. Manual live check: `.venv/bin/python -m app.agent.weather` with real credentials (👤, needs a Meteomatics account).

## Tests

`server/tests/test_weather.py`: bad arguments are errors for the model; the URL, with the auth header sent; parsing, including `-999`; the route with the tool on, with no credentials, and with Meteomatics down.

## Guardrails

- The credentials are never logged or sent to the browser. Only the status code is logged on failure.
- The model chooses only numbers and a time. Everything shown is built from the fetched values.
- The route keeps its caps (`MASCOT_ENABLED`, per-minute limits, timeout). The Meteomatics call has its own 15 s timeout.

## Done when

- With credentials set, "the weather in Port Louis today" gives a reply with the lowest and highest temperature and a playable payload.
- Without credentials, Echo says weather is not set up, and every other Echo answer is unchanged.
- The server tests pass.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- Showing the numbers as a table (WX02) and a multi-voice weather sound (WX03).
- Place-name geocoding on the server: the model gives the coordinates, as it gives the bbox for Planetary Computer.
- The POST form for bulk queries (one point and one parameter stay far under 1,000 characters).
- The Sentinel-2 image-to-WAV pipeline in the notes: Echo already fetches Sentinel-2 cloud cover, and the app's own analysis already sonifies images in the browser.

## Result

Built by agent A on 2026-11-14 from `origin/main` (`fc6e8eb`).

- New `server/app/agent/weather.py`, the Meteomatics client: argument checks, the URL, the JSON checked with Pydantic, `-999` dropped, and Basic auth.
- `planetary.py`:
  - a `fetch_weather` tool, and `SOURCES` for the reply's labels (weather is not a Planetary Computer collection);
  - `_when` for hours, plus the "not set up" and "did not answer" replies;
  - the instruction now gives the current UTC hour.
- Settings `METEOMATICS_USERNAME` and `METEOMATICS_PASSWORD` are in `config.py`, `.env.example` and `render.yaml` (`sync: false`).
- The front end is unchanged: the Jukebox already shows the reply and plays the payload.

Checks:

```
(cd server && .venv/bin/python -m pytest)   396 passed, 2 skipped, 14 warnings in 9.92s  (17 of them new in tests/test_weather.py)
npm run lint                                exit 0; only the existing warnings in src/features/compare/Fusion.tsx
npm test                                    Test Files 221 passed (221), Tests 3171 passed (3171)
npm run build                               ✓ built in 1.16s
```

Still to do (👤): the live check `.venv/bin/python -m app.agent.weather` with a real Meteomatics login. The URL's `<start>--<end>:PT1H` form is from Meteomatics' documentation and has not been run against the live API yet.

# G11 Echo fetches live Planetary Computer data

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/G11-planetary-computer-echo` |

## Goal

Someone types a question about Earth data in Jukebox Studio, for example "sea surface temperature around Mauritius in January 2026" or "Sentinel-2 cloud cover over Madagascar in October 2026", and presses **Fetch live data (Planetary Computer)**. The server fetches the series from Microsoft Planetary Computer and answers with a short reply, a theme and an `AudioPayload`. Echo reacts on the page: searching, then happy, then playing, or the alert face on a failure. The reply is announced, and the existing `JukeboxPlayer` plays the series.

## Why

- The Jukebox orchestrator's numeric tool is a mock that hashes the place and the day into made-up numbers (`server/app/agent/orchestrator.py:190`). No route fetches real data.
- `JukeboxPlayer` (`src/features/jukebox/JukeboxPlayer.tsx`) already plays any checked `AudioPayload` (`src/features/jukebox/payload.ts:22`).
- Echo's expressions `happy | searching | eq_active | alert` exist (`src/components/mascotTypes.ts:4`), and `Ixia` takes `expression`, `pose` and `say` (`src/features/mascot/Ixia.tsx:26`).

## Design

**Server: `POST /api/v1/mascot/query`** (`server/app/api/mascot.py`, `server/app/agent/planetary.py`)

- **Request:** `{user_prompt: str (1–300), audio_preference: "gentle"|"normal"|"bold" = "normal", catalog: [{id, title, summary}] (≤ 40)}`.
- **Response:** `{mascot_reply, dataset_theme: "ocean"|"atmosphere"|"forest"|"default", sonification_json: AudioPayload | null, local_dataset_id: str | null}`.
- **Guards**, the same as `api/jukebox.py`:
  - the route is off (503) unless `MASCOT_ENABLED=true` and a Gemini key is set;
  - the origin check;
  - a body cap;
  - a rate limit for the whole server and for each visitor;
  - a time limit (a timeout gives 504, any other failure gives 502).
  Errors log only the class name, never the prompt.
- **The agent.** One ADK `LlmAgent` with two tools. The model only chooses tool arguments:
  - `search_local_datasets(dataset_id)` picks from the catalog the browser sent. Render deploys with `rootDir: server`, so the server can't read `public/data/index.json` itself.
  - `fetch_planetary_computer_data(collection, bbox, datetime_range, metric_name)`. The collection must be on an allow-list:
    - `sentinel-2-l2a` → `eo:cloud_cover`, read from item properties. Theme `atmosphere`.
    - the SST collection → the mean over the bbox from the data API's statistics endpoint. Theme `ocean`.

    The tool checks its arguments first: a bbox inside the globe and no bigger than 10°×10°, dates as `YYYY-MM-DD/YYYY-MM-DD` and at most a year apart. It normalises the values to 0..1 and writes the series into session state.
- **`mascot_reply`** is a template filled from the fetched numbers. It is never model text (ADR-0005).
- **`sonification_json`** is built from the series with no model call. Volume is `0.15 + 0.85·n`, so no step is a rest. `audio_preference` sets `pitch_range`. The result is checked against `orchestrator.AudioPayload`.
- **No items** is a 200 answer with `sonification_json: null`.
- **Settings:** `mascot_enabled`, `mascot_model`, `mascot_runs_per_minute`, `mascot_runs_per_minute_per_visitor`, `mascot_timeout_seconds`, and `pc_sdk_subscription_key` (optional; Planetary Computer works without it at lower rate limits).

**Browser: Jukebox Studio**

- `src/features/jukebox/mascotQuery.ts`, written like `generate.ts`: it never throws, it checks the answer with zod, and it keeps `local_dataset_id` only if it is one of the ids it sent.
- `JukeboxStudio.tsx` gets:
  - a second submit button and a gentle/normal/bold choice;
  - Echo (`Ixia`, loaded with `lazy`), with its accent set from `dataset_theme` through design tokens;
  - the reply, announced once;
  - `JukeboxPlayer` for the payload;
  - a link to a local data set when one was picked.

## Reuse

- `api/jukebox.py` and `api/agent.py`: the route guards and the lazy service.
- `agent/ask.py`: `AskService`, a session for each request.
- `agent/models.keyed_model`.
- `orchestrator.AudioPayload`.
- `generate.ts`: the error kinds.
- `payload.ts`: `audioPayloadSchema`.
- `JukeboxPlayer`, `Ixia`, `useAnnounce`.
- `src/data` `loadCatalog`.

## Touches

`server/requirements.txt`, `server/app/config.py`, `server/.env.example`, `server/app/main.py`, `server/app/agent/planetary.py` (new), `server/app/api/mascot.py` (new), `server/tests/test_mascot.py` (new), `src/features/jukebox/mascotQuery.ts` (new) and its test, `src/features/jukebox/JukeboxStudio.tsx` and its test, `src/features/jukebox/jukebox.css`, `docs/PRE-HACKATHON-WORK.md`.

## Tests

- **Server, with no network:**
  - the argument checks;
  - `build_audio`;
  - each case of the reply template;
  - the route: 503, 413, 422, 200 with a payload, 200 with no items, 504.
- **Browser:**
  - `mascotQuery` answers and error kinds;
  - the Studio fetch flow, with `Ixia` stubbed, plus `expectNoA11yViolations`.

## Done when

- The checks pass.
- With a key and `MASCOT_ENABLED=true`, a real question plays a real series in `/jukebox.html`.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- ERA5 (Zarr, which needs xarray) and NASADEM (no time series).
- Echo in the main app's dock.
- A text box in the dock's bubble.
- Signed asset preview URLs.
- Local search with no model call.

## Result

Branch `feature/G11-planetary-computer-echo` (agent A, 14 Nov 2026).

- The SST collection is **OISST** (`noaa-cdr-sea-surface-temperature-optimum-interpolation`), not WHOI: OISST's `sst` asset is a COG that the data API's `item/statistics` reads (checked live; raw values are scaled by `raster:bands[0].scale`, 0.01 °C). OISST on Planetary Computer has gaps: no items for January 2025 or January 2026, while June and October 2026 have them. A request for January gets the "found no days" reply.
- `metric_name` was dropped from the tool: each collection has one metric. Catalog entries may carry `summary`, but the agent reads only the id and the title.
- Live check with no model (`.venv/bin/python -m app.agent.planetary`): 30 days of SST around Mauritius in June 2026, 25.39 to 26.21 °C; 14 days of Sentinel-2 over Madagascar in October 2026, cloud cover 2.71% to 83.63%.
- Not run: the whole route with a real Gemini key (the model choosing the bbox and dates). Do it before a demo: `MASCOT_ENABLED=true`, then ask in `/jukebox.html`.

```
$ npm run lint            # exit 0; warnings only, in src/features/compare/Fusion.tsx (not this ticket)
$ npx vitest run --maxWorkers=2
 Test Files  221 passed (221)
      Tests  3200 passed (3200)
$ npm run build           # ✓ built (tsc -b clean)
$ (cd server && .venv/bin/ruff check . && .venv/bin/python -m pytest -q)
All checks passed!
376 passed, 2 skipped
```

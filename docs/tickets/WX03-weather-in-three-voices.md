# WX03 Weather in three voices: temperature, rain and wind

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S |
| **Who** | agent |
| **Needs** | WX01 |
| **Hotspots** | — |
| **Branch** | `feature/WX03-weather-in-three-voices` |

## Goal

Echo's weather sounds like weather. Temperature is the melody, rain is a low pulse, and wind is a pad that swells. The reply says which voice is which.

## Why

- WX01 fetches only `t_2m:C`, and `build_audio` (`server/app/agent/planetary.py:218`) makes one marimba track. So a rainy windy day and a calm one sound the same if the temperature matches.
- The player already has three voices, picked from the instrument name (`timbreOf`, `src/features/jukebox/payload.ts:117`: "bass" gives bass, "pad" gives pad, anything else gives lead), and plays several tracks at once. So this is a server change only.

## Design

- `weather.py` asks for `t_2m:C,precip_1h:mm,wind_speed_10m:ms` in the one GET and returns three aligned series. An hour with any value missing is dropped from all three.
- `build_weather_audio(series, preference)` makes three tracks at `base_bpm` 100:
  - **lead "marimba"**: the temperature curve (as WX01);
  - **bass "rain bass"**: precipitation. The volume is 0 when dry and rises with mm (cap at 10 mm/h = 1.0). A 0 is a rest in the player, which is right for a dry hour;
  - **pad "wind pad"**: wind speed, 0.1 to 1.0 from calm to 20 m/s.
- Fixed scales (not min to max), so a calm day sounds calm. The thresholds are named constants with a one-line why.
- The reply adds one sentence built from the numbers: "The melody is temperature, the low pulse is rain (wettest at 15:00 UTC, 2.4 mm), the pad is wind (strongest 9 m/s)." For a dry hour or calm wind it says so.

## Reuse

`AudioPayload` / `AudioTrack` (`app/agent/orchestrator.py:106`), `PITCH_RANGES`, `series_of`, and `answer_for` in `planetary.py`; the WX01 client and tests.

## Touches

`server/app/agent/weather.py`, `server/app/agent/planetary.py`, `server/tests/test_weather.py`.

## Steps

1. Ask for three parameters and parse them aligned, with tests.
2. Add `build_weather_audio` and use it for weather series, with tests: a dry hour is a rest, the scales are fixed, and the output passes `AudioPayload`.
3. Add the reply's voice sentence, with tests for wet and dry, windy and calm.

## Tests

`server/tests/test_weather.py`, with `httpx.MockTransport` and `FakeLlm`. No network.

## Guardrails

- The same numbers always give the same payload (no randomness).
- The player keeps its peak at or below −1 dBFS with three tracks. Check one loud day in the Jukebox (👤 listens once).
- Every voice is named in the reply (a text equivalent for each sound).

## Done when

- A wet, windy forecast plays three voices, and the reply names each one with its peak.
- A dry, calm day plays the melody with a quiet pad and no rain pulse.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- New browser instruments or samples. Wind direction (no clear sound mapping yet).

## Result

Filled in by the agent.

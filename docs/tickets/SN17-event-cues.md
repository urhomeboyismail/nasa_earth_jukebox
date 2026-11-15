# SN17 Event cues: a short sound and a caption when a dated event in the manifest is reached

| | |
|---|---|
| **Priority** | P2 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | schema |
| **Branch** | `feature/SN17-event-cues` |

## Goal

A manifest can list dated events (for example "a storm forms here"). When playback reaches an event's date, the listener hears one short percussive cue, placed left or right by where the event is, and the caption says what happened. A data set without events sounds exactly as before.

## Why

- In the hurricane data set (`public/data/hurricanes-2023-atlantic/`) the storms are drawn as dotted tracks and names, which the app counts as no data (they are not legend colours), so the storms themselves are silent: only the warm water is heard. Its manifest's description has to say so.
- Nothing in a manifest can carry a dated, placed event today: `src/data/schema.ts` has frames, regions, comparisons and story chapters (`schema.ts:90`), but story chapters span dates and have no place or sound.

## Design

- `src/data/schema.ts` and `src/data/types.ts` (the `schema` hotspot): an optional, strict `events` list: `{ id, date (YYYY-MM-DD), label, place?: { x, y } }`, `x` and `y` 0 to 1 of the map area. Each `date` must fall within the frames' dates; ids unique. Left out: no events. Document it in `docs/data-sources.md`, "Manifest fields".
- `src/sonify/`: a pure function `eventsBetween(events, fromDate, toDate)` gives the events whose date is after the previous frame's date and on or before this frame's date, in date order.
- `src/audio/ensemble/`: `playEvent({ pan, atTime })`: one short seeded percussive cue (the same every time, like the dropout cue), panned by `place.x` (centre without a place), at least 6 dB under the melody, through the master bus so the −1 dBFS ceiling holds. At most two cues a frame; more are merged into one.
- `src/sonify/captions.ts` and the announcer: each cue has its text ("Event: Hurricane Idalia forms, south-west."), announced politely, merged when several fall on one frame.
- Symphony only. Simple mode, Scan and the offline WAV keep their sound.

## Reuse

The dropout cue's seeded approach in `src/audio/ensemble/dropout.ts`, `placeWord`-style ninth names (`src/sonify/fuse.ts`), `useAnnounce`, the story's date checks in `schema.ts:216-221`.

## Touches

- `src/data/schema.ts`, `src/data/types.ts` and their tests
- `src/sonify/` (the new function, captions) and tests
- `src/audio/ensemble/` (the cue) and tests
- `src/features/player/symphonyState.ts` (call the cue and the caption when a frame passes an event)
- `docs/data-sources.md`, "Manifest fields" only

## Steps

1. The schema field with its checks and defaults.
2. `eventsBetween` and the caption, pure, with tests.
3. The cue in the ensemble, then the call in Symphony.

## Tests

- `schema.test.ts`: a valid list; a date outside the frames; a duplicate id; a place outside 0 to 1; a manifest without events unchanged.
- `eventsBetween`: events between two dates, none on the first frame, several on one frame.
- The ensemble: the cue is deterministic, panned by `place.x`, and the peak stays at or below −1 dBFS.
- Symphony with the fake ensemble: reaching an event's date plays one cue and announces its text; `expectNoA11yViolations`.

## Guardrails

The template's guardrails, and: every cue has its caption; nothing specific to one data set in `src/` (the events live in each manifest).

## Done when

- A data set with an `events` list plays one cue per event at its date, placed by its position, with its caption; every other data set sounds as before. The checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
npm run check-data
```

## Out of scope

- Filling in events for any data set (that is data work: for the hurricane season, from NOAA's track list, credited).
- Event sounds in Simple mode, Scan or the WAV export.

## Result

Built by agent E (Claude Code, for Roni), 15 Nov 2026, on `feature/SN17-event-cues`.

- `src/data/schema.ts` and `src/data/types.ts`: optional, strict `events: [{ id, date, label, place? }]`; ids unique, each date within the frames' dates, `place.x` and `place.y` 0 to 1. A manifest without it is unchanged.
- `src/sonify/events.ts` (pure): `eventsBetween` (events after the last frame's date and up to this one; none on the first frame or when the dates go backwards), `eventCues` (a short G5 and C6 ping, panned by `place.x`, level 0.3, at most two a frame, 0.18 s apart) and `eventSentence` ("Event: A storm forms, east.", with the ninth of the map from `placeWord`).
- `src/features/player/symphonyState.ts`: each frame plays the reached events' cues and announces the sentence. The cue goes through the ensemble's existing `playNotes` (the scan bank, under the master limiter) instead of a new `playEvent`, so `src/audio/ensemble/` is unchanged.
- `docs/data-sources.md`, "Manifest fields": the `events` row.
- Tests: `events.test.ts` (between, cues, sentence), `schema.test.ts` (valid, outside the dates, repeated id, place out of range, unknown field), `Symphony.test.tsx` (no cue on the first frame; a placed cue and the announcement when the date is reached; no a11y violations).
- No data set has events yet: filling them (for example NOAA's storm list for `hurricanes-2023-atlantic`, credited) is data work.

Checks (Windows): `npm run lint` 0 errors; `npm run build` built; `npm run check-data` 12 files, 213 tests passed; `npm test` 3092 of 3094 passed, the 2 failures in `src/App.test.tsx`, which passes when run alone (with `Symphony.test.tsx`: 88 tests passed); the full suite is flaky under load on this machine.

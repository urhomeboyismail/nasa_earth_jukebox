# IX09 Echo points with a sound beacon

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | IX01, G06 |
| **Hotspots** | server-assistant, app, voice, player |
| **Branch** | `feature/IX09-echo-points` |


## Goal

Echo, the voice guide, can point at a place with a sound beacon instead of describing it. The app can do the same without the server: pressing `E` points at the next hot spot in the frame, from a scripted order, offline.

## Why

- The voice guide can only navigate and control playback (`server/app/assistant/tools.py`: `navigate_to`, `control_playback`, `set_date`, `get_screen_context`). There is no way to point at a place.
- The browser's allow-list (`src/hooks/useVoiceAssistant.ts`, `toAssistantAction`) accepts only the navigate and player actions. The server rule is that only allow-listed actions reach the app (`.claude/rules/server.md`).
- Nothing on the map makes a sound that says "here". A beacon is a sound that pins a place in space, which speech cannot do.

## Design

**Server (`server/app/assistant/tools.py`, `knowledge.py`).**
- A new tool `point_to` with one argument, `target` (a string). The model is told the valid targets in the instruction: the ids of the hot spots in the context the browser sent (G06's context schema), plus the compass places `north-west`, `north`, `north-east`, `west`, `centre`, `east`, `south-west`, `south`, `south-east`.
- `run_tool` checks `target` against the context in `SessionState.screens` (G06). An unknown target returns `{ "error": ... }` with the valid list, and no client action.
- A valid target returns `ToolResult({ "ok": True, "target": target }, { "action": "point", "target": target })`.
- `knowledge.py`: one line in the guide's instructions: "When the listener asks where something is, call point_to, then ask one short question about that place."

**Browser allow-list (`src/hooks/useVoiceAssistant.ts`, `toAssistantAction`).** Accepts `{ action: "point", target }` only when `target` is one of the current frame's hot-spot ids (from the player's context) or one of the compass places. Anything else is dropped, as the other actions are. `App.tsx` forwards an accepted point to `dispatch({ type: 'point', target })`.

**The action (IX01 union).** This ticket adds one member: `{ type: 'point'; target: string }`. It also adds the `E` entry to the shortcut list (`match` gives `{ type: 'point', target: <next offline target> }`).

**Resolving a target (pure, `src/features/point/targets.ts`).**
- A hot-spot id gives that spot's cell in the current frame: its `centroid` (an image fraction in SN01's `hotspots`) through `cellOfFraction` (IX01 `notes.ts`).
- A compass place gives the grid cell at the matching third of the map (`centre` is the middle).
- Unknown ids give `null`, and nothing plays.

**The beacon (`src/features/point/beacon.ts`).** The cursor moves silently to the cell (`moveTo` with speech off). Then three `playNotes` calls, 300 ms apart, of the place's note (`noteForPosition`, IX01 `notes.ts`), each panned with `panForPoint(col)` and raised or lowered with `elevationForPoint(row)` (3D mode only, as today). The first ping sounds at once (immediate voice, within the budget).

**Offline (`E`).** Without the server, `E` points at the next target in a scripted order: the hot spots of the frame by size, largest first, then `centre`. It wraps. The order is computed from the frame's features, so it works for any data set.

**Words.** For a voice point, the guide speaks (through the server, as today). For `E`, a short visible line: "Pointing at the largest warm area, north-east." The words come from SN10's hot-spot sentence when it exists; otherwise from the compass name.

## Reuse

- `src/audio/pan.ts` (`panForPoint`, `elevationForPoint`).
- IX01: `useActionHandler`, the shortcut list, `dispatch`, `ANSWER_BUDGET_MS`.
- `src/assistant/context.ts` (`useAssistantContext`, `publishContext`): the player already publishes its state.
- **Gap to close before coding.** G06's explore context (`server/app/assistant/context_schemas.py`, `ExploreContext`) carries the cell, not the hot spots. This ticket needs a `hotspots` list of `{ id, place }` in the context. Ask G06's owner on `docs/AGENT-BOARD.md` to add it (preferred), or add it here only with Mohammad's agreement, since both files are his. Until then, set `blocked: needs hotspots in the explore context`.
- `server/app/assistant/tools.py` (`run_tool`, `ToolResult`, `SessionState`) and the tests in `server/tests/test_assistant.py`.

## Touches

- `server/app/assistant/tools.py`, `knowledge.py`, `server/tests/test_assistant.py`.
- `src/hooks/useVoiceAssistant.ts` and its test: the allow-list.
- `src/App.tsx`: forward the point to `dispatch` (one line).
- `src/features/point/targets.ts`, `beacon.ts`, `useEcho.ts` and their tests (new).
- `src/features/player/index.tsx`: publish the hot-spot ids through the context (G06's schema). `player.test.tsx`.
- `src/interaction/actions.ts` and `shortcuts.ts`: one member and one entry each (IX01's files; this is the only change to them).

## Steps

1. Write `targets.ts` and its tests (pure).
2. Write `beacon.ts`: three `playNotes` calls with the pan and elevation, 300 ms apart.
3. Add the `point` action and the `E` entry to IX01's files. Register `useActionHandler('point', ...)`.
4. Server first: `point_to` in `tools.py` with the target check; the instruction line in `knowledge.py`; the pytest cases.
5. Browser allow-list in `toAssistantAction`, with its test; forward in `App.tsx`.
6. Check the server tests and the browser tests against the same target list.

## Tests

- Server (`cd server && .venv/bin/python -m pytest`): `point_to` with a known hot-spot id from the context returns the `point` client action; an unknown id returns an error and no action; a compass place is accepted with no context hot spots; the arguments are checked for type (a number is an error); the action is not sent when the session is not on Listen (if the other tools have this rule, copy it).
- `targets.test.ts`: a hot-spot id resolves to its centroid; each compass place resolves to the right third; an unknown id gives `null`.
- `beacon.test.ts` (fake engine): three pings, 300 ms apart; the first is immediate; the cursor moves with no speech.
- `useVoiceAssistant.test.ts`: an accepted point reaches `dispatch`; an unknown target is dropped.
- `E` (`Explorer.test.tsx`): the offline order visits the largest hot spot first, then `centre`, then wraps.
- `expectNoA11yViolations` on the visible line.

## Guardrails

- The same frame and the same target give the same pings and the same cursor place.
- Peak at or below −1 dBFS; no sound before a key press. A voice point is only heard after the listener has spoken or pressed the voice button.
- Nothing flashes.
- Every beacon has its text: the visible line, and the guide's own words when the point is by voice.
- The model cannot change data: `point_to` only reads the context and returns an allow-listed action.
- No data-set name in `src/` or in `knowledge.py`.

The five principles, for this ticket:
1. The first ping sounds within the budget.
2. Sound first: the beacon points; the guide's question comes after, and is rate-limited by the server as it is now (`ANNOUNCE_GAP_SECONDS`).
3. The listener can stop the guide (Escape stops speech) and can ignore the beacon.
4. Voice and `E` produce the same action through the same dispatcher.
5. Learn by doing: the beacon teaches the pan and the height by hearing them.

## Done when

- `E` points offline at the largest hot spot, then the centre, with three pings each time, on the SN02 set and the fixture.
- A voice point is accepted only for a listed target and reaches the same beacon.
- The server tests and the browser tests pass; the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- A scripted offline question (questions come from the voice guide only).
- Pointing at any pixel, or at a place in another data set.
- Changes to the voice protocol, the model or the Gemini bridge (G04, G05).
- **Voice points at a hot spot**, waiting on board R-20261113-IX09-1 (to G06). Both checks already read a `hotspots` list of `{ id }` from the explore context: the server in `point_targets` (`server/app/assistant/tools.py`), the browser in `pointTargets` (`src/hooks/useVoiceAssistant.ts`). G06's `ExploreContext` has no such field and forbids extra keys, so today the list is always empty and only the nine compass places pass. To finish: add the field to the two context schemas, and publish `echo.hotspots` (the ids `useEcho` resolves against, so the two always agree) from the screen G06's owner picks. `useEcho` already returns them.
- **The ADK agent** (`server/app/agent/tools.py`) has its own fixed list of five tools and no `point_to`, so on the ADK path the guide cannot point. `system_instruction` leaves the point_to line out when `page_label` is given (the ADK path) so that agent is not told about a tool it lacks. G05 (ADK by default) should add a `point_to` wrapper there and drop that default.

## Result

Done 2026-11-13, agent D, branch `feature/IX09-echo-points`. Voice points at a hot spot wait on the board (Out of scope); everything else in "Done when" is in.

**What it does**
- `E` on the sound map points at the date's hot spots by size, largest first, then the centre, and wraps (`offlineOrder`, `nextOffline`). The cursor moves in silence (`moveTo(…, 'follow')`, as IX03), three pings play 300 ms apart (the first at once, the other two on timers that Escape cancels), each panned by `panForPoint(x)` and raised by `elevationForPoint(y)`, at the spot's note (`noteForPosition(peakPosition)`) or, for a compass place, the cell's value. A line says where: "Pointing at the largest warm area, north-east." with the data set's own band word (SN10's `bandWord`) and compass name (`sectorOf`). `E` announces it once.
- The voice guide's `point_to(target)` (bridge path) checks the target against what the browser reported plus the nine compass places, only on Listen, and returns `{ action: "point", target }`. The browser checks it again and `App.tsx` dispatches the same `point` action as `E`. A voice point is not announced, because the guide says it.
- A sound map that is off says "Turn on the sound map to hear where that is."; a locked place says to press L first; an unknown target does nothing.
- The frame's hot spots are read once per date while the sound map is on, so `E` answers at once.

**Files outside Touches**, each needed for the above:
- `src/hooks/voiceMessages.ts`: the server-message schema stripped `target`, so a point never reached the allow-list. One field added.
- `src/features/point/places.ts` (new): the nine compass places on their own, so the allow-list (in the entry chunk) imports nothing else.
- `src/App.test.tsx`: one case, a point from the guide reaches `dispatch`.
- `src/features/player/index.tsx` is in Touches but in the `player` hotspot, which the queue row did not list; I added `player` to the row on main (`1e7ed83`).

**Design choices**
- The `point` action's `target` is optional: `E` sends none (a key's `match` cannot know the next target), and the hook picks the next place in the offline order. The voice guide always names one.
- No `player.test.tsx` change: the player now only mounts `useEcho` and shows its line, and publishing the hot spots waits on the board.

**Checks**

On this laptop the suite runs with `--pool=forks --maxWorkers=1` for memory. Main currently has `src/features/compare/Fusion.tsx` and `fusion.ts` side by side (UI/UX blueprint, `1e53f2b`). Windows cannot tell them apart, so `import './Fusion'` loads `fusion.ts` here: the type check, `vite build` and `Fusion.test.tsx` fail on this laptop and pass on Linux. IX09 changes nothing under `src/features/compare/` or `src/sonify/`. The bundle below was built with that one import pointed at `./Fusion.tsx` for the build only, then restored with git. Also on main: `src/sonify/fuse.ts` has two `as VoiceId[]` casts that I11's lint rule rejects (I11 and the blueprint were merged at the same time), so `npm run lint` fails there on main too. Both are left for their owner (they are not IX09's files).

```
$ npm run lint
src/sonify/fuse.ts:31:20: error typescript(consistent-type-assertions): Do not use any type assertions. …
src/sonify/fuse.ts:39:23: error typescript(consistent-type-assertions): Do not use any type assertions. …
(nothing else: 0 problems in any other file)

$ npx tsc -b
the only errors are the Fusion/fusion casing above (TS2305, TS1149, TS1261); 0 others

$ npm test   (npx vitest run --pool=forks --maxWorkers=1)
 Test Files  1 failed | 197 passed (198)
      Tests  4 failed | 2893 passed (2897)
 FAIL  src/features/compare/Fusion.test.tsx (4 tests): Element type is invalid … got: undefined  (the casing issue above)

$ npx vite build   (with the Fusion import pointed at ./Fusion.tsx, then reverted)
dist/assets/index-BYZJX6zd.js             253.21 kB │ gzip: 81.28 kB
✓ built in 768ms

$ npm run check-bundle
index-BYZJX6zd.js: 80409 bytes gzip (78.5 KB), within the budget of 84362 bytes (82.4 KB).

$ cd server && .venv/Scripts/ruff.exe check app tests
All checks passed!

$ cd server && .venv/Scripts/python.exe -m pytest -q
344 passed, 2 skipped in 13.49s
```

New tests: `targets.test.ts` (9), `beacon.test.ts` (3), `useEcho.test.tsx` (14, on SN02's motion set and the fixture), 20 new cases in `useVoiceAssistant.test.ts` (9 compass places, a reported id, 9 dropped targets, and the whole hook), 1 in `App.test.tsx`, and 23 new server cases (`point_to` with a reported id, an unknown id, every compass place with no context, an id with none reported, four wrong argument types, four pages that are not Listen, the action over the socket, the instruction line on the bridge and not on ADK, and the compass list against `src/features/point/places.ts`).

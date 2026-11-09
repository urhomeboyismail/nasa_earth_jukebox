# IX09 Echo points with a sound beacon

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | IX01, G06 |
| **Hotspots** | server-assistant, app, voice |
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

## Result

Not started.

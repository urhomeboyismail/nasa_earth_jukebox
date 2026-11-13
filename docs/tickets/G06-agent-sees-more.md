# G06 The agent sees facts, the explorer and the music; context schemas and drift test

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | G04, SN03 |
| **Hotspots** | server-assistant, player, compare, ask |
| **Branch** | `feature/G06-agent-sees-more` |

## Goal

The voice guide can see three more things on the screen: the **facts** the Ask panel uses for the current data set, the **sound map** (the explorer: the cell under the cursor, whether it is locked, the sound style), and, after SN03, a short **music** summary. Every context payload is checked by a Pydantic schema on the server. The server refuses a `set_date` for a date the data set does not have. A test keeps the browser's context keys and the server's list in step.

**Note on Needs.** The music part needs SN03 (the `MusicFrame` caption), which is still open. The queue lists no Needs for this ticket. Part A (facts, explorer, schemas, drift test) does not need SN03, so it can merge alone. Part B (music) is only built once SN03 is `done`; until then leave it out and say so in **Result**. Ask the queue owner to add SN03 to Needs for part B.

## Why

- The guide sees only two keys today: `player` and `compare` (`src/assistant/context.ts:7`, `server/app/api/assistant.py:34`). The Ask panel's facts are in the browser only (`src/features/ask/facts.ts`), so the guide cannot answer "what was the warmest day?" from its context. The instruction says it may use facts from `get_screen_context` only (`server/app/assistant/knowledge.py`, "Only use facts about the data").
- The guide cannot say what the listener has put under the cursor. The explorer's state (`src/features/explore/useExplorer.ts`: the cursor, `locked`, the style) is not published.
- `set_date` checks the date's shape and that it is a real date (`server/app/assistant/tools.py`, `_is_real_date`), but not that the data set has it. The browser's guard for dates is `knownDates` in the Ask path (`mentionsUnknownTime`).
- The TypeScript `ContextKey` and the server's `CONTEXT_KEYS` are typed by hand. Nothing fails when they drift. The pages list has such a test (`server/tests/test_assistant.py`, `test_pages_match_frontend`); the context keys need the same.
- The server accepts any object for a context and stores it (`assistant.py:update_context`, size cap only).

## Design

### Payloads and schemas (`server/app/assistant/context_schemas.py`, new)

All models use `model_config = ConfigDict(extra="forbid")`. Invalid payloads are dropped and logged at DEBUG with the key only.

```python
class PlayerContext(BaseModel):
    visualization: str = Field(max_length=80)
    date: str = Field(max_length=40)
    region: str = Field(max_length=80)
    category: str = Field(max_length=40)
    playing: bool
    changeStep: str | None = Field(default=None, max_length=40)

class CompareContext(BaseModel):
    frameA: str = Field(max_length=40)
    frameB: str = Field(max_length=40)
    answered: bool
    revealed: bool
    testInProgress: bool = False        # new: see the browser side

class FactModel(BaseModel):
    id: str = Field(max_length=20)
    kind: Literal["data", "text"]
    text: str = Field(max_length=400)

class FactsContext(BaseModel):
    knownDates: list[str] = Field(max_length=400)    # each matches YYYY-MM-DD
    facts: list[FactModel] = Field(max_length=10)

class CellContext(BaseModel):
    col: int = Field(ge=0, le=1000)
    row: int = Field(ge=0, le=1000)
    value: float | None = None
    category: str = Field(max_length=40)

class ExploreContext(BaseModel):
    on: bool
    locked: bool
    style: Literal["full", "simple", "change"]
    cell: CellContext | None = None

CONTEXT_SCHEMAS: dict[str, type[BaseModel]] = {
    "player": PlayerContext, "compare": CompareContext, "facts": FactsContext, "explore": ExploreContext,
}
```

- Part B, only once SN03 is `done`: a `MusicContext` with `preset: str (max 40)`, `caption: str (max 300)` and `voices: list[str]` (at most 7 names), added as `"music"`.
- `CONTEXT_KEYS` in `server/app/agent/limits.py` (G04) becomes `frozenset(CONTEXT_SCHEMAS)`.
- `update_context` (G04's `voice.py`) validates with `CONTEXT_SCHEMAS[key].model_validate(data)` and stores `model_dump(exclude_none=True)`. The 24 KiB size cap stays before validation.

### Server behaviour

- `get_screen_context` returns the validated payloads as stored. The `facts` payload is included as it is. Update the tool's docstring (it is the tool description the model reads) to say it includes the facts and the sound map.
- `set_date` (`server/app/assistant/tools.py`, `run_tool`): after the format and calendar checks, if `state.screens["facts"]["knownDates"]` is a list and the date is not in it, return `{"error": "That date is not in this data set."}` with no action. G01's callback does the same check; both stay (defence in depth).
- The instruction text (`knowledge.py`) gets one line: facts and the sound map come from `get_screen_context`, and the facts are the only source of numbers about the data.

### Browser side

- `src/assistant/context.ts`: `ContextKey = "player" | "compare" | "facts" | "explore"`. Add "music" only in part B.
- `src/features/ask/AskPanel.tsx`: publish `facts` with `useAssistantContext('facts', { knownDates: dates, facts: facts.map(({ id, kind, text }) => ({ id, kind, text })) })`. It is cleared on unmount, as the hook already does.
- The component that calls `useExplorer` publishes `explore`: `{ on, locked, style, cell }`, where `cell` is `{ col, row, value, category }` for the cell under the cursor, or `null`. Use `grep -rn "useExplorer(" src` to find it (`src/features/player/index.tsx` is the likely place). Do not publish the grid or any list of values.
- `src/features/compare/index.tsx`: add `testInProgress` to the existing `compare` publish. It is `true` from the start of the listening test (`?test=1`, `TestMode.tsx`) until its results are shown.
- The publishers do not change behaviour: nothing is sent unless a voice conversation is open (existing rule in `context.ts`).

### Hotspots and touches

The queue lists only `server-assistant` for this ticket. The browser side needs three more places: `src/features/player/index.tsx` (the `player` hotspot), `src/features/compare/index.tsx` (`compare`), and `src/features/ask/AskPanel.tsx` (no hotspot). Before you claim, ask the queue owner to add `player` and `compare` to this row. If that is not possible, do the server side and the drift test only, and post the browser side as a request on the board.

## Reuse

- G04's `voice.py` (`update_context`), `limits.py` (`CONTEXT_KEYS`).
- `src/assistant/context.ts` (`useAssistantContext`, `publishContext`, `currentContext`).
- `server/app/assistant/tools.py` (`run_tool`, `_is_real_date`, `_ISO_DATE`).
- `src/features/ask/facts.ts` (`buildFacts`), `src/features/compare` (`TestMode.tsx`).
- `server/tests/test_assistant.py`'s `test_pages_match_frontend` for the drift test's pattern (a regex over the TypeScript source).

## Touches

- `server/app/assistant/context_schemas.py` (new)
- `server/app/agent/limits.py`, `voice.py` (G04's files: the key list and the validation only)
- `server/app/assistant/tools.py` (`run_tool` check; `get_screen_context` docstring)
- `server/app/assistant/knowledge.py` (one instruction line)
- `server/tests/test_context_schemas.py` (new), `server/tests/test_context_drift.py` (new)
- `src/assistant/context.ts`
- `src/features/ask/AskPanel.tsx`, `src/features/ask/AskPanel.test.tsx` or `ask.test.tsx` (new cases)
- `src/features/player/index.tsx` and `src/features/compare/index.tsx` (only the publish lines; see Hotspots)

## Steps

1. Confirm the hotspot question above and the state of SN03.
2. Write `context_schemas.py` and its tests. Make the `CONTEXT_KEYS` change and the validation in `voice.py`.
3. Add the `set_date` check and the instruction line. Test them.
4. Write the drift test: read `src/assistant/context.ts`, take the members of `ContextKey` with a regex, and compare them with `CONTEXT_SCHEMAS` and `CONTEXT_KEYS`.
5. Browser: publish `facts`, `explore`, and `testInProgress`.
6. Part B, only if SN03 is `done`: add `music`, on both sides, with the same drift test.

## Tests

Server (pytest):
1. A valid `player`, `compare`, `facts` and `explore` payload each validates. An extra key, a missing key, a wrong type, a date like `2024-7-1` in `knownDates`, a 401-character fact text, more than 10 facts, and a cell with `col` of 1001 each fail.
2. `update_context` stores only validated payloads, and an invalid one leaves the old value in place.
3. `get_screen_context` returns the facts payload and the explorer payload exactly as stored, and no key that was not sent.
4. `set_date` to a date not in `knownDates` returns an error and no action. A date in it returns the action. With no `facts` key, `set_date` behaves as before.
5. Drift: `ContextKey` in `src/assistant/context.ts` has exactly the keys of `CONTEXT_SCHEMAS` and `CONTEXT_KEYS`. Adding a key to one side fails the test.

Browser (Vitest):
6. Rendering the AskPanel on the fixture publishes `facts` with `knownDates` equal to the fixture's dates and fact ids equal to `buildFacts`' ids. `currentContext()` returns it.
7. The explorer publish has `cell: null` before the cursor moves, and its keys are exactly `on`, `locked`, `style`, `cell`.
8. The compare publish has `testInProgress` `true` while the listening test runs and `false` otherwise.
9. No publish happens unless a listener is subscribed (`subscribeContext`), as before.

## Guardrails

Not applicable to sound. Do not publish the grid, the image, or any list of values beyond the facts. The explorer publish must not change how the explorer sounds or what it announces.

## Done when

- Each context key the browser publishes has a schema, and the server drops anything that does not match it.
- `set_date` refuses a date the data set does not have.
- The drift test fails if the two lists of keys differ.
- The browser publishes `facts`, `explore` and `testInProgress` as described, and nothing else changes for the listener.
- Part B (music) is either done, or left out with a line in **Result** saying why.

## Checks

```bash
npm run lint && npm test && npm run build
(cd server && .venv/bin/python -m pytest)
```

## Out of scope

- The music summary before SN03 is done (part B).
- Changing what the guide says about the facts. The Ask panel's wording stays as it is.
- Any new tool. The five tools and `get_screen_context` are the whole set.

## Result

Built on `feature/G06-agent-sees-more` (part A). Part B (music) is left out; see "Differences from the ticket".

**What changed**
- `server/app/assistant/context_schemas.py` (new): strict Pydantic models (`extra="forbid"`, no type coercion) for `player`, `compare` (with `testInProgress`), `facts` and `explore`; `CONTEXT_SCHEMAS`; `validate_context`.
- `CONTEXT_KEYS` is now `frozenset(CONTEXT_SCHEMAS)`. Both bridges (`server/app/agent/voice.py`, `server/app/api/assistant.py`) store only a validated payload; an invalid one leaves the old value and is logged at DEBUG with the key only.
- `run_tool("set_date")` refuses a date missing from `facts.knownDates` (`"That date is not in this data set."`, no action). Without a `facts` payload it behaves as before.
- `get_screen_context` description and one instruction line in `knowledge.py` now mention the facts and the sound map.
- Browser: `ContextKey` gains `"facts"`. `AskPanel` publishes `facts` (`knownDates` and `{id, kind, text}`; text cut to 400 characters to fit the schema). `Compare` publishes `testInProgress: false`. `TestMode` publishes `compare` with `testInProgress: true` from the first screen until the thank-you, with empty frames (no dates, no answers).
- Tests: `server/tests/test_context_schemas.py`, `test_context_drift.py` (new); two existing server tests now send a valid `player` payload; browser tests added in `ask.test.tsx`, `test-mode.test.tsx`; `compare.test.tsx` and `player.test.tsx` adjusted for the new keys.

**Differences from the ticket**
- **`explore` already exists (JB07).** `useExplorer.ts` publishes `explore` as `{ exploring, value, position, here }`, which the mascot reads (`MascotDock`). The server dropped it, because `CONTEXT_KEYS` had only `player` and `compare`. The ticket's `{ on, locked, style, cell }` would break Echo, and `useExplorer.ts` is outside Touches (hotspot `explorer`). So `ExploreContext` describes the shape the browser already sends, and the guide now receives it. `locked`, `style` and `cell` are not published; posted as R-20261113-G06-1 on the board. Ticket test 7 (exact keys `on, locked, style, cell`) is therefore not written.
- **Part B (music) is not built.** SN03 is done, but nothing in the player builds a `MusicFrame` for the screen, so there is nothing to publish from the places this ticket may touch.
- **Listening test.** `testInProgress` is published from `TestMode.tsx` (same hotspot as `compare/index.tsx`, because the test renders instead of `Compare`).

**Checks** (run in `../nasa-c`)
```
npm run lint            0 warnings, 0 errors
npm test                Test Files 161 passed (161); Tests 2532 passed (2532)
npm run build           built in 1.43s
server: pytest -q       321 passed, 2 skipped
```
One earlier full run showed 4 failures under load; the one caused by this change (`player.test.tsx` expected the player's clear to be the last update, but the Ask panel's `facts` clear now comes after it) is fixed, and the rerun was clean.

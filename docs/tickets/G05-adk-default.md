# G05 ADK by default; retire the old bridge

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | H02 |
| **Hotspots** | server-assistant |
| **Branch** | `feature/G05-adk-default` |

## Goal

The voice guide runs on Google ADK and nothing else. The google-genai bridge, its tools and its switch are deleted. The documents that describe the server (`docs/PLAN.md`, `AGENTS.md`, the README's AI disclosure) say so.

**Do not start until H02 has recorded a pass** in `docs/adk-spike.md`. If H02 failed, set this ticket to `blocked` and stop.

## Why

- Two voice paths that must stay in step are a maintenance cost, and the bridge can no longer be tested without the same fake session G04 uses.
- The bridge's tool code (`server/app/assistant/tools.py:21-55`, `tools()`) and its connection code (`server/app/api/assistant.py:39-57`, `live_config` and `connect_live`) are replaced by G01 and G04.
- The docs still say the server runs "a Gemini Live bridge ported from FinAssist" (`AGENTS.md`, the Commands section; `docs/PLAN.md` §3 and §4).

**Decision in this ticket:** the `assistant_engine` switch is removed together with the bridge. A switch with one value does nothing. A rollback is a revert of this commit. (The queue says "default adk"; this is that default, with the old path deleted.)

## Design

### Code

- `server/app/config.py`: remove `assistant_engine`. The config file belongs to the team leader, so post the change on `docs/AGENT-BOARD.md` before you claim.
- `server/app/api/assistant.py`: delete `live_config`, `connect_live`, `_Bridge` and `_run_bridge`, and the google-genai imports. The route calls the ADK path (G04's `_run_adk`) only. Keep `_scrub`, `_close` and the shared route parts.
- `server/app/assistant/tools.py`: delete `tools()` and its google-genai imports. Keep `PLAYBACK_COMMANDS`, `SessionState`, `ToolResult`, `run_tool` and the helper functions. `run_tool` is still the single source of checks.
- `server/app/config.py` keeps `gemini_live_model` and `gemini_api_version`. ADK uses them.
- `server/app/assistant/knowledge.py`: nothing to remove. `system_instruction` keeps its `page_label` argument from G04.
- `server/.env.example`: remove the `ASSISTANT_ENGINE` line.

### Tests

- Merge the two voice test files into one: `server/tests/test_assistant.py`. Keep:
  - every `run_tool` unit test (navigation, playback, dates, screen context);
  - the persona and drift tests (`test_the_guide_speaks_as_the_mascot...`, `test_the_persona_name_matches_the_frontend`, `test_pages_match_frontend`, and the new G06 context drift test if it has merged);
  - the browser-message tests from `test_assistant_adk.py` (G04), which now use the ADK seam.
- Delete `server/tests/test_assistant_adk.py` after the merge.
- Replace `test_tool_declarations_build` (it checked the google-genai list) with the G01 test that checks the ADK tools and their enum lists.

### Documents

- `docs/PLAN.md`:
  - §3 "Voice guide" row: say the guide runs on Google ADK `run_live` (G04, G05); drop "already merged: Gemini Live bridge ported from FinAssist".
  - §3 "Agents" row, if it names the bridge: update it.
  - §4 diagram: the voice box reads "Voice guide and Ask agent (Google ADK): `server/app/agent/`, route `server/app/api/`".
  - §5.4: the allowed keys live in `server/app/agent/limits.py` (`CONTEXT_KEYS`), not in `assistant.py`.
  - Leave the rest of the plan alone.
- `AGENTS.md`, Overview and Commands: "A small FastAPI server (`server/`) runs only the voice guide, a Gemini Live bridge ported from FinAssist" → the server runs the voice guide and the Ask agent, both on Google ADK. Also the Deployment table row for the server: say "voice guide, Ask agent and listening-test API".
- `README.md`, the AI disclosure: add a section "How we used AI" that says, in plain words:
  - AI coding assistants helped write the code, and the team checked it.
  - The voice guide and the optional Ask agent run on Google's Gemini, through Google's Agent Development Kit (ADK). The agent chooses fact IDs; the app writes every sentence the user reads from its own facts.
  - Questions and voice are sent to Google while a conversation or an Ask question is open. The app saves none of it.
  - The sounds are made by rules, not by AI.
  The root README is still the Vite template until S03 lands. If S03 is not `done`, add the section under the existing intro and tell S03's owner on the board.

### Not in this ticket

- `src/features/about/index.tsx` (lines 100-101) tells visitors "The voice guide uses Google's Gemini". It should also name the Ask agent and ADK. That file belongs to Roni (`docs/PLAN.md` §4). Post a request on the board; do not edit it here.
- `render.yaml` comments may mention the bridge. Bhavish owns that file. Post on the board if you find a mention.

## Reuse

- G04's `_run_adk`, `connect_adk` and the test fakes. Do not rewrite them.
- G01's `AGENT_TOOLS` and tests.

## Touches

- `server/app/config.py` (remove one setting; post on the board first)
- `server/app/api/assistant.py`
- `server/app/assistant/tools.py`
- `server/.env.example`
- `server/tests/test_assistant.py`, `server/tests/test_assistant_adk.py` (deleted)
- `docs/PLAN.md` (§3, §4, §5.4 only)
- `AGENTS.md` (the Overview and Commands lines and the Deployment row only)
- `README.md` (the AI disclosure section only)

## Steps

1. Confirm H02 is `pass` in `docs/adk-spike.md`. Otherwise set `blocked` and stop.
2. Post the `config.py` change on the board, and wait for the team leader's answer.
3. Delete the bridge code and the switch. Update the imports.
4. Merge the test files. Replace the declaration test.
5. Update the four documents.
6. Search for leftovers and fix them: `grep -rn "connect_live\|_Bridge\|live_config\|assistant_engine\|ASSISTANT_ENGINE\|FinAssist" server src docs/PLAN.md AGENTS.md README.md`. The only allowed hits are in archived docs and the FinAssist credit in `docs/planning/`.

## Tests

- Every test in `server/tests/test_assistant.py` passes after the merge.
- The new declaration test: the five ADK tools, in order, with their enum lists.
- `test_pages_match_frontend` still passes.
- The route refuses a foreign origin, reports `not_configured` with no key, and reports `busy` at the session cap (from G04).
- No test imports `google.genai` types from `app.assistant.tools` (a grep test is enough: `"google.genai" not in tools.py source`).

## Guardrails

Not applicable: no sound, no display change.

## Done when

- The bridge code, the switch and their tests are gone; the leftover grep in Steps 6 has no live hits.
- The server starts with no `ASSISTANT_*` variable set, and the voice guide is the ADK one.
- The four documents say ADK, and the README section is in place (or the S03 note is on the board).
- `pytest` passes with no key, and with a key set (the live path is not run here).

## Checks

```bash
(cd server && .venv/bin/python -m pytest)
env -u GEMINI_API_KEY -u GOOGLE_API_KEY bash -c 'cd server && .venv/bin/python -m pytest'
grep -rn "connect_live\|_Bridge\|live_config\|assistant_engine\|ASSISTANT_ENGINE" server src docs/PLAN.md AGENTS.md README.md
```

The grep should print nothing. The front end is not changed, so the `npm` checks do not apply.

## Out of scope

- Any new voice feature.
- Any change to the browser protocol.
- The About page text (Roni), `render.yaml` (Bhavish), and the Ask agent's front end (G03, already done).

## Result

Not started.

# H02 Live parity check with a billed key

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | 👤 |
| **Needs** | G04 |
| **Hotspots** | — |
| **Branch** | `chore/H02-live-parity-check` |

## Goal

A person runs the four live checks in `docs/adk-spike.md` against the real Gemini Live API, with `ASSISTANT_ENGINE=adk`, and writes the answers into that file. If any check fails, the ADK voice path stops here: G05 does not start, and the bridge stays the default.

## Why

- G04 is tested with fake live sessions only. Nothing so far proves that the real Live API accepts the ADK calls, sends the same tool results, or gives the same transcripts.
- `docs/adk-spike.md` lists the four checks that decide it. The spike was cut on 7 Nov for lack of a key. This check is the one that was missing.
- Live audio is billed by the minute (`server/app/config.py:33-38`), so the run is short and capped.

## What to do

### Before you start

1. G04 is merged (or on a branch you can run). Note the commit in **Result**.
2. Use a key on a billed project. Put it in `server/.env` only, as `GEMINI_API_KEY=`, and never in a chat, a file in git, a screenshot or a board post.
3. Set `ASSISTANT_ENGINE=adk` in `server/.env` for this run. Unset it again afterwards.
4. Start the server: `mkdir -p ~/h02-run && cd server && .venv/bin/uvicorn app.main:app --port 8000 2>&1 | tee ~/h02-run/server.log`. The log stays outside the repository.
5. Check `http://127.0.0.1:8000/api/v1/health`: `"voice_guide": true`.
6. Start the site: `npm run dev`. Open it in Chrome, with the browser's developer tools open on the Network tab, filter WS, so you can read the frames.

### The four checks

Write each result as **pass** or **fail** with the evidence: the frame text, the time and the page.

**C1. Tools reach the browser as before.** Say, one at a time: "Take me to the Listen page"; "Play"; "Pause"; "Go to 15 July 2024" (or the nearest date in the data set). Expected WebSocket text frames:
- `{"type":"action","action":"navigate","page":"listen"}`
- `{"type":"action","action":"player","command":"play"}`
- `{"type":"action","action":"player","command":"pause"}`
- `{"type":"action","action":"player","command":{"setDate":"2024-07-15"}}`

Then run the same four requests once with `ASSISTANT_ENGINE=bridge` and compare the frames. The JSON must match.

**C2. Transcripts and page context.** Ask a question with a spoken sentence. Expect `{"type":"transcript","role":"user",...}` and `{"type":"transcript","role":"assistant",...}` frames, and a `turn_complete`. Then, mid-session, navigate to Compare with the nav bar and ask "what page am I on?". The answer must be Compare, so the page context reached the agent.

**C3. Memory and start-up.** Record the server's resident memory (`ps -o rss= -p <pid>`) at start, after one session, and after the session has been open for 5 minutes with the mic quiet. Measure the import time with `cd server && time .venv/bin/python -c "import app.main"` before and after the ADK install (the numbers are in `docs/adk-spike.md`: +0.5 s and +30 MB were measured with no session). A Render cold start is not measured here unless the branch is deployed.

**C4. The key stays on the server.** `grep -c "<the key>" ~/h02-run/server.log` must print `0`. Also check the browser's frames: the key must not appear in any frame.

### Cost

Record the minutes of live audio used and the cost shown in the billing page. Keep each run under 10 minutes.

## Kill rule

- **Any fail** (C1 to C4): stop. Write the failure in `docs/adk-spike.md` with the frame or the log line, set G05 to `blocked: H02 failed, see docs/adk-spike.md`, and post on `docs/AGENT-BOARD.md`. The bridge stays the default, and G05 is not started.
- Only if all four pass: G05 may start.

## Done when

- `docs/adk-spike.md` has the answers to the four questions, the memory and import numbers, the minutes and cost, and the commit that was tested.
- The kill rule outcome is written in that file, in one line.
- The log is outside the repository, and no file in git contains the key.
- `ASSISTANT_ENGINE` is back to the default in `server/.env` (or removed).

## Checks

```bash
git status --short            # nothing new in git from this run, apart from docs/adk-spike.md
grep -rn "$GEMINI_API_KEY" docs server --include='*.md' --include='*.py' | head   # must print nothing
```

## Guardrails

The guide's speech and the music must not play at the same time (F12): on Listen, check that the player pauses while the guide talks.

## Out of scope

- Changing the code. A bug found here becomes a new ticket or a fix on G04.
- Deploying to Render. That is a separate step after G05.
- Any change to the default engine. That is G05.

## Result

Not started.

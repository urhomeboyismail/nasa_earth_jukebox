# ADK spike (T86, step 1)

**Decision, 7 Nov: T86 is cut.** See `docs/planning/FEATURE-REVIEW.md`. The voice guide stays on the current bridge.

**Result so far: not finished, and not a yes.** The two things that decide it (a live voice session and tool calls) need a
`GEMINI_API_KEY`, which the machine this was run on did not have. Everything that could be measured without one is below.
Per the ticket, the build (steps 2 and 3) has **not** been started.

Run on Python 3.12.3 (Render uses 3.12.7), `google-adk` **2.13.0** with `google-genai` 2.34.0 (the version the server uses
already). Nothing in `server/` was changed.

## Answers

| Question | Answer | Evidence |
|---|---|---|
| A Live voice session through our WebSocket with the same browser protocol | **Unknown** | No API key, so nothing was sent to Gemini. The API has what is needed on paper: `Runner.run_live`, `LiveRequestQueue.send_realtime` (audio and text), `send_audio_stream_end`, and `RunConfig.input_audio_transcription` / `output_audio_transcription`. These are the same pieces `server/app/api/assistant.py` uses on `google-genai` today |
| Tool calls, with results reaching the browser as today | **Unknown, and the risky part** | Today the bridge sees each tool call and forwards player commands to the browser itself (`assistant.py` lines 110 to 119). In ADK the tools run inside the agent, so each of the five tools would have to push its result to the WebSocket from inside the tool function. Possible, but not shown |
| Transcripts and page context | **Unknown** | Transcript options exist (above). Page context is sent today with `send_realtime_input(text=...)`; the equivalent is `send_realtime` or `send_content`, not tried |
| Idle memory | **+30 MB** | See below |
| Cold start | **+0.5 s** | See below |

## Measured (Python 3.12, no API key, one process, resident memory)

| | Memory | Import time |
|---|---|---|
| `import app.main` (the server as it is) | 44 MB | 0.3 s |
| plus `google.adk` (Agent, Runner, LiveRequestQueue, session service) | 73 MB | +0.5 s |
| plus one `Agent` with a tool and a `Runner` | 74 MB | |

Two runs each, same numbers. This is only the import, with no open session, so it is the **floor**. A real session holds an
audio stream and a model connection, which can only be measured with a key. 74 MB is far below Render's 512 MB, so memory is
unlikely to be the reason to say no.

Install size: the environment grew from 118 MB (server requirements) to 160 MB with `google-adk`. The build on Render will
be slower; not timed.

## What is still needed (under a day, by someone with a key)

1. Run the five tools through an ADK `Agent` with `run_live`, speaking a short phrase, and check that "play", "pause" and
   "go to date" reach the browser as the same JSON messages as now.
2. Check that transcripts arrive as the same `{type: "transcript"}` messages and that a page-context update mid-session works.
3. Leave a session open for 5 minutes and read memory. Note the Render cold start with `google-adk` installed.
4. Write the answers here. If any is no, stop.

## Advice

This is "Could, first to be cut". The voice guide works today, judges see the same thing either way, and the one real
unknown (tool results reaching the browser) is a rewrite of the part of the server that already works. If nobody can run the
four checks above in a day, **cut T86** and have the README quote this note: the library fits in memory, and was not proven for
live voice. Do not begin the build on the strength of the numbers here.

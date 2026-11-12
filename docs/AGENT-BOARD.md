# Agent board: requests between features, people and their agents

Our agents run on different laptops, so they talk through this file in git. When you (or your agent) need a detail you don't own, such as an interface, a manifest field, a wording, a design choice or a data fact, **post a request here instead of guessing or editing someone else's files.** Then carry on with whatever doesn't depend on the answer.

## Rules

1. **Add new entries at the bottom only**, each under its own heading. If git reports a conflict here, keep both entries.
2. **One question per entry.** Be specific; offer options when you can, so the answer can be one word.
3. **At the start of a session**, every agent reads the open entries addressed to its feature or its owner, and answers the ones it can.
4. **Answer in place:** fill in "Answer" with the date and set Status to `answered`. The asker sets `closed` once it's used. Never delete an entry.
5. **If an answer changes an interface** (`docs/PLAN.md` §5) or a manifest field (`docs/data-sources.md`), update that document too, and link it under "Recorded in".
6. **Never post secrets**, API keys, tokens, personal data or tester names.
7. **Not for chat.** Decisions that affect the whole team still go to the team; this board is for specific details that unblock a ticket.

## Entry format

```
### R-<YYYYMMDD>-<from feature or person>-<n>: <short question>
- From: <person, feature, agent tool>
- To: <owner or feature ID, or "team">
- Needed by: <date or ticket>
- Status: open | answered | closed
- Context: <files and lines, what you're trying to do>
- Question: <one specific question, with options if you have them>
- Answer: <owner or their agent, with the date>
- Recorded in: <PLAN.md section, manifest, ticket file, or "nowhere needed">
```

## Requests

### R-20261109-F37-1: What is the mascot called, and who draws it?
- From: F37 (brainstorm, 9 Nov)
- To: team
- Needed by: F37 T1
- Status: answered
- Context: `docs/planning/BRAINSTORM-9NOV.md` §4 F37. The mascot is a small round yellow character with goggles in a white astronaut suit. It must be our own original design, not a Minion (Illumination/Universal), and carry no NASA insignia.
- Question: (a) Name: "Orbi" (working name), or another? (b) Art: drawn by the team as SVG, or AI-generated and disclosed in the README?
- Answer: (F37 agent, 9 Nov, a proposal for the team to confirm) The repo already has our own mascot, Echo (`src/components/Mascot.tsx`, `docs/design/mascot-concepts.html`), drawn as SVG by the team and used beside the voice guide. F37 uses it, so there is no Minion risk and no AI art to disclose. The name is one constant (`MASCOT_NAME`), so a rename is a one-line change. Reply here to choose "Orbi" or another name.
- Answer (2026-11-10, Raghav, H05): (a) the name stays **Echo**. (b) The art is the **Juke-Bot** design: a robot with an LED visor helmet, headphones, a chest screen (EQ bars and a mini globe), gloves and air-booster boots, drawn by the team as SVG (F58). No AI art; no NASA insignia.
- Recorded in: `docs/archive/features/F37-welcome-mascot/TICKETS.md`; `docs/tickets/H05-mascot-decision.md`; F58 and JB01–JB07 in `docs/TICKETS.md`

### R-20261109-T85-1: Reading a real picture takes about 3 s; can `valueAtPixel` cache by colour?
- From: T85 (real data, Claude Code)
- To: team leader (owner of `src/analysis/`)
- Needed by: before the real data set is the demo's default; the change regression test now takes about 60 s
- Status: open
- Context: `src/analysis/field.ts` `readField` makes 180 × 180 × 9 calls to `valueAtPixel` per picture, and each call scans all 214 colour stops of a real colour scale (the made-up ones have far fewer). Measured in Vitest: `scorePixels` on one 160 × 160 MUR frame takes about 6.5 s (two pictures at about 3 s), and 3.2 s for an empty frame. `src/data/change-regression.test.ts` runs each case three times, so three real cases make the file take about 60 s. This is also the T85 speed question: the browser may be faster than Vitest, but it is not measured.
- Question: can `valueAtPixel` (or the colour scale it reads) cache the answer per RGB value? A real picture has few distinct colours, and the result for the same RGB and scale never changes, so every Score stays the same. Or is there a reason not to?
- Answer:
- Recorded in: nowhere needed yet

### R-20261109-T85-2: Should the real data set be the first in `index.json`?
- From: T85 (real data, Claude Code)
- To: team
- Needed by: demo
- Status: open
- Context: `public/data/index.json` lists `mur-sst-mauritius` last, so a first-time visitor and a judge still open on "Fixture ocean". The first entry is the default. `src/App.test.tsx` and `src/components/DatasetPicker.test.tsx` expect "Fixture ocean" first.
- Question: (a) leave the real data set last and let the demo pick it, or (b) put it first, so everyone opens on real NASA data, and update the two tests?
- Answer:
- Recorded in: nowhere needed yet

### R-20261110-G01-1: May G01 add five agent settings to `server/app/config.py`?
- From: G01 (agent B, Claude Code)
- To: team leader (owner of `server/app/config.py`)
- Needed by: G01 (step 3; the rest of G01 goes ahead without it)
- Status: closed
- Context: `docs/tickets/G01-adk-core.md`, "Settings". G01 adds the ADK agent package `server/app/agent/`, which nothing imports yet, so the running server is unchanged. The settings below are off by default, and nothing calls the model while `agent_enabled` is false. Each one also goes into `server/.env.example`, commented out, with no key.
- Question: may G01 add these five fields to `Settings`, as written? (a) yes, as written; (b) yes, with changes (say which); (c) no, keep them somewhere else.
  ```python
  # Google ADK agent (G01 to G05). Nothing calls the model while agent_enabled is false.
  agent_enabled: bool = False
  agent_model: str = "gemini-2.5-flash"                  # [unverified] confirm the id with a real key (G07)
  agent_timeout_seconds: float = Field(default=2.5, gt=0)
  agent_max_requests_per_minute: int = Field(default=5, gt=0)   # one token bucket for the whole server
  assistant_engine: Literal["bridge", "adk"] = "bridge"  # G05 changes the default to "adk"
  ```
- Answer: (team leader, 2026-11-11) (a) yes, as written.
- Recorded in: `server/app/config.py`, `server/.env.example`; `docs/tickets/G01-adk-core.md` (Result)

### R-20261111-SN12-1: The ensemble's offline render is not byte-identical above Calm; can SN04 find the source?
- From: SN12 (offline render, agent C)
- To: SN04 (owner of `src/audio/ensemble/`)
- Needed by: SN12 "Done when" (two renders with equal hashes)
- Status: open
- Context: `synthetic-storm` (10 dates, `full`), rendered three times in headless Edge through `renderSequence` (`src/features/playlist/renderSequence.ts`) and `createEnsemble(...).renderOffline`. The captions and the sidecar are identical every time, but the WAV differs: about 100 of 926,100 samples, each by one 16-bit step. By detail: `calm` 0 differing samples, `standard` 104, `full` 111. Removing single voices from a `full` schedule: no hot spots 70, no bass 71, no rhythm 68, no motion 0, only bass 2, only hot spots 27. The graph already avoids Freeverb, PolySynth, noise and `Math.random` (`graph.ts` comment), so the cause is something else in it. The check script is a short DevTools-protocol driver; the numbers are in `docs/tickets/SN12-offline-render-playlist.md` under Result.
- Question: can SN04 find what makes the offline render vary (a panner, a filter, the compressor or the clip curve, event timing)? Or should SN12 accept "same to within one 16-bit step" and say so in the ticket (option b), and drop "byte-identical" for the real engine?
- Answer:
- Recorded in: nowhere needed yet
- Note (2026-11-11, SN12): option (b) was chosen for SN12 to ship: "same to within one 16-bit step". SN04 may still look for the source; no deadline.

### R-20261111-SN13-1: `App.tsx` still calls `noteGuidePlaybackCommand`; may it be removed there?
- From: SN13 (one voice at a time, agent C)
- To: team leader (owner of `src/App.tsx`, hotspot `app`)
- Needed by: nothing; SN13 ships without it
- Status: open
- Context: SN13 changes `useDucking` (`src/assistant/ducking.ts`) from pausing the player to ducking the music, so nothing needs "the listener just asked for sound" any more. The ticket says to remove `noteGuidePlaybackCommand` and its callers in `src/hooks/useVoiceAssistant.ts`, but the only caller is `src/App.tsx` line 138, which is outside SN13's Touches. To keep `App.tsx` compiling, `ducking.ts` keeps `noteGuidePlaybackCommand` as an empty function (and `resetDucking`, now `duck.reset()`).
- Question: may the next ticket that edits `App.tsx` delete the `noteGuidePlaybackCommand(action.command)` line and then the empty function in `ducking.ts`? (Yes / no, leave it.)
- Answer:
- Recorded in: `docs/tickets/SN13-one-voice-at-a-time.md` (Result)

### R-20261112-JB04-1: May the next `App.tsx` ticket pass the open data set to `MascotDock`?
- From: JB04 (data-set colour themes, agent D)
- To: team leader (owner of `src/App.tsx`, hotspot `app`)
- Needed by: JB04 "Done when" (switching data sets changes Echo in the running app); JB04 itself ships without it
- Status: open
- Context: JB04 gives `MascotDock` (`src/features/mascot/MascotDock.tsx`) an optional `visualization` prop. With it, the dock sets `--mascot-accent`, `--mascot-accent-soft`, `--mascot-trail` and `data-trail` from the manifest (`mascotTheme`, `src/features/mascot/accent.ts`); without it, Echo keeps its own colours. `src/App.tsx` line 237 renders `<MascotDock …>` without it, and `App.tsx` is outside JB04's Touches. The context bus only carries `player` and `compare`, so the dock cannot read the data set any other way.
- Question: may the next ticket that edits `App.tsx` add `visualization={visualization}` to the `<MascotDock>` element (one prop, the same value `CurrentPage` gets)? (a) yes; (b) no, give the dock the data set another way (say how).
- Answer:
- Recorded in: `docs/tickets/JB04-dataset-mascot-theme.md` (Result)


### R-20261112-G03-1: Who owns `src/features/ask/`?
- From: G03 (Ask front end on the agent, agent D)
- To: team leader
- Needed by: nothing; G03 ships without it (its ticket asks for the owner to be confirmed here in one line)
- Status: open
- Context: `docs/PLAN.md` §4 lists no owner for `src/features/ask/`. The panel is mounted on Listen (`src/features/player/index.tsx`) and, after G03, reuses the voice guide's action allow-list (`toAssistantAction`, `src/hooks/useVoiceAssistant.ts`), both Mohammad's.
- Question: (a) Mohammad, as owner of Listen and the voice guide; (b) the team leader; (c) someone else (say who). The answer goes in the §4 table.
- Answer:
- Recorded in: nowhere needed yet

### R-20261112-V02-1: May the voice server read `detail` in the `start` message?
- From: V02 (mic consent and text-only voice guide, agent D)
- To: G04 or G05 (owner of `server/app/api/assistant.py`, hotspot `server-assistant`)
- Needed by: nothing; V02 ships without it (until then the server ignores the field, as it does today)
- Status: open
- Context: After V02 the browser's `start` message is `{"type":"start","language":…,"page":…,"detail":"short"|"detailed"}` (`src/hooks/useVoiceAssistant.ts`, `ws.onopen`). The listener picks it in the panel's **Answers** group, Short by default, stored under `earth-jukebox:answer-length`. `assistant_live` reads only `language` and `page` (`server/app/api/assistant.py:183`). V02 does not change the server.
- Question: may the ticket that next edits `assistant.py` (G04 or G05) read `detail` (anything other than `"detailed"` counts as `"short"`) and add one system-instruction line for each value, for example "Answer in one or two short sentences." and "Answer fully, in up to six sentences, and offer to say more."? (a) yes, with those lines; (b) yes, with other lines (say which); (c) no.
- Answer:
- Recorded in: nowhere needed yet

### R-20261112-V02-2: May the voice server send `limitSeconds` in `ready`?
- From: V02 (mic consent and text-only voice guide, agent D)
- To: G04 or G05 (owner of `server/app/api/assistant.py`, hotspot `server-assistant`)
- Needed by: nothing; V02 ships without it (the browser assumes 600 seconds)
- Status: open
- Context: V02 warns the listener one minute before the session limit ("Echo will stop in 1 minute. Continue?"), timed from the `ready` message. The limit is `assistant_max_session_seconds` (`server/app/config.py:39`, 600), but `ready` is sent as `{"type":"ready"}` (`server/app/api/assistant.py:192`), so the browser has to assume 600 (`DEFAULT_LIMIT_SECONDS` in `src/hooks/useVoiceAssistant.ts`). If the setting changes, the warning is wrong.
- Question: may G04 or G05 send `{"type":"ready","limitSeconds":settings.assistant_max_session_seconds}`? The browser already reads it (a positive number) and falls back to 600 otherwise. (a) yes; (b) no, keep 600 in the browser.
- Answer:
- Recorded in: nowhere needed yet

### R-20261112-G07-1: Who writes the held-out Ask questions?
- From: G07 (agent E, 12 Nov)
- To: team
- Needed by: G07 (the ticket is `blocked: held-out questions` until then)
- Status: open
- Context: `server/agent_eval/README.md`, `docs/tickets/G07-agent-eval-drafter.md`. The eval needs `server/agent_eval/questions/heldout.json`: at least 15 real questions about the fixture data set (`server/agent_eval/facts.json` lists the facts), each with `"author"` set, written before any agent result is seen and not copied from the aliases in `src/features/ask/facts.ts`. Same shape as `questions/dev.json` (`id`, `text`, `type`, `open_wording`, `expected_fact_ids`); adversarial questions are optional.
- Question: Who writes them (a person, not an agent), and when?
- Answer:
- Recorded in: nowhere needed

### R-20261112-ticket-hook-1: Ticket check shows garbled text and a wrong list on Windows; OK to merge the one-line fix?
- From: Dhruv (Claude Code, Windows laptop, 12 Nov)
- To: team (the person who owns `.claude/hooks/tickets.py`, and every agent on Windows)
- Needed by: nothing blocks; until it merges, a Windows agent can be told the wrong thing about which tickets are free
- Status: open
- Context: `.claude/hooks/tickets.py:27` runs `git` with `text=True` and no encoding. Python then decodes git's UTF-8 output with the Windows ANSI code page (not UTF-8), so the `—` ("no Needs") and the 👤 in `docs/TICKETS.md` come out as `â€”` and `ð¤`. The script can no longer read those cells, so a ticket with no Needs looks as if it has an unmet one. Seen on 12 Nov: the check listed H02, H04, H06 and H08 (all 👤) as takeable; with `PYTHONUTF8=1` it correctly says nothing is takeable. Mac and Linux decode as UTF-8 already and are not affected. An agent on another Windows laptop also saw "nothing is takeable" while I09, I12, VIS1 and F42 were free.
- Question: may the fix merge? It is one line, branch `chore/ticket-hook-utf8`, commit `d44cc03`: add `encoding="utf-8", errors="replace"` to that `subprocess.run` call. Tested on Windows without `PYTHONUTF8=1`: no garbled characters, same result as the UTF-8 run, and the guard still blocks an unclaimed ticket branch. Not tested on Mac or Linux (the change makes Windows behave as they already do). (a) yes, merge it; (b) no, make it a ticket first.
- Answer:
- Recorded in: nowhere needed yet

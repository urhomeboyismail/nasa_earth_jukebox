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

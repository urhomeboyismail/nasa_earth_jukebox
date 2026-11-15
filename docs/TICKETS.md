# Tickets: the queue

One queue for everyone, people and agents. Up to six coding agents (A to F) work from it at the same time: each one reads this file, claims the next ticket it can take, and works on it fully. Each ticket has its own file in [`tickets/`](tickets/), written from [`tickets/_TEMPLATE.md`](tickets/_TEMPLATE.md), and carries everything the agent needs (goal, why, design, reuse, files, steps, tests, done when, checks).

- **The design:** [`PLAN.md`](PLAN.md) §6.3 (v3, translating sight into sound in real time) for SN, IX and EIC tickets; §5 for the interfaces.
- **Done tickets are deleted** from this table and from `tickets/` (the record is git history, `PRE-HACKATHON-WORK.md` and [`archive/README.md`](archive/README.md)). A **Needs** entry is always a ticket that is still open.
- **Built or replaced work:** [`archive/README.md`](archive/README.md).
- **Questions between agents:** [`AGENT-BOARD.md`](AGENT-BOARD.md).
- **The rules:** `AGENTS.md` and `.claude/rules/` (workflow, phases, front end, server, git, tickets).

## How to claim a ticket (agents)

1. **Setup, once.** Each agent works in its own clone or worktree, on its own machine. Use `git worktree add ../nasa-<letter> main` (agent A is `../nasa-a`, agent B `../nasa-b`, up to F) when several run from one clone. **Before anything else, run the ticket check** (`.claude/hooks/tickets.py status`; the hooks in `.claude/settings.json` run it for you, see `.claude/rules/tickets.md`). Agents on separate laptops each clone the repo. Either way, the claim is shared through `origin/main`.
2. **Pick.** Run `git pull` on `main` first, so you see every claim pushed so far. Then go down the queue from the top and take the first row where:
   - **Status** is `open`;
   - **Who** is `agent` or `agent+👤` (never `👤`);
   - every ticket in **Needs** is `done`;
   - none of its **Hotspots** is in a ticket any other agent has `claimed`.
3. **Claim.** On `main`: set Status to `claimed: A, <date>` (your letter, A to F), commit `chore: claim <ID>`, then **push at once**: `git push origin main`. A claim that isn't pushed is invisible to the other agents. If the push is rejected, someone else pushed first: run `git pull`, check the row, and pick again if it's taken. Never force-push.
4. **Build.** In your worktree, branch `<feature|fix|chore>/<ID>-<slug>` from `main`. Read the ticket file and change only the files under **Touches**. Run the checks and paste their real output under **Result** in the ticket file.
5. **Finish.** Set Status to `ready: <branch>`. The person reviews and merges. Don't push or open a PR without asking. After the merge, Status becomes `done` and a line goes into [`PRE-HACKATHON-WORK.md`](PRE-HACKATHON-WORK.md) under "During the hackathon".
6. **Blocked.** Set `blocked: <reason>`, post on [`AGENT-BOARD.md`](AGENT-BOARD.md), and pick another ticket. Never guess an interface you don't own.

Status values: `open`, `claimed: <A to F>, <date>`, `ready: <branch>`, `done`, `blocked: <reason>`.

## Hotspots

Files many tickets touch. Two agents must never be in the same hotspot at the same time.

| Hotspot | Files |
|---|---|
| `player` | `src/features/player/index.tsx`, `usePlayer.ts`, `Viewer.tsx`, `player.test.tsx` |
| `explorer` | `src/features/explore/useExplorer.ts`, `Explorer.tsx` |
| `app` | `src/App.tsx` |
| `engine` | `src/audio/engine.ts` |
| `voice` | `src/VoiceAssistant.tsx`, `src/hooks/useVoiceAssistant.ts` |
| `server-assistant` | `server/app/assistant/tools.py`, `server/app/api/assistant.py` |
| `schema` | `src/data/schema.ts`, `src/data/types.ts` |
| `learn` | `src/features/learn/index.tsx` |
| `compare` | `src/features/compare/index.tsx`, `TestMode.tsx` |
| `ask` | `src/features/ask/AskPanel.tsx`, `ask.ts`, `facts.ts` |
| `about` | `src/features/about/index.tsx` |
| `catalogue` | `public/data/index.json`, `docs/data-sources.md` |
| `welcome` | `src/features/welcome/*` |
| `tour` | `src/features/mascot/tour.ts`, `TourOverlay.tsx`, `MascotDock.tsx` |
| `theme` | `scripts/make_tokens.mjs`, `src/styles/tokens.css`, `src/styles/components.css`, `src/index.css` |

## The queue

Who: `agent`, `👤` (a person; agents never claim it), `agent+👤` (an agent builds it, a person signs off). Size: S under half a day, M about a day, L more.

### P0: salvage and blockers

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|

### P1: sight to sound v3 (the core; `PLAN.md` §6.3)

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [SN15](tickets/SN15-own-sound-first.md) | Each data set keeps its own sound unless the listener chooses a style on purpose | S | agent | — | — | ready: feature/SN15-own-sound-first |

### P1: interaction (the listener plays the map; `PLAN.md` §6.3)

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [IX07](tickets/IX07-compare-by-hand.md) | Compare by hand: date A in the left ear, B in the right | S | agent | — | explorer | blocked: needs SN04 two holds |

### P1: EIC data

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [EIC02](tickets/EIC02-pick-visualisations.md) | Pick 3–5 EIC visualisations; check source, credit and licence | S | 👤 | — | — | done |
| [EIC03](tickets/EIC03-ingest-datasets.md) | Ingest and tune each picked visualisation (manifest and data only) | M each | agent+👤 | EIC02 | catalogue | blocked: EIC02 picks missing (see AGENT-BOARD R-20261114-EIC03-1) |

### P1: Gemini on ADK and the voice panel

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [G05](tickets/G05-adk-default.md) | ADK by default; retire the old bridge | S | agent | — | server-assistant | ready: feature/G05-adk-default |
| [G07](tickets/G07-agent-eval-drafter.md) | Agent evaluation (scoring bug fixed) and the offline drafter | M | agent+👤 | — | — | blocked: held-out questions |

### P1: UI overhaul (the Muninn look; [`planning/UI-OVERHAUL.md`](planning/UI-OVERHAUL.md))

The MC tickets branch from `chore/jpl-hud-theme` (the Mission Control look, not yet on `main`) and are merged back into it; MC05 opens the one pull request into `main`.

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [MC01](tickets/MC01-review-mission-control.md) | Code review of the Mission Control look, and its fixes | S | agent | — | theme, player | ready: chore/MC01-review-mission-control |
| [MC02](tickets/MC02-a11y-mission-control.md) | Accessibility pass on the Mission Control look | S | agent+👤 | — | theme | ready: chore/MC02-a11y-mission-control |
| [MC03](tickets/MC03-backdrop-real-audio.md) | The backdrop follows real sound | S | agent | — | — | ready: no code change (findings in Result) |
| [MC04](tickets/MC04-quality-gate-flaky-app-test.md) | Quality gate, and the flaky App test | S | agent | — | — | claimed: A, 2026-11-14 |
| [MC05](tickets/MC05-pr-mission-control.md) | Pull request: the Mission Control look into main | S | agent+👤 | MC01, MC02, MC03, MC04 | — | open |
| [LY01](tickets/LY01-phone-layout-pass.md) | The phone layout pass: the page, not the chrome, on the first screen | M | agent+👤 | MC05 | app, player | open |

### P2: quality and smaller features

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|

### P2: Echo's weather (Meteomatics)

Echo fetches the weather for a place, shows every value it fetched, and plays it. Server credentials: `METEOMATICS_USERNAME`, `METEOMATICS_PASSWORD`.

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [WX01](tickets/WX01-echo-fetches-weather.md) | Echo fetches hourly air temperature from Meteomatics; reply and sound from the numbers | S | agent | — | — | ready: feature/echo-weather |
| [WX02](tickets/WX02-echo-shows-the-numbers.md) | "Show the numbers": every fetched value in an accessible table, the playing row marked | S | agent | WX01 | — | ready: feature/echo-weather |
| [WX03](tickets/WX03-weather-in-three-voices.md) | Weather in three voices: temperature melody, rain pulse, wind pad | S | agent | WX01 | — | open |
| [WX04](tickets/WX04-voice-guide-weather.md) | The voice guide can tell the weather (ADK path; `get_weather` tool) | S | agent | WX01 | — | ready: feature/echo-weather |

### P3: people, evidence and submission

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|

## Parked

Not in the queue; listed with the reason in [`archive/README.md`](archive/README.md): T95, T103, T104, T118, T119, F43–F47, F49, F51–F57, I08 and I13 (`usePlayer.ts` and `engine.ts` are replaced by v3), and T86 (replaced by G01–G07).

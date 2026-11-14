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

### P1: interaction (the listener plays the map; `PLAN.md` §6.3)

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [IX07](tickets/IX07-compare-by-hand.md) | Compare by hand: date A in the left ear, B in the right | S | agent | — | explorer | blocked: needs SN04 two holds |

### P1: EIC data

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [EIC02](tickets/EIC02-pick-visualisations.md) | Pick 3–5 EIC visualisations; check source, credit and licence | S | 👤 | — | — | open |
| [EIC03](tickets/EIC03-ingest-datasets.md) | Ingest and tune each picked visualisation (manifest and data only) | M each | agent+👤 | EIC02 | catalogue | open |

### P1: Gemini on ADK and the voice panel

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [H02](tickets/H02-live-parity-check.md) | Live parity check with a billed key | S | 👤 | — | — | open |
| [G05](tickets/G05-adk-default.md) | ADK by default; retire the old bridge | S | agent | H02 | server-assistant | open |
| [G07](tickets/G07-agent-eval-drafter.md) | Agent evaluation (scoring bug fixed) and the offline drafter | M | agent+👤 | — | — | blocked: held-out questions |

### P1: UI overhaul (the Muninn look; [`planning/UI-OVERHAUL.md`](planning/UI-OVERHAUL.md))

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [UI02](tickets/UI02-welcome-glass.md) | Welcome in glass: Echo's chat and the manual form | M | agent+👤 | — | welcome | claimed: C, 2026-11-14 |
| [UI05](tickets/UI05-motion-layer.md) | Motion layer on CSS and the Web Animations API (no Anime.js): press, drawers, sky, theme sweep and Echo's flight | M | agent+👤 | — | tour | claimed: D, 2026-11-14 |
| [UI07](tickets/UI07-ear-check.md) | Ear check: "Which is higher?" and "Left or right?" set the detail level and flip swapped ears | M | agent | — | welcome | open |
| [UI09](tickets/UI09-fusion-moments.md) | Remix: a chord when both decks peak together, and one caption strip | M | agent | — | — | done |

### P2: quality and smaller features

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|

### P2: Echo as Juke-Bot (the guide)

Echo, the guide, redrawn as Juke-Bot (helmet visor, headphones, chest screen, air-booster boots) and brought to life. F58 first; the rest set its props. Nothing specific to one data set in `src/`: colours and trails come from each manifest (JB04).

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [JB09](tickets/JB09-tour-from-welcome.md) | The tour starts after the welcome (map path), and Echo flies home to the dock when it finishes | S | agent | — | tour | done |
| [JB10](tickets/JB10-tour-mixer-stop.md) | The tour's third stop is the Speed and Volume mixer, not Explore the map | S | agent | — | player | done |
| [JB11](tickets/JB11-chat-welcome.md) | Echo's chat welcome (name, four sound chips, then the path and sound check) with a "Prefer manual setup?" form | M | agent | JB09 | welcome | done |

### P3: people, evidence and submission

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [H03](tickets/H03-practice-listening-test.md) | Practice listening test: Symphony against Simple, Find and Predict, with a blind or low-vision tester | M | 👤 | — | — | open |
| [H04](tickets/H04-change-style-check.md) | Change-style check on real data | S | 👤 | — | — | open |
| [H06](tickets/H06-device-numbers.md) | Device numbers, live-video CPU on a phone, real-phone checks | S | 👤 | — | — | open |
| [H07](tickets/H07-video-slides.md) | 30 s video and 7 slides | M | 👤 | H03 | — | open |
| [H08](tickets/H08-final-check.md) | Final check: keyboard, NVDA and VoiceOver, server off | M | 👤 | — | — | open |

## Parked

Not in the queue; listed with the reason in [`archive/README.md`](archive/README.md): T95, T103, T104, T118, T119, F43–F47, F49, F51–F57, I08 and I13 (`usePlayer.ts` and `engine.ts` are replaced by v3), and T86 (replaced by G01–G07).

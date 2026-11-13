# Tickets: the queue

One queue for everyone, people and agents. Up to six coding agents (A to F) work from it at the same time: each one reads this file, claims the next ticket it can take, and works on it fully. Each ticket has its own file in [`tickets/`](tickets/), written from [`tickets/_TEMPLATE.md`](tickets/_TEMPLATE.md), and carries everything the agent needs (goal, why, design, reuse, files, steps, tests, done when, checks).

- **The design:** [`PLAN.md`](PLAN.md) §6.3 (v3, translating sight into sound in real time) for SN, IX and EIC tickets; §5 for the interfaces.
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

## The queue

Who: `agent`, `👤` (a person; agents never claim it), `agent+👤` (an agent builds it, a person signs off). Size: S under half a day, M about a day, L more.

### P0: salvage and blockers

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [H01](tickets/H01-commit-rules-merge-t88b.md) | Commit the uncommitted rules and docs edits on a `chore/` branch; merge `feature/T88b-demo-script`; remove the duplicate root `brainstorm/` | S | 👤 | — | — | done |
| [S01](tickets/S01-salvage-f40-f41.md) | Salvage F40 deep links and F41 shortcuts dialog from their unmerged branches | M | agent | — | player, explorer | done |
| [S02](tickets/S02-salvage-mur-sst.md) | Salvage the `mur-sst-mauritius` data set; draft its comparisons and story | M | agent+👤 | — | catalogue | done |
| [S03](tickets/S03-salvage-readme.md) | Salvage the project README and `CREATIVE_PROCESS.md`; update them for v3 | S | agent+👤 | — | — | done |
| [S04](tickets/S04-salvage-t93-announce-rate.md) | Salvage T93 announcement rate | S | agent | I01 | player, explorer | done |
| [S05](tickets/S05-salvage-t114-sheet.md) | Salvage the T114 change-style listening sheet | S | agent | S02 | — | done |
| [I01](tickets/I01-app-announcer.md) | One `AnnouncerProvider` for the whole app: Home, welcome and help announcements never reach screen readers today | S | agent | — | app, player, compare, learn | done |
| [I02](tickets/I02-neutral-words.md) | Neutral default words; remove the temperature words still in `src/` | M | agent | — | learn, player, compare | done |

### P1: sight to sound v3 (the core; `PLAN.md` §6.3)

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [SN01](tickets/SN01-feature-extractor.md) | Feature extractor: `FrameFeatures` from any frame (data and picture mode), in the worker | L | agent | — | — | done |
| [SN02](tickets/SN02-synthetic-feature-sets.md) | Synthetic data sets with known answers for motion and hot spots | M | agent | SN01 | catalogue | done |
| [SN03](tickets/SN03-ruleset-presets.md) | Ruleset and presets: `FrameFeatures` → `MusicFrame`, pure and deterministic | L | agent | SN01, SN05 | — | done |
| [SN04](tickets/SN04-ensemble-engine.md) | Ensemble engine: seven voices, master bus with limiter, dropout cue, lifecycle | L | agent | SN03, SN05 | — | done |
| [SN05](tickets/SN05-manifest-v3-fields.md) | Manifest fields `video`, `sonification`, `legend`, with defaults | M | agent | — | schema, catalogue | done |
| [SN06](tickets/SN06-live-video-source.md) | Live video source: read each displayed EIC frame as it plays | M | agent | SN01, SN05 | — | done |
| [SN07](tickets/SN07-symphony-mode.md) | Listen: Symphony mode wired end to end; Detail, mixer, layer captions; Simple mode kept | L | agent | SN01, SN03, SN04, SN06 | player | done |
| [SN08](tickets/SN08-scan-mode.md) | Scan mode: sweep a frame so shapes become audible | M | agent | SN01, SN03, SN04, SN07 | player | done |
| [SN09](tickets/SN09-explore-v2.md) | Explore v2: continuous tone and slope cue under the cursor or finger | M | agent | SN03, SN04 | explorer | done |
| [SN10](tickets/SN10-text-equivalents.md) | Text equivalents: event sentences, announcements, hot-spot markers, sound recipe | M | agent | SN01, SN03 | player, about | done |
| [SN11](tickets/SN11-learn-v3.md) | Learn v3: one card per voice, played alone on the synthetic sets | M | agent | SN01, SN02, SN03, SN04, SN06 | learn | done |
| [SN12](tickets/SN12-offline-render-playlist.md) | Offline render: byte-identical WAV, captions file, playlist of every data set | M | agent | SN01, SN03, SN04 | about | done |
| [SN13](tickets/SN13-one-voice-at-a-time.md) | One voice at a time: real gain ducking under the guide and speech on every page | M | agent | SN04 | voice, engine | done |

### P1: interaction (the listener plays the map; `PLAN.md` §6.3)

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [IX01](tickets/IX01-input-layer.md) | Input layer and key map: keyboard, touch, mouse and gamepad as one set of actions; 50 ms answer | M | agent | S01, SN03, SN04 | explorer, player | done |
| [IX02](tickets/IX02-whats-here.md) | "What's here?" on demand; verbosity; Esc stops speech | S | agent | IX01, SN10 | explorer | done |
| [IX03](tickets/IX03-follow-mode.md) | Follow a hot spot through time | M | agent | SN01, SN04 | player | open |
| [IX04](tickets/IX04-find-game.md) | Find game: warmest place, the edge, the biggest change, by ear | M | agent | IX01, SN04 | player | open |
| [IX05](tickets/IX05-predict-then-hear.md) | Predict, then hear: a question before the next frames, then the answer | M | agent | SN01 | player | open |
| [IX06](tickets/IX06-scrub-and-sculpt.md) | Scrub time with sound; draggable scan line; keyboard mixer; "My mix" | M | agent | SN07, SN08 | player | open |
| [IX07](tickets/IX07-compare-by-hand.md) | Compare by hand: date A in the left ear, B in the right | S | agent | IX01, SN04 | explorer | open |
| [IX08](tickets/IX08-mark-share-record.md) | Mark moments, share them, record an exploration as WAV | M | agent | S01, SN12 | player | open |
| [IX09](tickets/IX09-echo-points.md) | Echo points with a sound beacon and asks questions back | M | agent | IX01, G06 | server-assistant, app, voice | open |
| [IX10](tickets/IX10-haptics-map.md) | Haptics map on the audio clock; gamepad rumble | S | agent | IX01 | explorer, player | open |
| [IX11](tickets/IX11-interactive-onboarding.md) | Interactive onboarding: the first minute is a game | M | agent | IX04 | player | open |
| [IX12](tickets/IX12-art-mode.md) | Art mode: your own preset, recorded and exported | M | agent | SN03, SN12 | player | open |

### P1: EIC data

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [EIC01](tickets/EIC01-ingest-script.md) | `scripts/eic_ingest.py`: MP4 or PNG sequence in, frames, colour scale, web video and manifest out | L | agent | SN05 | catalogue | done |
| [EIC02](tickets/EIC02-pick-visualisations.md) | Pick 3–5 EIC visualisations; check source, credit and licence | S | 👤 | — | — | open |
| [EIC03](tickets/EIC03-ingest-datasets.md) | Ingest and tune each picked visualisation (manifest and data only) | M each | agent+👤 | EIC01, EIC02 | catalogue | open |
| [D04](tickets/D04-known-answer-check.md) | Known-answer check: decoded values against NASA's numbers | S | agent+👤 | — | catalogue | done |

### P1: Gemini on ADK and the voice panel

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [G01](tickets/G01-adk-core.md) | ADK core package: tools, callbacks, action sink, keyless tests | M | agent | — | server-assistant | done |
| [G02](tickets/G02-agent-ask-endpoint.md) | Grounded Ask endpoint on ADK | M | agent | G01 | — | done |
| [G03](tickets/G03-ask-frontend-agent.md) | Ask front end on the agent, with the offline matcher as fallback | M | agent | — | ask | done |
| [G04](tickets/G04-voice-on-adk.md) | Voice guide on ADK `run_live`, same browser protocol, behind a switch | L | agent | G01 | server-assistant | done |
| [H02](tickets/H02-live-parity-check.md) | Live parity check with a billed key | S | 👤 | G04 | — | open |
| [G05](tickets/G05-adk-default.md) | ADK by default; retire the old bridge | S | agent | G04, H02 | server-assistant | open |
| [G06](tickets/G06-agent-sees-more.md) | The agent sees facts, the explorer and the music; context schemas and drift test | M | agent | G04, SN03 | server-assistant, player, compare, ask | open |
| [G07](tickets/G07-agent-eval-drafter.md) | Agent evaluation (scoring bug fixed) and the offline drafter | M | agent+👤 | G02 | — | blocked: held-out questions |
| [G08](tickets/G08-jukebox-orchestrator.md) | Jukebox orchestrator: a LangGraph of four ADK agents (supervisor, synthesizer, vision, critic), and its route `POST /api/v1/jukebox/generate` | M | agent | — | — | done |
| [G09](tickets/G09-jukebox-player.md) | Jukebox player: a React component that plays the orchestrator's `AudioPayload` with Tone.js (Play/Stop) | S | agent | G08 | — | done |
| [G10](tickets/G10-jukebox-studio.md) | Jukebox studio on `jukebox.html`: narration in time with the sound, instrument timbres, the live route with a demo fallback | M | agent | G08, G09 | — | done |
| [V01](tickets/V01-agent-panel-focus-undo.md) | Agent panel: focus not stolen, "Echo did" with Undo, Alt+E, Stop | M | agent | — | app, voice | done |
| [V02](tickets/V02-mic-consent-text-only.md) | Mic consent first, text-only mode, push-to-talk, session warning | M | agent | — | app, voice | done |
| [V03](tickets/V03-voice-client-hygiene.md) | Voice client: parsed messages, quieter status, shared icons | S | agent | — | voice | done |

### P2: quality and smaller features

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [I03](tickets/I03-friendly-data-errors.md) | Friendly data errors instead of developer messages | S | agent | — | app | done |
| [I04](tickets/I04-zod-boundaries.md) | zod at the boundaries: study client, context data, welcome storage | S | agent | — | — | done |
| [I05](tickets/I05-server-hardening.md) | Server hardening and missing server tests | M | agent | — | server-assistant | done |
| [I06](tickets/I06-analysis-memory.md) | Analysis memory: bounded concurrency, cache eviction, dead casts | M | agent | — | player, explorer, compare | open |
| [I07](tickets/I07-shared-hooks.md) | Shared hooks: sound engine, frame analysis, stored settings | M | agent | I06 | player, compare, learn | open |
| [I09](tickets/I09-compare-cleanup.md) | Compare clean-up | S | agent | — | compare | done |
| [I10](tickets/I10-first-load.md) | First load: lazy voice panel, demo and v3 pipeline; bundle budget in CI | M | agent | SN07 | app | done |
| [I11](tickets/I11-lint-ci-rules.md) | Lint and CI rules that enforce `frontend.md`; ruff | S | agent | I04, I06 | — | open |
| [I12](tickets/I12-missing-unit-tests.md) | Unit tests for five untested modules | S | agent | — | — | done |
| [VIS1](tickets/VIS1-low-vision-map-tools.md) | Low-vision map tools: magnifier, big cursor, high-contrast outline, forced colours | M | agent | — | explorer | done |
| [VIS2](tickets/VIS2-patterns-display-settings.md) | Colour-vision patterns and display settings | M | agent | — | app, explorer | open |
| [VIS3](tickets/VIS3-design-system-housekeeping.md) | Design-system housekeeping | M | agent | — | app | done |
| [F42](tickets/F42-spoken-demo-caption.md) | Spoken demo caption; demo fixes | S | agent | — | — | done |
| [F48](tickets/F48-region-picker.md) | Region picker | M | agent | I06 | player, compare, schema | open |
| [AU-UI](tickets/AU-UI-interface-sounds.md) | Interface sounds, quiet and behind a switch | M | agent | SN04, H03 | player, compare, voice | open |

### P2: Echo as Juke-Bot (the guide)

Echo, the guide, redrawn as Juke-Bot (helmet visor, headphones, chest screen, air-booster boots) and brought to life. F58 first; the rest set its props. Nothing specific to one data set in `src/`: colours and trails come from each manifest (JB04).

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [F58](tickets/F58-robot-echo.md) | Echo as Juke-Bot: art, five visor expressions, motion states | M | agent | H05 | — | done |
| [JB01](tickets/JB01-mascot-dock.md) | Corner widget, glass speech bubble and `useMascotGuide()`; Echo's face follows the app | L | agent | F58 | app | done |
| [JB02](tickets/JB02-scroll-boosters.md) | Scroll-driven air boosters: tilt, thrust and retro-burn | S | agent | JB01 | — | done |
| [JB03](tickets/JB03-audio-chest.md) | Audio-reactive chest: EQ bars and mini globe from the playing sound | M | agent | JB01 | — | done |
| [JB04](tickets/JB04-dataset-mascot-theme.md) | Data-set colour themes and trails from the manifest | M | agent | F58 | schema, catalogue | done |
| [JB05](tickets/JB05-tour-flight-path.md) | Guided tour flight path with a glowing jet trail | L | agent | JB01, JB02 | player | open |
| [JB06](tickets/JB06-alert-visor.md) | Alert visor on notable data events | S | agent | JB01, SN10 | player | open |
| [JB07](tickets/JB07-explorer-mirror-legend.md) | Echo mirrors the explorer; the legend becomes playable | M | agent | JB01, SN09, IX02 | explorer | open |

### P3: people, evidence and submission

| ID | Ticket | Size | Who | Needs | Hotspots | Status |
|---|---|---|---|---|---|---|
| [H03](tickets/H03-practice-listening-test.md) | Practice listening test: Symphony against Simple, Find and Predict, with a blind or low-vision tester | M | 👤 | SN07 | — | open |
| [H04](tickets/H04-change-style-check.md) | Change-style check on real data | S | 👤 | S02, S05 | — | open |
| [H05](tickets/H05-mascot-decision.md) | Mascot name and art decision | S | 👤 | — | — | done |
| [H06](tickets/H06-device-numbers.md) | Device numbers, live-video CPU on a phone, real-phone checks | S | 👤 | SN06 | — | open |
| [H07](tickets/H07-video-slides.md) | 30 s video and 7 slides | M | 👤 | H01, S02, H03 | — | open |
| [H08](tickets/H08-final-check.md) | Final check: keyboard, NVDA and VoiceOver, server off | M | 👤 | S02 | — | open |

## Where two agents start

The v3 core has a fixed order: **SN01 and SN05 first** (no needs), then SN03, then SN04 and SN06, then SN07. Everything else in v3 hangs off those.

- **Agent A (the sound path):** SN01 → SN03 → SN04 → SN07 → SN08.
- **Agent B (data, sources and the server):** SN05 → SN06 → EIC01 → G01 → G04, with SN02 once SN01 is done.
- **While waiting on a need,** take a P0 ticket (S01, S02, I01, I02, S03) or a free P1 ticket with no needs (G03, V01, V02, V03). Only one agent works in a hotspot at a time, so `player` tickets (SN07, SN08, IX03, IX06, S01) never run together, and nor do `voice` tickets (V01–V03, SN13).

## Parked

Not in the queue; listed with the reason in [`archive/README.md`](archive/README.md): T95, T103, T104, T118, T119, F43–F47, F49, F51–F57, I08 and I13 (`usePlayer.ts` and `engine.ts` are replaced by v3), and T86 (replaced by G01–G07).

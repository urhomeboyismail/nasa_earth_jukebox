# What was built before and during the hackathon

For judges and the team. The 2026 NASA Space Apps Challenge started for this team on **9 Nov 2026**. Everything committed to this repository before that day is pre-hackathon work.

## How the work is split

**Before the hackathon (2 to 8 Nov 2026): a broad, data-agnostic design.** It's a general "Earth Jukebox" that turns any dated, colour-scaled map into sound and text. It wasn't tuned to any one NASA data set; it ran on a fixture and made-up (synthetic) data sets.

**During the hackathon (from 9 Nov 2026): refinement for each NASA data set.** Real NASA data sets are added and tuned one by one through their own data files (`docs/DATASET-PLAYBOOK.md`), plus the evidence, write-up and submission.

## Built before the hackathon

On `main` up to commit `66b7517` (7 Nov). Feature IDs are from `docs/PLAN.md`.

| Area | What | Where |
|---|---|---|
| Planning | Brainstorm, product brief, decision log, ADRs 0001–0005, the vanilla-JS prototype and its GIBS pipeline | `docs/planning/` |
| Data | Manifest schema and checks (`check-data`), frame converter, fixture and synthetic data sets, baselines (T111) | `src/data/`, `scripts/`, `public/data/` |
| Analysis | Image reading in a worker, value grid, change field, contours (F1–F3, F27, T112–T113) | `src/analysis/` |
| Sound | Musical engine, styles "full", "simple" and "change", stereo and 3D pan, WAV export (F4, F13, F14, F18, F20, F28) | `src/audio/` |
| Pages | Home, Listen with the sound-map explorer, Compare, Learn, About; story mode; descriptions (concise and rich) | `src/features/`, `src/describe/` |
| Accessibility | Keyboard everywhere, announcements, axe checks in tests, vibration (F15) | `src/components/`, `src/test/` |
| Server | Voice guide (Gemini Live bridge), listening-test API | `server/` |
| Deploy | Vercel (site) and Render (server) configs | `vercel.json`, `render.yaml` |

## During the hackathon

Add one line per piece of work, newest last.

| Date | What | Branch or PR |
|---|---|---|
| 9 Nov | Brainstorm merge: test sound, "both ways", data table, Ask about this data (F29–F32, T88b) | `feature/T88b-brainstorm-merge` |
| 9 Nov | Design system foundations (T116) | `feature/T116-m3e-foundations` |
| 9 Nov | Voice guide: pin the Gemini API version | `fix/voice-guide-live-api-version` |
| 9 Nov | Test suite and lint clean-up; lazy-loaded pages | `fix/green-suite`, `perf/lazy-pages` |
| 9 Nov | Working rules, the two-phase rule, this record, the data set playbook | `chore/rules-and-decisions` |
| 9 Nov | F23 time travel: lock one cell, scrub the dates | `feature/F23-time-travel` |
| 9 Nov | F33 What the sound hides | `feature/F23-time-travel` |
| 9 Nov | F36 Manifest wording: `variable.words` replaces the hard-coded "warmer", "warm edge" and "water" | `feature/F36-T1-manifest-wording` |
| 9 Nov | F37 T1 Welcome: Echo greets a first visit on Home with three paths (screen reader, map, just play), a sound check (note, left, right, centre, volume) and the defaults each path sets | `feature/F37-T1-welcome` |
| 9 Nov | F37 T2 Help from Echo: a help button in the same place on every page (one tip per page, the welcome again, the mascot off), Echo's face beside the demo caption, and Echo as the voice guide's persona | `feature/F37-T2-help` |
| 9 Nov | F38 Learn fills: cards for the change from normal and the edge trace (only with a baseline), and `L` with "Play this place across the dates" on the map card | `feature/F38-T1-learn-fills` |
| 9 Nov | F39 Hear the legend: a button under the colour legend on Listen plays the categories coolest to warmest and announces each label; the steps are shared with Learn's "Play all" | `feature/F39-T1-hear-legend` |
| 9 Nov | F40 Deep links and Share: a link opens Listen on the same date, sound-map cell and sound style; the address follows them; a "Copy link to this moment" button | `feature/F40-T1-deep-links` |
| 9 Nov | F41 Shortcuts dialog: `?` or a button lists every key on Listen, made from one list that both keyboard handlers read; a shared modal Dialog component | `feature/F41-T1-shortcuts-dialog` |
| 9 Nov | F35 Demo mode: one button plays a scripted tour | `feature/F23-time-travel` |
| 9 Nov | T120 phone support: 360 px check, installable PWA manifest and icons | `feature/T120-phone` |
| 9 Nov | T88b demo script for the video, slides and live demo | `feature/T88b-demo-script` |
| 9 Nov | Plan v3 "sight into sound in real time" (`PLAN.md` §6.3) and the ticket reorganisation: one queue for two agents (`TICKETS.md`, `tickets/`), done and replaced tickets moved to `archive/` | `chore/tickets-v3` |
| 9 Nov | S02 first real data set, `mur-sst-mauritius`: sea surface temperature around Mauritius, 2023 (NASA MUR via GIBS): 5 comparisons, 4 story chapters, reference-date baseline, recorded Scores. Still to check by a person: the credit and licence wording, and the story | `feature/S02-mur-sst-mauritius` |
| 9 Nov | I01 One announcer for the whole app: Home, the welcome and the help button now reach the screen-reader live region; Learn announces through it too | `fix/I01-app-announcer` |
| 9 Nov | S04 (T93) Announcement rate: the player and the sound map change the live region at most once every 1.5 s while busy, the newest message replaces the older one and the last is always spoken; messages built by tested functions in `src/describe/announcements.ts`, within 160 characters (60 when concise) | `feature/S04-announce-rate` |
| 9 Nov | S03 project README for v3 (what is built, planned and not started; n = 0; AI tools named) and `docs/CREATIVE_PROCESS.md`, with every code claim checked | `feature/S03-readme` |
| 9 Nov | S05 (T114) Listening sheet for the change-from-normal sound: every answer re-derived from the data, and corrected where the app plays two lines in one trace; still NOT RUN | `feature/S05-t114-sheet` |
| 9 Nov | I02 Neutral default words: the defaults name no temperature (higher, lower, edge, values), each data set in the repo sets its own words in its manifest, and the sentences that said warm, cold or temperature are neutral | `fix/I02-neutral-words` |
| 10 Nov | SN05 Manifest v3 fields: optional `video`, `sonification` and `legend`, with defaults so every data set still validates | `feature/SN05-manifest-v3-fields` |
| 10 Nov | SN01 Feature extractor: `FrameFeatures` (grid, stats, hot spots, edges, motion, change, confidence) from any frame, in data and picture mode | `feature/SN01-feature-extractor` |
| 10 Nov | SN02 Synthetic data sets with known answers: `synthetic-motion` (patches move east two cells a step) and `synthetic-storm` (a storm on a known path, a cold patch, a day with no data) | `feature/SN02-synthetic-feature-sets` |
| 10 Nov | SN03 Ruleset and presets: `toMusicFrame` turns `FrameFeatures` into a `MusicFrame` (seven voices, dropout, captions) with three artistic presets | `feature/SN03-ruleset-presets` |
| 10 Nov | SN04 Ensemble engine: `createEnsemble` plays a `MusicFrame` through seven voices into a limited master bus (compressor, limiter, hard clip at -1 dBFS), with a lifecycle (start, pause, suspended, page hidden) and an offline render | `feature/SN04-ensemble-engine` |
| 11 Nov | SN06 Live video source: `LiveSource` reads each frame a `<video>` presents (rVFC or rAF, back-pressure, 20 fps cap) through the feature worker with date and confidence, and falls back to the checked PNG frames with a plain-words reason | `feature/SN06-live-video-source` |
| 11 Nov | SN11 Learn v3: a "Seven voices" section on Learn, one card per voice with Play alone and Stop, playing the data set on screen with only that voice audible | `feature/SN11-learn-v3` |
| 11 Nov | SN12 Offline render: "Render the playlist" on About renders every data set to a 16-bit stereo WAV, a WebVTT captions file and a JSON sidecar, in the browser from the checked frames through the ensemble; the pipeline is deterministic, the real engine's WAV matches to within one 16-bit step (R-20261111-SN12-1) | `feature/SN12-offline-render-playlist` |
| 11 Nov | SN13 One voice at a time: a shared duck controller lowers the music by 18 dB (0.3 s attack, 0.8 s release) under the voice guide, browser speech and announcements instead of pausing it, in both engines and on every page; `speak()` resolves when the speech ends and the Welcome sound check plays its note after the spoken question | `feature/SN13-one-voice-at-a-time` |
| 11 Nov | EIC01 `scripts/eic_ingest.py`: an EIC MP4 or frame folder in, a data set folder out (dated frames, colour scale read from the colour bar, map area, same-origin H.264 web video, manifest with `video`, `legend` and `sonification`), with `--detect-only` to preview the bar first; calls `convert_frames.py` as a library | `feature/EIC01-ingest-script` |
| 11 Nov | F58: Echo redrawn as Juke-Bot; five visor expressions and four motion states as props; persona says Echo is a program | `feature/F58-juke-bot` |
| 12 Nov | JB01 Echo's corner dock on every page: a button that opens a glass speech bubble (page tip or a tip a page offers through `useMascotGuide()`), Talk to Echo, Turn Echo off; the visor follows loading, playing, speaking and idle; tips are announced only when the bubble is opened | `feature/JB01-mascot-dock` |
| 12 Nov | JB04 Echo's look per data set: an optional `mascot { accent, trail }` manifest field; without it the accent comes from the legend's most saturated colour (3:1 against the visor, else the theme colour) and the trail is sparks; four trail shapes (sparks, bubbles, ions, pulse), still under reduced motion; set for the SST, ocean and storm sets | `feature/JB04-dataset-mascot-theme` |
| 12 Nov | V01 Voice guide keeps the listener's place: a page the guide opens no longer moves focus, "Echo did" lists the last 10 steps with Undo on the newest, Alt+E opens and closes the guide, Stop talking cuts the sound, errors and ended reasons in plain words | `feature/V01-agent-panel-focus-undo` (#16) |
| 12 Nov | V02 Voice guide asks first: a consent card (Allow microphone or Use text only, stored and revocable) comes before any microphone prompt; text-only conversations and a refused microphone keep working; push-to-talk by default, and an open mic turns itself off after 60 s of quiet; Short or Detailed answers sent as `detail`; a warning a minute before the session limit with Continue; "Waking Echo up" after 3 s of connecting; the mic level no longer re-renders the app | `feature/V02-mic-consent-text-only` |

## Outside resources used

- **NASA data:** listed per data set in its `manifest.json` (`source`) and in `docs/data-sources.md`.
- **Libraries:** React, Vite, Tone.js, tonal, zod (front end); FastAPI and google-genai (server).
- **AI:** Google Gemini Live runs the optional voice guide. Coding assistants (Claude Code, Codex) helped write code and docs; the team reviewed every change.

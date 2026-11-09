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

## Outside resources used

- **NASA data:** listed per data set in its `manifest.json` (`source`) and in `docs/data-sources.md`.
- **Libraries:** React, Vite, Tone.js, tonal, zod (front end); FastAPI and google-genai (server).
- **AI:** Google Gemini Live runs the optional voice guide. Coding assistants (Claude Code, Codex) helped write code and docs; the team reviewed every change.

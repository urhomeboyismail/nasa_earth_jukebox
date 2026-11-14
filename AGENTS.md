# NASA Guru's Moon Heist

Project instructions for AI coding agents (Claude Code, Codex).

## Overview

Entry for the 2026 NASA Space Apps Challenge (Intermediate/Beginner-Youth; subjects: Arts & Multimedia, Earth Science, Software).

Goal: an "Earth Jukebox" that pairs NASA Earth Information Center (EIC) visual frames with dynamic sonifications generated in real time, making Earth science accessible and multi-sensory (including for blind and low-vision users) by translating sight into sound.

Full brief: see `CHALLENGE.md`.

Project plan (features, interfaces, folder ownership, milestones): see `docs/PLAN.md`. Read it and your ticket before starting work.

## Team

- Team leader
- Mohammad Ismail Iftikhar Oozeerally (@urhomeboyismail)
- @bhavish.tb
- Dhruv Bhantoo
- Roni

## Commands

Stack: React + TypeScript, built with Vite. A small FastAPI server (`server/`) does three jobs: the voice guide and the Ask agent (both on Google ADK), the listening-test API, and the Jukebox orchestrator (`POST /api/v1/jukebox/generate`, off unless `JUKEBOX_ENABLED=true`). The rest of the app works without it.

- Install: `npm install`
- Dev: `npm run dev` (proxies `/api`, including the voice guide WebSocket, to the server on port 8000)
- Build (typecheck + bundle): `npm run build`
- Lint: `npm run lint` (oxlint)
- Test: `npm test` (Vitest + Testing Library, jsdom); `npm run test:watch` while working
- Preview build: `npm run preview`
- Check every data set in `public/data/index.json`: `npm run check-data` (schema, images, legend, no `TODO` left; see `docs/data-sources.md`)
- Stage and convert an EIC/SVS video (EIC04, see `Consumption/README.md`): `npm run new-translation -- "<Category>/<Source>/<Item_ID>"`, then `npm run parse-nasa`, `npm run view` (port 5180, reloads on data JSON edits), `npm run check` (lint, test, check-data, script tests), `npm run clean-consumption`
- Regenerate the fixture dataset: `python3 -I scripts/make_fixture.py` (writes `public/data/fixture/`)
- Regenerate the synthetic dataset (needs Pillow and NumPy): `python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt && .venv/bin/python -I scripts/make_synthetic.py` (writes `public/data/synthetic-ocean/`)

Server (from `server/`):

- Install: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`
- Configure: copy `.env.example` to `.env` and set `GEMINI_API_KEY`
- Run: `.venv/bin/uvicorn app.main:app --port 8000`
- Test: `.venv/bin/python -m pytest`

Pages are listed in both `src/pages.ts` and `server/app/assistant/knowledge.py`; a server test fails if they drift.

## How to write a test

Tests sit next to the code (`thing.ts` → `thing.test.ts`) and run with `npm test`. Copy `src/test/a11y.test.tsx`.

- Render with Testing Library and find things the way a person would: `screen.getByRole('button', { name: 'Play' })`, not by class or test id. Use `userEvent` for clicks and keys.
- Check accessibility on anything you render: `await expectNoA11yViolations(container)` from `src/test/a11y.ts`. It cannot check color contrast in jsdom, so that is covered by the design tokens and the manual audit.
- jsdom has no `AudioContext` or `Worker`. Call `installFakeAudioContext()` or `installFakeWorker(handler)` from `src/test/fakes.ts`, and `uninstall()` after. Code that plays sound should normally go through the sound engine's fake in the same way the player tests do.
- Mock `fetch` with `vi.stubGlobal('fetch', ...)` and undo it in `afterEach` (see `src/App.test.tsx`).
- Use the fixture dataset (`public/data/fixture/manifest.json`) for realistic data.

## Conventions

- Match the style of the surrounding code.
- Keep changes small and focused; don't refactor unrelated code.
- Don't commit secrets or `.env` files.
- Commits and PRs carry no AI attribution: no `Co-Authored-By:` trailer and no "Generated with Claude Code" line (`.claude/rules/git.md`).
- **Two phases** (`.claude/rules/phases.md`): before the hackathon the design is broad and works for any data set; from 9 Nov each NASA data set is refined through its own manifest and data, not through code (`docs/DATASET-PLAYBOOK.md`). Nothing specific to one data set goes in `src/`. What was built when is recorded in `docs/PRE-HACKATHON-WORK.md`.
- **Layout is deferred to the end** (`.claude/rules/platform.md`). Don't check or rework the phone, tablet or desktop layout when you change the front end, and don't report widths in a PR. The team lead does one layout pass at the end. Keep using the existing components and design tokens so that pass stays small. The responsive-layout skill (`.claude/skills/responsive-layout/SKILL.md`) stays as a reference for that pass.
- **All open work is one queue** (`.claude/rules/tickets.md`; tickets are written independent, and done ones are deleted): `docs/TICKETS.md`, with one file per ticket in `docs/tickets/`. Up to six agents (A to F) work from it at once. **Before starting any ticket, every agent runs the ticket check** (it fetches `origin/main` and lists the unclaimed tickets; hooks run it at session start and refuse a `feature/<ID>-…` branch for an unclaimed ticket). Each claims the next ticket it can take (open, needs done, no hotspot shared with another agent's claim) and works on it fully in its own worktree. The v3 design ("sight into sound in real time") is `docs/PLAN.md` §6.3. Done and replaced tickets are in `docs/archive/`.
- **Agents ask each other on `docs/AGENT-BOARD.md`.** Need a detail you don't own? Post a request there instead of guessing; at the start of a session, answer open requests addressed to your feature.
- Claude Code also loads the working rules in `.claude/rules/` (workflow, phases, platform, front end, server, git, tickets). Other AI tools: point the agent at that folder.

## Deployment

Two services: the website on Vercel and the server (voice guide, Ask agent, listening-test API and Jukebox orchestrator) on Render.

| What | Where | Live URL |
|---|---|---|
| Website | Vercel, from `vercel.json` | https://nasagurusmoonheist.vercel.app/ |
| Server | Render, from `render.yaml` | https://earth-jukebox-server.onrender.com |

**First deploy**
1. Render: New → Blueprint → this repository. In the dashboard set the secrets `GEMINI_API_KEY`, `STUDY_EXPORT_TOKEN` (long random text) and `CORS_ORIGINS` (the Vercel URL, no trailing slash). Never put them in a file.
2. Vercel: import this repository. It reads `vercel.json` (build `npm run build`, output `dist`). Set the environment variable `VITE_API_URL` to the Render URL, with no trailing slash. Redeploy after changing it, because Vite reads it at build time.
3. Check `https://<render-url>/api/v1/health`, then open the Vercel site and try the voice guide.

**Redeploying:** both services deploy automatically when `main` changes. To redeploy by hand, use "Manual Deploy" on Render and "Redeploy" on Vercel.

**Before any demo:** Render's free tier sleeps when idle and takes up to a minute to wake. Open the health URL a minute before you start.

**Test results:** the free tier's disk is wiped on every restart and deploy. Either use a paid plan with a persistent disk (see the comments in `render.yaml`), or download the CSV after every session: `curl -H "X-Team-Token: $STUDY_EXPORT_TOKEN" https://<render-url>/api/v1/tests/export.csv -o results.csv`.

## Git

- Default branch: `main`
- Remote: `origin` (https://github.com/urhomeboyismail/nasa.git)

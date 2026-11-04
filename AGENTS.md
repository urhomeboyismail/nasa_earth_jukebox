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

Stack: React + TypeScript, built with Vite. A small FastAPI server (`server/`) runs only the voice guide, a Gemini Live bridge ported from FinAssist; the rest of the app works without it.

- Install: `npm install`
- Dev: `npm run dev` (proxies `/api`, including the voice guide WebSocket, to the server on port 8000)
- Build (typecheck + bundle): `npm run build`
- Lint: `npm run lint` (oxlint)
- Test: `npm test` (Vitest + Testing Library, jsdom); `npm run test:watch` while working
- Preview build: `npm run preview`
- Regenerate the fixture dataset: `python3 -I scripts/make_fixture.py` (writes `public/data/fixture/`)

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
- If a change affects layout (markup structure, CSS, spacing, sizing, or anything visible), it must work well on both mobile and desktop:
  - Design mobile first, then widen. Check at least 360 px (phone), 768 px (tablet) and 1280 px (desktop) wide.
  - No horizontal scrolling at any of those widths; content reflows instead of being cut off. Use flexible units (`%`, `rem`, `min()`/`clamp()`) and `flex-wrap`/grid over fixed pixel widths.
  - Touch targets (buttons, sliders, links) are at least 44 × 44 px with space between them; nothing depends on hover alone.
  - Text stays readable without zooming (body at least 16 px) and the page still works at 200% browser zoom.
  - Images and frames scale to fit their container and keep their aspect ratio.
  - On mobile (below 768 px wide) the main navigation sits in a bar fixed to the bottom of the screen, within thumb reach; on tablet and desktop it stays in the header. Leave room for it: page content and floating panels (such as the voice guide) must not be hidden behind the bar, and it must clear the phone's home indicator (`env(safe-area-inset-bottom)`).
  - Say in your PR which widths you checked.
  - To choose and check the layout, follow the responsive-layout skill in `.claude/skills/responsive-layout/SKILL.md` (pattern guide, rules, and a screenshot script for the four widths). Claude Code runs it automatically through a hook after layout edits; with other AI tools, point the agent at that file.

## Deployment

Two services: the website on Vercel and the server (voice guide and listening-test API) on Render.

| What | Where | Live URL |
|---|---|---|
| Website | Vercel, from `vercel.json` | _fill in after the first deploy_ |
| Server | Render, from `render.yaml` | _fill in after the first deploy_ |

**First deploy**
1. Render: New → Blueprint → this repository. In the dashboard set the secrets `GEMINI_API_KEY`, `STUDY_EXPORT_TOKEN` (long random text) and `CORS_ORIGINS` (the Vercel URL, no trailing slash). Never put them in a file.
2. Vercel: import this repository. It reads `vercel.json` (build `npm run build`, output `dist`). Set the environment variable `VITE_API_URL` to the Render URL, with no trailing slash. Redeploy after changing it, because Vite reads it at build time.
3. Check `https://<render-url>/api/v1/health`, then open the Vercel site and try the voice guide.

**Redeploying:** both services deploy automatically when `main` changes. To redeploy by hand, use "Manual Deploy" on Render and "Redeploy" on Vercel.

**Before any demo:** Render's free tier sleeps when idle and takes up to a minute to wake. Open the health URL a minute before you start.

**Test results:** the free tier's disk is wiped on every restart and deploy. Either use a paid plan with a persistent disk (see the comments in `render.yaml`), or download the CSV after every session: `curl -H "X-Team-Token: $STUDY_EXPORT_TOKEN" https://<render-url>/api/v1/tests/export.csv -o results.csv`.

## Git

- Default branch: `main`
- Remote: `origin` (https://github.com/raghavburtony-creator/nasa.git)

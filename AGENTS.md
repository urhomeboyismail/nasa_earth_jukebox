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

## Git

- Default branch: `main`
- Remote: `origin` (https://github.com/raghavburtony-creator/nasa.git)

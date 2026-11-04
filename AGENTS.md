# NASA Guru's Moon Heist

Project instructions for AI coding agents (Claude Code, Codex).

## Overview

Entry for the 2026 NASA Space Apps Challenge (Intermediate/Beginner-Youth; subjects: Arts & Multimedia, Earth Science, Software).

Goal: an "Earth Jukebox" that pairs NASA Earth Information Center (EIC) visual frames with dynamic sonifications generated in real time, making Earth science accessible and multi-sensory (including for blind and low-vision users) by translating sight into sound.

Full brief: see `CHALLENGE.md`.

## Team

- Team leader
- Mohammad Ismail Iftikhar Oozeerally (@urhomeboyismail)
- @bhavish.tb
- Dhruv Bhantoo

## Commands

Stack: React + TypeScript, built with Vite. A small FastAPI server (`server/`) runs only the voice guide, a Gemini Live bridge ported from FinAssist; the rest of the app works without it.

- Install: `npm install`
- Dev: `npm run dev` (proxies `/api`, including the voice guide WebSocket, to the server on port 8000)
- Build (typecheck + bundle): `npm run build`
- Lint: `npm run lint` (oxlint)
- Preview build: `npm run preview`

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

## Git

- Default branch: `main`
- Remote: `origin` (https://github.com/raghavburtony-creator/nasa.git)

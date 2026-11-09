# Workflow

Adapted from ECC `rules/common` (development-workflow, code-review, testing) for Earth Jukebox.

- Before starting, read `AGENTS.md`, `docs/PLAN.md` and your ticket in `docs/TICKETS.md`. Do only that ticket.
- For a feature from the catalogue (F36 onward), follow `tickets.md`: its tickets live in `docs/features/<ID>-<slug>/TICKETS.md`. At the start of a session, check `docs/AGENT-BOARD.md` for open requests addressed to you.
- One ticket per branch: `feature/<ID>-short-name`, `fix/<short-name>` or `chore/<short-name>`, branched from `main`.
- Don't push, open a PR, rewrite history or delete a branch without asking the user first. Local commits are fine.
- Keep changes small. Don't refactor code the ticket doesn't touch.
- Before you say a ticket is done, run the checks and report the real output, failures included:

  ```bash
  npm run lint && npm test && npm run build
  npm run check-data                          # if public/data/ changed
  (cd server && .venv/bin/python -m pytest)   # if server/ or src/pages.ts changed
  ```

- If you add or rename a page, update both `src/pages.ts` and `server/app/assistant/knowledge.py`.
- Work done from 9 Nov 2026 on is hackathon work. If it's a feature, add it to the "During the hackathon" list in `docs/PRE-HACKATHON-WORK.md`.
- Also follow `phases.md`, `platform.md`, `frontend.md`, `server.md`, `git.md` and `tickets.md` in this folder.

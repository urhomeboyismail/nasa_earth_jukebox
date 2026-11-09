# F<ID> <Feature name>: tickets

- **Card:** [`docs/planning/BRAINSTORM-9NOV.md`](../../planning/BRAINSTORM-9NOV.md) → F<ID>
- **Owner:** <person> (agent: <Claude Code / Codex>)
- **Status:** tickets written | in progress | done
- **Why this many tickets:** <one line: why it can't be fewer>

## T1: <short title>

- **Goal:** <one sentence>
- **Independent of:** <say that it builds on `main` as it is today; or name the unavoidable order and how this ticket still merges on its own>
- **Branch:** `feature/F<ID>-T1-<slug>`
- **Files:** <paths, inside one owner's area where possible>
- **Steps:**
  1. …
- **Done when:**
  - …
  - Layout checked at 360, 768 and 1280 px (if it changes layout)
- **Checks:** `npm run lint && npm test && npm run build` (plus `npm run check-data` if `public/data/` changed; `cd server && .venv/bin/python -m pytest` if `server/` or `src/pages.ts` changed)
- **Status:** [ ] not started · [ ] in progress · [ ] done (branch and commit)

<!-- Add T2 only if the feature can't be done in one ticket. Say why in "Why this many tickets". -->

## Open questions

| Board entry | Question | Answer |
|---|---|---|
| R-<YYYYMMDD>-F<ID>-<n> | | |

# Audit follow-up tickets (9 Nov 2026)

For a Claude Code agent (Sonnet 5.5, medium effort). Do the tickets **in order**, one at a time. Before starting, read `AGENTS.md` and load the `jukebox-dev` skill. Each ticket says when it's done; stop and report after each one.

Ground rules for all tickets:
- Don't push, open PRs, or delete branches without asking the user first. Local commits are fine.
- Don't change behaviour beyond what the ticket says. Don't touch `brainstorm/`, `docs/planning/`, or T85/T87 work.
- Verification for every ticket: `npm run lint && npm test && npm run build`, plus `(cd server && .venv/bin/python -m pytest)` if `server/` or `src/pages.ts` changed. Report the real output; if something still fails, say so.
- Commit messages end with the attribution line from your system reminder.

---

## A1. Split the working tree into per-ticket branches

The checkout is on `feature/T116-m3e-foundations` with uncommitted changes from several tickets mixed together. Separate them so each branch holds one ticket's work.

1. Run `git status` and `git diff --stat`. Group every changed or untracked file by ticket using `docs/TICKETS.md` and `docs/planning/MERGE-VERDICT.md`. Expected groups (check, don't assume):
   - **T116 design system:** `src/components/*`, `src/styles/*`, `src/index.css`, `public/fonts/`, `docs/ui-overhaul/`.
   - **Voice guide fix:** `server/.env.example`, `server/app/api/assistant.py`, `server/app/config.py`, `server/tests/test_assistant.py` → branch `fix/voice-guide-live-api-version` (it already exists; check it first).
   - **T88b player, data table, Ask:** `src/features/player/*`, `src/features/ask/`, `docs/planning/MERGE-VERDICT.md`.
   - **Data and docs:** `public/data/index.json`, `src/data/change-regression.test.ts`, `docs/evidence/`, `docs/tests/`, `AGENTS.md`, `docs/PLAN.md`, `docs/TICKETS.md`, the deleted `Earth_Jukebox_Five_Person_Step_by_Step_Plan.pdf`.
   - `.claude/skills/jukebox-dev/` and `TICKET.md`: tooling, own branch `chore/agent-skills`.
2. **Show the user the grouping and wait for their OK** before moving anything. Ask about any file whose ticket is unclear, and about whether the PDF deletion is intended.
3. Before you move anything, back up the whole tree: `git stash push --include-untracked -m "audit-backup"` then `git stash apply`. Then for each group: create the branch from `main` (or check out the existing one), carry over only that group's files (`git checkout stash@{0} -- <paths>`, or patch files for untracked ones), and commit. Never lose a change: when you finish, `git stash list` still holds the backup.
4. A file edited for two tickets (e.g. `docs/TICKETS.md`): put it on the branch whose ticket owns most of the change and tell the user.

**Done when:** every change is committed on exactly one branch, the backup stash still exists, and you've listed the branches with the files on each.

---

## A2. Get the suite green and lint clean

Work on the branch that holds `public/data/index.json` (from A1), or a new `fix/green-suite` branch from it.

1. **Data set count.** `src/App.test.tsx` ("offers every data set, starting on the first") and `src/components/DatasetPicker.test.tsx` ("has a labelled choice with every data set…") expect 4 data sets; `public/data/index.json` now has 5. If the 5th entry is intended (check `npm run check-data` passes for it), update both tests to the new list. If it isn't, ask the user.
2. **Regression timeout.** `src/data/change-regression.test.ts` "gives the same Score every time" takes ~11 s against the 5 s limit. Find why it's slow (running the full analysis more than needed?). Make it faster if you can without weakening what it checks; otherwise give that one test a per-test timeout (e.g. `30_000`). Do not raise the global timeout.
3. **Lint warnings in `src/features/explore/Explorer.tsx`:**
   - line 41: move the non-component export to its own module (e.g. `explorerUtils.ts`) and update imports;
   - line 75: remove the synchronous `setState` in the effect (derive the value during render or set it in the event that causes it);
   - line 91: copy `ref.current` to a local variable inside the effect and use that in the cleanup.
   Keep behaviour identical; the explorer tests must still pass.
4. **Test speed.** In `vitest.config.ts` try `pool: 'vmThreads'`. Keep it only if the whole suite still passes and gets faster; note the before/after durations.

**Done when:** `npm run lint` shows 0 warnings, `npm test` passes all tests, `npm run build` passes. Commit.

---

## A3. Lazy-load pages to shrink the main bundle

Branch `perf/lazy-pages` from `main` (rebase onto A2 if it's merged first).

The main chunk is 460 kB (145 kB gzip) plus `esm-*.js` at 341 kB. The demo has to load fast on a phone (T85 speed check).

1. Run `npm run build` and record the chunk sizes.
2. Find what `esm-*.js` is (check `dist/assets` and the imports). If it's only used by one page or feature, make sure it loads only there.
3. In the router (`src/App.tsx` / `src/route.ts`), load each page except Home with `React.lazy` + `Suspense`. The fallback must be accessible: a short visible "Loading…" text with `role="status"`, and it must not shift the layout or cover the bottom nav on mobile.
4. Update tests that break because pages now load asynchronously (use `findBy…` queries). Keep `expectNoA11yViolations` checks.
5. Rebuild and record the new sizes.

**Done when:** the initial JS (what Home loads) is clearly smaller, all checks pass, and you report before/after sizes. This changes what's visible while loading, so follow the `responsive-layout` skill and check 360, 768 and 1280 px.

---

## For the team (not for the agent)

- Record the Render URL in the deployment table in `AGENTS.md`. Check that `VITE_API_URL` on Vercel matches it, and try the voice guide on the live site.
- T85 speed measurements on a real laptop and phone, due **10 Nov**.
- Keep T116–T119 (UI overhaul) behind T85 and T87; they're cut first if time runs short.

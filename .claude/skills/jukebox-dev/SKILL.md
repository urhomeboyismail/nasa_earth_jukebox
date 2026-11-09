---
name: jukebox-dev
description: Project workflow for Earth Jukebox (React + TypeScript + Vite front end, FastAPI voice-guide server). Use when building a feature, fixing a bug, writing tests, or reviewing changes in this repo. Picks the right ECC skill for the job and overrides its generic advice with this project's conventions.
---

# Earth Jukebox development

ECC skills are generic. Use them for technique, but where they disagree with this file, **this file wins**. Read `AGENTS.md` and `docs/PLAN.md` (and the ticket in `docs/TICKETS.md`) before starting.

## Which ECC skill to load

| Task | Load | Project overrides |
|---|---|---|
| New feature / ticket | `ecc:tdd-workflow` | Tests sit next to code (`x.ts` → `x.test.ts`), Vitest not Jest. Skip its 80% coverage gate; cover behavior the ticket names. |
| React components, hooks | `ecc:react-patterns`, `ecc:react-performance` | Plain React + Vite: ignore Next.js / server-component advice. Match the feature-folder layout in `src/features/<name>/`. |
| Component tests | `ecc:react-testing` | See "Tests" below. |
| Accessibility (core to this project: blind and low-vision users) | `ecc:frontend-a11y`, `ecc:accessibility` | Every rendered test calls `expectNoA11yViolations`. Sound must have a text/description equivalent and keyboard controls. |
| Vite config, build, env | `ecc:vite-patterns` | Env vars read at build time (`VITE_API_URL`); dev proxies `/api` to port 8000. |
| Server (`server/`) | `ecc:fastapi-patterns`, `ecc:python-testing` | Server only runs the voice guide and listening-test API; keep it small. Never commit `.env`. |
| Layout / CSS | project `responsive-layout` skill | Mobile first; check 360/768/1280 px; bottom nav on mobile. |
| Before a PR | `ecc:verification-loop` | Use the commands below instead of its generic ones. |
| Review | `/code-review`, `ecc:react-review`, `ecc:fastapi-review` | — |

Skip ECC skills about Next.js, databases, Django, Kotlin, etc.: not used here.

## Tests

- Testing Library queries by role/name (`getByRole('button', { name: 'Play' })`), never class or test id; `userEvent` for input.
- jsdom has no `AudioContext`/`Worker`: use `installFakeAudioContext()` / `installFakeWorker(handler)` from `src/test/fakes.ts`, and `uninstall()` after. Sound code goes through the sound engine's fake like the player tests.
- Mock `fetch` with `vi.stubGlobal` and restore in `afterEach` (see `src/App.test.tsx`).
- Realistic data: `public/data/fixture/manifest.json`.
- Template to copy: `src/test/a11y.test.tsx`.

## Verify before saying done

```bash
npm run lint && npm test && npm run build
npm run check-data                     # if public/data changed
(cd server && .venv/bin/python -m pytest)   # if server/ or src/pages.ts changed
```

If you add or rename a page, update both `src/pages.ts` and `server/app/assistant/knowledge.py`.

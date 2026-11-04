# Bhavish tickets (light)

Stereo panning, CI, deployment, the results summary and the submission README.

Files you own: `src/audio/pan.ts`, `.github/`, `render.yaml`, `vercel.json`, `scripts/summarize_results.py`, the root `README.md`.

---

## T20: Stereo panning values (M3, should)

**Files:** `src/audio/pan.ts`, `src/audio/pan.test.ts`.

**Do:** write a pure function, `panFor(region): number` from −1 (west) to +1 (east), based on where the region's sample points sit across the image, and `panForPoint(x): number` for single points. The engine already accepts `pan` (T00's interface), so the player only needs to pass your value. Tell Mohammad when it's merged.

**Done when:** tests cover the west edge, the east edge, the center, and an empty region (returns 0).

---

## T21: Continuous integration (M2)

**Files:** `.github/workflows/ci.yml`.

**Do:** on every PR and every push to `main`:
- `npm ci`
- `npm run lint`
- `npm run build`
- `npm test`
- in `server/`: `pip install -r requirements.txt` then `python -m pytest`

Use Node 22 and Python 3.12, and cache npm and pip.

**Done when:** a PR shows a green check, and a deliberately broken test turns it red.

---

## T22: Deployment: Render and Vercel (M2)

**Files:** `render.yaml`, `vercel.json` (only if needed), and a "Deployment" section in `AGENTS.md`.

**Do:**
1. **Render:** a web service rooted at `server/`.
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Health check: `/api/v1/health`
   - Set `GEMINI_API_KEY` and `STUDY_EXPORT_TOKEN` as secrets in the dashboard, never in the file. Set `CORS_ORIGINS` to the Vercel URL.
2. **Vercel:** build `npm run build`, output `dist`. Set `VITE_API_URL` to the Render URL (T00 already reads it).
3. Write down both live URLs, how to redeploy, and that Render's free tier sleeps when idle (wake it a minute before any demo).

**Done when:** the live Vercel site loads, and its voice guide reaches the Render server.

---

## T23: Results summary (M3)

**Files:** `scripts/summarize_results.py`, `scripts/fixtures/sample_results.csv`.

**Do:**
1. Make a small fake CSV matching the export in PLAN.md §5.5, so you can build this without waiting for real data.
2. From it, print, per comparison and overall:
   - number correct out of total
   - median response time
   - average confidence
   - the same numbers split by participant group
3. Save a simple bar chart as a PNG for the pitch. Report the numbers exactly, including small samples.

**Done when:** it runs on the sample CSV and the output could go straight on a slide.

---

## T24: Submission README and AI-use disclosure (M5)

**Do:**
1. Rewrite the root `README.md` for judges: what it is, the live URLs, how to run it, data credits, how the sound mapping works, the test results, and the limits.
2. Collect each member's AI-use notes (PLAN.md §10) into one disclosure section.
3. Check every link in a private browser window.

**Done when:** the README is merged before the submission deadline, and every link works.

# Earth Jukebox (NASA Guru's Moon Heist)

Hear NASA Earth data. The Earth Jukebox turns dated NASA maps into **sound and text at the same time**, so blind and low-vision people can explore Earth science that is usually only a picture. Entry for the 2026 NASA Space Apps Challenge (categories: Arts & Multimedia, Earth Science, Software).

**Live site:** https://nasagurusmoonheist.vercel.app. It runs on phones and desktops and can be installed from the browser.

> This project is not endorsed by NASA. It uses NASA data and imagery and credits them below.

## What you can do

- **Listen:** play a data set date by date. Each date is a note (higher is warmer), with the place on the map heard left to right. Explore the map yourself with the keyboard, a finger or a mouse, lock one place and hear it change across the dates, read the same information as a data table, and download the sound as a WAV file.
- **Learn:** hear every sound once, with its words.
- **Compare:** pick two dates, listen, answer, and see the reveal.
- **Ask:** questions about the data, answered from the data, with no server.
- **Voice guide (optional):** a spoken guide that can explain a page and play or step the dates. Everything else works without it.

How the sound is made, and why, is in [`docs/CREATIVE_PROCESS.md`](docs/CREATIVE_PROCESS.md).

## Status

What the app does today, what is designed but not built, and what has not been started. The design is in [`docs/PLAN.md`](docs/PLAN.md) §6.3.

| Built now | Planned (`docs/PLAN.md` §6.3) | Not started |
|---|---|---|
| Listen with three sound styles: Simple, Full and Change from normal | A live ensemble that follows the playing EIC animation frame by frame, with one voice for each job (level, mix, change, hot spots, edges, motion, time) | A listening test with blind or low-vision people |
| The sound map: explore by keyboard, finger or mouse; lock one place across the dates | A feature extractor that reads hot spots, edges and motion from each frame, including from video | Checks on real phones |
| Learn, Compare and Ask, with a data table and text for every sound | Scan mode: sweep a frame so its shapes become audible | More NASA data sets from the Earth Information Center, beyond the Mauritius one |
| Download the sound as a WAV file; a scripted demo tour | Playing the map: follow a hot spot, find the warmest place by ear, predict then hear, compare dates left and right | A voice guide built on Google's Agent Development Kit |
| An optional voice guide (Gemini Live) | Offline rendering of every data set to WAV with a captions file | |

## Run it

Needs Node.js. The voice guide also needs Python and a Gemini API key; the rest does not.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit and accessibility tests
npm run build      # typecheck and bundle
npm run check-data # validate every data set in public/data/index.json
```

Voice guide (optional), from `server/`:

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env    # then set GEMINI_API_KEY
.venv/bin/uvicorn app.main:app --port 8000
```

## NASA data and credits

Each data set names its source, credit and licence in its own `manifest.json` and is described in [`docs/data-sources.md`](docs/data-sources.md). The real data set so far is **sea surface temperature around Mauritius, 2023**, from the GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis (v4.1), as drawn by NASA GIBS. Its suggested citation, from the PO.DAAC dataset page: *JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis. Ver. 4.1. PO.DAAC, CA, USA. Dataset accessed 2026-11-07 at https://doi.org/10.5067/GHGMR-4FJ04.*

> We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS).

The other data sets in the list (`fixture`, `synthetic-*`) are made-up practice data and say so on screen.

## How it was made

- **Creative process:** [`docs/CREATIVE_PROCESS.md`](docs/CREATIVE_PROCESS.md).
- **Sound choices and the research behind them:** [`docs/SOUND_MAPPINGS.md`](docs/SOUND_MAPPINGS.md).
- **Plan, tickets and what was built when:** [`docs/PLAN.md`](docs/PLAN.md), [`docs/TICKETS.md`](docs/TICKETS.md), [`docs/PRE-HACKATHON-WORK.md`](docs/PRE-HACKATHON-WORK.md).
- **Adding a NASA data set:** [`docs/DATASET-PLAYBOOK.md`](docs/DATASET-PLAYBOOK.md).
- **How to work on it:** [`AGENTS.md`](AGENTS.md) and the rules in [`.claude/rules/`](.claude/rules/).

Stack: React, TypeScript and Vite; Tone.js for sound; a small FastAPI server for the optional voice guide and the listening-test API. The analysis, sound and text code is deterministic: the same picture always gives the same sound and words, and none of it needs the server.

## AI tools

- **Google Gemini Live** runs the optional voice guide. It can reword and use a short list of allow-listed actions (go to a page, play, pause, step a date, read the screen). It never touches the analysis, the sound or the descriptions, and the app works with it switched off.
- **Claude Code and Codex** (coding assistants) helped write code, tests and documents. The sound itself is computed by rules in the code: no AI model sits between a picture and what you hear. The team reviews what the assistants write.
- **The art:** the mascot, Echo, is our own SVG drawing (`src/components/Mascot.tsx`). If an AI image tool is ever used for any art, it will be named here.

## Limits

- **Not yet tested with blind or low-vision users.** No test session has been run yet, so n = 0 (see [`docs/evidence/`](docs/evidence/)). We make no claim about how well it works for them until it has.
- The app reads colours from NASA's rendered maps, not NASA's data files, so values are approximate.
- The practice listening test has not been run, so we cannot yet say which sound style listeners find clearer.
- The "change from normal" sound has not had its listening check, so it is opt-in.
- The checks on real phones are not done yet. Vibration does not work on iPhones.
- The voice guide's server sleeps when idle (free hosting) and can take up to a minute to wake. The rest of the app does not use it.
- Test results are saved on the server's disk, which the free tier wipes on every restart; download the CSV after each session.

## Team

Mohammad Ismail Iftikhar Oozeerally, Dhruv Bhantoo, Roni, Bhavish and the team leader.

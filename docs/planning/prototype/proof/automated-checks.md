# Automated checks (what the team has run, not user results)

TL;DR: These are machine checks and scripted browser runs. They show the app behaves as designed. They do **not** show a blind person can use it. See `proof/results-note.md`: no session has been run.
Last run: 2026-11-07.

| Suite | Command | Result |
| --- | --- | --- |
| App (sound plan, engine, player, picture, hides, Q&A, offline packaging) | `cd app && npm test` | 107 passed, 0 failed |
| Story and facts contract (validator, 16 broken-copy tests) | `python3 -I -m unittest discover -s contract` | 19 passed |
| Real data outputs (pipeline) | `python3 -I pipeline/test_pipeline.py` | 16 passed |
| Agent guards (fake model only) | `cd agent && .venv/bin/python -m unittest discover -s .` | 21 passed |
| axe-core in jsdom | inside the app suite | 0 serious or critical issues. Colour contrast is not testable there |

## Real-browser runs (desktop Chrome, scripted real clicks, nobody listening)
- Player: Play, key-moment stops, gap stop, Continue, mode switch (silent, leaves playback paused). One live message per stop, none between.
- Picture and data table, "What the sound hides", Ask section (reported by the building agents; see `brainstorm/reports/`).
- Offline: service worker active, 46 files cached; with the web server stopped, a reload showed the full page with the real story and Play worked.

## Not done
- No one has heard the output, so the pitch, timing and levels are untuned (W3).
- No screen reader (NVDA, TalkBack, VoiceOver) has been used on any section (W7).
- Android Chrome, Safari and iOS not run; the iOS silent switch is untested.
- Colour contrast not measured by a tool. Light mode not checked.
- The Gemini agent has never run against a real model (W5).
- Public deploy not done; the GitHub Pages workflow has never run.

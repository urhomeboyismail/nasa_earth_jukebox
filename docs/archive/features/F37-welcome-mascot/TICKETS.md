# F37 Welcome mascot and onboarding: tickets

- **Card:** [`docs/planning/BRAINSTORM-9NOV.md`](../../planning/BRAINSTORM-9NOV.md) → F37
- **Owner:** Roni (agent: Claude Code)
- **Status:** done
- **Why this many tickets:** the welcome (first visit, three paths, sound check) is one self-contained piece on Home. Per-page help and the demo host touch the app shell and `DemoControl`, which belong to other owners (`docs/PLAN.md` §4), so they are a second ticket. Two is the card's own minimum.
- **The mascot:** both tickets use **Echo** (`src/components/Mascot.tsx`, concept in `docs/design/mascot-concepts.html`), the astronaut we already have, in place of the card's yellow "Orbi". Echo is our own design, so there is no Minion or NASA-insignia risk, and the app already uses it beside the voice guide. The name is one constant (`MASCOT_NAME` in `src/features/welcome/lines.ts`), so the team can still rename it. See board entry R-20261109-F37-1.

## T1: Welcome, the three paths and the sound check

- **Goal:** on a first visit Home shows an inline welcome from the mascot with three paths and a sound check; each path sets its defaults, and a second visit does not show it again.
- **Independent of:** builds on `main` as it is today. No other ticket is needed first.
- **Branch:** `feature/F37-T1-welcome`
- **Files:** `src/features/welcome/` (new: `Welcome.tsx`, `storage.ts`, `lines.ts`, `speak.ts`, `welcome.css`, tests), `src/features/home/index.tsx` (lazy-loads the welcome), `src/features/player/usePlayer.ts` (starts at the volume chosen in the sound check), `docs/features/`, `docs/PRE-HACKATHON-WORK.md`.
- **Steps:**
  1. `storage.ts`: the choice under `earth-jukebox:welcome` (`path`, `speech`, `volume`, `done`), read and written in try/catch with an in-memory fallback, like `src/audio/style.ts`.
  2. `Welcome.tsx`: Echo, one line of greeting and three large buttons ("I use a screen reader", "I can see the map", "Just play me something"). "Skip" comes first in focus order. It is inline, not a modal.
  3. The sound check, after a path is chosen and only after a click: one note, then left (pan -1), right (pan +1) and centre (pan 0), each with Yes, No and Replay; then "Is this volume comfortable?" with a volume slider. A "Skip the sound check" button is always there. Every step is announced through `useAnnounce`.
  4. Defaults: screen reader → concise descriptions, no speech, go to Learn; map → rich descriptions, the mascot may speak (`speechSynthesis`, only after this click), go to Listen; just play → go to Listen and press play. Focus lands on the new page's heading.
  5. Nothing sounds or speaks before a click. Animation only under `prefers-reduced-motion: no-preference`.
  6. Tests with the fake engine, axe, and the three widths.
- **Done when:**
  - The first visit shows the welcome and a second does not.
  - Each path sets its defaults and moves focus to the right heading.
  - The sound check plays pans of -1, +1 and 0 through the fake engine, and nothing plays before a gesture.
  - Skip is first in focus order; axe passes; checked at 360, 768 and 1280 px and with reduced motion.
  - With the server off everything works (it does not use the server).
- **Checks:** `npm run lint && npm test && npm run build`
- **Status:** [ ] not started · [ ] in progress · [x] done (branch `feature/F37-T1-welcome`)

## T2: "Help from Echo" on every page, the off switch and the demo host

- **Goal:** a small help button in the same place on every page gives one tip for that page and can bring the welcome back; a setting turns the mascot off; the demo caption shows the mascot's face.
- **Independent of:** needs T1 merged first (unavoidable: it resets T1's stored choice through `resetWelcome()`, and Home hides the welcome when the mascot is off). It changes T1's files only in `src/features/home/index.tsx`, by one condition.
- **Branch:** `feature/F37-T2-help`
- **Files:** `src/features/help/` (new), `src/App.tsx` (one button, in the same place on every page), `src/features/demo/DemoControl.tsx` and `demo.css`, optionally `server/app/assistant/knowledge.py` (persona text only).
- **Steps:**
  1. `tips.ts`: one tip for each page in `pages`, naming no data set. A test fails when a page has no tip.
  2. `HelpButton.tsx`: the same place on every page (WCAG 3.2.6), 44 px target, opens an inline panel with the tip, "Show the welcome again" and "Turn the mascot off". Focus is never hidden behind the voice guide or the bottom bar (WCAG 2.4.11).
  3. The off switch is remembered under `earth-jukebox:mascot`; when it is off the welcome and the face on the demo caption are not shown, and the help button stays (it is the way back).
  4. Put the mascot's face next to the demo caption.
  5. Server persona text (name and tone) in `knowledge.py`, with the same 5 tools and the page list unchanged.
- **Done when:** the button works by keyboard on every page; each page gives its own tip; the welcome comes back after "Show the welcome again"; with the mascot off, neither the welcome nor the demo face shows; axe passes; checked at three widths.
- **Checks:** `npm run lint && npm test && npm run build`, and `cd server && .venv/bin/python -m pytest` if `server/` changed.
- **Status:** [ ] not started · [ ] in progress · [x] done (branch `feature/F37-T2-help`, built on T1)

## Open questions

| Board entry | Question | Answer |
|---|---|---|
| R-20261109-F37-1 | Name and art | Proposed: keep Echo, already drawn as SVG in the repo. Waiting for the team. |

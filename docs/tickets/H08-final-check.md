# H08 Final check: keyboard, NVDA and VoiceOver, server off

| | |
|---|---|
| **Priority** | P3 |
| **Size** | M (about a day) |
| **Who** | 👤 |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `chore/H08-final-check` |

## Goal

Before the submission, a person checks the whole app as a keyboard user and as a screen-reader user (NVDA on Windows, VoiceOver on a Mac and on an iPhone), with the server off. Every fault found is written down with a fix ticket. This ticket fixes nothing.

## Why

- The accessibility claim is the product (`.claude/rules/frontend.md`). The automated checks (axe in jsdom) cannot check colour contrast, focus order in a real browser, or what a screen reader actually says.
- The app must work with the server off (`AGENTS.md`: "the app works without it"). The Ask panel and the Listen page must still work, and the voice guide must fail in plain words.
- Several recent tickets change focus and announcements (I01, V01, V03). They need a real check.
- `docs/PLAN.md` §9 and `docs/evidence/results-note.md` need a dated record of what was checked.

## What to do

### Setup

1. Use the production build (`npm run build && npm run preview`), or the live site. Note the commit or the URL.
2. Run with the server **off**: no server process, and `VITE_API_URL` unset. Then, once, with the server on (a test key or the team's key), for the voice guide only.
3. Keep a log: date, browser and version, screen reader and version, the step, what happened, and pass or fail.

### Keyboard journey (no mouse, no touch)

Do the whole visit with Tab, Shift+Tab, Enter, Space and the arrow keys:

1. Home: skip link, the nav bar, the help button, the demo control, the voice guide button.
2. Learn: every example plays on Enter or Space, and the page's text is reachable in order.
3. Listen: Play, Pause, Stop, Replay, the date slider (arrow keys), speed, volume, the sound map keys (arrow keys, `L` to lock), the Ask panel (type a question, press Enter, use a suggested question button), the data table.
4. Compare: pick two dates, play each, answer, reveal.
5. About: every heading is reachable; the links work.
6. Alt+E opens and closes the voice guide (V01, if merged). Escape closes its panel. Focus returns to the button that opened it.
7. Every control has a visible focus ring and a name. Nothing traps focus.

### NVDA (Windows, Chrome or Firefox) and VoiceOver (macOS Safari, iPhone Safari)

For each page:
- The page title is announced when the page opens.
- Changing the date on Listen announces the date once, not twice.
- Starting and stopping playback announces the change once.
- The Ask answer is announced once, with its confidence line.
- The voice guide: opening it announces its title; the status line is announced only for "connecting", errors and "ended" (V03); the Echo did list and the Undo button have sensible names (V01).
- With the server off, the voice guide's error says "Echo could not connect. The rest of the app still works." (V01), and no developer text is read.
- Welcome and Help announcements reach the screen reader (I01).

### Server off

- Every page loads and works (the Ask panel answers from the offline matcher and says "Answered offline").
- The voice guide's error is plain (see above).
- No page shows a raw error (for example a data error message with a file name), unless I03 has not yet been merged; in that case write it down as a fault.

## Writing it down

Write `docs/tests/<YYYY-MM-DD>-final-check.md` (new, dated) with:

- The setup: commit or URL, browsers, screen readers and versions, server on or off.
- A table: area, step, result (pass, fail or not run), and a note.
- Each fail, as one line, with the ticket or board entry that will fix it. Open a board entry for each one that has no ticket.
- The overall verdict: "ready" only if no fail is left open, and "not ready" otherwise.

## Done when

- The dated file exists, with every area in the lists above marked pass, fail or not run.
- Each fail has a ticket or a board entry.
- The verdict line is written, and it is "ready" only when no fail is open.

## Checks

```bash
git status --short docs/tests          # only the new dated file
grep -rnE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/tests   # must print nothing
```

## Guardrails

Do not leave the sound on for long. Turn the volume down before listening to a screen reader. No flashing.

## Out of scope

- Fixing faults (tickets).
- Testing with real listeners (H03). This is a check of the interface and the screen reader, not of the sound.
- Layout checks for phone and desktop. Those are the team lead's one layout pass (`.claude/rules/platform.md`), so do not report widths here.

## Result

Not started.

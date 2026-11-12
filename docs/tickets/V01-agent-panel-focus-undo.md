# V01 Agent panel: focus not stolen, "Echo did" with Undo, Alt+E, Stop talking

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | app, voice |
| **Branch** | `feature/V01-agent-panel-focus-undo` |

## Goal

When the voice guide moves the app, the listener keeps their place: focus stays where it was, and a short line says what happened. The panel lists what Echo did in this conversation, with an Undo for the latest step. A key opens and closes the panel, a button stops the guide talking, and errors say what happened in plain words.

## Why

- `src/App.tsx:114-121` moves focus to the page heading on every page change, including a change the guide made. A screen-reader user who asked for a page is moved away from the panel they are typing in.
- The voice panel has no record of what the guide did. An action leaves no trace except the page change.
- The panel can be opened only by clicking the header button (`src/App.tsx`, the `app-guide-toggle` button). There is no keyboard shortcut.
- The only way to stop the guide talking is to end the conversation. `src/VoiceAssistant.tsx` has End conversation and a Close button, and Escape closes the panel (`onKeyDown`, about line 64), which ends the conversation.
- Errors are developer text: "The voice guide could not connect. Check that the service is running." (`src/hooks/useVoiceAssistant.ts`, `ws.onerror`) and "The voice guide stopped unexpectedly." Also `src/VoiceAssistant.tsx` shows "Try again" even when the server says `not_configured` (about line 131), where a retry cannot help.
- The ended reason from the server (`time_limit`, `service_ended`, `closed`) is received and then ignored (`useVoiceAssistant.ts`, `case "ended"`).
- `handleAssistantAction` in `App.tsx` (about line 135) does the navigation and the player command. Nothing remembers the step before it.

## Design

### Focus (App)

- Focus moves to the page heading only when the page changed because of the listener: a nav link, the skip link, the brand, or the browser's back and forward. It does not move when the guide navigated.
- Implementation: `handleAssistantAction` sets a ref `guideNavigated` before calling `goTo`. The page effect (`App.tsx:114-121`) checks the ref, skips the focus when it is set, and clears it.
- The guide's new page is announced by the panel's own live region (see "Echo did"), not by moving focus.
- A `setDate` command moves no focus. Check that `src/features/player/` does not move focus for a player command. If it does, stop and post on `docs/AGENT-BOARD.md`: the player is another ticket's hotspot.

### "Echo did" (the panel)

- The hook (`src/hooks/useVoiceAssistant.ts`) records each action it receives as `{ id, label, inverse }`:
  - `label` in plain words, for example "Opened Listen", "Paused", "Played", "Went to 15 July 2024". Use the page titles from `src/pages.ts`.
  - `inverse`, the action that undoes it: navigate → back to the page that was showing (`pageRef.current` before the navigation); `play` ↔ `pause`; `setDate` → the previous date from `currentContext()` (the `player` payload's `date`), when known. `stop`, `replay`, `next` and `previous` have no inverse.
- The panel shows the list as a real `<ul aria-label="Echo did">` of the last 10 entries, with the newest last.
- **Undo** is a button on the latest entry only, when it has an inverse. Its accessible name includes the label: "Undo: Opened Listen". It is at least 24 by 24 CSS pixels (WCAG 2.5.8) and uses the existing `Button` component.
- Pressing Undo sends `inverse` through the same `onAction` path as a server action, then records a new entry "Undid: <label>" with no Undo button. Undo does not undo itself.
- "Works by voice and text too" means: an action asked for by voice or by a typed question appears in the list and can be undone. It does not mean a spoken "undo that" (that needs a new tool on the server, which is not in this ticket). Post a board request if the team wants it.
- A visually hidden `<p aria-live="polite">` shows the label of the newest entry, so a screen reader hears "Opened Listen" once when the guide acts.

### Alt+E and aria-keyshortcuts (App)

- A window `keydown` listener in `App.tsx`: Alt+E toggles the panel (open if closed, close if open, as the header button does).
- It does nothing when the event target is an `input`, `textarea`, `select` or a `contenteditable` element, so typing "e" with Alt held in a field is not hijacked.
- The header button gets `aria-keyshortcuts="Alt+E"`.
- Closing with the shortcut has the same effect as the Close button (the conversation ends, and focus returns to the button, as now).

### Stop talking and Escape (the panel and the hook)

- A **Stop talking** button is shown while the status is `speaking`. It calls a new hook function `stopSpeaking()`: it flushes the speech player (`player.current?.flush()`, `src/assistant/audio.ts`) and sets the status back to `listening`. The conversation stays open. Say in the code comment that the server may still finish its turn, but the sound is cut here.
- Escape still closes the panel, as the Close button does. It does not stop speech separately, so there is one way to close and one way to stop talking.

### Plain errors and the ended reason

Replace the developer text with these strings (exact wording):

| Situation | Text shown |
|---|---|
| WebSocket error (`ws.onerror`) | "Echo could not connect. The rest of the app still works." |
| Server `upstream` error | "Echo stopped unexpectedly. The rest of the app still works." |
| Server `busy` | "Echo is busy with other conversations. Try again in a minute." |
| Server `time_limit` ended | "This conversation reached its time limit. Start again to keep talking." |
| Server `service_ended` ended | "Echo finished the conversation." |
| Server `closed` ended | "The conversation has ended." |

- The hook stores the server's error `code` and the ended `reason`.
- "Try again" is hidden when the code is `not_configured` or `bad_start`, and shown otherwise.
- The microphone messages are not in this ticket: V02 rewrites them.

## Reuse

- `src/components` (`Button`, `IconButton`, `Notice`), `src/components/useAnnounce.ts` if you need it, `src/pages.ts`, `src/route.ts` (`hashFor`), `src/assistant/context.ts` (`currentContext`), `src/assistant/audio.ts` (`SpeechPlayer.flush`).
- `src/VoiceAssistant.test.tsx` and `src/hooks/useVoiceAssistant.test.ts` for the test style.
- `src/test/a11y.ts` (`expectNoA11yViolations`).

## Touches

- `src/App.tsx` (focus rule, `guideNavigated`, Alt+E listener, `aria-keyshortcuts`)
- `src/hooks/useVoiceAssistant.ts` (action records, `stopSpeaking`, error code and reason, plain messages)
- `src/VoiceAssistant.tsx` (Echo did list, Undo, Stop talking, Try again rule, the live region, Escape unchanged)
- `src/VoiceAssistant.test.tsx`, `src/hooks/useVoiceAssistant.test.ts`, `src/App.test.tsx` (new cases)
- `src/assistant/` styles, if a class is needed (use existing tokens)

Do not change `src/features/player/`. Do not add a server message type.

## Steps

1. Read `App.tsx`, `useVoiceAssistant.ts` and `VoiceAssistant.tsx` in full. Note the current line numbers in **Result**.
2. Hook: store the error code and reason, the plain messages, the action records, and `stopSpeaking`.
3. Panel: the list, Undo, the live region, Stop talking, the Try again rule.
4. App: the focus rule and the Alt+E listener.
5. Tests (below). Run the checks.

## Tests

Vitest and Testing Library, `userEvent`, `expectNoA11yViolations` on the panel in each state.

1. A server action `navigate` to Listen: focus does not move to the heading (`document.activeElement` is unchanged), and the live region reads "Opened Listen".
2. The same navigation by the listener's own nav link moves focus to the heading (existing behaviour).
3. The list shows "Opened Listen"; the Undo button's accessible name is "Undo: Opened Listen"; pressing it sends navigate back to the previous page through `onAction`; the list then shows "Undid: Opened Listen" with no Undo button.
4. A `pause` followed by Undo sends `play`. A `stop` has no Undo button.
5. The list keeps the last 10 entries.
6. The Undo button is at least 24 by 24 CSS pixels (check the class's declared size in the stylesheet by reading the file in the test, or state it in the design token; the test must fail if the size is removed).
7. Alt+E opens the panel; Alt+E again closes it. Alt+E typed inside a text field does nothing.
8. `aria-keyshortcuts="Alt+E"` is on the header button.
9. Stop talking appears only while speaking; pressing it calls the flush and the status becomes `listening`; the panel stays open.
10. Escape closes the panel (same as Close).
11. Error texts: a socket error, an `upstream` error and a `busy` error show the exact strings in the table.
12. "Try again" is not shown after `not_configured` and is shown after `upstream`.
13. The ended reasons show the exact strings in the table.
14. `expectNoA11yViolations` on the panel with the list, with Undo, and in the error state.

## Guardrails

The Stop talking button cuts the guide's sound at once. Nothing else plays sound in this ticket. Announcements go through the live region and `useAnnounce`, never through a second message. No motion: the list and the buttons do not animate.

## Done when

- The guide's navigation no longer moves focus, and the listener hears what happened.
- The list and Undo work for every action with an inverse, and only for those.
- Alt+E and Stop talking work from the keyboard, with the names above.
- Every error and ended reason uses the table's words, and "Try again" follows the rule.
- Every test in the list passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

No server change, so the server checks do not apply. Do not report widths or phone layout.

## Out of scope

- Microphone consent and push-to-talk (V02).
- A spoken "undo that" (a new server tool; post a board request).
- The server's message types and the ADK voice path (G04, G05).
- Any change to the player's behaviour.

## Result

Built on `feature/V01-agent-panel-focus-undo`.

- `src/App.tsx`: `guideNavigated` ref (set only when the guide changes to a different page) so the page effect skips the heading focus; Alt+E window listener (ignores input, textarea, select, contenteditable, and any other modifier); `aria-keyshortcuts="Alt+E"` on the header button.
- `src/hooks/useVoiceAssistant.ts`: `actions` (last 10, `{ id, label, inverse }`), `undo()`, `stopSpeaking()`, `errorCode`, `endedMessage`, and the exact plain-words strings from the table.
- `src/VoiceAssistant.tsx`: `<ul aria-label="Echo did">`, Undo on the newest entry only (named "Undo: <label>"), a polite live region, Stop talking while speaking, "Try again" hidden for `not_configured` and `bad_start`. After Undo the button disappears, so focus moves to the panel title instead of being lost (found by the test, not in the ticket text).
- `src/styles/assistant.css`: `.voice-assistant__undo { min-width: 24px; min-height: 24px }`.

Checks (run in `../nasa-c`):

```
npm run lint   -> oxlint, no errors
npm run build  -> built, no errors
npm test       -> 1867 passed, 2 failed in the first full run:
  - src/data/sound-regression.test.ts "notices when one legend stop of the fixture changes": also fails on clean main
    (checked with my changes stashed). Not caused by V01.
  - src/App.test.tsx "loads the first visualization and shows it on each page": passes alone (34/34) and passed in the
    next full run; it timed out once under full-suite load.
npx vitest run src/App.test.tsx src/VoiceAssistant.test.tsx src/hooks -> 105 passed
```

Not done: no server change, no change to `src/features/player/`. A spoken "undo that" needs a new server tool (out of scope).

# UI02 Welcome in glass: Echo's chat and the manual form

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | UI01, JB11 |
| **Hotspots** | — |
| **Branch** | `feature/UI02-welcome-glass` |

## Goal

The first-visit welcome that JB11 builds (Echo's chat: name, then four sound chips, then the path and sound check, with "Prefer manual setup?") looks like Muninn's glass chat: glass speech bubbles, chips as telemetry pills, and a calm glass form for the manual path.

## Why

- Draft Ticket 2 asks for this flow; JB11 (claimed by B) builds it in `src/features/welcome/`. This ticket only restyles it and adds the draft's copy.
- Muninn's chat panel (`frontend/src/components/chat/MemoryChat.tsx`) is the look: a glass window, a mono header label and a status pill, user and assistant bubbles, and the input row at the bottom.

## Design

- The chat column is a `.ui-glass` panel. Echo's lines are glass bubbles on the left with a `.ui-label` "ECHO"; the listener's answers are accent bubbles on the right (`--accent-atmosphere`).
- The name input and its submit sit at the bottom like Muninn's input row. The sound chips are `.ui-pill` toggle buttons with `pressed`, one per existing style id (`STYLE_IDS`), using the existing labels.
- Echo's first line uses the draft's wording, adapted: "Commander! Welcome to the Earth Information Jukebox. What should I call you?". It goes in JB11's `lines.ts`, so the copy stays in one place.
- "Prefer manual setup?" stays JB11's control. Its form becomes one `.ui-glass` card with native fields; nothing in it is chat-styled.
- JB11's storage and its bypass of the welcome for a returning visitor are unchanged.

## Reuse

- Everything JB11 adds: `Welcome.tsx`, `ManualSetup.tsx`, `lines.ts`, its storage, and its tests.
- `.ui-glass`, `.ui-pill` and `.ui-label` from UI01. `Button` (`pressed`), `useAnnounce`.

## Touches

- `src/features/welcome/welcome.css`, `Welcome.tsx`, `ManualSetup.tsx` (class names and markup wrappers only), `lines.ts` (the first line).
- `src/features/welcome/welcome.test.tsx` (new cases only).

## Steps

1. Read JB11's merged files. Wrap the chat column, bubbles, chips and manual form in the UI01 classes.
2. Write the chip and bubble CSS on tokens in `welcome.css`.
3. Change Echo's first line in `lines.ts`.

## Tests

- The first line reads as written. The chips are buttons with `aria-pressed`. "Prefer manual setup?" still switches to a form with labelled fields.
- `expectNoA11yViolations` on the chat and on the manual form.

## Guardrails

- The template's guardrails. No sound before a click; the sound check stays JB11's.
- New bubbles don't animate here (motion is UI05).

## Done when

- The welcome looks like Muninn's glass chat in both themes, passes its tests, and behaves exactly as JB11 left it.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Changing JB11's flow, its storage or its steps. Echo's motion (UI05).

## Result

Filled in by the agent.

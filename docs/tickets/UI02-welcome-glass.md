# UI02 Welcome in glass: Echo's chat look and the manual form

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | welcome |
| **Branch** | `feature/UI02-welcome-glass` |

## Standalone

This ticket is built on the welcome that is on `main` today (`src/features/welcome/Welcome.tsx`, `lines.ts`, `storage.ts`, `welcome.css`). It does not wait for any other ticket. JB11 (the chat flow) edits the same folder, so both hold the `welcome` hotspot: only one of them is in it at a time. Whoever merges second rebases onto the first and keeps the other's logic; this ticket changes look and copy only, never the flow or the storage.

## Goal

The first-visit welcome looks like a glass chat: a glass panel, Echo's lines as glass bubbles under a mono "ECHO" label, the listener's answers as accent bubbles, the sound choices as toggle pills, and a calm glass card for any form.

## Why

- The overhaul wants Muninn's chat look (`docs/planning/UI-OVERHAUL.md`): a glass window, a mono header label, user and assistant bubbles, the input row at the bottom.
- The welcome today is plain (`src/features/welcome/welcome.css`).

## Design

- The welcome column is a glass panel. Echo's lines are glass bubbles on the left under a mono uppercase "ECHO" label. The listener's answers are accent bubbles on the right (`--md-sys-color-tertiary-container`).
- Any text input and its submit sit at the bottom of the panel. Choices that are toggles are pill buttons with `aria-pressed`, using the labels the welcome already has.
- Echo's opening line becomes: "Commander! Welcome to the Earth Information Jukebox. What should I call you?" It goes in `lines.ts` only, so the copy stays in one place. If the welcome on `main` has no name question, change the wording of its first line and do not add a step.
- Any manual or setup form is one glass card with native, labelled fields.
- No animation here.

Write the glass as a local class in this feature's CSS, on the existing `--md-sys-color-*` tokens: a translucent `surface-container` with `backdrop-filter: blur(24px)`, a 1 px lit top edge, and a solid `surface-container-high` with a 2 px outline under `prefers-contrast: more`, `prefers-reduced-transparency: reduce` and `@supports not (backdrop-filter: blur(1px))`. If `.ui-glass`, `.ui-pill` and `.ui-label` already exist in `src/styles/components.css` on `main` when you start, use them instead and write no local copy. Do not edit `tokens.css`, `components.css` or `index.css` (the `theme` hotspot).

## Reuse

- `Welcome.tsx`, `lines.ts`, `storage.ts`, `welcome.test.tsx`. `Button` (`pressed`), `useAnnounce`.

## Touches

- `src/features/welcome/welcome.css`, `Welcome.tsx` (class names and wrapper markup only), `lines.ts` (the first line), `welcome.test.tsx` (new cases only).

## Steps

1. Wrap the column, bubbles, choices and any form in the glass classes.
2. Write the bubble and pill CSS on tokens in `welcome.css`.
3. Change Echo's first line in `lines.ts`.

## Tests

- The first line reads as written. Toggle choices are buttons with `aria-pressed`. Every existing welcome test passes unchanged.
- `expectNoA11yViolations` on the chat and on any form.

## Guardrails

The template's guardrails, and:

- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`); colours and text come from the manifest.
- No sound before a click or key press. Nothing flashes. Every sound has a text equivalent.

- The flow, steps and storage do not change.

## Done when

- The welcome looks like a glass chat in both themes, behaves exactly as before, and passes its tests.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Changing the flow, the storage or the steps (JB11). Echo's motion (UI05).

## Result

Filled in by the agent.

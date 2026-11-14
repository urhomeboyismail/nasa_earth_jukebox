# UI11 About: keyboard shortcuts and how to use the app with a screen reader

| | |
|---|---|
| **Priority** | P2 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | about |
| **Branch** | `feature/UI11-about-keys` |

## Standalone

It builds on the About page as it is on `main` (`src/features/about/index.tsx`), and does not wait for any other ticket.

## Goal

The About page has two more sections: "Keyboard shortcuts", rendered from the same list the player's shortcuts dialog uses so the two never drift, and "Using a screen reader", with short steps for NVDA, JAWS, VoiceOver and TalkBack.

## Why

- The master prompt asks the About page for "keyboard navigation shortcuts, and screen-reader instructions".
- About has the sound recipe, the ranges, the styles and the legend (`about/index.tsx:58`, `:76`, `:79`). It has no shortcuts and no screen-reader help.
- The shortcuts are listed once in `src/features/player/shortcuts.ts` and `src/interaction/shortcuts.ts`, and shown only in the player's `ShortcutsDialog.tsx`.

## Design

- **"Keyboard shortcuts":** a `<table>` with a caption and Key and Action columns, mapped from the existing shortcut list (whichever of the two files the dialog reads). Keys go in `<kbd>`. Nothing is copied by hand.
- **"Using a screen reader":** a short list.
  - The map is an application region: press Enter to explore it with the arrow keys, and Escape to leave.
  - Announcements are polite and the music lowers while they speak.
  - For JAWS and NVDA, use forms or focus mode on the map. For VoiceOver on a Mac, use VO+Shift+Down to interact. For TalkBack and iOS VoiceOver, drag a finger on the map.
  - The words go in this feature's file, not in `src/describe`.
- A link to each section in the page's existing contents list, if it has one.

## Reuse

`ShortcutsDialog.tsx`'s data source, `Card`, the page's existing headings and CSS.

## Touches

- `src/features/about/index.tsx`, `about.css`, `about.test.tsx`

## Steps

1. Render the shortcuts table from the shared list.
2. Write the screen-reader section.

## Tests

- `about.test.tsx`: a table named "Keyboard shortcuts" has one row per entry in the shared list; the heading "Using a screen reader" exists; `expectNoA11yViolations`.

## Guardrails

- Nothing specific to one data set in `src/`. No sound.

## Done when

- About shows both sections, the table matches the dialog, and the checks pass.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Changing any shortcut. The player's dialog.

## Result

Filled in by the agent.

# LY02 Phone visual fixes from the 15 Nov visual audit

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 (an agent builds it; the team lead signs off on a real phone) |
| **Needs** | — |
| **Hotspots** | app, about, learn |
| **Branch** | `chore/LY02-phone-visual-fixes` |

## Goal

Nothing floats over text on a phone, the voice guide sheet stays inside its own box, About reads as cards instead of crushed tables, and a phone turned sideways still shows the page.

## Why

A visual audit of `main` after LY01 (Edge, 360 × 740, 320 × 640 and 740 × 360, both themes, screenshots of every screen of every page and of the open dialogs):

1. **Echo's 3D robot rests on text on every page**, including the listening test's consent text, the "Two data sets" switch, Listen's Fast and Download buttons. The vendored robot (`public/robot/robot-companion.js:95-100`) looks for a spot clear of text and controls; on a narrow phone there is none, so it settles on text. The vendored file has no setting to pin it.
2. **The voice guide sheet spills under the tab bar:** its last paragraph runs past the sheet's bottom edge (measured: the element under the tab bar's middle is `.voice-assistant__why`), and the tab labels print over it (`src/styles/assistant.css:137-157`).
3. **About's three-column tables are crushed** to 1–3 words a line and clipped at the right; the page is 19 screens at 360 px.
4. **Landscape phones** (740 × 360): the header, tools and an 88 px tab bar leave about 100 px of page; Echo draws at desktop size (240 px) because the dock's size goes by width only (`src/features/mascot/mascot-dock.css:18-21`).
5. **320 px:** the theme switch wraps to a row of its own.
6. **Home:** "Save <long title> for offline" wraps to 3 lines; the crate's search field is an unstyled grey box.
7. **Listen:** Mixer sits alone on a row under Stop and Loop; the Ask questions are pills of ragged widths.
8. **Listening test:** "Play the demo" and "Read the demo aloud" sit above the consent form.
9. **Learn:** every voice shows a disabled Stop button on its own row under Play.

## Touches

`src/App.tsx`, `src/App.css`, `src/hooks/useMediaQuery.ts` (new), `src/styles/assistant.css`, `src/features/mascot/mascot-dock.css`, `src/features/about/about.css`, `src/features/about/index.tsx`, `src/features/home/home.css`, `src/features/home/Crate.tsx`, `src/features/player/player.css`, `src/features/ask/ask.css`, `src/features/learn/learn.css`, and the tests next to them.

## Done when

- At 360 × 740 and 740 × 360 nothing fixed covers text or a control on any page (Echo's 3D dock shows from 768 px wide and 500 px tall; on a phone, the Guide button and "Help from Echo" carry Echo).
- The voice guide sheet's content scrolls inside the sheet and never reaches the tab bar.
- About's tables read as one card per row below 768 px, with each value labelled.
- `npm run lint && npm test && npm run build` pass; the phone audit shows no sideways scroll and no target under 24 px.
- **👤** The team lead checks on a real phone.

## Out of scope

- The welcome page (its link order is the keyboard's skip path).
- Changing the vendored robot.

## Result

Filled in by the agent.

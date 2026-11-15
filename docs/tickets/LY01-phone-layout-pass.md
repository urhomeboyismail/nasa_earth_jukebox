# LY01 The phone layout pass: the page, not the chrome, on the first screen

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent+👤 (an agent builds it; the team lead signs off on a real phone) |
| **Needs** | MC05 (the Mission Control look restyles the header and panels; this pass lays out the look that ships, not the one being replaced) |
| **Hotspots** | app, player |
| **Branch** | `chore/LY01-phone-layout-pass` |

## Goal

On a 360 px phone, each page shows its own heading and main content on the first screen, and the Listen page's Play button is within reach without scrolling past everything else. Nothing that passes today (no sideways scroll, targets, input sizes) regresses.

## Why

This is the one layout pass the team lead does at the end (`.claude/rules/platform.md`). Measured on `main` at `ff3bc44` (before the Mission Control look) with `npm run phone-audit` (Edge, 360 × 740, 320 × 640 and 390 × 844, dark theme, server off):

**Already fine, keep it so:** no page scrolls sideways at 320, 360 or 390 px; no tap target under 24 px (WCAG 2.5.8); every input is 16 px or more (no iOS zoom on focus); no text under 12 px.

**What to fix, worst first:**

1. **The header takes 214 px of a 740 px screen.** On a phone, Display, the theme switch, the server status and its "Check again" link each get their own row (`src/App.tsx:307-309`; `src/App.css:552-555` gives `.app-server` a full row and the rest wrap). Every page's `<h1>` starts at 214 px (218 px at 320).
2. **Every page opens with the same setup block.** "Help from Echo", "Play the demo", "Read the demo aloud" and the data set picker with its summary come before the page itself (`src/App.tsx:324-328`), about 370 px. Together with the header, the first screen of Listen, Compare and Learn is chrome and setup only.
3. **Listen's Play is about 4 screens down** (2876 px at 360). The player renders the stage, the explorer panel, Marks, Record, Description, the data table, Ask (eleven question buttons) and the legend before the transport (`src/features/player/index.tsx:240-285`).
4. **The Home crate cards squeeze their text.** The record art sits beside the text, which leaves about 110 px for it, so titles wrap to 4 or 5 lines and "Save … for offline" wraps to 5 (`src/features/home/home.css:88`, `.crate__sleeve`).
5. **The bottom of the screen is crowded.** The Voice guide button (`src/App.css:558-565`, 97 × 48 at bottom left), Echo's dock (`src/features/mascot/mascot-dock.css:21,26`, 140 × 126 at bottom right) and the tab bar together cover the bottom ~150 px. On Compare they hide the "Two dates / Two data sets" switch on the first screen.
6. **Echo flies in over the page heading** for a few seconds after each page change (it covers "Compare two dat…"), then settles in the dock.
7. **Long pages.** About is 16.4 screens at 360 (22.2 at 320), Learn 7.9, Home 6.6, Listen 6.1.
8. **Legend rows are 26 px tall** (`src/components/Legend.tsx:95`, focusable `li`s on Listen and About). They pass WCAG 2.5.8 but are under the 44 px comfort size the rest of the app keeps.

Screenshots are written by the audit; re-run it on `main` after MC05, because the new look will move some of these numbers.

## Design

Follow `.claude/skills/responsive-layout/SKILL.md` (mobile first; intrinsic layout, then container queries, then media queries; the project widths 360, 768, 1024, 1280; 320 must not break).

- **Header (1):** on a phone, one row: the wordmark, then the secondary controls compact. Either one "Display" menu that holds the theme and display settings, or icon buttons with text names. The server status becomes a dot with a short label, its "Check again" in the same row or inside the status. Names stay what screen readers hear today (WCAG 2.5.3).
- **Setup block (2):** keep "Help from Echo" in the same place on every page (WCAG 3.2.6), but compact: one row with the demo, and the data set picker on one line with its summary collapsed (a `<details>` or the summary moved under the picker's own label). Don't hide the picker behind a gesture.
- **Listen order (3):** move the transport (Play, the date slider, Speed and Volume) to directly after the stage in the **DOM**, at every width, so focus order and reading order match what people see. Do not use CSS `order` for it (WCAG 1.3.2, 2.4.3). The description and Ask stay, after the transport.
- **Crate cards (4):** a container query on the card: below about 320 px of card width the art goes above the text, full width; above it, beside as now.
- **Bottom (5, 6):** nothing fixed may cover a page's primary control on the first screen. Options: the page's bottom padding grows by the floating buttons' height, or Echo's dock shrinks to an avatar on a phone. Echo's fly-in must not cross the `<h1>` (end it in the dock, or start it from the dock), and stays still under `prefers-reduced-motion`.
- **Long pages (7):** About and Learn sections become `<details>` (closed by default on a phone if the team agrees; ask on `AGENT-BOARD.md`), so their headings form a scannable list.
- **Legend (8):** rows at least 44 px tall on a phone.

## Reuse

- `npm run phone` (`phone.html`): the app in phone frames that reload as you edit, with a live check for sideways scroll and small targets.
- `npm run phone-audit` (`scripts/phone_audit.mjs`): the measurements above, with screenshots. Run it before and after and paste both summaries in **Result**.
- The tokens and components in `src/styles/` and `src/components/` (`Button`, `IconButton`, `Dialog`). Don't hard-code colours or sizes.
- `--bottom-nav-height` and the phone media query in `src/App.css` for anything fixed.

## Touches

`src/App.tsx`, `src/App.css`, `src/features/player/index.tsx`, `src/features/player/player.css`, `src/features/home/home.css`, `src/features/mascot/mascot-dock.css`, `src/features/demo/DemoControl.tsx`, `src/features/demo/demo.css`, `src/features/help/help.css`, `src/components/DatasetPicker.tsx`, `src/components/ServerPill.tsx`, `src/components/ThemeSwitch.tsx`, `src/display/DisplaySettings.tsx`, `src/styles/display.css`, `src/components/Legend.tsx`, `src/features/about/about.css`, `src/features/learn/learn.css`, and the tests next to them. Changing `src/features/about/index.tsx` or `src/features/learn/index.tsx` (hotspots `about`, `learn`) or the mascot's flight (`tour` hotspot) needs a post on `AGENT-BOARD.md` first.

## Steps

1. Pull `main` after MC05 is merged. Run `npm run dev`, then `npm run phone-audit -- http://localhost:5173/` and keep the summary (the "before").
2. Open `npm run phone` with 320, 360 and 390 ticked and keep it open while you work.
3. Fix 1 to 8 above in that order. After each, check 768, 1024 and 1280 px too (the 768 frame in the preview; a desktop window for the rest), so the tablet and desktop layouts don't change unless they should.
4. Update the tests that depend on order (the player's tab order, the header's controls), and add one for anything new.
5. Run the audit again (the "after") and the checks.
6. **👤** The team lead opens the app on a real phone (`npm run dev -- --host`, the Network address) with VoiceOver or TalkBack on, and checks: the order you swipe through matches the order you see; the floating buttons don't cover anything you need; the safe areas (notch, home bar) are clear.

## Tests

- Find things by role and name; check the new order with `userEvent.tab()` where order changed (Listen: Play comes before the description and Ask).
- `await expectNoA11yViolations(container)` on every changed component.
- No layout assertions in jsdom (it has no layout); the audit is the layout check.

## Guardrails

- Accessibility is the product: every control keeps its name, keyboard use and focus order; announcements still go through `useAnnounce`.
- Nothing specific to one data set in `src/` (`.claude/rules/phases.md`).
- No new flashing or motion; `prefers-reduced-motion` and `prefers-reduced-transparency` keep working.
- No sound changes.

## Done when

- At 360 × 740: every page's `<h1>` starts at or above 120 px; Listen's Play starts within the first 1.5 screens (about 1100 px); nothing fixed covers a primary control on the first screen.
- Home crate cards show titles in at most 2 lines at 360 px.
- The audit still shows no sideways scroll, no target under 24 px and no input under 16 px at 320, 360 and 390, and the legend rows are 44 px or more.
- Tablet (768) and desktop (1024, 1280) look as before, except where a fix was meant for them too.
- The real-phone check in step 6 is done and noted in **Result**.

## Checks

```bash
npm run lint && npm test && npm run build
npm run phone-audit -- http://localhost:5173/   # with npm run dev running; paste the before and after summaries
```

## Out of scope

- Landscape phone layouts beyond "nothing breaks".
- New features, new pages, or sound changes.
- The welcome page's 3D scene (it already fits one screen at 320, 360 and 390).

## Result

Filled in by the agent: the branch, the commits, the audit's before and after summaries, and the real output of the checks, failures included.

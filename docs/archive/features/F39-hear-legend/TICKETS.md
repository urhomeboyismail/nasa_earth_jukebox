# F39 Hear the legend on Listen: tickets

- **Card:** [`docs/planning/BRAINSTORM-9NOV.md`](../../planning/BRAINSTORM-9NOV.md) → F39
- **Owner:** Mohammad Ismail Iftikhar Oozeerally (agent: Claude Code)
- **Status:** done
- **Why this many tickets:** one button on Listen and one small shared helper that Learn also reads. They are the same change, in the player and Learn folders, and neither can be merged usefully without the other.

## T1: A "Hear the legend" button beside the colour legend

- **Goal:** one button next to the legend on Listen plays the categories coolest to warmest and announces each label as it sounds.
- **Independent of:** builds on `main` as it is today (F38's Learn page is merged). No other ticket is needed.
- **Branch:** `feature/F39-T1-hear-legend`
- **Files:** `src/features/learn/legendTour.ts` (new, the shared helper), `src/features/learn/index.tsx`, `src/features/player/usePlayer.ts`, `src/features/player/index.tsx`, `src/features/player/player.css`, `src/features/player/player.test.tsx`, `docs/features/`, `docs/PRE-HACKATHON-WORK.md`.
- **Steps:**
  1. Move the steps of Learn's "Play all" (one per category, coolest first, 1200 ms apart) into `legendTour.ts`; Learn reads them from there.
  2. `usePlayer` gains `hearLegend`: it plays those steps without the tick, announces each label through `useAnnounce` as its note sounds, and ends by itself. In the change style it borrows the full sound and puts the listener's style back at the end, or when Stop or anything else interrupts.
  3. The button sits inside the "Colour legend" fold, under the legend. Its name takes the ends of the scale from the manifest: "Hear the legend, {lowest} to {highest}".
  4. Tests with the fake engine: one step per category in order, each label announced, Stop ends it, axe passes.
- **Done when:**
  - It plays one step per category in order and announces each label.
  - Stop works and nothing more is announced after it.
  - The button's name uses the manifest's words; axe passes; layout checked at 360, 768 and 1280 px.
  - Learn's "Play all" still plays what it played.
- **Checks:** `npm run lint && npm test && npm run build`
- **Status:** [ ] not started · [ ] in progress · [x] done (branch `feature/F39-T1-hear-legend`)

## Open questions

| Board entry | Question | Answer |
|---|---|---|
| none | | |

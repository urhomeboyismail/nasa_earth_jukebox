# F38 Learn fills: tickets

- **Card:** [`docs/planning/BRAINSTORM-9NOV.md`](../../planning/BRAINSTORM-9NOV.md) → F38
- **Owner:** Roni (agent: Claude Code)
- **Status:** done
- **Why this many tickets:** all three additions are cards on the one Learn page, in one folder (`src/features/learn/`) with one owner. Nothing else is touched.

## T1: Learn teaches the change style, the edge trace and the lock key

- **Goal:** Learn teaches every cue that Listen can make: the change from normal, tracing one line (`T`), and locking a place (`L`).
- **Independent of:** builds on `main` as it is today (F36's words are already merged). No other ticket is needed.
- **Branch:** `feature/F38-T1-learn-fills`
- **Files:** `src/features/learn/index.tsx`, `src/features/learn/learn.test.tsx`, `docs/features/`, `docs/PRE-HACKATHON-WORK.md`.
- **Steps:**
  1. A card "Change from normal", shown only when the data set has a baseline (`hasChange`): a button plays the data set's change steps in order, in the change style, and the status line names each step as it sounds.
  2. A card "The {edge}" (the word comes from `variable.words.edge`), shown only with a baseline: says to press `T` on Listen in the "Change from normal" style, plays one example line as a trace, and shows its description from `describeContour`.
  3. The "Explore the map" card gains `L` and "Play this place across the dates".
  4. Every Play restores the listener's own style first, so a change-style card never leaves the other cards in the wrong style.
  5. Tests with the fake engine: the steps played, hidden without a baseline, the words from the manifest, axe.
- **Done when:**
  - The change card plays one step per `changeSteps` entry, in order, with `changeStep` set, in the change style.
  - Both new cards are absent on a data set without a baseline, and no existing Learn test changes.
  - The trace card calls `traceContour` with a line at the first contour level and shows its words.
  - The map card mentions `L` and "Play this place across the dates".
  - axe passes; layout checked at 360, 768 and 1280 px.
- **Checks:** `npm run lint && npm test && npm run build`
- **Status:** [ ] not started · [ ] in progress · [x] done (branch `feature/F38-T1-learn-fills`)

## Open questions

| Board entry | Question | Answer |
|---|---|---|
| none | | |

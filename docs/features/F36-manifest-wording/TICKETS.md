# F36 Manifest wording: tickets

- **Card:** [`docs/planning/BRAINSTORM-9NOV.md`](../../planning/BRAINSTORM-9NOV.md) → F36
- **Owner:** Dhruv Bhantoo (agent: Claude Code)
- **Status:** done
- **Why this many tickets:** one optional manifest field, its default and every caller that reads it are one interface change; splitting would leave `src/` half-converted.

## T1: `variable.words` in the manifest, read by every comparison sentence

- **Goal:** the comparison words ("warmer", "warmest", "warm edge", "water") come from an optional `variable.words` field that defaults to today's words.
- **Independent of:** builds on `main` as it is today. No other ticket is needed first.
- **Branch:** `feature/F36-T1-manifest-wording`
- **Files:** `src/data/types.ts`, `src/data/schema.ts`, `src/data/words.ts` (new), `src/data/index.ts`, `src/describe/index.ts`, `src/features/{home,player,compare,learn,about,demo}/`, `docs/data-sources.md` → "Manifest fields".
- **Steps:**
  1. Add `VariableWords` (`higher`, `lower`, `highest`, `lowest`, `edge`, `thing`), the optional partial `variable.words` to the type and the zod schema, and `variableWords()` with the defaults.
  2. Replace the hard-coded strings in Home, Listen (player), Compare (and `judge.answerText`), the listening test, Learn, About and `describeSequence`.
  3. Make the demo script wording neutral (it has no data set).
  4. Document the field. Add a test manifest with `higher: "more ice"` and check Home, Listen, Compare and `describeSequence` use it.
- **Done when:**
  - Every existing manifest validates unchanged and every existing test and golden text is unchanged.
  - A manifest with `higher: "more ice"` changes the words in Compare, Listen, Home and `describeSequence`.
  - `grep -rni warmer src` finds only comments, tests and the default.
- **Checks:** `npm run lint && npm test && npm run build && npm run check-data`
- **Status:** [ ] not started · [ ] in progress · [x] done (branch `feature/F36-T1-manifest-wording`)

## Open questions

| Board entry | Question | Answer |
|---|---|---|
| none | | |

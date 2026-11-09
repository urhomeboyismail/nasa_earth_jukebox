# S03 Salvage the project README and the creative process, and update them for v3

| | |
|---|---|
| **Priority** | P0 |
| **Size** | S (under half a day) |
| **Who** | agent+👤 |
| **Needs** | — |
| **Hotspots** | — |
| **Branch** | `feature/S03-readme` |

## Goal

The root `README.md` describes the app as it is. It says plainly what is built and what is planned (`docs/PLAN.md` §6.3). It states that no blind or low-vision person has tested it yet (n = 0), and it has an honest AI disclosure. `docs/CREATIVE_PROCESS.md` is on `main`, and it claims only work that was done.

## Why

- `main`'s `README.md` is still the Vite template. Check with `git show main:README.md | head -20`.
- The finished draft is commit `f434632` ("T87: creative process draft and the submission README") on `feature/T87-creative-process-readme`, based on `main` at `afcbc8f`. It replaces `README.md` (+60 −29) and adds `docs/CREATIVE_PROCESS.md` (+80).
- The draft was written before v3. It describes v2 only, and it says "Each date is a note (higher is warmer)". That is what is built. The v3 features (Symphony, Scan, live video, Detail, Explore v2, and the rest of §6.3) are not built, so the README must not list them as done.
- Its "NASA data and credits" section calls the Mauritius data set "the real data set so far", with the GHRSST v4.1 citation. That is true only once S02 has landed, and the credit wording needs the sign-off described in S02.
- Its AI section says the mascot is "our own SVG drawing". That is true today. F58 would redraw the mascot, and any AI tool used for the art must then be named here.
- "Not yet tested with blind or low-vision users (n = 0)" is correct: no session has run (`docs/evidence/results-note.md`).
- Claims in the draft to check against the code before merging:
  - "read the same information as a data table": `src/features/player/DataTable.tsx` exists;
  - "download the sound as a WAV file": the button "Download this soundscape (WAV)" in `src/features/player/index.tsx`;
  - "lock one place": `src/features/explore/Explorer.tsx:54`;
  - "Ask … with no server": `src/features/ask/`;
  - "can be installed from the browser": `public/manifest.webmanifest` exists; check the icons are listed in it;
  - "Vibration does not work on iPhones": `.claude/rules/platform.md`.

## Reuse

- `docs/PLAN.md` §6.3 for the v3 wording, and §1 for the testable question.
- `docs/evidence/` for the n = 0 wording.
- `docs/SOUND_MAPPINGS.md`, `docs/DATASET-PLAYBOOK.md` and `docs/data-sources.md` for links.

## Touches

- `README.md`: owner Bhavish (`docs/PLAN.md` §4). Review by Bhavish.
- `docs/CREATIVE_PROCESS.md`: new, with no owner in `docs/PLAN.md` §4. Ask Bhavish and the team leader to review it.
- Nothing else.

## Steps

1. Use a worktree: `git worktree add ../nasa-a main`, then `cd ../nasa-a && git switch -c feature/S03-readme`. Run `git cherry-pick f434632`.
2. Add a "Status" section after "What you can do". Use a table with three columns: "Built now", "Planned (`docs/PLAN.md` §6.3)" and "Not started". Built now means what the app does today: Listen (Simple, Full and Change from normal sounds), the sound map, Learn, Compare, Ask, the WAV download, the demo tour, and the optional voice guide. Planned means the v3 items in §6.3. Do not use internal ticket IDs in the README.
3. In the limits, keep "n = 0". Add that the practice listening test has not been run, and that the phone checks (H06) are not done.
4. The data section depends on S02. If S02 has not merged, write that the app ships with practice data sets and that the first real NASA data set is in progress. If it has merged, keep the Mauritius paragraph, with the wording a person confirmed (S02).
5. AI section. Name the tools: Claude Code and Codex helped write code and documents, and Google Gemini runs the optional voice guide. Say what each does and does not do. If an AI image tool drew any art, name it here.
6. Check every claim in the draft against the code (the list in Why). Remove any claim you cannot find in the code.
7. Check every relative link. Run `grep -o '](\([^)#]*\)' README.md docs/CREATIVE_PROCESS.md` and confirm each relative path exists (`test -e`). The links to `docs/TICKETS.md` work only after H01 is merged.
8. Team section. Use the names that each person has agreed to. Ask before you publish a name. Do not write a handle with an `@` in the README unless the person wants it shown.
9. Read `docs/CREATIVE_PROCESS.md` against this codebase. Remove or mark anything that describes work not done: tests with users, screen-reader checks, phone tests.
10. Add one line to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".

## Tests

Not applicable: documentation only. The link check in Steps 7 is the test.

## Guardrails

Not applicable: no sound or visual change.

## Done when

- `README.md` has no Vite template text left.
- It has a Status section with the three columns, and it states n = 0 and the practice listening test has not been run.
- The AI disclosure names the tools and the art, if any.
- Every claim in the Why list has been checked, and the pull request says how.
- Every relative link resolves.
- Bhavish has reviewed the README. A person (👤) has approved the credit wording and the team list.
- `docs/CREATIVE_PROCESS.md` has been read against the code and claims only work that was done.

## Checks

```bash
npm run lint && npm test && npm run build
# link check for the two documents
for f in README.md docs/CREATIVE_PROCESS.md; do grep -o '](\([^)#]*\)' "$f" | sed 's/^](//; s/)$//' | grep -v '^http' | while read -r p; do test -e "$p" || echo "missing: $f -> $p"; done; done
```

## Out of scope

- The 30-second video and the slides (H07), and the submission form.
- The demo script (`docs/submission/demo-script.md`, from T88b).
- Any change to the app's text (I02 and F58 handle theirs).

## Result

Branch `feature/S03-readme`: `f434632` cherry-picked (no conflicts), then one commit with the v3 changes.

Done:
- Step 2: a Status section with the three columns (built now, planned, not started) and no ticket IDs.
- Step 3: the limits keep n = 0 and now say the practice listening test has not been run and the phone checks are not done.
- Step 4: S02 has merged, so the Mauritius paragraph stays, with the PO.DAAC suggested citation read on the live page (S02). The licence is not stated in the README.
- Step 5: the AI section names Gemini Live, and Claude Code and Codex, and what each does and does not do. The mascot is named as our own SVG drawing.
- Step 6: claims checked against the code: `src/features/player/DataTable.tsx` exists; "Download this soundscape (WAV)" is in `src/features/player/index.tsx:305`; `L` locks the place in `src/features/explore/Explorer.tsx:54`; `src/features/ask/` exists; `public/manifest.webmanifest` lists three icons; `.claude/rules/platform.md` says iOS has no vibration. Every code reference in `docs/CREATIVE_PROCESS.md` (`valueAtPixel`, `analyzePixels`, `analyzeGrid`, `voicingFor`, `Freeverb`, `describeSequence`, `src/boundary.test.ts`, `docs/adk-spike.md`) was found. No claim was removed.
- Step 7: the link check from the Checks section prints nothing for either file.
- Step 9: two rows in `docs/CREATIVE_PROCESS.md` were out of date after the v3 plan (live video, and ADK, now planned in the queue); they are corrected. The T114 reference now points at the S05 ticket file.
- Step 10: one line in `docs/PRE-HACKATHON-WORK.md`.

Not done (👤):
- Step 8, the team list: it uses the names already in `AGENTS.md`, with "Bhavish" in place of the `@` handle. A person has to confirm each name is wanted before this is published.
- The credit wording and the AI section need a person's approval, and Bhavish's review. The statement that the mascot is our own SVG drawing comes from the board entry `R-20261109-F37-1`, which is itself a proposal for the team to confirm.

```
$ npm run lint
(oxlint: no warnings or errors)
$ npm test
 Test Files  62 passed (62)
      Tests  1166 passed (1166)
$ npm run build
✓ built in 491ms
$ link check for README.md and docs/CREATIVE_PROCESS.md
(no output: every relative link resolves)
```

# S01 Salvage F40 deep links and the F41 shortcuts dialog

| | |
|---|---|
| **Priority** | P0 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | — |
| **Hotspots** | player, explorer |
| **Branch** | `feature/S01-deep-links-shortcuts` |

## Goal

Deep links (F40) and the Shortcuts dialog (F41) are on `main`, built from their finished commits. The `?` dialog and the keyboard handlers on Listen and the sound map read one shortcut list, `SHORTCUTS`.

## Why

- The finished work is on two unmerged branches, both based on `main` at `afcbc8f`:
  - `feature/F40-T1-deep-links`, commit `28eeec5`: 12 files, +502 −21.
  - `feature/F41-T1-shortcuts-dialog`, commit `acc6095`, on top of `28eeec5`: 13 files, +464 −27.
  - Check with `git log --oneline main..feature/F41-T1-shortcuts-dialog`.
- F40 changes `src/route.ts` (adds `parseCell`, `cellParam`, `parseStyleParam`, `withParams`, `replaceParams`), `src/features/player/index.tsx`, `usePlayer.ts`, `momentLink.ts` (new), `player.css`, `player.test.tsx`, `src/features/explore/useExplorer.ts`, `Explorer.test.tsx`, and `src/route.test.ts`.
- F41 adds `src/features/player/shortcuts.ts` (the list `SHORTCUTS`, each entry with `id`, `scope`, `keys`, `does`, `note`), `ShortcutsDialog.tsx`, `shortcuts.test.ts`, and `src/components/Dialog.tsx` (a native `<dialog>` that moves focus in and back out). It also changes `useExplorer.ts`, the player's key handler, and `src/styles/components.css`, and exports `Dialog` from `src/components/index.ts`.
- Both commits add `docs/features/F40-deep-links/TICKETS.md`, `docs/features/F41-shortcuts-dialog/TICKETS.md` and rows in `docs/features/README.md`. That is the old per-feature format, replaced by the queue (`docs/archive/README.md`). Leave those three out.
- `main` already has the route helpers that F40 needs. `parseHash` and `hashFor` accept any params (`src/route.ts:14-31`).

## Reuse

- `src/route.ts`: `parseHash`, `hashFor`, `currentDataParam`, and the helpers added by F40.
- `SHORTCUTS` in `src/features/player/shortcuts.ts`. It is the only key table. Do not add a second one.
- `src/components/Button.tsx`, `Notice`, and `useAnnounce` for the "link copied" message.
- `expectNoA11yViolations` from `src/test/a11y.ts`.

## Touches

- From F40 and F41: the files listed in Why, except the three ticket files and the README rows.
- `docs/PRE-HACKATHON-WORK.md`: one line for F40 and one for F41.
- Review: Mohammad for `src/features/player/`, `src/features/explore/` and `src/route.ts` (the App shell's route, not in `docs/PLAN.md` §4, so ask on `docs/AGENT-BOARD.md` before changing more than the cherry-pick). Roni for `src/components/Dialog.tsx`, `src/components/index.ts` and `src/styles/components.css`.

## Steps

1. Use a worktree: `git worktree add ../nasa-a main`, then `cd ../nasa-a && git switch -c feature/S01-deep-links-shortcuts`.
2. Run `git cherry-pick 28eeec5`. Amend the message so it starts with `S01:`, and keep the body. Remove the F40 ticket file and its README row: `git rm docs/features/F40-deep-links/TICKETS.md`, then edit `docs/features/README.md` back to `main`'s version. Commit with `git commit --amend`.
3. Run `git cherry-pick acc6095`. Expect a conflict in `src/features/explore/useExplorer.ts`, where both commits change the key handling. Keep the F40 deep-link behaviour and the F41 key lookup. The explorer must ask `SHORTCUTS` which key means what.
4. Remove the F41 ticket file and its README row the same way.
5. Check the result against the rules below (Done when). Fix anything that does not hold.
6. Keep `SHORTCUTS` as the one key table, with `keys` as data. The later input-layer ticket (IX01) will replace where the keys come from, and the dialog must not need to change for that.
7. Add one line per feature to `docs/PRE-HACKATHON-WORK.md` under "During the hackathon".
8. Run the checks.

## Tests

- Keep the tests that come with the commits: `src/route.test.ts`, `src/features/player/player.test.tsx` (deep-link cases), `src/features/player/shortcuts.test.ts`, `src/features/explore/Explorer.test.tsx`.
- If one of these is missing after the rebase, add it:
  - `?` on Listen opens a dialog named "Keyboard shortcuts"; its list is one item per entry in `SHORTCUTS`. Find the items by role (`listitem`) and text.
  - Escape closes it, and focus returns to the control that opened it.
  - `await expectNoA11yViolations(container)` with the dialog open.
  - A link with a bad `date`, `cell` or `style` value opens on the defaults. A link with good values opens on them, and the style is not saved to storage.
  - A linked cell opens the map without sound. The first key press or touch unlocks the audio.

## Guardrails

- No sound plays before a click or key press (WCAG 1.4.2). A linked cell opens silently.
- The dialog and the copy button do not flash or move under `prefers-reduced-motion`. Nothing animates.
- Every key in the dialog has its text, from `does` and `note`. A keyboard user can reach and close the dialog.

## Done when

- Both features are on one branch, built on `main`. `npm run lint && npm test && npm run build` pass.
- `?` opens the dialog on Listen, and every key it lists works. No key handler names a key that is not in `SHORTCUTS` (the guard test in `shortcuts.test.ts` passes).
- A link such as `#listen?data=<id>&date=<date>&cell=<col>,<row>&style=<style>` opens on those values. Bad values are ignored.
- Neither old `TICKETS.md` file is on the branch.
- `docs/PRE-HACKATHON-WORK.md` has the two lines.
- Mohammad has reviewed the player and explorer changes. Roni has reviewed `Dialog.tsx` and the CSS.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/route.test.ts src/features/player src/features/explore
```

## Out of scope

- A native share sheet. The button copies the link.
- The input layer and the key map (IX01).
- Any change to the sound.

## Result

Branch `feature/S01-deep-links-shortcuts`, two commits on `main` at `4018952`: `68c559c` (F40, cherry-picked from `28eeec5`) and `20c7906` (F41, cherry-picked from `acc6095`). The only conflict was `docs/features/README.md`, resolved by taking `main`'s version. `useExplorer.ts` merged without a conflict. Neither old `TICKETS.md` file is on the branch. `docs/PRE-HACKATHON-WORK.md` has one line each for F40 and F41.

```
$ npm run lint
(oxlint: no warnings or errors)

$ npm test
 Test Files  62 passed (62)
      Tests  1160 passed (1160)

$ npm run build
✓ built in 433ms

$ npx vitest run src/route.test.ts src/features/player src/features/explore
 Test Files  7 passed (7)
      Tests  198 passed (198)
```

Test coverage checked against the ticket: `player.test.tsx` has the deep-link cases (good values opened and the style not saved, bad style ignored, link applied while Listen is open and silent, copy button), the dialog cases (named "Keyboard shortcuts", Escape closes and returns focus, `expectNoA11yViolations` with it open), and `shortcuts.test.ts` has the guard test (no handler names a key outside `SHORTCUTS`).

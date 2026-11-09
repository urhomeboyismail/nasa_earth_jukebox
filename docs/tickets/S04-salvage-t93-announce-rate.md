# S04 Salvage the announcement rate (T93)

| | |
|---|---|
| **Priority** | P0 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | I01 |
| **Hotspots** | player, explorer |
| **Branch** | `feature/S04-announce-rate` |

## Goal

The player and the sound map speak at most one busy update every 1.5 seconds. The newest message replaces the older ones, and the last message is always spoken. The messages are built by pure functions in `src/describe/announcements.ts`, and they reach screen readers only through `useAnnounce`.

## Why

- The finished work is commit `458e18a` ("T93: announcement rate rule and string builders…"). It is on the remote branch `origin/claude/zen-wozniak-s3z2sh`, which is based on `d61d2c75`. That base is 59 commits behind `main`, and the branch is 1 commit ahead. Do not merge that branch. Cherry-pick the commit onto a branch made from `main`.
- The commit changes 13 files (+637 −44):
  - new: `src/components/announceRate.ts` and its test, `src/describe/announcements.ts` and its test;
  - changed: `src/components/Announcer.tsx`, `announcerContext.ts`, `components.test.tsx`, `src/describe/index.ts`, `src/features/player/usePlayer.ts`, `player.test.tsx`, `src/features/explore/Explorer.tsx`, `Explorer.test.tsx`;
  - `docs/PRE-HACKATHON-TICKETS.md` (+13), which is archived on `main` at `docs/archive/PRE-HACKATHON-TICKETS.md`. Leave that hunk out.
- The commit message ends with a `Co-Authored-By:` line and a `Claude-Session:` line. Remove both when you re-commit (`.claude/rules/git.md`).
- Step 3 of T93, a manual screen-reader check, is not done. It belongs to H08. This ticket covers the code and the unit tests.
- The commit changes `AnnouncerProvider` to take `announce(text, { busy })`. I01 moves the provider to `App.tsx`. So S04 must come after I01.
- Hotspots: this ticket edits `usePlayer.ts` and `player.test.tsx` (player hotspot) and `Explorer.tsx` (explorer hotspot), although the queue row says "—". The queue row should be fixed.

## Reuse

- `AnnouncerProvider` (`src/components/Announcer.tsx`), after I01 it sits in `App.tsx`.
- `useAnnounce` (`src/components/useAnnounce.ts`).
- The builders in `src/describe/announcements.ts` from the commit, and the rate rule in `src/components/announceRate.ts`.

## Touches

- The files listed in Why, except `docs/PRE-HACKATHON-TICKETS.md`.
- `docs/PRE-HACKATHON-WORK.md`: one line.

## Steps

1. Wait until I01 is on `main`. Then `git worktree add ../nasa-a main`, `cd ../nasa-a && git switch -c feature/S04-announce-rate`.
2. `git fetch origin` (if needed), then `git cherry-pick 458e18a`.
3. Resolve conflicts with I01. The provider stays in `App.tsx`, and the rate rule stays inside the provider. No page should create its own provider.
4. Remove the archived file from the commit: `git rm docs/PRE-HACKATHON-TICKETS.md` (it is not on `main`), and add the T93 line to `docs/PRE-HACKATHON-WORK.md` instead.
5. Amend the commit message. The summary becomes `S04: announcement rate for the player and the explorer`. Delete the `Co-Authored-By` and `Claude-Session` lines.
6. Check the rule against the tests (Tests below). Add any missing case.
7. Run the checks.

## Tests

Keep the tests from the commit: `src/components/announceRate.test.ts`, `src/describe/announcements.test.ts`, `src/components/components.test.tsx`, `src/features/player/player.test.tsx`, `src/features/explore/Explorer.test.tsx`. Add, if missing, with `vi.useFakeTimers()`:

- Two busy messages within 1.5 s: only the first is spoken at once, and the newest is spoken after the gap. The old one is never spoken.
- A message that is not busy is never delayed.
- The last message is always spoken, even when it comes right after a busy one.
- Messages stay within 160 characters, and busy messages within 60 characters.
- Read the live region by role: `screen.getByRole('status')` and its text, not a class name.

## Guardrails

Not applicable: no sound or visual change. Announcements remain the only spoken channel, and they go through `useAnnounce`. Do not add `speechSynthesis` in this ticket.

## Done when

- The commit is on a branch made from `main` after I01. No `Co-Authored-By` or `Claude-Session` line remains (`git log -1 --format=%B | grep -ci "co-authored\|claude-session"` prints `0`).
- `docs/PRE-HACKATHON-TICKETS.md` is not added by the branch.
- All rate tests pass. `grep -rn "speechSynthesis" src/components src/describe src/features/player src/features/explore` prints nothing new.
- The line is in `docs/PRE-HACKATHON-WORK.md`.

## Checks

```bash
npm run lint && npm test && npm run build
npx vitest run src/components src/describe src/features/player src/features/explore
```

## Out of scope

- The manual screen-reader check (H08).
- Changing the wording of any message beyond what the commit has.
- The voice guide's status messages (V03).

## Result

Branch `feature/S04-announce-rate`: `458e18a` cherry-picked onto `main` (after I01) and re-committed as `21665e1`, "S04: announcement rate for the player and the explorer". No `Co-Authored-By` or `Claude-Session` line (`git log -1 --format=%B | grep -ci "co-authored\|claude-session"` prints `0`). The archived `docs/PRE-HACKATHON-TICKETS.md` hunk was left out. `grep -rn "speechSynthesis" src/components src/describe src/features/player src/features/explore` prints nothing.

Conflicts, and how they were resolved:
- **The explorer moved.** T93 edited the explorer logic in `src/features/explore/Explorer.tsx`; on `main` that logic is in `useExplorer.ts` and `Explorer.tsx` is only the view. `Explorer.tsx` keeps `main`'s version, and the same T93 changes (the date at the start of the first message after turning on or a date change, `edgeMessage`, `sweepEndMessage`) are applied in `useExplorer.ts`. `main`'s hook already took a `formatDate` option, so T93's own formatter was dropped.
- **`usePlayer.ts`.** Imports merged. The change-step code from `main` is kept, with T93's `speakNow`. The earlier `useDescriptionDetail()` is kept and `main`'s later duplicate removed.
- **`player.test.tsx`.** Both sets of `describe` blocks kept. T93's rate test renders with `{ wrapper: AnnouncerProvider }`, since the provider is now in `App.tsx` (I01). `src/describe/index.ts` exports both `./change` and `./announcements`.
- **F39 against T93.** Stop now says where it stopped ("Stopped at January 2024: cold."). The F39 test "stops with Stop, and nothing more is announced" expected the live region to stay on the last legend label, so it now checks that the stop line is said and that nothing changes in the next 5 s (same intent: no more labels). This is the one assertion changed.

The tests the ticket lists are in the commit: `announceRate.test.ts` (hold, newest replaces, not-busy never delayed, last always spoken), `announcements.test.ts` (160 and 60 character limits), `components.test.tsx`, `player.test.tsx` (12-date run at Fast, at most one change per 1.5 s, last date said) and `Explorer.test.tsx`.

```
$ npm run lint
(oxlint: no warnings or errors)
$ npm test
 Test Files  64 passed (64)
      Tests  1203 passed (1203)
$ npm run build
✓ built in 362ms
$ npx vitest run src/components src/describe src/features/player src/features/explore
 Test Files  15 passed (15)
      Tests  325 passed (325)
```

Not done: the manual screen-reader check (H08), as the ticket says.

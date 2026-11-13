# IX02 What's here on demand

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | IX01, SN10 |
| **Hotspots** | explorer |
| **Branch** | `feature/IX02-whats-here` |

## Goal

The listener presses `I` (or long-presses, right-clicks, or presses X on a gamepad) and hears and reads what is under the cursor. A second press within 4 s gives where it is and what is around it. Escape stops any speech. Nothing speaks unless asked.

## Why

- Words were attached to every move. `src/features/explore/useExplorer.ts:166` speaks the cell on each move, which IX01 removes. Something must replace it for the listener who wants words.
- `describeCell` (`src/describe/`) and `describePlace` (used in `useExplorer.ts:242`) already exist and are never asked for on demand.
- Escape does not stop speech on its own; `src/features/welcome/speak.ts` uses `speechSynthesis` and nothing else cancels it.

## Design

- **Keys and devices.** `query` from IX01 (`I`, long press, right click, gamepad X). Nothing else is added to the shortcut list.
- **Two levels.** Level 1 is `describeCell(visualization, grid, col, row, { detail })`: what the place shows, in the data set's own words. Level 2 is `describePlace(grid, col, row)` plus a hot-spot sentence from SN10 when SN10 exports one; if it does not, level 2 is `describePlace` alone. A second `query` within 4 s moves from level 1 to level 2. After 4 s it starts again at level 1.
- **Verbosity.** A setting, `brief` (default) or `full`, stored in `localStorage` under `earth-jukebox:verbosity`. `brief` starts at level 1; `full` starts at level 2. The setting is a two-option radio group in `ExplorerPanel`, labelled "Words for What's here".
- **Output.** The text goes to `useAnnounce` (the screen reader) and into a visible `<p>` under the map, which stays until the next query.
- **Sound.** None. The map's sound is the answer to a move; words are the answer to a question.
- **Escape.** IX01's `stopSpeech` cancels pending queries and every speech stopper. The explorer registers a stopper that clears its own `announceTimer`.
- **Off the map.** With the explorer off, `query` does nothing and plays nothing.
- **Words.** No temperature or data-set words are written here. Use the manifest words through `describeCell` and `variableWords`.

## Reuse

- `src/describe/` (`describeCell`, `describePlace`, `detail.ts`).
- `src/components/useAnnounce.ts`; `src/components/Button.tsx`.
- `src/features/explore/useExplorer.ts`: `grid`, `cursor`, the existing `describePlace` call in `lock`.
- IX01's `useActionHandler`, `speech.ts` (`registerSpeechStopper`).

## Touches

- `src/features/explore/whatsHere.ts` (new, pure: the level and the 4 s rule) and `whatsHere.test.ts`.
- `src/features/explore/useExplorer.ts` (registers the `query` handler and the stopper).
- `src/features/explore/Explorer.tsx` (the visible text and the verbosity radio group).
- `src/features/explore/Explorer.test.tsx`.

## Steps

1. Write `whatsHere.ts`: `nextLevel(previous, now)` returns 1 or 2, and `startLevel(verbosity)`.
2. Register `useActionHandler('query', ...)` in `useExplorer.ts`. It reads `grid`, `cursor` and the current `visualization`, and builds the text with `describeCell` or `describePlace`.
3. Call `announce(text)` and set the visible text. Do not change the sound.
4. Register a speech stopper that clears the pending query and `announceTimer`.
5. Add the verbosity radio group to `ExplorerPanel`.

## Tests

- `whatsHere.test.ts`: a first query is level 1; a second within 4 s is level 2; after 4 s it is level 1 again; `full` starts at level 2.
- `Explorer.test.tsx` (Testing Library, `userEvent`): with the map focused, `I` announces the level 1 text (`liveText()`) and shows it; `I` a second time gives level 2; Escape after a query stops the pending text; `I` with the explorer off does nothing.
- Regression: arrow moves still make no announcement (IX01).
- Storage: `full` survives a remount; blocked storage falls back to `brief`.
- Pointer: a long press on a cell gives the query (`userEvent.pointer` with fake timers advanced 500 ms).
- `expectNoA11yViolations` on the explorer panel with the visible text and the radio group.

## Guardrails

- The same input gives the same text: the words depend only on the grid, the cursor and the verbosity.
- No sound is made by this ticket, so the peak rule is met by not adding any.
- Every word the listener asks for is in a visible `<p>` and in the live region.
- Changes are announced through `useAnnounce`; nothing is spoken on its own.
- No data-set names, units or colours in `src/`: the words come from `describe/` and the manifest.

The five principles, for this ticket:
1. Words are not the first answer: this ticket adds no sound, and the map's sound is unchanged.
2. Sound first, words on request: this is the words-on-request path. Nothing speaks automatically.
3. Escape stops speech, and the query can always be repeated or ignored.
4. The same action comes from keys, touch, mouse and gamepad through IX01.
5. Learn by doing: IX11 teaches `I` in its first minute.

## Done when

- `I`, a long press, a right click and gamepad X each give level 1 once; a second within 4 s gives level 2.
- Escape stops a pending query and speech.
- Verbosity `full` starts at level 2; the choice survives a reload.
- All tests above pass, and the a11y check passes.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A spoken voice for the words (the voice guide, V01/G04). This ticket uses the screen reader only.
- New sentences for hot spots (SN10). Level 2 uses what SN10 exports, or `describePlace`.
- Any change to the sound map's sound.

## Result

Built by agent D on `feature/IX02-whats-here`, 13 Nov 2026, from `main` at `7ad1e64`.

**What changed**

- `src/features/explore/whatsHere.ts` (new, pure): `QUERY_REPEAT_MS` (4000), `startLevel(verbosity)`, `nextLevel(previous, now, verbosity)`, `parseVerbosity`, and `whatsHereText`. Level 1 is `describeCell(…, { detail })`. Level 2 is `describePlace` as a sentence ("North-east, column 5, row 1."). A second question within 4 s of the last gets level 2, and after that the next question starts again. A clock that went backwards also starts again.
- `src/features/explore/useExplorer.ts`: a `query` handler. It does nothing with the explorer off or the map not read, and makes no sound. It announces the text through `useAnnounce` and keeps it for the panel. A speech stopper (`registerSpeechStopper`) clears `announceTimer` and forgets the last question, so after Escape the next `I` is level 1 again. "Words for What's here" is stored under `earth-jukebox:verbosity`; blocked storage gives Brief. Turning the explorer off clears the answer.
- **Long press fix:** lifting the finger after a long press used to announce the cell (`onRelease`). That would say the plain sentence over the answer, and over level 2. The release is now silent when that press asked the question. A plain press and lift still says the cell, as before.
- `src/features/explore/Explorer.tsx`: the answer in a `<p class="explorer__here">` at the top of the panel, under the map. It is not a live region, because the announcer already says it. Below it, a `ButtonGroup` radio group "Words for What's here" (Brief, Full).
- **Outside Touches, as IX01 asks:** `src/interaction/shortcuts.ts:4` says the ticket that handles a routed key flips it to listed. So `I` and gamepad X are now listed: they show in the shortcuts dialog and in the map's instructions ("I: Ask what is here."). In `shortcuts.test.ts`, `query` and `pad-x` move from the "later" list to the listed one. That's three one-line changes.

**Level 2, built as written.** SN10's hot-spot sentences (`hotspotMarkers`) need a frame's `FrameFeatures`, which the sound map does not read, so level 2 is `describePlace` alone, as the ticket's fallback says. With the default detail, level 1 already gives the column and row, so level 2 adds nothing, and "Full" says less than "Brief". Asked on the board: R-20261113-IX02-1 (a neighbours sentence in `src/describe/`, for Roni).

**Tests:** `whatsHere.test.ts` (13): first question, within 4 s, after 4 s, the clock going backwards, full, parsing, and the words at both levels. `Explorer.test.tsx` (10 new):
- `I` says and shows level 1, and a second `I` gives level 2, with no sound.
- After 4 s it is level 1 again.
- It answers for the cursor's place, and arrows still say nothing.
- Escape forgets the question.
- With the explorer off (never on, or turned off) nothing happens.
- The query action, as gamepad X sends it, is answered.
- A long press answers, and the lift does not overwrite the answer. A right click answers, and a second one gives level 2.
- Full starts at level 2 and survives a remount.
- Blocked storage gives Brief.
- `I` is in the instructions, and there are no a11y violations with the answer and the radio group shown.

With the release guard removed, the long-press test fails ("January 2024. Cold, …" over the answer).

**Checks.** On this laptop the default `npm test` (8 vmThreads workers) runs out of memory (about 650 MB free), so the suite ran as `npx vitest run --pool=forks --maxWorkers=1`. Same tests, one process.

```
$ npm run lint
> moon-heist@0.0.0 lint
> oxlint
(exit 0)

$ npx vitest run --pool=forks --maxWorkers=1
 Test Files  152 passed (152)
      Tests  2407 passed (2407)
   Duration  532.89s

$ npm run build
✓ built in 1.25s

$ npx vitest run src/features/explore src/interaction --pool=forks --maxWorkers=1
 Test Files  15 passed (15)
      Tests  216 passed (216)
```

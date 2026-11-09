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

Not started.

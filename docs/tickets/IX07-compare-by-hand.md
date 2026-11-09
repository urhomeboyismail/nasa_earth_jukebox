# IX07 Compare by hand: date A in the left ear, date B in the right

| | |
|---|---|
| **Priority** | P1 |
| **Size** | S (under half a day) |
| **Who** | agent |
| **Needs** | IX01, SN04 |
| **Hotspots** | explorer |
| **Branch** | `feature/IX07-compare-by-hand` |

## Goal

On the sound map, the listener sets date A and date B, then holds `A` to hear the place under the cursor on date A in the left ear, and holds `B` to hear date B in the right ear. Both held: both ears at once. Releasing stops that ear.

## Why

- The Compare page (`src/features/compare/index.tsx`) plays A then B in sequence and answers a question. There is no way to compare two dates by ear while exploring the map.
- SOUND_MAPPINGS §5 (`docs/SOUND_MAPPINGS.md:95-104`) asks for A in the left ear and B in the right. The ear is the comparison; the sequence is not.
- T100 "both dates at once" was archived (`docs/archive/README.md`) and is replaced by this ticket.

## Design

- **State.** `compare: { a: string | null; b: string | null }`, dates as frame ids. Both start unset. Date A is set with `Shift+A` (`compareSet` for `A`) to the date on screen; date B with `Shift+B`. A hold with no date set plays nothing and shows the visible text "Set date A with Shift+A first."
- **Hold.** `compareHold` with `held: true` on keydown starts a held note through SN04's `hold` (see Reuse): the note of the cursor's place on that date (`noteForPosition`, IX01 `notes.ts`), panned −1 for A and +1 for B (stereo pan, whatever the spatial mode is). `held: false` on keyup releases that note. Blur of the map, Escape (IX01 `stopSpeech`) and the page closing also release both.
- **Feedback.** Setting A or B plays the `move` note of the cursor's place, once. No label earcon here (AU-UI adds those).
- **Gamepad.** LT is held for A, RT for B (IX01).
- **Words.** The visible line shows "A: March 2024. B: not set." and updates when set.
- **Undo.** Setting a date is recorded with `recordUndo`.

## Reuse

- SN04's `hold(tone | null, atTime)`. It takes one tone at a time, and SN09 uses it for the explorer's continuous tone. Compare needs two held tones at once (A left, B right). Before you start, post on `docs/AGENT-BOARD.md` to the SN04 owner asking for two named holds (for example a `slot: 'A' | 'B'` argument). Do not change `hold` or SN09's tone in this ticket. Until the answer is in, set `blocked: needs SN04 two holds`.
- IX01's `notes.ts` (`noteForPosition`).
- `src/features/explore/useExplorer.ts`: `cursor`, `grid` and the cell lookup (`cellAt`), and `panForPoint` (`src/audio/pan.ts`) for the pan.
- IX01: `compareHold`, `compareSet`, `recordUndo`, `stopSpeech`.
- `src/features/explore/Explorer.test.tsx` helpers.

## Touches

- `src/features/explore/compare.ts` (new, pure: the state and the set and clear rules) and `compare.test.ts`.
- `src/features/explore/useExplorer.ts`: the handlers, and the release on blur. Keep the explorer's cursor code as it is.
- `src/features/explore/Explorer.tsx`: the visible line and the two buttons "Set A to this date" and "Set B to this date" (the same actions as the keys, for touch and screen readers).
- `src/features/explore/Explorer.test.tsx`.

## Steps

1. Write `compare.ts`: `setSide(state, side, frameId)`, `clearSide(state, side)`, and `describeCompare(state)` for the visible text.
2. Register `compareSet` and `compareHold` in `useExplorer.ts`. The hold starts a note on `held: true` (ignore a repeated keydown: `event.repeat` is filtered in IX01) and stops it on `held: false`.
3. Add the two buttons and the line to `ExplorerPanel`.
4. On blur or Escape, release both notes.

## Tests

- `compare.test.ts`: setting, clearing, and the text for each state.
- `Explorer.test.tsx` (`userEvent.keyboard`): `{Shift>}a{/Shift}` sets A; `{a>}` starts a note with pan −1 on the fake engine; `{/a}` stops it (the note's release is called). `B` likewise with pan +1. Both held: two notes, one each side.
- A hold with no date set plays nothing and shows the text.
- Blur releases the notes.
- Buttons "Set A to this date" and "Set B to this date" do the same as the keys.
- `expectNoA11yViolations` on the panel.

## Guardrails

- The same input gives the same notes and pans. Nothing is random.
- Peak at or below −1 dBFS; no sound before a key press or click.
- Nothing flashes.
- Every sound has its text: the visible line names which date is in which ear.
- Changes are announced through `useAnnounce` only when the listener asks (with I, IX02).
- No data-set name in `src/`.

The five principles, for this ticket:
1. A held note starts at once, within the budget.
2. Sound first: the two ears are the answer; the words are the visible line.
3. Releasing the key stops the sound, and Escape stops both.
4. Keys, buttons and gamepad triggers call the same handlers.
5. The listener learns "left is A, right is B" by hearing it.

## Done when

- Shift+A and Shift+B set the dates; holding A and B plays each in its ear; releasing stops it.
- Blur and Escape release both notes.
- All tests pass and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- Comparing more than two dates.
- The label sounds for A and B (AU-UI).
- Changes to the Compare page.

## Result

Not started.

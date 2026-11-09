# IX06 Scrub time with sound, draggable scan line, keyboard mixer, My mix

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | SN07, SN08 |
| **Hotspots** | player |
| **Branch** | `feature/IX06-scrub-and-sculpt` |

## Goal

The listener moves through time by ear: each date step plays a short slice of that date's music. The scan line can be dragged across the map. The Symphony mixer works from the keyboard (1 to 7 solo, Shift+1 to 7 mute). The listener's mix can be saved and recalled as "My mix".

## Why

- The date slider and the arrow keys (`src/features/player/index.tsx:126-131`) move the picture and stay silent until playback starts. Scrubbing by ear is the missing loop.
- SN07 adds a mixer. Its controls are pointer controls. The keyboard route is not built.
- Nothing saves a listener's mix.

**Scan line.** SN08 (Scan mode) draws a scan line across the frame. SN08 is not in this ticket's Needs. If SN08 is not `done` when you claim this ticket, build the scrub and the mixer first, post on `docs/AGENT-BOARD.md` for the scan line, and mark the scan-line part as `blocked`. Do not draw a second scan line.

## Design

- **Scrubbing (IX01 `scrubTime`).** Alt+Left and Alt+Right move one date (`by: −1, +1`); Alt+Home and Alt+End go to the first and last date (`to`). Each step plays a 150 ms slice of the target date's music: `playNotes(notesOf(musicFrame, 0.15))` (IX01 `notes.ts`). The call releases itself, so no silent frame is needed. Holding a key repeats at 8 steps a second. Each slice starts within `ANSWER_BUDGET_MS` of the key. The date changes on screen at the same time (`player.goTo`).
- **Scan line.** SN08 draws it. This ticket lets the listener drag it with a pointer, and move it with Left and Right when it has focus. Its position chooses the column that sounds (the `move` feedback from IX01, through `playNotes`), so dragging sounds the column under it.
- **Keyboard mixer.** `voice` actions (IX01): `solo` on 1 to 7 toggles solo for that voice; `mute` on Shift+1 to 7 toggles mute. SN07's `VoiceMixer` already holds the state, and this ticket calls the same state through SN04's `ensemble.solo(voice | null)` and `ensemble.mute(voice, muted)`. It does not build a second mixer. A solo plays one melody note once (120 ms, `playNotes`); a mute plays the same note once, a fifth lower. Each change is recorded for undo (IX01 `recordUndo`). The mixer shows each voice's state as text ("Harmony: solo") and a button for each.
- **My mix.** The levels, solo and mute for the seven voices are saved under `earth-jukebox:my-mix`, validated with zod on read. Buttons: "Save my mix", "Recall my mix", "Reset the mix". A saved mix that names a voice SN04 does not have is dropped, not guessed.

## Reuse

- SN07's `VoiceMixer` and its mixer state (`symphony.ts`, names from SN07's ticket file).
- SN03's `MusicFrame` (per date); SN04's `playNotes`, `solo` and `mute`; SN05's `VoiceId`.
- IX01's `notes.ts` (`notesOf`, `noteForPosition`).
- IX01: `useActionHandler` for `scrubTime`, `voice`, `undo`; `recordUndo`; `ANSWER_BUDGET_MS`.
- `src/features/player/usePlayer.ts`: `goTo`, `index`, `frames`.
- `src/features/player/controls.ts`: nothing new is needed there.

## Touches

- `src/features/player/scrub.ts` (pure: the slice for a date and the step rules) and `scrub.test.ts`.
- `src/features/player/useScrub.ts` (the handlers) and a test.
- `src/features/player/mySoundMix.ts` (the store for "My mix", zod) and its test. No solo or mute logic here: it is SN07's.
- `src/features/player/index.tsx` and `player.test.tsx`: mount the hooks. The queue names `player`; this is the only hotspot.
- The scan-line drag goes in SN08's own component once SN08 is `done`, through a prop the player passes. Do not edit SN08's files without asking its owner.

## Steps

1. Write the pure parts first: `scrub.ts` (the date after a step, the clamp at the ends, the slice length of 150 ms) and `mySoundMix.ts` (the zod store).
2. Register the `scrubTime` handler: move the date, then call `playNotes` with the slice.
3. Register the `voice` handler: update the mixer, play the feedback note, record undo.
4. Add the "My mix" buttons and the mixer list in the Symphony panel.
5. When SN08 is `done`, add the drag and the Left and Right keys to the scan line through its prop.

## Tests

- `scrub.test.ts`: the step stays within the dates; `first` and `last` go to the ends; the slice is 150 ms.
- `mySoundMix.test.ts`: a saved mix round-trips; an unknown voice id is dropped; corrupt data gives the default mix.
- Mixer keys: a solo or mute key calls SN04's `solo` or `mute` on the fake ensemble, and undo restores the previous state (SN07's mixer is tested in SN07).
- `useScrub` (`userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}')`): the date changes by one, and the fake engine gets one `playNotes` call with notes of 150 ms, within the budget (fake timers: no timer advanced before the call).
- Mixer keys: `{Shift>}1{/Shift}` mutes voice 1 (the `code` is used, so Shift does not change the key).
- Scan line drag: in SN08's test, once SN08 is done.
- `expectNoA11yViolations` on the Symphony panel.

## Guardrails

- The same input gives the same slices and the same mix. Nothing is random.
- Peak at or below −1 dBFS; no sound before a key press.
- Nothing flashes; the scan line does not animate under reduced motion.
- Every sound has its text: each slice is the date's visible label and the Date slider's value; the mixer's state is written out in the list.
- Changes are announced through `useAnnounce` only on request (the mixer list is the text).
- No data-set name in `src/`.

The five principles, for this ticket:
1. A scrub step sounds within the 50 ms budget.
2. Sound first: the slice is the answer; words are the visible date and the mixer list.
3. Every change is undoable, and Escape stops the slice.
4. The same actions come from keys, touch (the slider and drag) and gamepad (D-pad left and right).
5. The mixer teaches the voices by letting the listener hear each one alone.

## Done when

- Alt+Left and Alt+Right step the dates with a sound each, within the budget in the test.
- The seven voices solo and mute from the keyboard, with undo.
- My mix saves, recalls and resets on this device; a corrupt store is ignored.
- The scan-line drag is either done or recorded as blocked on SN08 (no partial line).
- All tests pass, and the checks are green.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- A new mixer design (SN07 owns the look) or any new voice.
- Per-voice effects, automation or recording (IX08 records the whole exploration).
- Changing how SN03 builds music.

## Result

Not started.

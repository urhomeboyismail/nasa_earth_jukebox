# IX01 Input layer and key map

| | |
|---|---|
| **Priority** | P1 |
| **Size** | M (about a day) |
| **Who** | agent |
| **Needs** | S01, SN03, SN04 |
| **Hotspots** | explorer, player |
| **Branch** | `feature/IX01-input-layer` |

## Goal

Every key, touch, mouse and gamepad action on Listen becomes one `Action` value. One dispatcher runs the handlers that other tickets register. Each action with a sound answers within 50 ms, and a move makes a sound, not a sentence.

**Needs SN04 in practice.** The 50 ms answer uses SN04's `playNotes` (default lead 20 ms from the audio clock, `INTERACTIVE_LOOKAHEAD_S`, not Tone's look-ahead). It also reads SN03's melody constants and `snapToScale`. If SN04 or SN03 is not `done` when you claim this ticket, set `blocked: needs SN04` (or SN03) and post on `docs/AGENT-BOARD.md`. Do not write a second engine here.

**Two tickets change the explorer's sound.** SN09 (continuous tone under the cursor, using `ensemble.hold`) owns the explorer's continuous tone. This ticket owns the keys, the gestures, the words and the one-note fallback sounds. If SN09 is `done` first, a move's sound is SN09's tone (and this ticket's `move` note is used only where SN09's tone is off, as SN09 specifies).

## Why

- Every move speaks a sentence. `src/features/explore/useExplorer.ts:166` calls `announceCell(next, ANNOUNCE_AFTER_MS)` on each move, and `:173` speaks the edge name. The listener hears words where the sound should be.
- A sound can wait up to 120 ms. `useExplorer.ts:15` sets `PLAY_EVERY_MS = 120`, applied in `soundCell` (`:154`). Immediate notes use `now()`, which adds Tone's look-ahead (about 100 ms, `src/audio/engine.ts:425`).
- Keys are spread over two places with no shared list: the explorer's `onKeyDown` (`useExplorer.ts:325-349`, with `MAP_KEYS` at `:25`) and the player's (`src/features/player/index.tsx:114-133`). The letter `T` works anywhere on the Listen page, which is a single-key shortcut outside the map (WCAG 2.1.4). `Escape` both stops sound and unlocks (`useExplorer.ts:346`).
- The explorer's instructions (`src/features/explore/Explorer.tsx:51-55`) are typed by hand, so they drift from the handlers.
- There is no pointer long press, no two-finger gesture and no gamepad anywhere.

## Design

### The `Action` union (`src/interaction/actions.ts`)

This is the only definition. Other IX tickets add a member only when they need one, and say so in their own Touches.

```ts
import type { VoiceId } from '../data/sonification' // SN05: the seven voice ids

export type Action =
  | { type: 'move'; dx: number; dy: number }                  // cells on the sound map; Shift = 4
  | { type: 'moveTo'; col: number; row: number }              // pointer, touch, sliders
  | { type: 'sweep'; line: 'row' | 'column' }                 // Enter, Shift+Enter
  | { type: 'replayPlace' }                                   // R
  | { type: 'lock' }                                          // L: lock or unlock this place
  | { type: 'trace' }                                         // T: trace the warm edge (change style)
  | { type: 'scrubTime'; by: number }                         // dates: Alt+Left/Right, Left/Right off the map, D-pad
  | { type: 'scrubTime'; to: 'first' | 'last' }               // Alt+Home, Alt+End
  | { type: 'transport'; command: 'play' | 'pause' | 'toggle' } // Space
  | { type: 'stopSpeech' }                                    // Escape, two-finger tap, gamepad B
  | { type: 'query' }                                         // I, long press, right click, gamepad X (IX02)
  | { type: 'mark' }                                          // M (IX08)
  | { type: 'voice'; voice: VoiceId; how: 'solo' | 'mute' }   // 1 to 7, Shift+1 to 7 (IX06)
  | { type: 'follow'; step: 'toggle' | 'next' | 'previous' }  // H, [, ] (IX03)
  | { type: 'find'; command: 'start' | 'stop' | 'toggle' }    // F (IX04)
  | { type: 'compareHold'; side: 'A' | 'B'; held: boolean }   // hold A or B (IX07)
  | { type: 'compareSet'; side: 'A' | 'B' }                   // Shift+A, Shift+B (IX07)
  | { type: 'undo' }                                          // Ctrl+Z, Cmd+Z, gamepad View
  | { type: 'openShortcuts' }                                 // ? (the S01 dialog reads the same list)
```

IX09 adds `{ type: 'point'; target: string }`. Nothing else is added here.

### One shortcut list (`src/interaction/shortcuts.ts`)

`SHORTCUTS` is the only list of keys in the app. The keyboard matcher, the gamepad matcher, the map's instructions and the S01 dialog all read it, so they cannot drift.

S01 has already written a shortcut list in `src/features/player/shortcuts.ts` (fields `id`, `scope`, `keys`, `does`, `note`) with its own dialog. This ticket moves that list to `src/interaction/shortcuts.ts`, keeps S01's field names so the dialog reads it unchanged, and deletes the old list (or makes it re-export the new one), in the same PR. If S01 is not merged when you start, stop and post on the board: a second list is what this ticket forbids.

```ts
export type Shortcut = {
  id: string
  keys: string                 // as shown to people: 'Shift + 1 to 7', 'Alt + Left'
  does: string                 // what it does, in plain words (S01's field name)
  note?: string                // e.g. 'Works only while the sound map has focus' (S01's field name)
  device: 'keyboard' | 'touch' | 'mouse' | 'gamepad'
  /** 'map': the sound map has focus. Single printable characters are always 'map' (WCAG 2.1.4). 'listen': anywhere on Listen but not in a field. 'anywhere': Escape only. */
  scope: 'map' | 'listen' | 'anywhere'
  match: (input: KeyInput) => Action | null
}
export const SHORTCUTS: Shortcut[]
export function shortcutsFor(scope: Shortcut['scope'] | 'all'): Shortcut[]
```

The keyboard list (`match` uses `event.code` for digits and letters, so Shift does not change them):

| Keys | Action | Scope | Owner |
|---|---|---|---|
| Arrow keys | `move` one cell | map | IX01 |
| Shift + arrow | `move` four cells | map | IX01 |
| Home, End | `moveTo` the west or east edge of the row | map | IX01 |
| Page Up, Page Down | `moveTo` the north or south edge of the column | map | IX01 |
| Enter, Shift + Enter | `sweep` the row west to east, or the column north to south | map | IX01 |
| Space | `transport` toggle (not on buttons, links or fields, which keep Space) | listen | IX01 |
| R | `replayPlace` | map | IX01 |
| L | `lock` | map | IX01 |
| T | `trace` (change style only) | map | IX01 |
| I | `query` | map | IX02 |
| M | `mark` | map | IX08 |
| F | `find` toggle | map | IX04 |
| H | `follow` toggle | map | IX03 |
| [, ] | `follow` previous, next | map | IX03 |
| A, B (hold) | `compareHold` | map | IX07 |
| Shift + A, Shift + B | `compareSet` | map | IX07 |
| 1 to 7 | `voice` solo | map | IX06 |
| Shift + 1 to 7 | `voice` mute | map | IX06 |
| ? | `openShortcuts` | map | IX01 |
| Alt + Left, Alt + Right | `scrubTime` by -1, +1 | listen | IX06 |
| Alt + Home, Alt + End | `scrubTime` to first, last | listen | IX06 |
| Left, Right (focus not on the map) | `scrubTime` by -1, +1 (the player's existing keys) | listen | IX01 |
| Ctrl + Z, Cmd + Z | `undo` (not in a field) | listen | IX01 |
| Escape | `stopSpeech` | anywhere | IX01 |

Gamepad (Standard mapping; only when `gamepad.mapping === 'standard'`): left stick moves in both axes, held at 8 cells a second; D-pad up and down `move` one cell; D-pad left and right `scrubTime` by one date; A `transport` toggle; B `stopSpeech`; X `query`; Y `mark`; LB and RB `follow` previous and next; LT and RT held `compareHold` A and B; L3 `lock`; R3 `replayPlace`; View `undo`; Menu `find` toggle. Stick deadzone 0.25.

Touch and mouse: a tap or click on a place is `moveTo` and sounds it. A drag is `moveTo` as the finger or pointer moves. A long press (500 ms, moved less than 10 px) is `query`. A two-finger tap is `stopSpeech`. A right click is `query`.

Rules the list must keep, and a test checks:
- No two entries in the same scope match the same key.
- Every entry whose `keys` is one printable letter, digit or symbol has scope `map`. Space is the one exception: it is the transport key on Listen, active only while focus is inside Listen and not on a button, link or field. Its `note` says so.

### Dispatch (`src/interaction/registry.ts`)

- `dispatch(action)` runs every handler registered for `action.type`, in registration order, synchronously. Nothing is queued, so a test can see the result on the same tick.
- `useActionHandler(type, handler)` registers a handler in an effect and removes it on unmount. Keep handlers stable with `useCallback`. Registering is not `setState`, so it is allowed in an effect.
- An action with no handler is ignored and does nothing else.
- `resetActionHandlers()` is for tests only.

Sources, in `src/interaction/useInput.ts`: keyboard on the map surface and on the Listen section, pointer events on the map surface, and gamepad polling with `requestAnimationFrame` while Listen is mounted and a gamepad is connected. Each source only builds an `Action` and calls `dispatch`. A source never changes the sound or the words itself.

Gestures are a pure state machine in `src/interaction/gestures.ts` (no DOM), with `LONG_PRESS_MS = 500`, `MOVE_TOLERANCE_PX = 10`, `TWO_FINGER_MS = 300`.

### Undo (`src/interaction/history.ts`)

`recordUndo(label, undo)` and `undoLast()`, a stack of at most 50. Each handler that changes state records its own undo (cursor moves here; lock, solo and mute, marks and follow in their tickets). The `undo` handler pops one entry, runs it, and plays the `undo` feedback sound. Undo itself is not announced in words: it is a result of the listener's own action.

### Speech (`src/interaction/speech.ts`)

- `stopSpeech()` calls `speechSynthesis.cancel()` when it exists and every stopper registered with `registerSpeechStopper(fn)` (returns an unregister function). The voice guide's playback and `src/features/welcome/speak.ts` register themselves in their own tickets. Escape cannot silence a screen reader; say so in the shortcut's label.
- `createSpeechGate(gapMs = 4000)` returns `allow(now)`. An automatic utterance (an event sentence from SN10, a lost hot spot) is spoken only if the gate allows it, and is dropped otherwise, never queued. A sentence the listener asked for skips the gate.

### Feedback sounds (`src/interaction/feedback.ts`)

Every answer is a sound, played at once through SN04's `playNotes` (or `playDropout` for missing data), never through `apply`, which waits for a frame.

**The note of a place** (`src/interaction/notes.ts`, pure, shared by IX03 to IX09): `noteForPosition(position, preset)` takes a place's position across the legend (0 to 1, from its value and the colour scale's first and last stops) and returns `snapToScale(MELODY_LOW_MIDI + position × MELODY_SPAN, preset, low, high)`, with the constants and `snapToScale` from SN03. The preset is the data set's `sonification.preset` (SN05), or `major` when there is none. `notesOf(frame, seconds)` turns a `MusicFrame` (SN03) into `NoteEvent`s (melody, harmony and hot spots) for the scrub, follow and predict tickets. `cellOfFraction(x, y, area, cols, rows)` turns a place given as image fractions (SN01's `hotspots[].centroid`, `peakPosition`, and the strongest edge) into the sound map's cell, clamped to the grid. SN01 gives image fractions, not grid cells, so every ticket that places something on the map uses this function. None of these functions is written again elsewhere.

| Name | When | Sound (SN04 call) |
|---|---|---|
| `move` | a place is sounded | `playNotes` with the place's note, 120 ms, level 0.5, panned to its column and raised by its row (3D only) |
| `edge` | a move would leave the map | two `playNotes` calls with the same note, 60 ms each, at now and now + 0.08 s; the second an octave lower |
| `missing` | the place has no data | `playDropout()`: SN04's seeded dropout (never noise) |
| `lock` | L locks | `playNotes` with the note and the fifth above it together, 250 ms |
| `unlock` | L unlocks | the fifth, then the note, two calls 0.12 s apart |
| `mark` | M marks | `playNotes` with one note at the top of the melody range (`MELODY_LOW_MIDI + MELODY_SPAN`, snapped), 500 ms |
| `undo` | a step is undone | `playNotes` with the restored place's note, 120 ms, level 0.3 |
| `stop` | Escape, two-finger tap, gamepad B | nothing: the sound stops (`stop` and `playNotes` are not called) |

SN04 has no bell voice; the `mark` is a single bright note instead. The test checks that every call uses a note from `notes.ts`, so the sounds stay in the data's pitch range and nothing plays a noise.

### The 50 ms budget (`src/interaction/budget.ts`)

- `ANSWER_BUDGET_MS = 50`: a sound answer starts within this of the input event.
- `MOVE_GAP_MS = 50`: sounds for moves arrive at most this often. The first move after a pause plays at once. A move during the gap waits, and only the latest place plays, at the end of the gap. This replaces `PLAY_EVERY_MS = 120`.
- No feedback sound waits for a timer except the gap above.

### Explorer changes (`src/features/explore/`)

- `moveTo` no longer announces (`:166`). `hitEdge` plays `edge`, not words (`:170-173`). The lock message (`:242`) is replaced by the `lock` sound; `describePlace` is kept for IX02. The move-while-locked message (`:180`) becomes the `edge`-style sound too, with the visible line kept.
- `Escape` stops speech, sound and held keys. It no longer unlocks the place; `L` does (today `useExplorer.ts:346` does both).
- Space is `transport` toggle. The old Space (replay this place) moves to `R`. This is a visible change: Space plays and pauses everywhere on Listen, as the principles say.
- The instructions text is built from `shortcutsFor('map')`, not typed out.
- The surface keeps `role="application"` and `aria-roledescription="sound map"`. Its `aria-describedby` text adds the direct-touch hint for VoiceOver and TalkBack: "Direct touch: drag to hear each place. Long press for what's here. Two fingers tap to stop." Confirm the behaviour on real devices in H08; do not claim it here.

## Reuse

- `src/features/explore/useExplorer.ts`: `place`, `soundCell`, `moveTo`, `sweep`, `lock`, `playLockedAt` and the cursor state stay. Only the key and announce paths change.
- `src/features/explore/Explorer.test.tsx`: the hoisted `engine` mock, `tick()`, `liveText()` and `surface()` helpers.
- `src/features/player/index.tsx`: `isEditable`, `isField`, `isTyping`, `spaceActivates` (the rules about which keys belong to a field or a button).
- `src/components/useAnnounce.ts`, `src/describe/` (`describeCell`, `describePlace`).
- `src/test/fakes.ts` (`installFakeAudioContext`), `src/test/a11y.ts` (`expectNoA11yViolations`).

## Touches

- `src/interaction/` (new): `actions.ts`, `shortcuts.ts`, `keys.ts`, `gestures.ts`, `gamepad.ts`, `registry.ts`, `useInput.ts`, `history.ts`, `speech.ts`, `notes.ts`, `feedback.ts`, `budget.ts`, and a test file next to each.
- `src/features/player/shortcuts.ts` (S01's list, replaced or made a re-export) and `ShortcutsDialog.tsx` (its data source only). These are S01's files.
- `src/features/explore/Explorer.tsx`, `useExplorer.ts`, `Explorer.test.tsx`.
- `src/features/player/index.tsx` and `player.test.tsx`: the Listen keys move to `useInput`. The queue's hotspot list names only `explorer`; this file also changes `player/index.tsx`, so no other player ticket runs at the same time. Say so in the PR.
- `docs/AGENT-BOARD.md`: a request to the team leader to add `src/interaction/` (owner: Mohammad) to the ownership table in `docs/PLAN.md` §4, and an `Action` entry in §5.

## Steps

1. Write the pure parts first, with their tests: `actions.ts`, `shortcuts.ts` and `keys.ts` (the table above), `gestures.ts`, `gamepad.ts` (button edges, a repeat rate of 8 a second, deadzone), `history.ts`, `budget.ts`, `speech.ts` (gate and stoppers).
2. Write `registry.ts` and `useInput.ts`, then `notes.ts` and `feedback.ts`. `feedback.ts` calls SN04's `playNotes` and `playDropout` and no other audio function.
3. Move the explorer's key and pointer handling to `dispatch`. Register the `move`, `moveTo`, `sweep`, `replayPlace`, `lock`, `stopSpeech` and `undo` handlers in `useExplorer.ts`.
4. Move the player's Space, Left, Right, Alt and Escape handling to `useInput`. Keep the existing player behaviour for fields and buttons.
5. Replace the instructions text with one built from `shortcutsFor('map')`.
6. Replace S01's list in `src/features/player/shortcuts.ts` with `src/interaction/shortcuts.ts` (same field names). S01's dialog and its test read `shortcutsFor('all')`. `openShortcuts` opens that dialog.

## Tests

- `shortcuts.test.ts`: every row of the table matches its action; no key is bound twice in one scope; every single printable key has scope `map`.
- `gestures.test.ts`: a 500 ms press without movement is `query`; a press that moves 11 px is not; a two-finger tap is `stopSpeech`; a drag produces `moveTo`.
- `gamepad.test.ts`: a held button gives one action, not a stream; the stick repeats at 8 a second (fake timers).
- `registry.test.ts`: dispatch is synchronous; an unhandled action is ignored; unmounting removes the handler.
- `history.test.ts`: undo order, the limit of 50.
- `speech.test.ts`: the gate drops inside 4 s and allows after; `stopSpeech` calls the stub `speechSynthesis.cancel` and every stopper.
- **Latency** (`useExplorer` and `Explorer.test.tsx`, fake timers and `installFakeAudioContext()`): a keydown on the map calls `playNotes` before any timer is advanced. Ten moves within 20 ms: the first sounds at once, the last sounds within `MOVE_GAP_MS` after the last move.
- `Explorer.test.tsx` (updated): arrow moves make no announcement (`liveText()` stays empty); Space toggles playback; R replays the place; Escape stops the sound and does not unlock; L locks; the instructions text equals the list.
- Keyboard and pointer by `userEvent`: a Space press on a button still activates the button; a click on a cell sounds it.
- `expectNoA11yViolations` on the explorer and the player after the change.

## Guardrails

- The same input always gives the same output. Nothing is random in this ticket.
- Peak at or below −1 dBFS. No sound before a key press or a click (WCAG 1.4.2).
- Nothing flashes. Under `prefers-reduced-motion` nothing moves.
- Every sound has a text equivalent: the cue's name in the shortcut list, and the words on request through `I` (IX02).
- Changes are announced through `useAnnounce`. A move is not announced.
- Nothing specific to one data set goes in `src/interaction/` (`.claude/rules/phases.md`).

The five principles, for this ticket:
1. A sound answer within 50 ms: `playNotes` with its 20 ms lead, and `MOVE_GAP_MS`.
2. Sound first, words on request, rate-limited automatic speech: moves are sounds, the gate limits automatic speech.
3. The listener is in control: Space, Escape and undo work, and no key traps focus.
4. One input layer for every device: keys, touch, mouse and gamepad all go through `dispatch`.
5. Learn by doing: the list is the thing IX11 teaches.

## Done when

- The shortcut list is the only list of keys: the matcher, the gamepad, the map's text and S01's dialog all read it.
- A key, a tap, a long press, a two-finger tap and a gamepad button each produce one action through `dispatch`.
- A move makes a sound and no speech. The first sound of a press starts within 50 ms in the test.
- Space plays and pauses on Listen; R replays the place.
- Every test in the list passes. The explorer and the player pass the a11y check.

## Checks

```bash
npm run lint && npm test && npm run build
```

## Out of scope

- What I, M, F, H, A and B do (IX02 to IX07). This ticket only routes them.
- The shortcut dialog (S01).
- Words for any cell or place, beyond the existing `describeCell` already used by the instructions.
- Any layout or width change (`.claude/rules/platform.md`).
- Changing SN04's voices.

## Result

Not started.
